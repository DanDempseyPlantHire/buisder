# Deas Jobs v18 — Production Backup & Recovery

## Before the pilot

Create a D1 backup/export before the first live pilot invitation, every database migration, any bulk cleanup or correction, and any major release.

Keep the export outside the application deployment bundle and restrict access to authorised administrators.

## Cloudflare dashboard approach

Use the Cloudflare D1 database tools for the production `buisder-db` and create/download an export or backup using the controls available in the current D1 dashboard.

Confirm that the export completed, has a non-zero size, the date/time is recorded, and access is restricted. Mark the backup checklist item in Admin -> Launch only after this is confirmed.

## Recovery order

1. Stop further write activity where practical.
2. Record the deployment/version and approximate incident start time.
3. Revert the Pages deployment to the last known-good application version.
4. Do not restore the database simply because the UI is broken.
5. Check `/api/health` and Admin -> Launch.
6. Restore/import a D1 backup only if the database itself was corrupted or a destructive migration must be reversed.
7. Verify login, a candidate account, an employer account, applications and admin access before reopening the pilot.

A code rollback and a database rollback are different actions. Prefer a Pages code rollback when schema and data remain valid. A database restore can discard legitimate user activity created after the backup.
