# Buisder v24 validation

Validated locally before packaging:

- Fresh `schema.sql` executes with SQLite foreign keys enabled.
- All 15 v24 production-expansion tables are present.
- The v23 schema upgrades to v24 successfully.
- The v24 migration executes twice successfully, confirming idempotent migration behaviour.
- Billing catalogue seeds, v24 launch-readiness checklist seeds and Stripe processor seed are present.
- JavaScript syntax checks pass for Pages Functions, the scheduled reminder Worker, scripts and the service worker.
- Pages Function and Worker ES modules import successfully and relative module paths resolve.
- Inline JavaScript in public HTML pages passes syntax checking.

## Live testing still required

Local validation cannot prove external-service operation. Before live launch, test in the real Cloudflare environment with:

- Stripe test-mode secret key, webhook secret, Customer Portal and actual Growth/Pro/featured Price IDs.
- A real browser/device Web Push subscription using generated VAPID keys.
- The separate scheduled reminder Worker against the production D1 binding.
- PWA installation on iPhone Safari and Android Chrome.
- One complete candidate/employer workflow covering matching, messaging, interview reminders, offer/hire, risk review and data export/deletion.

Do not switch Stripe to live mode until the test plan passes.
