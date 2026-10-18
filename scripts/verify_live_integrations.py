"""Read-only deployment smoke. Never generates campaigns or publishes content."""
import json
import os
import subprocess
import urllib.request

base = os.environ['SERVICE_URL']
with urllib.request.urlopen(base + '/health', timeout=45) as response:
    health = json.load(response)
if not health.get('ok') or not all(health.get('configured', {}).get(key) for key in ['approvalToken', 'openai', 'worker', 'project']):
    raise RuntimeError('Health configuration check failed')
with urllib.request.urlopen(base + '/login', timeout=45) as response:
    if b'type="password"' not in response.read():
        raise RuntimeError('Public login check failed')
with urllib.request.urlopen(base + '/', timeout=45) as response:
    if not response.url.endswith('/login'):
        raise RuntimeError('Unauthenticated dashboard access was not blocked')
print('Public health/login and dashboard sign-in protection: PASS')
token = subprocess.check_output(['gcloud', 'secrets', 'versions', 'access', 'latest', '--secret=MARKETING_AGENT_APPROVAL_TOKEN', '--project=' + os.environ['PROJECT_ID']], text=True).strip()
for path in ['/', '/api/campaign/status']:
    request = urllib.request.Request(base + path, headers={'x-approval-token': token})
    with urllib.request.urlopen(request, timeout=45) as response:
        body = response.read()
    if path == '/':
        if b'Automatic product rotation' not in body:
            raise RuntimeError('Dashboard version check failed')
        print('Authenticated dashboard and Firestore read: PASS')
    else:
        result = json.loads(body)
        if result.get('status') == 'not_configured':
            print('Campaign reader: NOT CONFIGURED; dedicated secret setup still required')
        elif result.get('status') != 'available':
            raise RuntimeError('Configured Campaign read-only connection is unavailable')
        else:
            print('Campaign authenticated profit read: PASS')
