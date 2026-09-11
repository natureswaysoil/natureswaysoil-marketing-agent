import type { CampaignRecord } from './types.js'

export async function dispatchToVideo(campaign: CampaignRecord): Promise<void> {
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error('GITHUB_TOKEN is not configured')
  const owner = process.env.GITHUB_OWNER || 'natureswaysoil'
  const repo = process.env.VIDEO_REPOSITORY || 'video'
  const workflow = process.env.VIDEO_WORKFLOW || 'sheet-row-posting.yml'
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: 'main', inputs: { marketing_campaign: Buffer.from(JSON.stringify(campaign)).toString('base64url') } })
  })
  if (!response.ok) throw new Error(`Video workflow dispatch failed (${response.status}): ${await response.text()}`)
}
