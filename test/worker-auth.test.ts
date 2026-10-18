import test from 'node:test'
import assert from 'node:assert/strict'
import {generateKeyPair,exportJWK,createLocalJWKSet,SignJWT} from 'jose'
import {authenticateWorker,WORKER_AUDIENCE} from '../src/worker-auth.js'
test('only signed main-branch video worker identities are trusted',async()=>{
 const pair=await generateKeyPair('RS256');const jwk=await exportJWK(pair.publicKey);const keys=createLocalJWKSet({keys:[{...jwk,kid:'test',alg:'RS256'}]})
 const claims={repository:'natureswaysoil/video',repository_id:'1075012006',repository_owner_id:'224654773',ref:'refs/heads/main',workflow_ref:'natureswaysoil/video/.github/workflows/sheet-row-posting.yml@refs/heads/main',run_attempt:'1',run_id:'123',event_name:'schedule'}
 const token=async(patch:Record<string,unknown>={},aud=WORKER_AUDIENCE,expires='5m')=>new SignJWT({...claims,...patch}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer('https://token.actions.githubusercontent.com').setAudience(aud).setSubject('immutable-repository-subject').setIssuedAt().setExpirationTime(expires).sign(pair.privateKey)
 assert.equal((await authenticateWorker('Bearer '+await token(),keys)).runId,'123')
 for(const patch of [{repository:'someone/video'},{repository_id:'999'},{ref:'refs/pull/1/merge'},{workflow_ref:'natureswaysoil/video/.github/workflows/other.yml@refs/heads/main'},{run_attempt:'2'},{event_name:'pull_request'}])await assert.rejects(()=>token(patch).then(jwt=>authenticateWorker('Bearer '+jwt,keys)))
 await assert.rejects(()=>token({},'https://wrong-audience').then(jwt=>authenticateWorker('Bearer '+jwt,keys)));await assert.rejects(()=>token({},WORKER_AUDIENCE,'-1m').then(jwt=>authenticateWorker('Bearer '+jwt,keys)));await assert.rejects(()=>authenticateWorker('Bearer unsigned',keys))
})
