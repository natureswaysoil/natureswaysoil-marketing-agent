import assert from 'node:assert/strict'
import test from 'node:test'
import { MemoryRetailStore } from '../src/retail-store.js'

test('saves and retrieves a retail prospect without leaking mutations', async () => {
  const store = new MemoryRetailStore()
  await store.save({id:'a',business:'Example Nursery',channel:'independent_garden',status:'research'})
  const record = await store.get('a')
  assert.equal(record?.business,'Example Nursery')
  if (record) record.business='Changed'
  assert.equal((await store.get('a'))?.business,'Example Nursery')
  assert.equal((await store.list()).length,1)
})
