# Reliable marketing execution and Campaign reads

This patch requires the companion `video` workflow change before agent rollout. It adds a required durable job identity for approved marketing payloads. Existing sheet-based scheduled runs retain their current behavior.

## Agent behavior

- Firestore transaction claims approval before sending a workflow request. Concurrent approval/rejection requests cannot send the same draft twice.
- Explicit HTTP client rejection permits a new dispatch attempt. Accepted, interrupted, rate-limited, server-error and lost-response requests never automatically replay.
- Refresh execution results reconciles an exact `marketing-job:<uuid>` workflow name. A bounded search that cannot find a unique run retains the hold.
- Workflow completion is separate from publishing. Only an identity-checked channel receipt containing a post ID confirms publishing. Pinterest and website remain draft-only.
- Existing dispatched records remain unconfirmed; do not replay them automatically.
- There is no new scheduler. Reconciliation is an authenticated dashboard action. A later background worker can call the same reconciler without dispatching jobs.

## Companion video behavior

The worker atomically creates a permanent generation-zero GCS job claim before rendering or publishing. Existing claims and GitHub reruns fail closed. It writes sanitized channel outcomes (IDs and statuses, no credentials or provider error bodies) before analytics and uploads a receipt even when the workflow fails later. Failed or interrupted publishing remains unconfirmed because the remote platform may have accepted the request.

Recovery is intentionally manual after a claim: inspect receipts and platform records rather than delete a claim or rerun the workflow. This favors avoiding duplicate posts over automatic retry.

## Campaign connection

`CAMPAIGN_BASE_URL` is an optional HTTPS origin. `CAMPAIGN_READ_TOKEN` is the dedicated `CAMPAIGN_MARKETING_READ_TOKEN` Secret Manager value passed in `X-Marketing-Read-Token`. The adapter implements only GET `/api/profit/status` and GET `/api/profit/eligibility/<numeric campaign ID>`. No bids, budgets, settings, costs or launch flags are changed. Existing safety blocker explanations are passed through.

Configure these values only during a separately approved deployment. The existing deployment workflow uses `--set-env-vars`; add the selected URL and a secret reference there when enabling the connection so later deploys do not remove them. No secret values belong in git.

## Rollout and validation

1. Review both PRs; merge the video companion first when approved.
2. Confirm the runtime has permission to create generation-zero job claims in its configured GCS state bucket, and GitHub token has video Actions read/write.
3. Deploy the agent only with explicit approval; configure Campaign reads if desired.
4. Generate a draft, approve once, and refresh execution. Check the run identity, durable claim and actual platform IDs. Do not use live publishing as a routine test.
5. Retain existing schedules pending a separate inventory/consolidation patch. This patch does not enable or disable any schedule.

Shared catalog/landing-page migration and website/social adapters remain separate patches. No claim of live publishing validation is made by the offline tests.

Validation: agent type-check/build and offline tests pass. Video production `src` type-check and marketing contract tests pass after `npm ci --ignore-scripts`. Explicit strict checking of the posting scripts encounters five existing nullable/type errors in `post-scheduled.ts`; running the same command on the unchanged main-branch script reproduces all five. No live Google Cloud or social publishing validation was performed.
