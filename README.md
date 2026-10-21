# Nature's Way Soil Marketing Agent

Automatic catalog rotation with liquid bone meal featured in alternating slots, plus an approval queue for manual drafts.

- Fourteen product families from the reviewed website catalog, with product-specific links and images.
- Five existing video posting windows: 8 AM, 11 AM, 2 PM, 5 PM and 8 PM Eastern.
- Automatic copy uses reviewed catalog facts. Prices, discounts and application rates are excluded.
- Manual drafts require approval; approved jobs queue for the next video worker.
- The dashboard can pause/resume automatic claims and shows per-channel receipts.
- Pinterest and website copy remain drafts; no Amazon advertising settings are changed.

The video worker uses short-lived GitHub OIDC, restricted to the exact main-branch video workflow. No GitHub personal token is needed. A Firestore transaction reserves each run and slot; interrupted or uncertain publication is never automatically replayed. See [AUTOMATIC_ROTATION.md](AUTOMATIC_ROTATION.md) for policy, trust, recovery and rollout details.

## Development

```bash
cp .env.example .env
npm ci
npm run typecheck
npm test
npm run dev
```

Use `APPROVAL_TOKEN` to sign in at `/login`, or send it in `x-approval-token` from a trusted API client. Never put it in a URL.

## Production

Project: `marketingagent-508322`. Cloud Run hosts the private application dashboard behind approval-token sign-in; the public login page is intentionally reachable. Firestore stores campaigns, worker runs, slot reservations and rotation controls. Secret Manager holds OpenAI and approval credentials. The GitHub deployment workflow validates public login protection and authenticated dashboard/storage reads without generating or publishing content.

Deploy the agent before updating the trusted `natureswaysoil/video` workflow. The activation file in that repository starts the first automatic liquid bone meal campaign once. Later scheduled runs rotate products. Pause blocks new claims; an in-progress video may finish.

The catalog snapshot and reviewed claims live in `src/catalog-data.json`. Update those from verified product sources. Do not import arbitrary website claims into unattended copy. Snapshot stock flags are not live Amazon inventory.

Campaign profitability/eligibility reads are optional and require the separate dedicated read-only secret configured by `scripts/connect-campaign-reader.sh`. The agent never needs the optimizer operator token.

## Retail & wholesale pipeline

The authenticated `/retail` dashboard manages prospect research, verified buyer contact details, unsent liquid bone meal introduction drafts, follow-up dates and opt-outs. There is **no automated outbound sending**. See [RETAIL_WHOLESALE.md](RETAIL_WHOLESALE.md) for buyer research and rollout controls.
