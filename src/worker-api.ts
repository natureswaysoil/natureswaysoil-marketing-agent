import type { Express, Request, Response } from 'express'
import { z } from 'zod'
import { authenticateWorker } from './worker-auth.js'
import { slotFor } from './rotation.js'
import type { WorkerStore } from './worker-store.js'
const reportSchema=z.object({campaignId:z.string().uuid(),jobId:z.string().uuid(),success:z.boolean(),channels:z.record(z.object({status:z.enum(['published','skipped','unconfirmed']),postId:z.string().min(1).max(500).optional()}))})
async function identity(req:Request,res:Response){
 try{return await authenticateWorker(req.get('authorization'))}catch{res.status(401).json({error:'Untrusted worker identity'});return null}
}
export function registerWorkerApi(app:Express,store:WorkerStore){
 app.get('/api/worker/preflight',async(req,res)=>{
  if(!await identity(req,res))return
  try{const state=await store.state();res.json({ok:true,enabled:state.enabled,cursor:state.cursor,mode:'trusted-pull-worker'})}catch{res.status(503).json({error:'Worker storage unavailable'})}
 })
 app.post('/api/worker/claim',async(req,res)=>{
  const worker=await identity(req,res);if(!worker)return
  const slot=slotFor(worker.event,worker.runId)
  if(!slot)return res.json({status:'outside_posting_window'})
  try{res.json(await store.claim(worker,slot))}catch{res.status(503).json({error:'Claim unavailable; never replay a lost claim response'})}
 })
 app.post('/api/worker/report',async(req,res)=>{
  const worker=await identity(req,res);if(!worker)return
  const payload=reportSchema.safeParse(req.body)
  if(!payload.success)return res.status(400).json({error:'Invalid worker receipt'})
  try{await store.report(worker,payload.data);res.json({ok:true})}catch{res.status(409).json({error:'Report not accepted; preserve receipt for review'})}
 })
}
