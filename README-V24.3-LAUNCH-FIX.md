# Deas Jobs v24.3 Launch Fix

This release rebuilds the first live post-launch update directly from the v24.1 Free Launch baseline.

## Changes

1. Password minimum reduced from 10 to 8 characters in both signup/reset UI and server-side validation.
2. Employer plan/access UI hidden. Employers no longer see the Access tab, plan card, Manage plan button or feature-job upsell control. Active job posting/reopen/import is no longer restricted by commercial plan limits during free launch.
3. Admin -> Users now has a permanent account-delete control for non-admin accounts. It requires typing DELETE and a final confirmation. Profile/CV/logo objects in R2 are removed before the database user is deleted.
4. Public prototype wording removed, including the old browser title and placeholder-job wording.
5. Reload jobs now deletes skipped-job decisions only. It never deletes applications.
6. Job seekers can Remove application. This records the application as withdrawn, notifies the employer, preserves the employer-side record, and removes the withdrawn application from the job seeker's visible Applications list.
7. Swipe actions are optimistic. The next card renders immediately before the network request completes, and the old 180 ms swipe timeout is removed.
8. Employers can edit posted jobs from Dashboard -> Your jobs -> Edit job. Editable fields include title, location, pay, matching rate, work type, hours, availability, experience, age, industry, start and description.
9. Work experience is available as an employer work type and as a job-seeker feed/profile filter.

## Database

No D1 migration is required for v24.3. All changes use fields and tables already present in v24.1.

## Deployment

Replace the current repository contents with this complete package and deploy through the existing GitHub -> Cloudflare Pages workflow. Do not merge only individual files from older releases.

After deployment, hard-refresh the browser or close/reopen the installed PWA so the new service worker/front-end is picked up.
