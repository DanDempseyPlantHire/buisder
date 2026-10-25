# Deas Jobs v15 - Public Jobs + SEO

This release activates the previously parked public-jobs and search-discovery work. It is built on v21 and does not require a D1 migration.

## Public routes
- `/jobs` - public index of active jobs from verified, non-suspended employers.
- `/jobs/<job-id>` - server-rendered public job page.
- `/jobs/category/<slug>` - category landing page.
- `/jobs/location/<slug>` - location landing page.
- `/employers/<employer-id>` - verified employer page.
- `/sitemap.xml` - generated sitemap of public jobs, employers, categories and locations.
- `/robots.txt` - crawler rules and sitemap declaration.
- `/public/logo/<employer-id>` - public logo endpoint restricted to verified, non-suspended employers.

## Search metadata
Public job pages include:
- canonical URL
- title and meta description
- Open Graph metadata
- Twitter summary metadata
- Schema.org `JobPosting` JSON-LD

Only fields Deas Jobs actually stores are emitted. Salary structured data is deliberately omitted rather than guessing a machine-readable salary basis from free text.

## Public visibility rule
A job is public only when:
1. the job is `active`;
2. the employer account is not suspended; and
3. the employer profile is `verified`.

This prevents unverified pilot accounts and suspended employers being indexed.

## Admin bottom navigation fix
Admin navigation now uses two fixed rows of five items instead of a long horizontal strip. Extra bottom content spacing is added in admin mode, including safe-area padding, so the bottom row is not cut off by the viewport/browser controls.

## Deployment
1. Deploy the package through the existing GitHub-connected Cloudflare Pages project.
2. No D1 migration is required for v15.
3. Confirm `APP_URL` is set to the canonical production origin, for example `https://your-domain.example`, without a trailing slash.
4. Visit `/jobs`, one public job, `/sitemap.xml`, and `/robots.txt` after deployment.
5. Test the Admin bottom navigation on iPhone Safari, Android Chrome and desktop.

