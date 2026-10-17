// Deliberately exposes GETs only. Amazon writes remain owned by Campaign's profit guard.
export class CampaignReader {
  constructor(private base = process.env.CAMPAIGN_BASE_URL || '', private token = process.env.CAMPAIGN_READ_TOKEN || '') {}
  private async get(path: string) {
    if (!this.base) return { status: 'not_configured' }
    const url = new URL(this.base)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Campaign URL must be an HTTPS origin')
    url.pathname = path
    const response = await fetch(url, { method: 'GET', redirect: 'error', headers: this.token ? { 'X-Marketing-Read-Token': this.token } : {}, signal: AbortSignal.timeout(10000) })
    if (!response.ok) return { status: 'unavailable', httpStatus: response.status }
    return { status: 'available', checkedAt: new Date().toISOString(), data: await response.json() }
  }
  status() { return this.get('/api/profit/status') }
  eligibility(campaignId: string) {
    if (!/^\d+$/.test(campaignId)) throw new Error('Select a numeric Amazon campaign ID')
    return this.get(`/api/profit/eligibility/${campaignId}`)
  }
}
