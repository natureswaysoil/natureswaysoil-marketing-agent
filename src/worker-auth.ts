import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey, type JWTPayload } from 'jose'
const issuer = 'https://token.actions.githubusercontent.com'
const keys = createRemoteJWKSet(new URL(issuer + '/.well-known/jwks'))
export const WORKER_AUDIENCE = 'https://natures-way-marketing-agent-784311047921.us-east1.run.app'
export type WorkerIdentity = { runId: string; event: 'schedule' | 'workflow_dispatch' | 'push' }
export function validateWorkerClaims(claims: JWTPayload): WorkerIdentity {
  if (claims.repository !== 'natureswaysoil/video' || claims.repository_id !== '1075012006' || claims.repository_owner_id !== '224654773' || claims.ref !== 'refs/heads/main' || claims.workflow_ref !== 'natureswaysoil/video/.github/workflows/sheet-row-posting.yml@refs/heads/main' || claims.run_attempt !== '1' || !/^\d+$/.test(String(claims.run_id)) || !['schedule','workflow_dispatch','push'].includes(String(claims.event_name))) throw new Error('Untrusted worker')
  return { runId: String(claims.run_id), event: claims.event_name as WorkerIdentity['event'] }
}
export async function authenticateWorker(authorization = '', resolver:JWTVerifyGetKey = keys) {
  if (!authorization.startsWith('Bearer ')) throw new Error('Worker identity required')
  const { payload } = await jwtVerify(authorization.slice(7), resolver, { issuer, audience: WORKER_AUDIENCE, algorithms: ['RS256'], maxTokenAge: '10m', requiredClaims: ['exp','iat','sub'] })
  return validateWorkerClaims(payload)
}
