import { PRODUCTS, type Product } from './catalog.js'
import { CHANNELS, CampaignDraftSchema, type CampaignRecord } from './types.js'
import { validateCampaignPolicy } from './policy.js'
export const ROTATION_HOURS = [8,11,14,17,20]
export function slotFor(event: string, runId: string, now = new Date()) {
  if (event === 'push') return 'activation-v1'
  if (event === 'workflow_dispatch') return `manual-${runId}`
  const fields = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]))
  if (!ROTATION_HOURS.includes(Number(fields.hour))) return null
  return `${fields.year}-${fields.month}-${fields.day}-${fields.hour}`
}
export function rotationProduct(cursor: number, products = PRODUCTS): Product {
  const eligible = products.filter(p=>p.automatic && p.inStock)
  const featured = eligible.find(p=>p.id==='NWS_012')
  const others = eligible.filter(p=>p.id!=='NWS_012')
  if (!eligible.length) throw new Error('No eligible catalog products')
  if (featured && (cursor % 2 === 0 || !others.length)) return featured
  return others[Math.floor(cursor / (featured ? 2 : 1)) % others.length]
}
export function rotationDraft(product: Product, id: string, cursor: number, now: string): CampaignRecord {
  const angle = ['A closer look at','Make room in your soil-care routine for','From our North Carolina family farm'][Math.floor(cursor/2)%3]
  const hook = `${angle} ${product.name}.`
  const claims = product.approvedClaims.slice(0,2)
  const callToAction = `Explore ${product.name} at natureswaysoil.com. Follow the label directions for your application.`
  const voiceover = `${hook} ${claims.join('. ')}. ${callToAction}`
  const caption = `${product.name}. ${claims.join('. ')}. Follow label directions. ${product.url}`
  const draft = CampaignDraftSchema.parse({ productId:product.id,productName:product.name,objective:'conversion',audience:product.audiences.join(', '),angle,hook,offer:'',callToAction,factualClaims:claims,prohibitedClaims:product.prohibitedClaims,videoBrief:{durationSeconds:35,voiceover,overlayText:[product.name,...claims,'Follow label directions','Nature’s Way Soil'],brollQueries:product.brollQueries},posts:CHANNELS.map(channel=>({channel,caption:channel==='twitter'?`${product.name}. ${claims[0]}. ${product.url}`:caption,headline:product.name,hashtags:['#NaturesWaySoil']})),rationale:'Owner-authorized automatic catalog rotation. Liquid bone meal alternates with all other in-stock products. Copy uses reviewed catalog facts; prices and application rates are excluded.'})
  const policy = validateCampaignPolicy(draft,product)
  if (!policy.ok) throw new Error('Automatic campaign failed catalog policy')
  return {...draft,schemaVersion:1,websiteUrl:product.url,productImageUrl:product.imageUrl,asin:product.asin||'',sku:product.sku||'',id,status:'approved',createdAt:now,updatedAt:now,automatic:true}
}
