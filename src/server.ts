import express from 'express'
import { generateCampaign } from './agent.js'
import { PRODUCTS } from './catalog.js'
import { dispatchToVideo } from './dispatcher.js'
import { renderDashboard } from './dashboard.js'
import { FirestoreCampaignStore, MemoryCampaignStore, type CampaignStore } from './store.js'

const app = express()
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: false }))
const token = process.env.APPROVAL_TOKEN || ''
const store: CampaignStore = process.env.NODE_ENV === 'test' || process.env.USE_MEMORY_STORE === 'true' ? new MemoryCampaignStore() : new FirestoreCampaignStore()

function authorized(value: unknown) { return Boolean(token) && value === token }

app.get('/health', (_req, res) => res.json({ ok: true }))
app.get('/api/products', (_req, res) => res.json(PRODUCTS))
app.get('/', async (req, res) => {
  if (!authorized(req.query.token)) return res.status(401).send('Approval token required')
  res.send(renderDashboard(await store.list(), token))
})

app.post('/api/campaigns/generate', async (req, res, next) => {
  try {
    if (!authorized(req.get('x-approval-token'))) return res.status(401).json({ error: 'Unauthorized' })
    const record = await generateCampaign(String(req.body.productId || ''), String(req.body.objective || 'conversion'))
    await store.save(record)
    res.status(201).json(record)
  } catch (error) { next(error) }
})

app.post('/campaigns/:id/approve', async (req, res, next) => {
  try {
    if (!authorized(req.body.token)) return res.status(401).send('Unauthorized')
    const record = await store.get(req.params.id)
    if (!record) return res.status(404).send('Campaign not found')
    if (record.status !== 'pending_approval') return res.status(409).send('Campaign already reviewed')
    record.status = 'approved'; record.updatedAt = new Date().toISOString(); await store.save(record)
    try {
      await dispatchToVideo(record)
      record.status = 'dispatched'
    } catch (error) {
      record.status = 'dispatch_failed'; record.reviewerNote = error instanceof Error ? error.message : String(error)
    }
    record.updatedAt = new Date().toISOString(); await store.save(record)
    res.redirect(`/?token=${encodeURIComponent(token)}`)
  } catch (error) { next(error) }
})

app.post('/campaigns/:id/reject', async (req, res, next) => {
  try {
    if (!authorized(req.body.token)) return res.status(401).send('Unauthorized')
    const record = await store.get(req.params.id)
    if (!record) return res.status(404).send('Campaign not found')
    if (record.status !== 'pending_approval') return res.status(409).send('Campaign already reviewed')
    record.status = 'rejected'; record.updatedAt = new Date().toISOString(); await store.save(record)
    res.redirect(`/?token=${encodeURIComponent(token)}`)
  } catch (error) { next(error) }
})

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error)
  res.status(500).json({ error: error instanceof Error ? error.message : 'Unexpected error' })
})

if (!token) console.warn('APPROVAL_TOKEN is not configured; protected routes will reject all requests')
const port = Number(process.env.PORT || 8080)
app.listen(port, () => console.log(`Marketing agent listening on ${port}`))
