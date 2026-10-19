# DEASJobs v25 validation

Validated before packaging:

- Product-facing Buisder references removed from `public/`, Pages Functions and reminder Worker. The only legacy-domain references retained in runtime code are deliberate redirect/compatibility checks for `buisder.com`.
- Production canonical domain is `https://deasjobs.com`.
- PWA name and short name are `DEASJobs`.
- Brand asset path is `/brand/deasjobs-logo.png`.
- Terms and Privacy version constants are `2026-10-19-v25-deasjobs`.
- Functions directory remains below the browser-upload limit target at 89 files.
- JavaScript syntax checks passed across Functions, Workers, scripts and service worker.
- Frontend inline JavaScript syntax checks passed.
- Relative ES-module import resolution passed.
- Fresh `schema.sql` executes with SQLite foreign keys enabled.
- `migration-deasjobs-rebrand-v25.sql` executes twice successfully (idempotency check).
- Existing seeded pilot/commercial wording changes from Buisder to DEASJobs after the migration.

## Intentionally retained internal identifiers

To avoid breaking production data, these infrastructure identifiers are not renamed:

- D1 database: `buisder-db`
- R2 bucket: `buisder-files`
- Existing historical admin-login email where referenced in the old admin migration

These identifiers are not exposed as the customer-facing product name.

## Live checks still required

After deployment:

- Set Cloudflare Pages `APP_URL=https://deasjobs.com`.
- Confirm `deasjobs.com` is attached to the Pages project.
- Confirm `/robots.txt` and `/sitemap.xml` emit `deasjobs.com` URLs.
- Add/verify the new domain in Google Search Console and submit the new sitemap.
- Test authentication, email links, Web Push, PWA install and reminder Worker against the new domain.
