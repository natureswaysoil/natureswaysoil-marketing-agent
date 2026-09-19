import type { Product } from './catalog.js'
import type { CampaignRecord } from './types.js'

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!))

export function renderDashboard(records: CampaignRecord[], products: Product[]): string {
  const options = products.map(product => `<option value="${esc(product.id)}">${esc(product.name)} · ${esc(product.price)}</option>`).join('')
  const cards = records.map(item => {
    const actions = item.status === 'pending_approval'
      ? `<form method="post" action="/campaigns/${esc(item.id)}/approve"><button>Approve & send to video</button></form><form method="post" action="/campaigns/${esc(item.id)}/reject"><button class="secondary">Reject</button></form>`
      : item.status === 'dispatch_failed'
        ? `<form method="post" action="/campaigns/${esc(item.id)}/retry"><button>Retry video dispatch</button></form>`
        : ''
    const note = item.reviewerNote ? `<p class="error"><strong>Dispatch note:</strong> ${esc(item.reviewerNote)}</p>` : ''
    return `<article><h2>${esc(item.hook)}</h2><p><strong>${esc(item.productId)}</strong> · ${esc(item.objective)} · <span class="status">${esc(item.status)}</span></p><p>${esc(item.angle)}</p>${note}<details><summary>Review video and channel copy</summary><h3>Voiceover</h3><p>${esc(item.videoBrief.voiceover)}</p>${item.posts.map(p => `<h3>${esc(p.channel)} · ${esc(p.headline)}</h3><p>${esc(p.caption)}</p>`).join('')}</details>${actions}</article>`
  }).join('')

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Nature's Way Soil Marketing Agent</title><style>body{font:16px system-ui;max-width:960px;margin:auto;padding:24px;background:#f5f2e8;color:#173d2a}article,.panel{background:white;border:1px solid #d5dfd4;border-radius:14px;padding:20px;margin:16px 0}button,select{font:inherit}button{background:#23633f;color:white;border:0;border-radius:8px;padding:10px 14px;margin:8px 8px 0 0}.secondary{background:#6b5b4b}form{display:inline}.panel form{display:flex;gap:10px;align-items:end;flex-wrap:wrap}.panel label{display:grid;gap:5px}summary{cursor:pointer}h1{margin-bottom:4px}.status{font-weight:700}.error{color:#9b1c1c}nav{display:flex;justify-content:space-between;align-items:center}</style></head><body><nav><div><h1>Nature's Way Soil Marketing Agent</h1><p>Approval-first campaign queue. Nothing publishes until you approve it.</p></div><form method="post" action="/logout"><button class="secondary">Sign out</button></form></nav><section class="panel"><h2>Create campaign draft</h2><form method="post" action="/campaigns/generate"><label>Product<select name="productId" required>${options}</select></label><label>Objective<select name="objective"><option value="conversion">Conversion</option><option value="education">Education</option><option value="awareness">Awareness</option><option value="retention">Retention</option></select></label><button>Create draft</button></form></section>${cards || '<p>No campaigns yet.</p>'}</body></html>`
}
