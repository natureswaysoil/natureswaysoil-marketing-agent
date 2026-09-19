import type { CampaignDraft } from './types.js'
import type { Product } from './catalog.js'

export type PolicyResult = { ok: boolean; errors: string[] }

const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase()

export function validateCampaignPolicy(campaign: CampaignDraft, product: Product): PolicyResult {
  const errors: string[] = []
  const { prohibitedClaims: _declaredProhibitedClaims, ...publishableCampaign } = campaign
  const text = JSON.stringify(publishableCampaign).toLowerCase()
  const approvedClaims = new Set(product.approvedClaims.map(normalize))

  for (const claim of campaign.factualClaims) {
    if (!approvedClaims.has(normalize(claim))) {
      errors.push(`Unapproved factual claim: ${claim}`)
    }
  }
  for (const claim of product.prohibitedClaims) {
    if (text.includes(claim.toLowerCase())) errors.push(`Prohibited claim used: ${claim}`)
  }
  if (campaign.productId !== product.id) errors.push('Campaign product does not match requested product')
  if (campaign.productName !== product.name) errors.push('Campaign product name does not match the catalog')
  if (campaign.posts.some(post => post.caption.length > (post.channel === 'twitter' ? 280 : 2200))) {
    errors.push('A channel caption exceeds its safe length')
  }
  if (/\b(cure|diagnose|treat disease|pesticide|kills all|guaranteed|drought[ -]?proof)\b/i.test(text)) {
    errors.push('Medical, pesticide, or guarantee-style claim requires regulatory review')
  }
  return { ok: errors.length === 0, errors }
}
