# Buisder v13.4 — Password reset diagnostics and hardening

This release addresses the generic "Something went wrong" error after Turnstile.

## Changes

- Frontend now shows the real HTTP/server error rather than hiding it.
- `/api/security/diagnostic` now checks the live D1 database and reports whether:
  - verified_emails exists
  - auth_tokens exists
  - auth_rate_limits exists
  - the v13 security migration is ready
- Forgot-password returns a clear error if the v13 migration was not run.
- Forgot-password reports Resend delivery failures.
- RESEND_API_KEY and EMAIL_FROM are trimmed.
- Password-reset token expiry comparison now uses SQLite `datetime(...)`, supporting both old ISO tokens and new timestamps.
- Password reset uses a D1 batch for the account/token/session changes.

## Database

There is no new v13.4 migration.

However, the original `migration-security-v13.sql` MUST already have been run in the live D1 database.

After deployment open:

`https://YOUR-BUISDER-HOST/api/security/diagnostic`

The important result is:

`securityMigrationReady: true`

and all three of these should be true:

- verified_emails
- auth_tokens
- auth_rate_limits

If `securityMigrationReady` is false, run `migration-security-v13.sql` in the D1 database bound to the live Buisder Pages project.

Then request a NEW password-reset email. Old reset links can be discarded.
