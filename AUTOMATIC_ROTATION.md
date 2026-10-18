# Automatic catalog rotation

Owner requested automatic rotation of all Nature's Way Soil products, highlighting liquid bone meal, on 2026-10-17.

The existing `video/.github/workflows/sheet-row-posting.yml` stream owns five Eastern-time windows: 08:00, 11:00, 14:00, 17:00, 20:00. A one-time activation event starts with liquid bone meal. Automatic slots alternate NWS_012 with each of the other 13 in-stock catalog families; every 26 automatic slots contain 13 liquid bone meal features and one of each other family. Manual approved jobs can take the next slot. The current catalog is a reviewed snapshot of `best/data/products.ts`; stock flags are that snapshot, not real-time Amazon inventory.

Automatic copy is assembled from reviewed catalog facts. It does not use free-form model generation, publish prices, invent discounts or application rates, or change Amazon ad settings. Pinterest and website copy remain drafts. Product IDs, ASINs, SKUs, landing URLs and explicit product images accompany each versioned payload. Old four-product drafts are retained as history and must be regenerated when they disagree with the current catalog.

The agent no longer uses a long-lived GitHub personal token for approval/dispatch. The video workflow pulls work with a GitHub-signed short-lived identity. The server verifies signature, issuer, audience, repository and owner IDs, main ref, exact workflow path, event and first run attempt. Worker endpoints cannot change ad budgets, edit arbitrary drafts or expose the approval token.

Each worker run and time slot is permanently reserved in a Firestore transaction together with the campaign and rotation cursor. A rerun or lost response never replays publishing. The video worker additionally uses the existing generation-zero GCS claim. Channel receipts are bound to the same signed run and campaign/job IDs; report retries are safe and do not republish. Partial publication remains visible, even if analytics fail later. A paused control prevents new claims; a running video can finish.

Deployment order: agent first, then the video workflow. The one-time activation file is added only after agent deployment succeeds and scheduler inventory has been reviewed. Other independent website/blog or Cloud Scheduler streams must be inventoried separately; this replaces the existing video workflow stream and does not create an additional recurring schedule.

Validation includes signed-token negative cases, all-product weighted coverage, DST windows, concurrent approval/worker claims, slot/run replay protection, pause behavior, report identity, partial outcomes, image identity and lossless approved narration. Live activation must confirm worker authentication, Firestore/GCS reservations and actual platform receipts before describing publication as validated.
