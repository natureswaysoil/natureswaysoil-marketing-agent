import test from 'node:test'
import assert from 'node:assert/strict'
import {rotationProduct,rotationDraft,slotFor} from '../src/rotation.js'
import {PRODUCTS} from '../src/catalog.js'
import {validateCampaignPolicy} from '../src/policy.js'
test('all 14 products rotate, with bone meal in 13 of 26 slots',()=>{
 const selected=Array.from({length:26},(_,i)=>rotationProduct(i))
 assert.equal(PRODUCTS.length,14);assert.equal(new Set(selected.map(p=>p.id)).size,14);assert.equal(selected.filter(p=>p.id==='NWS_012').length,13)
 for(let i=0;i<26;i++){const draft=rotationDraft(selected[i],'a6e12e0e-95b2-4c29-a99d-3af8cedb6ef4',i,new Date().toISOString());assert.equal(validateCampaignPolicy(draft,selected[i]).ok,true);assert.equal(draft.websiteUrl,selected[i].url);assert.equal(draft.schemaVersion,1);assert(!JSON.stringify(draft.posts).includes('$'));assert(draft.productImageUrl?.includes(selected[i].id))}
})
test('out-of-stock products are skipped and an empty catalog fails closed',()=>{
 const products=PRODUCTS.map(p=>({...p,inStock:p.id!=='NWS_012'}));assert(!Array.from({length:30},(_,i)=>rotationProduct(i,products)).some(p=>p.id==='NWS_012'));assert.throws(()=>rotationProduct(0,[]))
})
test('Eastern-time slots follow daylight saving and block off-hour schedules',()=>{
 assert.equal(slotFor('schedule','1',new Date('2026-10-17T12:01:00Z')),'2026-10-17-08');assert.equal(slotFor('schedule','2',new Date('2026-12-17T13:01:00Z')),'2026-12-17-08');assert.equal(slotFor('schedule','1',new Date('2026-10-17T13:01:00Z')),null);assert.equal(slotFor('push','1'),'activation-v1');assert.equal(slotFor('push','2'),'activation-v1')
})
