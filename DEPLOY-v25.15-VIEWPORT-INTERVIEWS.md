# Deas Jobs v25.15 — Swipe / dashboard viewport and unsuccessful interview cleanup

## Update only
Replace these existing repository files:
- `public/login.html`
- `public/sw.js`

Based on v25.14.1. Does not replace any logo, server route, database schema or other application file. No Cloudflare Functions files added.

## Changes
- On mobile screens, the Jobs and Work experience swipe card fits between the header and bottom tabs (100dvh / safe-area aware), with compact metadata and a shortened description. Open **View details** for the complete description and job details.
- The employer Home dashboard fits the viewport: headline, shortcuts, verification status and stats stay visible, while the **Your listings** subsection can scroll if it contains many listings. The entire dashboard page doesn't require scrolling.
- Marking an interview/application unsuccessful removes it from the employer's active applicant filter; the Closed filter still contains it. Jobseekers no longer see a cancelled interview invitation or calendar link for an unsuccessful application. The existing backend closes pending invites and offers, preserves application history, and notifies the jobseeker.
- The default employer applicant filter is Active rather than All.

## Deploy
1. Extract the ZIP.
2. Copy the included `public` files into your existing repository, preserving paths; replace existing files.
3. Commit and push through GitHub Desktop.
4. Verify the Cloudflare Pages production deployment for deasjobs.com.
5. On an iPhone, close/reopen the web app after deployment so the revised service worker takes effect.

## Check after deployment
- iPhone: Jobs and Work experience feeds show swipe actions and bottom navigation without page scrolling, in both short and long jobs.
- iPhone: employer dashboard shows overview without whole-page scrolling. Long listings may scroll inside their panel.
- Mark an interview unsuccessful: it disappears from employer's Active filter, shows under Closed, is no longer a pending candidate interview, and the candidate receives the outcome notification.
- Open a job's View details for the full description.

Note: deleting application records outright was deliberately avoided to protect audit/history and candidate outcome communications. Exact mobile rendering and the production backend still require testing on your deployment.
