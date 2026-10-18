# Buisder v12 — Timeline + employer controls + notifications

This release combines the next three roadmap items.

## 1. Application timeline

Both job seekers and employers can now see a chronological application history.

The timeline uses the existing `application_status_history` table and displays events such as:
- Applied
- Shortlisted
- Interview invited
- Interview accepted / declined
- Interview completed
- Offer made
- Offer accepted / declined
- Hired
- Unsuccessful
- Withdrawn

Employer-only history notes remain visible to the employer. Candidate timeline data does not expose employer internal notes.

## 2. Employer controls

Employers can now manage job lifecycle directly from the dashboard:
- Pause job
- Reopen job
- Close job

Only `active` jobs appear in the job-seeker feed.

Applicant management now includes:
- filter by job
- filter by active / shortlisted / interview / offer / hired / closed stages
- job-specific applicant counts
- stage-appropriate actions retained from earlier releases

No database migration is required for paused job status because `jobs.status` is already TEXT.

## 3. Notification centre

A new notification bell appears in Buisder.

Notifications are created for:
- new applications (employer)
- shortlisted / moved back to Applied (candidate)
- interview invitation / reschedule (candidate)
- interview accepted / declined (employer)
- interview completed (candidate)
- job offer / revised offer (candidate)
- offer accepted / declined (employer)
- hired (candidate)
- unsuccessful (candidate)
- withdrawn application (employer)
- accepted-interview reminders within 24 hours and within 1 hour

Features:
- unread badge
- notification history
- mark one as read
- mark all as read
- clicking an application notification opens the appropriate Applications/Applicants area
- browser Notification API alerts while Buisder is open, if the user grants permission

## Important notification limitation

This release provides persistent in-app notifications and browser alerts while the web app is running.

True background push notifications when Buisder is fully closed require Web Push subscriptions/VAPID infrastructure.
Email notifications require an email delivery provider and domain configuration.
Those are not enabled by this release.

## Database deployment

Run `migration-roadmap-v12.sql` once before deploying the v12 code.
It only creates the `notifications` table and indexes.
There are no ALTER TABLE statements.

## Test sequence

1. Candidate applies -> employer gets notification.
2. Employer shortlists -> candidate gets notification.
3. Employer sends interview -> candidate gets notification.
4. Candidate accepts -> employer gets notification.
5. Employer marks interview complete.
6. Employer sends offer -> candidate gets notification.
7. Candidate accepts -> employer gets notification.
8. Employer marks Hired -> candidate gets notification.
9. Open Application timeline on both accounts and check chronology.
10. Pause an active job and confirm it disappears from the job-seeker feed.
11. Reopen it and confirm it returns.
12. Filter employer applicants by job and stage.

## Roadmap status update after v21
- v15 Public Jobs + SEO: implemented in the post-v21 build.
- v22 Payments: intentionally parked by product decision; retain for later.
- v23 Growth: retain for later after payments/public launch priorities are revisited.


## Current roadmap status after v23
- v15 Public Jobs + SEO: complete
- v23 Growth: complete
- v22 Payments: parked for later at user request
- Post-launch enhancements: later

## Current roadmap status after v24
- v15 Public Jobs + SEO: complete
- v23 Growth: complete
- v22 Payments: complete as part of v24 Production Expansion
- Web Push notifications: complete in v24
- Advanced transparent job matching: complete in v24
- Fraud/abuse risk controls: complete in v24
- Application-only messaging: complete in v24
- Installable PWA/mobile improvements: complete in v24
- Generic employer integration API and interview calendar export: complete in v24
- Provider-specific ATS/HR connectors remain future integrations requiring provider credentials/specifications.


## Current launch decision
Payment processing is deferred. v24.1 launches free while retaining PWA, Web Push, matching, messaging, risk controls and integrations. Stripe/payment work is parked for a later release.
