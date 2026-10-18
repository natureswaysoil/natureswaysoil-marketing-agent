import test from 'node:test'
import assert from 'node:assert/strict'
import {MemoryCampaignStore} from '../src/store.js'
import {approveAndDispatch} from '../src/jobs.js'
import {rotationDraft} from '../src/rotation.js'
import {PRODUCTS} from '../src/catalog.js'
import type { Firestore } from '@google-cloud/firestore'
import {FirestoreWorkerStore,MemoryWorkerStore} from '../src/worker-store.js'
class FakeDb {
 rows=new Map<string,any>();serial=Promise.resolve()
 collection(name:string){
  const db=this
  return {doc(id:string){const path=name+'/'+id;return {path,async get(){return db.snapshot(path)},async set(value:any,options?:any){db.rows.set(path,options?.merge?{...db.rows.get(path),...value}:structuredClone(value))}}},orderBy(field:string,_direction:string){return {query:name,field,count:1,limit(n:number){this.count=n;return this}}}}
 }
 snapshot(path:string,rows=this.rows){const value=rows.get(path);return {exists:value!==undefined,data:()=>structuredClone(value)}}
 async runTransaction<T>(fn:(tx:any)=>Promise<T>):Promise<T>{
  const execute=async()=>{const staged=new Map(this.rows);const tx={get:async(ref:any)=>ref.query?{docs:[...staged.entries()].filter(([key,row])=>key.startsWith(ref.query+'/')&&row[ref.field]!==undefined).sort((a,b)=>String(a[1][ref.field]).localeCompare(String(b[1][ref.field]))).slice(0,ref.count).map(([,row])=>({data:()=>structuredClone(row)}))}:this.snapshot(ref.path,staged),set:(ref:any,value:any)=>staged.set(ref.path,structuredClone(value)),update:(ref:any,value:any)=>staged.set(ref.path,{...staged.get(ref.path),...value})};const result=await fn(tx);this.rows=staged;return result}
  const result=this.serial.then(execute);this.serial=result.then(()=>undefined,()=>undefined);return result
 }
}
test('atomic worker claims, slot locks, pause, and receipts',async t=>{
 process.env.AUTOMATION_ENABLED='true'
 const db=new FakeDb();const store=new FirestoreWorkerStore(db as unknown as Firestore)
 const first={runId:'101',event:'schedule' as const}
 const claims=await Promise.all(Array.from({length:10},()=>store.claim(first,'2026-10-18-08')))
 assert.equal(claims.filter(c=>c.status==='claimed').length,1)
 const claimed=claims.find(c=>c.status==='claimed')!;if(claimed.status!=='claimed')throw new Error('claim missing')
 const campaign=claimed.campaign;assert.equal(campaign.productId,'NWS_012');assert.equal((await store.state()).cursor,1)
 assert.equal((await store.claim({runId:'102',event:'schedule'},'2026-10-18-08')).status,'already_claimed')
 assert.equal((await store.claim(first,'2026-10-18-11')).status,'already_claimed')
 await store.enable(false);assert.equal((await store.claim({runId:'103',event:'schedule'},'2026-10-18-11')).status,'paused');assert.equal((await store.state()).cursor,1)
 await store.enable(true)
 const second=await store.claim({runId:'104',event:'schedule'},'2026-10-18-11');assert.equal(second.status,'claimed');if(second.status==='claimed')assert.notEqual(second.campaign.productId,'NWS_012')
 const report={campaignId:campaign.id,jobId:campaign.job!.id,success:false,channels:{youtube:{status:'published' as const,postId:'yt-id'},instagram:{status:'unconfirmed' as const},website:{status:'published' as const,postId:'ignored'}}}
 await assert.rejects(()=>store.report({runId:'104',event:'schedule'},report))
 await store.report(first,report)
 const saved=db.rows.get('marketing_campaigns/'+campaign.id)
 assert.equal(saved.job.state,'failed');assert.equal(saved.job.channels.youtube.postId,'yt-id');assert.equal(saved.job.channels.instagram.status,'unconfirmed');assert.equal(saved.job.channels.website.status,'draft_only')
 await store.report(first,{...report,success:true,channels:{youtube:{status:'published',postId:'changed'}}});assert.equal(db.rows.get('marketing_campaigns/'+campaign.id).job.channels.youtube.postId,'yt-id')
 assert.equal((await store.claim(first,'another-slot')).status,'already_claimed')
 delete process.env.AUTOMATION_ENABLED
})

test('queued work is found behind hundreds of legacy approved holds without a composite index',async()=>{
 process.env.AUTOMATION_ENABLED='true';const db=new FakeDb();const store=new FirestoreWorkerStore(db as unknown as Firestore)
 for(let i=0;i<150;i++)db.rows.set('marketing_campaigns/legacy-'+i,{id:'legacy-'+i,status:'approved',job:{state:'dispatching'}})
 const campaigns=new MemoryCampaignStore();const draft={...rotationDraft(PRODUCTS[4],'b603bbd0-9d1f-4d0c-9777-415b7cac6d05',0,new Date().toISOString()),status:'pending_approval' as const};await campaigns.save(draft);await approveAndDispatch(campaigns,draft.id);db.rows.set('marketing_campaigns/'+draft.id,await campaigns.get(draft.id))
 const result=await store.claim({runId:'999',event:'schedule'},'queue-test');assert.equal(result.status,'claimed');if(result.status==='claimed'){assert.equal(result.campaign.id,draft.id);assert.equal(result.campaign.queueOrder,undefined)}assert.equal((await store.state()).cursor,0);delete process.env.AUTOMATION_ENABLED
})
test('memory mode uses shared campaigns and keeps pause/receipts in memory',async()=>{
 const campaigns=new MemoryCampaignStore();const worker=new MemoryWorkerStore(campaigns);await worker.enable(true)
 const draft={...rotationDraft(PRODUCTS[4],'b603bbd0-9d1f-4d0c-9777-415b7cac6d05',0,new Date().toISOString()),status:'pending_approval' as const};await campaigns.save(draft);await approveAndDispatch(campaigns,draft.id)
 const identity={runId:'777',event:'schedule' as const};const result=await worker.claim(identity,'memory-slot');assert.equal(result.status,'claimed');if(result.status!=='claimed')throw new Error('missing claim');assert.equal(result.campaign.id,draft.id)
 await worker.report(identity,{campaignId:draft.id,jobId:result.campaign.job!.id,success:true,channels:{youtube:{status:'published',postId:'yt'}}});assert.equal((await campaigns.get(draft.id))!.job!.channels.youtube.postId,'yt')
 await worker.enable(false);assert.equal((await worker.claim({runId:'778',event:'schedule'},'next')).status,'paused')
})
