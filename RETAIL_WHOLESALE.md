# Retail and wholesale expansion — operating guide

The wholesale CRM at `/retail` stores prospects in the `retail_prospects` Firestore collection. **It never sends messages**; the `approved_to_send` stage records editorial approval only. Do not interpret it as an instruction to initiate a transmission.

## Prospect workflow
1. Research the retailer or distributor using official sources. Confirm whether new vendors should use a portal instead of unsolicited email.
2. Enter the business, website, category, and source in notes. Start in `research`.
3. Verify the buyer's public business contact address independently; only then check *I verified this email*.
4. Preview the personalized draft. Review all claims, recipient, pricing and links.
5. Use the retailer's supplier portal when required. For other verified business contacts, export a draft into an approved email tool and record the message only after a confirmed send receipt.
6. Track replies, opt-outs, samples, trial orders, and reorders. Never contact opted-out or declined recipients.

## Initial research targets (names only; none are preloaded as verified contacts)
- BFG Supply — horticultural distributor
- Wyatt-Quarles Seed Company — regional distributor
- Griffin Greenhouse Supplies — horticultural distributor
- Tractor Supply — national farm and garden chain; supplier portal
- Ace Hardware — retail hardware network
- Southern States — agricultural supply retailer
- Independent NC garden centers and nurseries — local owner/buyer introductions

## Safe rollout
- Keep outgoing email integration disabled until identity, SPF/DKIM/DMARC, contact provenance, opt-out handling, deduplication, per-day limits, and delivery receipts are verified.
- Never use guessed emails or scrape private addresses.
- Capture a clear reason for targeting each retailer. Avoid guarantees about results or regulatory claims.
- Test against the in-memory store, then preview the application in staging before merging.
- `npm ci && npm run typecheck && npm test` must pass before deployment.
