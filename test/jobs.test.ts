import test from 'node:test'
import assert from 'node:assert/strict'
import { MemoryCampaignStore } from '../src/store.js'
import { approveAndDispatch, reconcile } from '../src/jobs.js'
import { rotationDraft } from '../src/rotation.js'
import { PRODUCTS } from '../src/catalog.js'
import { CampaignReader } from '../src/integrations/campaign.js'
const fixture=()=>({...rotationDraft(PRODUCTS[0],'a6e12e0e-95b2-4c29-a99d-3af8cedb6ef4',1,new Date().toISOString()),status:'pending_approval' as const})
test('concurrent approvals queue exactly one job without contacting GitHub',async()=>{
 const store=new MemoryCampaignStore();const record=fixture();await store.save(record)
 const original=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('No external dispatch permitted')}
 try{const outcomes=await Promise.all(Array.from({length:10},()=>approveAndDispatch(store,record.id)));assert.equal(outcomes.filter(Boolean).length,1);const queued=(await store.get(record.id))!;assert.equal(queued.job?.state,'queued');assert.equal(queued.job?.transport,'pull');assert.equal(queued.job?.channels.pinterest.status,'draft_only');await reconcile(store,record.id);assert.equal((await store.get(record.id))!.job!.state,'queued')}finally{globalThis.fetch=original}
})
test('legacy uncertain failures stay held; rejected current drafts can be queued once',async()=>{
 const store=new MemoryCampaignStore();const record=fixture();await store.save({...record,status:'dispatch_failed'});assert.equal(await approveAndDispatch(store,record.id),false)
 await store.save({...record,status:'dispatch_failed',job:{id:'old-job',revision:1,state:'rejected',createdAt:record.createdAt,updatedAt:record.createdAt,channels:{}}});assert.equal(await approveAndDispatch(store,record.id),true);assert.equal(await approveAndDispatch(store,record.id),false)
})
test('automatic queue revalidates current catalog claims',async()=>{
 const store=new MemoryCampaignStore();const record=fixture();record.factualClaims=['Guaranteed cure for every lawn'];await store.save(record);await assert.rejects(()=>approveAndDispatch(store,record.id));assert.equal((await store.get(record.id))?.status,'pending_approval')
})
test('Campaign adapter preserves safety blockers and uses GET only',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async(_input,init)=>{assert.equal(init?.method,'GET');assert.equal(new Headers(init?.headers).get('X-Marketing-Read-Token'),'reader');return Response.json({status:'blocked',reason:'insufficient_mature_conversion_data'})}
 try{const result=await new CampaignReader('https://optimizer.example','reader').eligibility('123');assert.equal((result as any).data.reason,'insufficient_mature_conversion_data');await assert.rejects(()=>new CampaignReader('http://invalid').status());assert.throws(()=>new CampaignReader().eligibility('../policy'))}finally{globalThis.fetch=original}
})
