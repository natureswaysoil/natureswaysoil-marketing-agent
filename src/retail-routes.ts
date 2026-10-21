import crypto from 'node:crypto'
import type express from 'express'
import { renderRetailDashboard } from './retail-dashboard.js'
import type { RetailChannel, ProspectStatus, RetailProspect } from './retail-outreach.js'
import type { RetailStore } from './retail-store.js'
const channels: RetailChannel[]=['independent_garden','distributor','farm_store','hardware','national_chain','online_retailer']
const statuses: ProspectStatus[]=['research','contact_verified','draft_ready','approved_to_send','contacted','responded','sample_sent','trial_order','reorder','declined']
const string = (v:unknown,max=140) => typeof v==='string' ? v.trim().slice(0,max) : ''
export function registerRetailRoutes(app: express.Express, auth: express.RequestHandler, store: RetailStore) {
  app.get('/retail',auth,async(_req,res,next)=>{try{res.send(renderRetailDashboard(await store.list()))}catch(e){next(e)}})
  app.post('/retail/add',auth,async(req,res,next)=>{
    try{
      const business=string(req.body.business)
      const channel=string(req.body.channel) as RetailChannel
      if(!business || !channels.includes(channel)) return res.status(400).send('Invalid prospect')
      const buyerEmail=string(req.body.buyerEmail,254)
      if(buyerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) return res.status(400).send('Invalid email')
      const existing=(await store.list()).some(p=>p.business.toLowerCase()===business.toLowerCase())
      if(existing) return res.status(409).send('Business already exists; check existing record')
      const verified=buyerEmail.length>0 && req.body.emailVerified==='yes'
      const record: RetailProspect={id:crypto.randomUUID(),business,channel,website:string(req.body.website,500),buyerName:string(req.body.buyerName),buyerEmail,emailVerified:verified,status:verified?'contact_verified':'research',optedOut:false,notes:string(req.body.notes,1000)}
      await store.save(record);res.redirect('/retail')
    }catch(e){next(e)}
  })
  app.post('/retail/:id/status',auth,async(req,res,next)=>{
    try {
      const current=await store.get(String(req.params.id));if(!current)return res.status(404).send('Not found')
      const status=string(req.body.status) as ProspectStatus;if(!statuses.includes(status))return res.status(400).send('Invalid status')
      if(current.optedOut && status==='approved_to_send')return res.status(409).send('Opted-out contacts cannot be approved')
      if(status==='approved_to_send' && (!current.emailVerified || !current.buyerEmail))return res.status(409).send('Verified email required')
      await store.save({...current,status});res.redirect('/retail')
    }catch(e){next(e)}
  })
  app.post('/retail/:id/optout',auth,async(req,res,next)=>{
    try {
      const current=await store.get(String(req.params.id));if(!current)return res.status(404).send('Not found')
      await store.save({...current,optedOut:true,status:'declined'});res.redirect('/retail')
    }catch(e){next(e)}
  })
}
