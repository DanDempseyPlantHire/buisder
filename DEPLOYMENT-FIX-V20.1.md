# DEASJobs v20.1 Cloudflare Pages build fix

Cloudflare reported unresolved imports for these exact files:

- `functions/_lib/readiness.js`
- `functions/_lib/pilot.js`
- `functions/_lib/email-notifications.js`

Upload/commit these files to the repository using those exact paths, preserving lowercase filenames and the `_lib` directory.

No D1 migration is required for this fix.
