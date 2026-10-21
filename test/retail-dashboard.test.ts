import assert from 'node:assert/strict'
import test from 'node:test'
import { renderRetailDashboard } from '../src/retail-dashboard.js'

test('escapes untrusted retailer details', () => {
  const html = renderRetailDashboard([{ id:'1', business:'<script>alert(1)</script>', channel:'independent_garden', status:'research', notes:'<img src=x>', optedOut:false }])
  assert.ok(!html.includes('<script>alert(1)</script>'))
  assert.match(html, /&lt;script&gt;/)
  assert.match(html, /&lt;img src=x&gt;/)
})

test('does not count opted-out follow-ups', () => {
  const html = renderRetailDashboard([{id:'1',business:'Test',channel:'distributor',status:'contacted',followUpDue:'2020-01-01',optedOut:true}])
  assert.match(html, /0 follow-ups due/)
})
