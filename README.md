# Nature's Way Soil Marketing Agent

Approval-first AI campaign planning for Nature's Way Soil & Vermicompost LLC.

## What it does

1. Creates product-specific campaigns and channel copy with OpenAI.
2. Checks generated content against product claims and safety rules.
3. Saves drafts in Firestore with `pending_approval` status.
4. Presents a simple private approval dashboard.
5. Sends an approved campaign to the existing `natureswaysoil/video` GitHub Actions workflow.

The agent cannot publish an unapproved campaign. It does not change prices, discounts, ad budgets, product directions, or regulatory claims.

## Local setup

```bash
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:8080/?token=YOUR_APPROVAL_TOKEN`.

Create a campaign:

```bash
curl -X POST http://localhost:8080/api/campaigns/generate \
  -H 'content-type: application/json' \
  -H 'x-approval-token: YOUR_APPROVAL_TOKEN' \
  -d '{"productId":"dog-urine-neutralizer-32oz","objective":"conversion"}'
```

## Google Cloud resources

- Cloud Run: hosts the API and approval dashboard.
- Firestore: stores campaign drafts, decisions, and dispatch status.
- Secret Manager: `OPENAI_API_KEY`, `GITHUB_TOKEN`, and `MARKETING_AGENT_APPROVAL_TOKEN`.
- Cloud Scheduler: can call the generation endpoint weekly after an authenticated scheduler job is configured.
- Artifact Registry and Cloud Build: build and deploy the container.

## One-command Google Cloud setup

From Google Cloud Shell, run:

```bash
git clone https://github.com/natureswaysoil/natureswaysoil-marketing-agent.git
cd natureswaysoil-marketing-agent
bash scripts/bootstrap-gcp.sh
```

The script configures project `marketingagent-508322`, enables the required APIs,
creates Firestore and the least-privilege runtime service account, securely
prompts for the OpenAI and GitHub tokens, builds the container, deploys Cloud
Run, and prints the private approval-dashboard URL.

The Cloud Run service account needs Firestore access and Secret Manager Secret Accessor. The GitHub fine-grained token should be limited to the `natureswaysoil/video` repository with Actions read/write permission.

## Required video-repository contract

The selected workflow must accept a `marketing_campaign` workflow-dispatch input containing base64url-encoded campaign JSON. The agent deliberately does not place credentials or product claims in GitHub logs.

## Initial products

- Dog Urine Neutralizer & Lawn Revitalizer
- Hay, Pasture & Lawn Fertilizer
- Liquid Biochar with Kelp, Humic & Fulvic Acid
- Premium Hay, Pasture & Lawn Recovery System

Expand `src/catalog.ts` only with verified label directions, prices, and claims.
