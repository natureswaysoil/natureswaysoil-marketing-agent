import crypto from 'node:crypto'
import { Firestore } from '@google-cloud/firestore'
import type { CampaignRecord, VideoJob, ChannelOutcome } from './types.js'
import type { WorkerIdentity } from './worker-auth.js'
import { rotationDraft, rotationProduct } from './rotation.js'
export type AutomationState = { enabled:boolean; cursor:number; updatedAt?:string; lastCampaignId?:string; lastRunId?:string }
export type WorkerResult = { status:'claimed'; campaign:CampaignRecord } | { status:'paused'|'already_claimed' }
export type Report = {campaignId:string;jobId:string;success:boolean;channels:Record<string,ChannelOutcome>}
export interface WorkerStore {
 state():Promise<AutomationState>
 enable(enabled:boolean):Promise<void>
 claim(identity:WorkerIdentity,slot:string):Promise<WorkerResult>
 report(identity:WorkerIdentity,report:Report):Promise<void>
}
export function queuedJob(record:CampaignRecord):VideoJob {
 const now=new Date().toISOString()
 return {transport:'pull',revision:0,id:crypto.randomUUID(),state:'queued',createdAt:now,updatedAt:now,note:'Queued for the trusted video worker; no GitHub personal token required',channels:Object.fromEntries(record.posts.map(p=>[p.channel,{status:['pinterest','website'].includes(p.channel)?'draft_only':'unconfirmed'}]))}
}
export function assigned(record:CampaignRecord,identity:WorkerIdentity,now:string):CampaignRecord {
 const job=record.job||queuedJob(record)
 return {...record,status:'dispatched',updatedAt:now,job:{...job,transport:'pull',state:'running',runId:Number(identity.runId),runUrl:`https://github.com/natureswaysoil/video/actions/runs/${identity.runId}`,updatedAt:now,note:'Trusted video worker claimed this job; interrupted work is never automatically replayed'}}
}
export function applyReport(record:CampaignRecord,report:Report,now:string):CampaignRecord {
 const job=structuredClone(record.job!)
 for(const [channel,result] of Object.entries(report.channels)) {
  if(job.channels[channel]?.status==='draft_only')continue
  if(!['youtube','instagram','facebook','twitter','tiktok','facebook_groups'].includes(channel))continue
  job.channels[channel]=result.status==='published'&&!result.postId?{status:'unconfirmed'}:result
 }
 return {...record,updatedAt:now,job:{...job,state:report.success?'completed':'failed',revision:job.revision+1,updatedAt:now,note:'Worker returned channel receipts. Unconfirmed posts require review; they will not be replayed automatically.'}}
}
const defaults=():AutomationState=>({enabled:process.env.AUTOMATION_ENABLED==='true',cursor:0})
export class FirestoreWorkerStore implements WorkerStore {
 private db:Firestore
 private control
 constructor(db = new Firestore({projectId:process.env.GOOGLE_CLOUD_PROJECT})) {this.db=db;this.control=db.collection('marketing_automation').doc('rotation')}
 async state(){const snap=await this.control.get();return {...defaults(),...snap.data()} as AutomationState}
 async enable(enabled:boolean){await this.control.set({enabled,updatedAt:new Date().toISOString()},{merge:true})}
 async claim(identity:WorkerIdentity,slot:string):Promise<WorkerResult>{
  const runRef=this.db.collection('marketing_worker_runs').doc(identity.runId)
  const slotRef=this.db.collection('marketing_worker_slots').doc(slot)
  const id=crypto.randomUUID()
  return this.db.runTransaction(async tx=>{
   const [stateSnap,runSnap,slotSnap,pending]=await Promise.all([tx.get(this.control),tx.get(runRef),tx.get(slotRef),tx.get(this.db.collection('marketing_campaigns').where('status','==','approved').limit(100))])
   const state={...defaults(),...stateSnap.data()} as AutomationState
   if(!state.enabled)return {status:'paused'}
   if(runSnap.exists||slotSnap.exists)return {status:'already_claimed'}
   const queued=pending.docs.map(d=>d.data() as CampaignRecord).filter(c=>c.job?.transport==='pull'&&c.job.state==='queued').sort((a,b)=>a.createdAt.localeCompare(b.createdAt))[0]
   const now=new Date().toISOString()
   const draft=queued||rotationDraft(rotationProduct(state.cursor),id,state.cursor,now)
   const campaign=assigned(draft,identity,now)
   tx.set(this.db.collection('marketing_campaigns').doc(campaign.id),campaign)
   tx.set(runRef,{campaignId:campaign.id,jobId:campaign.job!.id,slot,claimedAt:now,reported:false})
   tx.set(slotRef,{runId:identity.runId,campaignId:campaign.id,claimedAt:now})
   tx.set(this.control,{...state,cursor:state.cursor+(queued?0:1),lastRunId:identity.runId,lastCampaignId:campaign.id,updatedAt:now})
   return {status:'claimed',campaign}
  })
 }
 async report(identity:WorkerIdentity,report:Report){
  const runRef=this.db.collection('marketing_worker_runs').doc(identity.runId)
  const campaignRef=this.db.collection('marketing_campaigns').doc(report.campaignId)
  await this.db.runTransaction(async tx=>{
   const [run,campaign]=await Promise.all([tx.get(runRef),tx.get(campaignRef)])
   const record=campaign.data() as CampaignRecord|undefined
   if(!run.exists||!record||run.data()!.campaignId!==report.campaignId||run.data()!.jobId!==report.jobId||record.job?.runId!==Number(identity.runId))throw new Error('Worker report identity mismatch')
   if(run.data()!.reported)return
   const now=new Date().toISOString()
   tx.set(campaignRef,applyReport(record,report,now))
   tx.update(runRef,{reported:true,reportedAt:now})
  })
 }
}
