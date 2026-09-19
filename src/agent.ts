import crypto from 'node:crypto'
import OpenAI from 'openai'
import { CampaignDraftSchema, CHANNELS, type CampaignRecord } from './types.js'
import { findProduct } from './catalog.js'
import { validateCampaignPolicy } from './policy.js'

export async function generateCampaign(productId: string, objective = 'conversion'): Promise<CampaignRecord> {
  const product = findProduct(productId)
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-5-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are the marketing planner for Nature's Way Soil & Vermicompost LLC, a small family farm in Snow Hill, North Carolina. Create truthful, practical marketing without invented certifications, guarantees, medical claims, pesticide claims, fake urgency, or unapproved discounts. Use only the exact approvedClaims supplied for factualClaims. Do not introduce additional measurable product claims in captions, headlines, overlays, or voiceover. Return JSON only.`
      },
      {
        role: 'user',
        content: JSON.stringify({
          task: 'Create one approval-ready campaign with exactly one post for each required channel.',
          objective,
          product,
          requiredChannels: CHANNELS,
          claimRules: {
            factualClaimsMustBeSelectedVerbatimFrom: product.approvedClaims,
            prohibitedClaims: product.prohibitedClaims
          },
          requiredShape: {
            productId: product.id, productName: product.name, objective: 'awareness|education|conversion|retention', audience: 'string', angle: 'string', hook: 'string', offer: 'string', callToAction: 'string', factualClaims: ['exact approved claim'], prohibitedClaims: product.prohibitedClaims,
            videoBrief: { durationSeconds: 30, voiceover: 'string', overlayText: ['string'], brollQueries: ['string'] }, posts: [{ channel: 'one required channel', caption: 'string', headline: 'string', hashtags: ['string'] }], rationale: 'string'
          }
        })
      }
    ]
  })
  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('OpenAI returned no campaign')
  const draft = CampaignDraftSchema.parse(JSON.parse(content))
  const policy = validateCampaignPolicy(draft, product)
  if (!policy.ok) throw new Error(`Campaign failed policy: ${policy.errors.join('; ')}`)
  const now = new Date().toISOString()
  return { ...draft, id: crypto.randomUUID(), status: 'pending_approval', createdAt: now, updatedAt: now }
}
