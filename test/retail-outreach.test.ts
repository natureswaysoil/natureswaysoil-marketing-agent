import assert from 'node:assert/strict'
import test from 'node:test'
import { draftRetailIntroduction, nextFollowUpDate, type RetailProspect } from '../src/retail-outreach.js'

const prospect: RetailProspect = {
  id: 'test-1', business: 'Example Garden Center', channel: 'independent_garden',
  buyerEmail: 'buyer@example.com', emailVerified: true, status: 'contact_verified'
}
test('creates an unsent retailer inquiry draft', () => {
  const draft = draftRetailIntroduction(prospect)
  assert.equal(draft.status, 'pending_approval')
  assert.equal(draft.recipient, 'buyer@example.com')
  assert.match(draft.body, /Liquid Bone Meal 2-14-0/)
  assert.match(draft.body, /reply and we will honor/)
})
test('never drafts to unverified buyers or opted-out accounts', () => {
  assert.throws(() => draftRetailIntroduction({ ...prospect, emailVerified: false }), /Verified/)
  assert.throws(() => draftRetailIntroduction({ ...prospect, optedOut: true }), /opted out/)
})
test('prevents accidental repeat contact', () => {
  assert.throws(() => draftRetailIntroduction({ ...prospect, status: 'contacted' }), /contact history/)
})
test('calculates follow-up date using calendar days', () => {
  assert.equal(nextFollowUpDate('2026-10-20T10:00:00Z'), '2026-10-27')
})
