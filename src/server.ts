import crypto from 'node:crypto'
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
const sessionCookie = 'marketing_session'

function secureEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

function expectedSession() {
  return token ? crypto.createHmac('sha256', token).update('marketing-agent-session-v1').digest('hex') : ''
}

function cookies(header = '') {
  return Object.fromEntries(header.split(';').map(value => value.trim()).filter(Boolean).map(value => {
    const separator = value.indexOf('=')
    return separator < 0 ? [value, ''] : [value.slice(0, separator), decodeURIComponent(value.slice(separator + 1))]
  }))
}

function authorized(req: express.Request) {
  if (!token) return false
  const headerToken = req.get('x-approval-token')
  if (headerToken && secureEqual(headerToken, token)) return true
  const session = cookies(req.get('cookie'))[sessionCookie]
  return Boolean(session) && secureEqual(session, expectedSession())
}

function requireDashboardAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!authorized(req)) return res.redirect('/login')
  next()
}

async function dispatch(recordId: string) {
  const record = await store.get(recordId)
  if (!record) return { status: 404, message: 'Campaign not found' }
  if (!['pending_approval', 'dispatch_failed'].includes(record.status)) return { status: 409, message: 'Campaign is not ready for dispatch' }

  record.status = 'approved'
  record.reviewerNote = undefined
  record.updatedAt = new Date().toISOString()
  await store.save(record)

  try {
    await dispatchToVideo(record)
    record.status = 'dispatched'
  } catch (error) {
    record.status = 'dispatch_failed'
    record.reviewerNote = error instanceof Error ? error.message : String(error)
  }
  record.updatedAt = new Date().toISOString()
  await store.save(record)
  return { status: 200, message: record.status }
}

app.get('/health', (_req, res) => res.json({
  ok: true,
  configured: {
    approvalToken: Boolean(token),
    openai: Boolean(process.env.OPENAI_API_KEY),
    github: Boolean(process.env.GITHUB_TOKEN),
    project: Boolean(process.env.GOOGLE_CLOUD_PROJECT)
  }
}))

app.get('/login', (_req, res) => {
  res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Marketing Agent Sign In</title><style>body{font:16px system-ui;max-width:440px;margin:10vh auto;padding:24px;color:#173d2a}form{display:grid;gap:12px}input,button{font:inherit;padding:11px}button{background:#23633f;color:white;border:0;border-radius:8px}</style></head><body><h1>Marketing Agent</h1><p>Enter the approval token stored in Google Secret Manager.</p><form method="post" action="/login"><label>Approval token<input name="token" type="password" required autocomplete="current-password"></label><button>Sign in</button></form></body></html>`)
})

app.post('/login', (req, res) => {
  const submitted = String(req.body.token || '')
  if (!token || !secureEqual(submitted, token)) return res.status(401).send('Invalid approval token')
  const attributes = [`${sessionCookie}=${expectedSession()}`, 'HttpOnly', 'SameSite=Strict', 'Path=/', 'Max-Age=28800']
  if (process.env.NODE_ENV === 'production') attributes.push('Secure')
  res.setHeader('Set-Cookie', attributes.join('; '))
  res.redirect('/')
})

app.post('/logout', (_req, res) => {
  res.setHeader('Set-Cookie', `${sessionCookie}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`)
  res.redirect('/login')
})

app.get('/api/products', requireDashboardAuth, (_req, res) => res.json(PRODUCTS))
app.get('/', requireDashboardAuth, async (_req, res, next) => {
  try {
    res.send(renderDashboard(await store.list(), PRODUCTS))
  } catch (error) { next(error) }
})

app.post('/api/campaigns/generate', async (req, res, next) => {
  try {
    if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' })
    const record = await generateCampaign(String(req.body.productId || ''), String(req.body.objective || 'conversion'))
    await store.save(record)
    res.status(201).json(record)
  } catch (error) { next(error) }
})

app.post('/campaigns/generate', requireDashboardAuth, async (req, res, next) => {
  try {
    const record = await generateCampaign(String(req.body.productId || ''), String(req.body.objective || 'conversion'))
    await store.save(record)
    res.redirect('/')
  } catch (error) { next(error) }
})

app.post('/campaigns/:id/approve', requireDashboardAuth, async (req, res, next) => {
  try {
    const result = await dispatch(req.params.id)
    if (result.status !== 200) return res.status(result.status).send(result.message)
    res.redirect('/')
  } catch (error) { next(error) }
})

app.post('/campaigns/:id/retry', requireDashboardAuth, async (req, res, next) => {
  try {
    const record = await store.get(req.params.id)
    if (!record) return res.status(404).send('Campaign not found')
    if (record.status !== 'dispatch_failed') return res.status(409).send('Only failed dispatches can be retried')
    const result = await dispatch(req.params.id)
    if (result.status !== 200) return res.status(result.status).send(result.message)
    res.redirect('/')
  } catch (error) { next(error) }
})

app.post('/campaigns/:id/reject', requireDashboardAuth, async (req, res, next) => {
  try {
    const record = await store.get(req.params.id)
    if (!record) return res.status(404).send('Campaign not found')
    if (record.status !== 'pending_approval') return res.status(409).send('Campaign already reviewed')
    record.status = 'rejected'
    record.updatedAt = new Date().toISOString()
    await store.save(record)
    res.redirect('/')
  } catch (error) { next(error) }
})

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error)
  res.status(500).json({ error: error instanceof Error ? error.message : 'Unexpected error' })
})

if (!token) console.warn('APPROVAL_TOKEN is not configured; protected routes will reject all requests')
const port = Number(process.env.PORT || 8080)
app.listen(port, () => console.log(`Marketing agent listening on ${port}`))
