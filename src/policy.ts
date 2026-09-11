import type { CampaignDraft } from './types.js'
import type { Product } from './catalog.js'

export type PolicyResult = { ok: boolean; errors: string[] }

export function validateCampaignPolicy(campaign: CampaignDraft, product: Product): PolicyResult {
  const errors: string[] = []
  const { prohibitedClaims: _declaredProhibitedClaims, ...publishableCampaign } = campaign
  const text = JSON.stringify(publishableCampaign).toLowerCase()

  for (const claim of product.prohibitedClaims) {
    if (text.includes(claim.toLowerCase())) errors.push(`Prohibited claim used: ${claim}`)
  }
  if (campaign.productId !== product.id) errors.push('Campaign product does not match requested product')
  if (campaign.posts.some(post => post.caption.length > (post.channel === 'twitter' ? 280 : 2200))) {
    errors.push('A channel caption exceeds its safe length')
  }
  if (/\b(cure|diagnose|treat disease|pesticide|kills all)\b/i.test(text)) {
    errors.push('Medical or pesticide-style claim requires regulatory review')
  }
  return { ok: errors.length === 0, errors }
}
