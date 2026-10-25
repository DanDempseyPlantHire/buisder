# Deas Jobs v25 Rebrand

Current production package for Deas Jobs, formerly Buisder.

## Rebrand changes
- Product name changed everywhere in the application from Buisder to Deas Jobs.
- Canonical production domain changed to `https://deasjobs.com`.
- SEO metadata, structured data, sitemap, robots.txt, public job pages and employer pages now use Deas Jobs.
- PWA name, install prompts, offline screen, notifications, emails, legal pages and downloadable filenames now use Deas Jobs.
- Brand asset path is now `/brand/deasjobs-logo.png`. The current supplied logo artwork is retained until a replacement Deas Jobs logo is provided.
- Existing users are prompted to accept the rebranded Terms and Privacy versions.
- A root middleware redirects `buisder.com`, `www.buisder.com` and `www.deasjobs.com` to `https://deasjobs.com` when those hostnames are connected to this Pages project.

## Infrastructure intentionally unchanged
The existing Cloudflare D1 database name `buisder-db`, R2 bucket `buisder-files`, and existing admin-login email are retained internally so the rebrand does not break or orphan production data. They are not customer-facing brand names.

## Database
Run `migration-deasjobs-rebrand-v25.sql` once after backing up D1. It updates old Buisder wording stored in existing production records.
