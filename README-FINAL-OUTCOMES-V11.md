# DEASJobs v11 — Final application outcomes

## Added

### Employer: Unsuccessful
Employers can mark an active candidate Unsuccessful.

This:
- changes application status to `unsuccessful`
- records the action in `application_status_history`
- closes a pending interview invitation
- closes a pending offer
- prevents further hiring actions on the application

An employer cannot mark a candidate unsuccessful after the candidate has accepted an offer. That state must be resolved directly rather than silently reversing an accepted offer.

### Job seeker: Withdraw
A candidate can withdraw their own application at any point before a final outcome.

This:
- changes application status to `withdrawn`
- records the action in `application_status_history`
- closes a pending interview invitation
- closes a pending offer
- prevents further employer hiring actions

### Hired
The existing `hired` status remains a final state.

### Final-state locking
The server now blocks attempts to:
- shortlist a closed application
- invite a closed application to interview
- respond to an interview after the application has moved on
- perform employer status actions after Hired / Unsuccessful / Withdrawn

## Database migration

No database migration is required for v11.

The existing `applications.status` TEXT field and the v9 `application_status_history`
table already support the new status values.

## Deployment

1. Do NOT run another D1 migration for v11.
2. Commit/deploy the v11 files to GitHub.
3. Let Cloudflare Pages redeploy.
4. Test both paths:

Employer outcome:
Applied → Shortlisted → Interview → Unsuccessful

Candidate outcome:
Applied → Withdraw application

Also verify that closed applications no longer show active shortlist/interview/offer controls.
