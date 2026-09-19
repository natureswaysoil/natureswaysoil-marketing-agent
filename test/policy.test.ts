import assert from 'node:assert/strict'
import test from 'node:test'
import { PRODUCTS } from '../src/catalog.js'
import { validateCampaignPolicy } from '../src/policy.js'
import { CampaignDraftSchema, CHANNELS, type CampaignDraft } from '../src/types.js'

const valid: CampaignDraft = {
  productId: PRODUCTS[0].id,
  productName: PRODUCTS[0].name,
  objective: 'conversion',
  audience: 'dog owners',
  angle: 'practical lawn care',
  hook: 'Help your lawn recover',
  offer: '',
  callToAction: 'Learn more',
  factualClaims: [PRODUCTS[0].approvedClaims[0]],
  prohibitedClaims: PRODUCTS[0].prohibitedClaims,
  videoBrief: {
    durationSeconds: 30,
    voiceover: 'A practical approach to outdoor pet odors and healthier-looking grass.',
    overlayText: ['Outdoor odor help', 'Use as directed'],
    brollQueries: ['dog playing lawn', 'green backyard']
  },
  posts: CHANNELS.map(channel => ({
    channel,
    headline: 'Lawn care for dog owners',
    caption: 'Help control outdoor pet odors when used as directed.',
    hashtags: ['#LawnCare']
  })),
  rationale: 'Matches the product audience and approved factual claims.'
}

test('accepts a campaign within policy', () => {
  assert.deepEqual(validateCampaignPolicy(valid, PRODUCTS[0]), { ok: true, errors: [] })
})

test('blocks prohibited guarantees', () => {
  const invalid = structuredClone(valid)
  invalid.posts[0].caption = 'This is a guaranteed cure.'
  assert.equal(validateCampaignPolicy(invalid, PRODUCTS[0]).ok, false)
})

test('blocks factual claims not present in the approved catalog', () => {
  const invalid = structuredClone(valid)
  invalid.factualClaims = ['Makes grass grow twice as fast']
  const result = validateCampaignPolicy(invalid, PRODUCTS[0])
  assert.equal(result.ok, false)
  assert.match(result.errors.join(' '), /Unapproved factual claim/)
})

test('requires exactly one post for every supported channel', () => {
  const invalid = structuredClone(valid)
  invalid.posts = invalid.posts.slice(0, 5)
  assert.equal(CampaignDraftSchema.safeParse(invalid).success, false)
})

test('rejects a product name that differs from the catalog', () => {
  const invalid = structuredClone(valid)
  invalid.productName = 'Different product'
  assert.equal(validateCampaignPolicy(invalid, PRODUCTS[0]).ok, false)
})
