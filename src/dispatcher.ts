import { unzipSync } from 'fflate'
import { z } from 'zod'
import type { CampaignRecord, VideoJob } from './types.js'

const config = () => ({ owner: process.env.GITHUB_OWNER || 'natureswaysoil', repo: process.env.VIDEO_REPOSITORY || 'video', workflow: process.env.VIDEO_WORKFLOW || 'sheet-row-posting.yml' })
function headers() { return { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' } }
async function github(path: string, init: RequestInit = {}) {
  if (!process.env.GITHUB_TOKEN) throw new Error('GitHub connection not configured')
  const { owner, repo } = config()
  return fetch(`https://api.github.com/repos/${owner}/${repo}/${path}`, { ...init, headers: headers(), signal: AbortSignal.timeout(15000) })
}
export async function dispatchToVideo(campaign: CampaignRecord): Promise<Pick<VideoJob, 'state' | 'note'>> {
  if (!campaign.job) throw new Error('Durable job required')
  if (!process.env.GITHUB_TOKEN) return { state: 'rejected', note: 'GitHub connection not configured; no request sent' }
  try {
    const response = await github(`actions/workflows/${config().workflow}/dispatches`, {
      method: 'POST', body: JSON.stringify({ ref: 'main', inputs: { marketing_job_id: campaign.job.id, marketing_campaign: Buffer.from(JSON.stringify(campaign)).toString('base64url') } })
    })
    if (response.ok) return { state: 'accepted', note: 'GitHub accepted the request; execution not yet confirmed' }
    // Only explicit client rejections permit retry. Timeout, rate-limit and server responses are uncertain.
    return { state: [400, 401, 403, 404, 422].includes(response.status) ? 'rejected' : 'unconfirmed', note: `GitHub HTTP ${response.status}; no response body retained` }
  } catch { return { state: 'unconfirmed', note: 'Dispatch response unavailable; reconcile before taking further action' } }
}
const Receipt = z.object({ schemaVersion: z.literal(1), jobId: z.string(), campaignId: z.string(), channels: z.record(z.object({ status: z.enum(['published', 'skipped', 'unconfirmed']), postId: z.string().min(1).max(500).optional() })) })
export async function reconcileVideo(record: CampaignRecord): Promise<VideoJob> {
  const job = structuredClone(record.job!)
  const finish = () => ({ ...job, updatedAt: new Date().toISOString() })
  try {
    if (!job.runId) {
      const candidates: { id: number }[] = []
      // Fail closed if the run is older than the bounded search; never infer identity from timing.
      for (let page = 1; page <= 5; page++) {
        const response = await github(`actions/workflows/${config().workflow}/runs?event=workflow_dispatch&per_page=100&page=${page}`)
        if (!response.ok) throw new Error('lookup')
        const data = await response.json() as { workflow_runs: { id: number; display_title: string; run_attempt: number }[] }
        candidates.push(...data.workflow_runs.filter(r => r.display_title === `marketing-job:${job.id}`))
        if (data.workflow_runs.length < 100) break
      }
      if (candidates.length !== 1) { job.note = candidates.length ? 'Multiple matching runs; manual review required' : 'No matching run yet; dispatch will not be replayed'; return finish() }
      job.runId = candidates[0].id
    }
    const response = await github(`actions/runs/${job.runId}`)
    if (!response.ok) throw new Error('run')
    const run = await response.json() as { status: string; conclusion: string | null; display_title: string; run_attempt: number }
    if (run.display_title !== `marketing-job:${job.id}`) throw new Error('identity')
    job.runUrl = `https://github.com/${config().owner}/${config().repo}/actions/runs/${job.runId}`
    job.state = run.status === 'completed' ? (run.conclusion === 'success' ? 'completed' : 'failed') : run.status === 'in_progress' ? 'running' : 'queued'
    job.conclusion = run.conclusion || ''
    job.note = 'Workflow state confirmed; channel results require a receipt'
    if (run.status !== 'completed') return finish()
    if (run.run_attempt !== 1) { job.note = 'Workflow was rerun; manual channel reconciliation required'; return finish() }
    const artifacts = await github(`actions/runs/${job.runId}/artifacts?per_page=100`)
    if (!artifacts.ok) throw new Error('artifacts')
    const data = await artifacts.json() as { artifacts: { id: number; name: string; expired: boolean; size_in_bytes: number }[] }
    const matches = data.artifacts.filter(a => a.name === `marketing-result-${job.id}` && !a.expired)
    if (matches.length !== 1 || matches[0].size_in_bytes > 1000000) return finish()
    // GitHub redirects to a signed artifact URL; fetch follows without forwarding Authorization cross-origin.
    const download = await github(`actions/artifacts/${matches[0].id}/zip`)
    if (!download.ok) throw new Error('download')
    const files = unzipSync(new Uint8Array(await download.arrayBuffer()), { filter: entry => entry.name === 'marketing-result.json' && entry.originalSize <= 65536 })
    const receipt = Receipt.parse(JSON.parse(new TextDecoder().decode(files['marketing-result.json'])))
    if (receipt.jobId !== job.id || receipt.campaignId !== record.id) throw new Error('receipt identity')
    for (const [channel, outcome] of Object.entries(receipt.channels)) {
      if (job.channels[channel] && job.channels[channel].status !== 'draft_only') job.channels[channel] = outcome.status === 'published' && !outcome.postId ? { status: 'unconfirmed' } : outcome
    }
    job.note = 'Channel receipt reconciled; unconfirmed outcomes require review, never automatic replay'
  } catch { job.note = 'Reconciliation unavailable; last known state retained and no work replayed' }
  return finish()
}
