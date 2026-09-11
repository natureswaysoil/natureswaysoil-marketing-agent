import { Firestore } from '@google-cloud/firestore'
import type { CampaignRecord, CampaignStatus } from './types.js'

export interface CampaignStore {
  save(record: CampaignRecord): Promise<void>
  get(id: string): Promise<CampaignRecord | null>
  list(status?: CampaignStatus): Promise<CampaignRecord[]>
}

export class FirestoreCampaignStore implements CampaignStore {
  private readonly collection
  constructor(projectId = process.env.GOOGLE_CLOUD_PROJECT) {
    this.collection = new Firestore({ projectId }).collection('marketing_campaigns')
  }
  async save(record: CampaignRecord) { await this.collection.doc(record.id).set(record) }
  async get(id: string) {
    const snap = await this.collection.doc(id).get()
    return snap.exists ? snap.data() as CampaignRecord : null
  }
  async list(status?: CampaignStatus) {
    const query = status ? this.collection.where('status', '==', status) : this.collection
    const snap = await query.get()
    return snap.docs.map(doc => doc.data() as CampaignRecord).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
}

export class MemoryCampaignStore implements CampaignStore {
  private records = new Map<string, CampaignRecord>()
  async save(record: CampaignRecord) { this.records.set(record.id, structuredClone(record)) }
  async get(id: string) { return this.records.has(id) ? structuredClone(this.records.get(id)!) : null }
  async list(status?: CampaignStatus) {
    return [...this.records.values()].filter(item => !status || item.status === status).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
}
