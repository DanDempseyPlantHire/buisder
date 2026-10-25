# Deas Jobs v18 — Pilot Launch Readiness

v18 is an operational-readiness release. It does not replace the later Production Legal & Compliance release.

## Admin -> Launch

The new launch dashboard checks D1 connectivity, required tables, R2, Turnstile, email, APP_URL, email-verification enforcement, admin access, demo data, suspended-employer jobs, missing account defaults, unverified accounts, recruitment-record integrity, past pending interviews, stale authentication records, moderation queues, verification queues and commercial request queues.

Critical checks prevent the automated readiness state from passing. Warnings require review. Queue counts are informational.

## Persistent go-live checklist

The D1-backed checklist covers backup, authentication, candidate flow, employer flow, the complete recruitment workflow, privacy/safety, commercial controls, iPhone Safari, Android Chrome, desktop Chrome/Edge, support/escalation and pilot-document review. Checklist changes are written to the existing admin audit log.

## Safe maintenance

Admin -> Launch can clean expired authentication records, repair missing privacy/commercial defaults, close open jobs belonging to suspended employers, and remove only the built-in `seed-employer` demo account and cascading demo records. All maintenance actions are audited.

## Health and failure handling

`/api/health` returns a minimal service/database health result without exposing secrets. If the main bootstrap cannot reach the application service, the UI now shows a clear service-unavailable state with a retry control instead of silently falling back to login.

All `/api/` responses are forced to `Cache-Control: no-store`.

## Database

Run `migration-pilot-readiness-v18-d1-safe.sql` before deploying v18. It uses no `ALTER TABLE` statements.

## Included operational documents
- `BACKUP-RECOVERY-V18.md`
- `PILOT-LAUNCH-TEST-PLAN-V18.md`

## Deployment order

1. Export/back up the existing production D1 database.
2. Run the v18 D1-safe migration.
3. Deploy v18.
4. Visit `/api/health`.
5. Sign in as admin and open Admin -> Launch.
6. Resolve critical automated checks.
7. Remove demo data when it is no longer needed.
8. Complete the manual end-to-end and device/browser tests.
9. Mark checklist items complete only when actually tested.

## Not automated in v18

Automated D1 backups, automated browser/device testing, production legal sign-off, Stripe/payments and public SEO job pages remain separate workstreams.
