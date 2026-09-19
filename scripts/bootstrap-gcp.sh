#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-marketingagent-508322}"
REGION="${GOOGLE_CLOUD_REGION:-us-east1}"
SERVICE="natures-way-marketing-agent"
REPOSITORY="marketing"
SERVICE_ACCOUNT="marketing-agent@${PROJECT_ID}.iam.gserviceaccount.com"
ROTATE_SECRETS="${ROTATE_SECRETS:-false}"

echo "Configuring Google Cloud project: ${PROJECT_ID}"
gcloud config set project "${PROJECT_ID}"

gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  firestore.googleapis.com \
  iam.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com

if ! gcloud artifacts repositories describe "${REPOSITORY}" --location="${REGION}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${REPOSITORY}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="Nature's Way Soil marketing agent images"
fi

if ! gcloud iam service-accounts describe "${SERVICE_ACCOUNT}" >/dev/null 2>&1; then
  gcloud iam service-accounts create marketing-agent \
    --display-name="Nature's Way Soil Marketing Agent"
fi

for role in roles/datastore.user roles/secretmanager.secretAccessor roles/logging.logWriter; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="${role}" \
    --condition=None \
    --quiet
done

if ! gcloud firestore databases describe --database='(default)' >/dev/null 2>&1; then
  gcloud firestore databases create \
    --database='(default)' \
    --location=nam5 \
    --type=firestore-native
fi

has_enabled_version() {
  [[ -n "$(gcloud secrets versions list "$1" --filter='state=ENABLED' --format='value(name)' --limit=1 2>/dev/null)" ]]
}

put_secret_if_needed() {
  local name="$1"
  local prompt="$2"
  local value
  if ! gcloud secrets describe "${name}" >/dev/null 2>&1; then
    gcloud secrets create "${name}" --replication-policy=automatic
  fi
  if has_enabled_version "${name}" && [[ "${ROTATE_SECRETS}" != "true" ]]; then
    echo "Keeping existing ${name}. Set ROTATE_SECRETS=true to replace it."
    return
  fi
  read -r -s -p "${prompt}: " value
  echo
  if [[ -z "${value}" ]]; then
    echo "${name} was empty; setup stopped without deploying."
    exit 1
  fi
  printf '%s' "${value}" | gcloud secrets versions add "${name}" --data-file=-
  unset value
}

put_secret_if_needed OPENAI_API_KEY "Paste the OpenAI API key (input is hidden)"
put_secret_if_needed GITHUB_TOKEN "Paste a fine-grained GitHub token with Actions write access to natureswaysoil/video (input is hidden)"

if ! gcloud secrets describe MARKETING_AGENT_APPROVAL_TOKEN >/dev/null 2>&1; then
  gcloud secrets create MARKETING_AGENT_APPROVAL_TOKEN --replication-policy=automatic
fi
if ! has_enabled_version MARKETING_AGENT_APPROVAL_TOKEN; then
  APPROVAL_TOKEN="$(openssl rand -hex 32)"
  printf '%s' "${APPROVAL_TOKEN}" | gcloud secrets versions add MARKETING_AGENT_APPROVAL_TOKEN --data-file=-
  echo "Created the approval token. Save it securely: ${APPROVAL_TOKEN}"
  unset APPROVAL_TOKEN
else
  echo "Keeping the existing approval token."
fi

IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/agent:$(date +%Y%m%d-%H%M%S)"
gcloud builds submit --tag "${IMAGE}" .

gcloud run deploy "${SERVICE}" \
  --image="${IMAGE}" \
  --region="${REGION}" \
  --platform=managed \
  --allow-unauthenticated \
  --service-account="${SERVICE_ACCOUNT}" \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GITHUB_OWNER=natureswaysoil,VIDEO_REPOSITORY=video,VIDEO_WORKFLOW=sheet-row-posting.yml,OPENAI_MODEL=gpt-5-mini" \
  --set-secrets="OPENAI_API_KEY=OPENAI_API_KEY:latest,GITHUB_TOKEN=GITHUB_TOKEN:latest,APPROVAL_TOKEN=MARKETING_AGENT_APPROVAL_TOKEN:latest"

SERVICE_URL="$(gcloud run services describe "${SERVICE}" --region="${REGION}" --format='value(status.url)')"
echo
echo "Deployment complete."
echo "Dashboard: ${SERVICE_URL}/login"
echo "The approval token remains in Secret Manager. Do not place it in a URL."
