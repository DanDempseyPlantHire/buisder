# Buisder v24 Production Expansion

v24 combines the previously parked v22 Payments release with the post-launch enhancement work.

## Included

### Payments
- Stripe Checkout for Growth and Pro employer subscriptions.
- Stripe Checkout for paid featured-job placement.
- Existing Stripe customers are reused.
- Existing active subscriptions are protected from duplicate subscription creation.
- Stripe Customer Portal entry point for subscription management, cancellation, invoice/receipt history and plan changes when enabled in Stripe Portal configuration.
- Webhook verification and idempotent event processing.
- Subscription state synchronises to Buisder commercial-plan access.
- Failed-payment notifications.
- Paid invoice records and revenue reporting by currency in Admin -> Billing.
- Featured-placement refund handling removes a Stripe-funded promotion.
- Card data is not stored by Buisder.
- Growth/Pro prices are not invented. Configure Buisder plan display prices and matching Stripe Price IDs before enabling live checkout.

### Installable app / PWA
- Web app manifest.
- 192px and 512px icons.
- Service worker and offline fallback.
- Install button and iPhone Add to Home Screen instructions.
- API responses are excluded from service-worker caching.

### Web Push
- Browser Push API subscription storage.
- VAPID-signed encrypted Web Push delivery.
- Push is generated from the existing in-app notification pipeline, so recruitment and message notifications can reach an installed/supported browser while Buisder is closed.
- Self-service push enable/disable.
- Dead 404/410 push endpoints are disabled automatically.

### Matching
- Server-side transparent rule-based job scoring.
- Uses age eligibility, availability, distance/location, pay, employment type, interests and experience.
- Candidate UI shows match reasons.
- No applicant ranking for employers and no automated hiring decision.

### Fraud, abuse and safety
- Behavioural risk flags for unusually rapid applications, job-posting bursts, repeated safety reports and repeated message reports.
- Admin -> Risk human-review queue.
- Flags can be reviewed, dismissed or actioned.
- Reported messages can be reviewed, resolved or dismissed.
- No IP address is stored for these risk controls.

### Application messaging
- Candidate/employer messaging is limited to an existing application.
- No unrestricted cold direct messaging.
- Blocking is respected.
- Messages can be reported.
- New messages use the existing notification system and Web Push where enabled.

### Employer integrations
- Employer API keys are generated once and stored only as SHA-256 hashes.
- Verified employers can bulk import/update up to 50 jobs per request using stable external job IDs.
- Active-job plan limits are enforced for imported jobs.
- API keys can be revoked.
- Interview invitations can be exported as an ICS calendar file.
- Provider-specific ATS/HR connectors are not preconfigured; v24 provides the secure generic integration surface they can connect to later.

## Legal/privacy changes
Terms and Privacy versions are `2026-10-17-v24`. Existing users are prompted to review the updated documents. v24 also adds working compliance-register entries for Stripe billing, Web Push, messaging, risk controls and integration credentials. These remain subject to the existing qualified legal/privacy review requirement before general commercial launch.

## Deployment order
1. Back up the production D1 database.
2. Run `migration-production-expansion-v24-d1-safe.sql` against the existing `buisder-db`.
3. Deploy the full v24 package through the existing GitHub -> Cloudflare Pages workflow.
4. Configure Stripe test-mode secrets and webhook.
5. Configure Stripe Price IDs in Admin -> Billing.
6. Generate/configure VAPID keys.
7. Deploy the included `buisder-reminders` scheduled Worker so interview reminders run even with no Pages traffic.
8. Run Admin -> Launch preflight.
9. Complete `V24-TEST-PLAN.md` in test mode before switching Stripe to live mode.

Do not put Stripe secret keys, webhook secrets or VAPID private keys in GitHub.
