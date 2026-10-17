"""Read-only deployment smoke. Never generates campaigns or publishes content."""
import json
import os
import subprocess
import urllib.request

base = os.environ['SERVICE_URL']
token = subprocess.check_output(['gcloud', 'secrets', 'versions', 'access', 'latest', '--secret=MARKETING_AGENT_APPROVAL_TOKEN', '--project=' + os.environ['PROJECT_ID']], text=True).strip()
identity = os.environ.get('CLOUD_RUN_ID_TOKEN') or subprocess.check_output(['gcloud', 'auth', 'print-identity-token', '--audiences=' + base], text=True).strip()
for path in ['/health', '/', '/api/campaign/status']:
    request = urllib.request.Request(base + path, headers={'x-approval-token': token, 'X-Serverless-Authorization': 'Bearer ' + identity})
    with urllib.request.urlopen(request, timeout=45) as response:
        body = response.read()
    if path == '/health':
        health = json.loads(body)
        if not health.get('ok') or not all(health.get('configured', {}).get(key) for key in ['approvalToken','openai','github','project']):
            raise RuntimeError('Health configuration check failed')
        print('Authenticated live health: PASS')
    elif path == '/':
        if b'Amazon eligibility' not in body:
            raise RuntimeError('Dashboard version check failed')
        print('Authenticated dashboard and Firestore read: PASS')
    else:
        result = json.loads(body)
        if result.get('status') != 'available':
            raise RuntimeError('Campaign read-only connection is unavailable')
        print('Campaign authenticated profit read: PASS')
