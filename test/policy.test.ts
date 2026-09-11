import assert from 'node:assert/strict'
import test from 'node:test'
import { PRODUCTS } from '../src/catalog.js'
import { validateCampaignPolicy } from '../src/policy.js'
import type { CampaignDraft } from '../src/types.js'

const valid: CampaignDraft = {
  productId: PRODUCTS[0].id, productName: PRODUCTS[0].name, objective: 'conversion', audience: 'dog owners', angle: 'practical lawn care', hook: 'Help your lawn recover', offer: '', callToAction: 'Learn more', factualClaims: PRODUCTS[0].approvedClaims, prohibitedClaims: PRODUCTS[0].prohibitedClaims,
  videoBrief: { durationSeconds: 30, voiceover: 'A practical approach to outdoor pet odors and healthier-looking grass.', overlayText: ['Outdoor odor help', 'Treats up to 5,000 sq ft'], brollQueries: ['dog playing lawn', 'green backyard'] },
  posts: [{ channel: 'twitter', headline: 'Lawn care for dog owners', caption: 'Help control outdoor pet odors and support healthier-looking grass when used as directed.', hashtags: ['#LawnCare'] }], rationale: 'Matches the product audience and approved factual claims.'
}

test('accepts a campaign within policy', () => assert.deepEqual(validateCampaignPolicy(valid, PRODUCTS[0]), { ok: true, errors: [] }))
test('blocks prohibited guarantees', () => {
  const invalid = structuredClone(valid); invalid.posts[0].caption = 'This is a guaranteed cure.'
  assert.equal(validateCampaignPolicy(invalid, PRODUCTS[0]).ok, false)
})
