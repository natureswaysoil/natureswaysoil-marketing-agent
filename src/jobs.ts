import type { CampaignStore } from './store.js'
import type { CampaignRecord } from './types.js'
import { reconcileVideo } from './dispatcher.js'

import { queuedJob } from './worker-store.js'
import { findProduct } from './catalog.js'
import { validateCampaignPolicy } from './policy.js'
export async function approveAndDispatch(store:CampaignStore,id:string){
 const claimed=await store.update(id,record=>{
  if(!(record.status==='pending_approval'&&!record.job)&&!(record.status==='dispatch_failed'&&record.job?.state==='rejected'))return null
  const product=findProduct(record.productId)
  if(!validateCampaignPolicy(record,product).ok)throw new Error('This legacy draft needs regeneration from the current catalog')
  return {...record,status:'approved',job:queuedJob(record),updatedAt:new Date().toISOString()}
 })
 return Boolean(claimed)
}

export async function reconcile(store: CampaignStore, id: string): Promise<CampaignRecord | null> {
  const record = await store.get(id)
  if (!record?.job || record.job.state === 'rejected' || record.job.transport === 'pull') return record
  const updated = await reconcileVideo(record)
  return store.update(id, current => {
    if (current.job?.id !== record.job!.id || current.job.revision !== record.job!.revision) return null
    return { ...current, job: { ...updated, revision: current.job.revision + 1 } }
  })
}
