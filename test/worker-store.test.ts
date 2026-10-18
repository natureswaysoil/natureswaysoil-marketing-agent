import test from 'node:test'
import assert from 'node:assert/strict'
import type { Firestore } from '@google-cloud/firestore'
import {FirestoreWorkerStore} from '../src/worker-store.js'
class FakeDb {
 rows=new Map<string,any>();serial=Promise.resolve()
 collection(name:string){
  const db=this
  return {doc(id:string){const path=name+'/'+id;return {path,async get(){return db.snapshot(path)},async set(value:any,options?:any){db.rows.set(path,options?.merge?{...db.rows.get(path),...value}:structuredClone(value))}}},where(field:string,_op:string,value:any){return {query:name,field,value,limit(_n:number){return this}}}}
 }
 snapshot(path:string,rows=this.rows){const value=rows.get(path);return {exists:value!==undefined,data:()=>structuredClone(value)}}
 async runTransaction<T>(fn:(tx:any)=>Promise<T>):Promise<T>{
  const execute=async()=>{const staged=new Map(this.rows);const tx={get:async(ref:any)=>ref.query?{docs:[...staged.entries()].filter(([key,row])=>key.startsWith(ref.query+'/')&&row[ref.field]===ref.value).map(([,row])=>({data:()=>structuredClone(row)}))}:this.snapshot(ref.path,staged),set:(ref:any,value:any)=>staged.set(ref.path,structuredClone(value)),update:(ref:any,value:any)=>staged.set(ref.path,{...staged.get(ref.path),...value})};const result=await fn(tx);this.rows=staged;return result}
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
