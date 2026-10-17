import crypto from 'node:crypto'
import type { CampaignStore } from './store.js'
import type { CampaignRecord, VideoJob } from './types.js'
import { dispatchToVideo, reconcileVideo } from './dispatcher.js'

export async function approveAndDispatch(store: CampaignStore, id: string) {
  const claimed = await store.update(id, record => {
    if (!(record.status === 'pending_approval' && !record.job) && !(record.status === 'dispatch_failed' && record.job?.state === 'rejected')) return null
    const now = new Date().toISOString()
    const job: VideoJob = { revision: 0, id: crypto.randomUUID(), state: 'dispatching', createdAt: now, updatedAt: now, channels: Object.fromEntries(record.posts.map(p => [p.channel, { status: ['website', 'pinterest'].includes(p.channel) ? 'draft_only' : 'unconfirmed' }])) }
    return { ...record, status: 'approved', updatedAt: now, job }
  })
  if (!claimed?.job) return false
  // Persist before network I/O. A process crash leaves a reconcilable hold, never an automatic replay.
  const outcome = await dispatchToVideo(claimed)
  await store.update(id, current => current.job?.id !== claimed.job!.id || current.job.state !== 'dispatching' ? null : ({
    ...current, status: outcome.state === 'rejected' ? 'dispatch_failed' : 'dispatched',
    job: { ...current.job, ...outcome, revision: current.job.revision + 1, updatedAt: new Date().toISOString() }
  }))
  return true
}

export async function reconcile(store: CampaignStore, id: string): Promise<CampaignRecord | null> {
  const record = await store.get(id)
  if (!record?.job || record.job.state === 'rejected') return record
  const updated = await reconcileVideo(record)
  return store.update(id, current => {
    if (current.job?.id !== record.job!.id || current.job.revision !== record.job!.revision) return null
    return { ...current, job: { ...updated, revision: current.job.revision + 1 } }
  })
}
