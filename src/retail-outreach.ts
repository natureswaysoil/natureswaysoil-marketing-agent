/**
 * Retail/wholesale prospecting: draft-only. No network calls or sending.
 * Add verified buyers using the caller's data source; never guess contact emails.
 */
export type RetailChannel = 'independent_garden' | 'distributor' | 'farm_store' | 'hardware' | 'national_chain' | 'online_retailer'
export type ProspectStatus = 'research' | 'contact_verified' | 'draft_ready' | 'approved_to_send' | 'contacted' | 'responded' | 'sample_sent' | 'trial_order' | 'reorder' | 'declined'
export interface RetailProspect {
  id: string
  business: string
  channel: RetailChannel
  website?: string
  buyerName?: string
  buyerEmail?: string
  emailVerified?: boolean
  status: ProspectStatus
  lastContactAt?: string
  followUpDue?: string
  optedOut?: boolean
  notes?: string
}
export interface OutreachDraft {
  prospectId: string
  recipient: string
  subject: string
  body: string
  status: 'pending_approval'
}
const clean = (s: string) => s.replace(/[\r\n<>]/g, ' ').trim().slice(0, 140)
export function draftRetailIntroduction(prospect: RetailProspect): OutreachDraft {
  if (prospect.optedOut) throw new Error('Prospect opted out')
  if (!prospect.emailVerified || !prospect.buyerEmail) throw new Error('Verified buyer email required')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(prospect.buyerEmail)) throw new Error('Invalid buyer email')
  if (prospect.status === 'contacted' || prospect.status === 'responded' || prospect.status === 'declined') throw new Error('Review existing contact history before another message')
  const buyer = prospect.buyerName ? `Hello ${clean(prospect.buyerName)},` : 'Hello,'
  const business = clean(prospect.business)
  const body = `${buyer}

I own Nature's Way Soil & Vermicompost LLC, a family-owned fertilizer manufacturer in North Carolina. I'm contacting you because ${business} may be a fit for our Liquid Bone Meal 2-14-0, a 32 fl oz fertilizer with a suggested retail price of $29.99.

We currently sell through Amazon, Walmart Marketplace, and natureswaysoil.com. We are exploring relationships with retailers and distributors and can provide a product sheet, sample, case pricing, product video, and labeling information for evaluation.

Would you be the right person to review a new lawn-and-garden product line? If not, could you direct me to the appropriate category buyer?

Thank you,
Nature's Way Soil & Vermicompost LLC
https://natureswaysoil.com

If you prefer not to receive further messages, just reply and we will honor that request.`
  return { prospectId: prospect.id, recipient: prospect.buyerEmail, subject: 'Nature\'s Way Soil — Liquid Bone Meal 2-14-0 retail inquiry', body, status: 'pending_approval' }
}
export function nextFollowUpDate(lastContactAt: string, days = 7): string {
  if (!Number.isInteger(days) || days < 1 || days > 30) throw new Error('Invalid follow-up interval')
  const date = new Date(lastContactAt)
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid contact date')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
