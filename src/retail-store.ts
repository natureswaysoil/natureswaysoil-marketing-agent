import { Firestore } from '@google-cloud/firestore'
import type { RetailProspect } from './retail-outreach.js'

export interface RetailStore {
  save(record: RetailProspect): Promise<void>
  get(id: string): Promise<RetailProspect | null>
  list(): Promise<RetailProspect[]>
}
export class FirestoreRetailStore implements RetailStore {
  private readonly collection
  constructor(projectId = process.env.GOOGLE_CLOUD_PROJECT) {
    this.collection = new Firestore({ projectId }).collection('retail_prospects')
  }
  async save(record: RetailProspect) { await this.collection.doc(record.id).set(record) }
  async get(id: string) {
    const snap = await this.collection.doc(id).get()
    return snap.exists ? snap.data() as RetailProspect : null
  }
  async list() {
    const snap = await this.collection.limit(500).get()
    return snap.docs.map(doc => doc.data() as RetailProspect).sort((a,b)=>a.business.localeCompare(b.business))
  }
}
export class MemoryRetailStore implements RetailStore {
  private records = new Map<string,RetailProspect>()
  async save(record: RetailProspect) { this.records.set(record.id,structuredClone(record)) }
  async get(id: string) { const value=this.records.get(id); return value ? structuredClone(value) : null }
  async list() { return [...this.records.values()].map(x=>structuredClone(x)).sort((a,b)=>a.business.localeCompare(b.business)) }
}
