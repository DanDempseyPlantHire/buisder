# DEASJobs v15 SEO launch checklist

## Before indexing
- Confirm the production custom domain and set `APP_URL` to that canonical origin.
- Confirm only verified employers are intended to be publicly discoverable.
- Review at least three public job pages for title, company, location, description and application CTA.
- Confirm closed/paused jobs return a non-indexable 404 public page.
- Confirm a suspended employer's jobs disappear from public pages.
- Confirm employer public pages do not expose email addresses, phone numbers, registration numbers or candidate information.

## Technical checks
- Open `/robots.txt` and confirm the sitemap URL uses the production domain.
- Open `/sitemap.xml` and confirm active public jobs are present once each.
- Validate several job URLs with Google's Rich Results Test for `JobPosting` markup.
- Confirm category and location landing pages only index when they contain jobs.
- Confirm canonical URLs use HTTPS production URLs.

## Google Search Console
- Add/verify the production domain or URL-prefix property in Google Search Console.
- Submit `/sitemap.xml`.
- Use URL Inspection on `/jobs` and a representative job page.
- Request indexing only after the public content is production-ready.
- Monitor indexing, structured-data/job-posting reports and crawl errors after launch.

## Ongoing
- Keep employer verification current.
- Close roles promptly when no longer available.
- Review Search Console errors before changing structured data.
- Do not add salary JSON-LD unless DEASJobs stores reliable structured salary amount/unit/currency data.
