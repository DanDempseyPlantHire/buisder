# Deas Jobs v25.11 — Job visibility correction (update-only)

Apply **on top of v25.10**. Only these existing files are replaced:

- `public/login.html` — accurate missing-location handling, nonrestrictive default feed, migrated untouched legacy filters, weekend availability matching, Refresh jobs, automatic feed redraw, empty-state filter reset, and clearer employer visibility status.
- `public/sw.js` — updated service-worker cache version for installed phones.

## Install

1. Back up/commit the current GitHub repository first.
2. Extract this patch outside the repository.
3. Copy the contents of the patch's `public` folder over your repo's existing `public` folder, choosing **Replace files**. **Do not delete** existing folders.
4. Commit and push to `main` in GitHub Desktop.
5. Check Cloudflare Pages deployment, then close/reopen the installed PWA or hard-refresh the browser.

No D1 database migration, backend Functions changes, or user-account reset are needed.

## How to verify

- Create an active job as an employer. Check that it appears in the employer dashboard.
- Sign in as a different, age-eligible jobseeker who hasn't already applied/skipped it; select **Jobs → Refresh jobs**. The job should appear, even without device GPS or availability populated.
- For work experience select the **Work experience** tab instead.
- Open Filters: Any distance / Any availability is now the default; custom saved filters remain respected.
- If no jobs appear, use **Clear filters**, **Show skipped jobs**, and check age eligibility.
- Public `/jobs` pages intentionally list only active jobs from verified employers; the signed-in candidate feed can show active jobs from unverified employers.

**Security note:** This patch does not bypass age restrictions, job status checks, user blocks or applicant history.
