import test from 'node:test'
import assert from 'node:assert/strict'
import { zipSync, strToU8 } from 'fflate'
import { MemoryCampaignStore } from '../src/store.js'
import { approveAndDispatch, reconcile } from '../src/jobs.js'
import { CampaignReader } from '../src/integrations/campaign.js'
import type { CampaignRecord } from '../src/types.js'
const fixture = (): CampaignRecord => ({ productId:'test-product', productName:'Test Product', objective:'conversion', audience:'Gardeners', angle:'Soil care', hook:'Care for soil', offer:'', callToAction:'Learn more', factualClaims:['Approved claim'], prohibitedClaims:[], videoBrief:{durationSeconds:30,voiceover:'Approved voiceover for the product.',overlayText:['Soil care','Learn more'],brollQueries:['soil','garden']}, rationale:'Approved campaign fixture', id: 'campaign-1', status: 'pending_approval', createdAt: '2026-10-17T00:00:00Z', updatedAt: '2026-10-17T00:00:00Z', posts: (['youtube','pinterest','website'] as const).map(channel => ({ channel, caption: 'approved copy', headline: 'Approved', hashtags: [] })) })

test('durable dispatch, reconciliation, and read-only adapter', async t => {
 const original = globalThis.fetch
 process.env.GITHUB_TOKEN = 'test-token'
 try {
  await t.test('parallel approvals send once; accepted is not published', async () => {
   const store = new MemoryCampaignStore(); await store.save(fixture()); let sent = 0
   globalThis.fetch = async () => { sent++; return new Response(null, {status: 204}) }
   const results = await Promise.all(Array.from({length: 10}, () => approveAndDispatch(store, 'campaign-1')))
   assert.equal(results.filter(Boolean).length, 1); assert.equal(sent, 1)
   const record = (await store.get('campaign-1'))!; assert.equal(record.job?.state, 'accepted'); assert.equal(record.job?.channels.youtube.status, 'unconfirmed'); assert.equal(record.job?.channels.website.status, 'draft_only')
  })
  await t.test('legacy failures cannot be replayed without evidence',async()=>{
   const store=new MemoryCampaignStore();await store.save({...fixture(),status:'dispatch_failed'});assert.equal(await approveAndDispatch(store,'campaign-1'),false)
  })
  await t.test('lost response and process-crash claims never replay', async () => {
   const store = new MemoryCampaignStore(); await store.save(fixture()); let sent = 0
   globalThis.fetch = async () => { sent++; throw new Error('timeout') }
   await approveAndDispatch(store, 'campaign-1'); assert.equal((await store.get('campaign-1'))?.job?.state, 'unconfirmed')
   assert.equal(await approveAndDispatch(store, 'campaign-1'), false); assert.equal(sent, 1)
   await store.update('campaign-1', r => ({...r, status:'approved', job:{...r.job!,state:'dispatching'}}))
   assert.equal(await approveAndDispatch(store, 'campaign-1'), false)
  })
  await t.test('explicit rejection is retryable; failed execution is not', async () => {
   const store = new MemoryCampaignStore(); await store.save(fixture())
   globalThis.fetch = async () => new Response(null,{status:422})
   await approveAndDispatch(store,'campaign-1'); assert.equal((await store.get('campaign-1'))?.job?.state,'rejected')
   globalThis.fetch = async () => new Response(null,{status:204})
   assert.equal(await approveAndDispatch(store,'campaign-1'),true)
   await store.update('campaign-1',r=>({...r,job:{...r.job!,state:'failed'}}))
   assert.equal(await approveAndDispatch(store,'campaign-1'),false)
  })
  await t.test('exact job identity and receipt confirm only supported channels', async () => {
   const store = new MemoryCampaignStore(); await store.save(fixture())
   globalThis.fetch = async () => new Response(null,{status:204}); await approveAndDispatch(store,'campaign-1')
   const job = (await store.get('campaign-1'))!.job!
   const receipt = {schemaVersion:1,jobId:job.id,campaignId:'campaign-1',channels:{youtube:{status:'published',postId:'yt-id'},website:{status:'published',postId:'bad'}}}
   globalThis.fetch = async input => {
    const url = String(input)
    if(url.includes('/dispatches')) throw new Error('must not replay')
    if(url.includes('/zip')) return new Response(zipSync({'marketing-result.json':strToU8(JSON.stringify(receipt))}) as BodyInit)
    if(url.includes('/artifacts?')) return Response.json({artifacts:[{id:9,name:`marketing-result-${job.id}`,expired:false,size_in_bytes:200}]})
    if(url.includes('/runs?')) return Response.json({workflow_runs:[{id:10,display_title:`marketing-job:${job.id}`}]})
    return Response.json({status:'completed',conclusion:'success',display_title:`marketing-job:${job.id}`,run_attempt:1})
   }
   await reconcile(store,'campaign-1'); const result=(await store.get('campaign-1'))!.job!
   assert.equal(result.state,'completed'); assert.equal(result.channels.youtube.status,'published'); assert.equal(result.channels.website.status,'draft_only')
   receipt.campaignId='another-campaign'; await reconcile(store,'campaign-1');assert.match((await store.get('campaign-1'))!.job!.note!,/unavailable/)
  })
  await t.test('ambiguous runs retain hold without choosing a run', async () => {
   const store=new MemoryCampaignStore();await store.save(fixture());globalThis.fetch=async()=>new Response(null,{status:204});await approveAndDispatch(store,'campaign-1')
   const job=(await store.get('campaign-1'))!.job!
   globalThis.fetch=async()=>Response.json({workflow_runs:[1,2].map(id=>({id,display_title:`marketing-job:${job.id}`}))})
   await reconcile(store,'campaign-1');assert.equal((await store.get('campaign-1'))!.job!.runId,undefined)
  })
  await t.test('Campaign GET preserves blockers and refuses invalid origins/IDs',async()=>{
   globalThis.fetch=async(input,init)=>{assert.equal(init?.method,'GET');assert.equal(new Headers(init?.headers).get('X-Marketing-Read-Token'),'private');return Response.json({status:'blocked',reason:'insufficient_mature_conversion_data'})}
   const reader=new CampaignReader('https://optimizer.example','private');const result=await reader.eligibility('123')
   assert.equal((result as any).data.reason,'insufficient_mature_conversion_data')
   await assert.rejects(()=>new CampaignReader('http://optimizer.example').status());assert.throws(()=>reader.eligibility('../policy'))
   assert.deepEqual(await new CampaignReader('').status(),{status:'not_configured'})
  })
 } finally {globalThis.fetch=original;delete process.env.GITHUB_TOKEN}
})

