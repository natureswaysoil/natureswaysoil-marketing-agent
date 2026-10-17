#!/usr/bin/env bash
# Run once as a Google Cloud administrator. Never prints credential values.
set -euo pipefail
OPTIMIZER_PROJECT=amazon-ppc-bid-optimizer
AGENT_PROJECT=marketingagent-508322
READ_SECRET=CAMPAIGN_MARKETING_READ_TOKEN
if ! gcloud secrets describe "$READ_SECRET" --project="$OPTIMIZER_PROJECT" >/dev/null 2>&1; then
  gcloud secrets create "$READ_SECRET" --project="$OPTIMIZER_PROJECT" --replication-policy=automatic --quiet
fi
if [ -z "$(gcloud secrets versions list "$READ_SECRET" --project="$OPTIMIZER_PROJECT" --filter='state=ENABLED' --format='value(name)' --limit=1)" ]; then
  python3 -c 'import secrets; print(secrets.token_urlsafe(48), end="")' | gcloud secrets versions add "$READ_SECRET" --project="$OPTIMIZER_PROJECT" --data-file=- --quiet >/dev/null
fi
campaign_runtime_sa="$(gcloud run services describe campaign-optimizer --project="$OPTIMIZER_PROJECT" --region=us-central1 --format='value(spec.template.spec.serviceAccountName)')"
test -n "$campaign_runtime_sa"
for reader_sa in "$campaign_runtime_sa" "marketing-agent@${AGENT_PROJECT}.iam.gserviceaccount.com"; do
  gcloud secrets add-iam-policy-binding "$READ_SECRET" --project="$OPTIMIZER_PROJECT" --member="serviceAccount:$reader_sa" --role=roles/secretmanager.secretAccessor --condition=None --quiet >/dev/null
done
gcloud run services update campaign-optimizer --project="$OPTIMIZER_PROJECT" --region=us-central1 --update-secrets="CAMPAIGN_MARKETING_READ_TOKEN=$READ_SECRET:latest" --quiet
gcloud run services update natures-way-marketing-agent --project="$AGENT_PROJECT" --region=us-east1 --update-env-vars=CAMPAIGN_BASE_URL=https://campaign-optimizer-366028971954.us-central1.run.app --update-secrets="CAMPAIGN_READ_TOKEN=projects/366028971954/secrets/$READ_SECRET:latest" --quiet
echo 'Dedicated read credential connected. No optimizer operator token was shared; no campaign or publishing actions performed.'
