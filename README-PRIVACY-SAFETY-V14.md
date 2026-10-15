# Buisder v14 — Privacy, Safety & Moderation

## Included

### User data controls
- Self-service account deletion with password + `DELETE` confirmation.
- R2 profile photo / CV / business logo removed during deletion.
- Personal-data export as JSON.
- Privacy controls for job seekers:
  - share / hide email
  - share / hide CV
  - share / hide profile photo
  - share / hide general location
- Precise matching coordinates are not exposed to employers.

### Young-user protection
- Job-seeker signup requires confirmation that the user is at least 16.
- Profiles marked `16–17` automatically prevent employer access to:
  - direct email
  - CV
  - profile photo
- General location can still be shared.
- Existing minimum-age matching on job listings remains in place.

This is a product safeguard, not an age-verification service.

### Reporting
Job seekers can report:
- a job
- an employer

Employers can report:
- an applicant who applied to one of their jobs

Reasons:
- scam / fraud
- misleading information
- inappropriate content
- harassment
- discrimination
- safety concern
- other

### Blocking
- Job seekers can block employers.
- Employers can block applicants who have applied to them.
- Blocked pairs cannot create new applications.
- Active recruitment interactions are closed when a block is created.
- Blocks can be reviewed and removed from the Safety Centre.

### Admin moderation
New Admin -> Reports queue:
- mark report Reviewing
- Resolve
- Dismiss
- suspend reported user
- close reported job
- moderation actions are added to the existing admin audit log
- reporter receives a generic notification when a report is resolved/dismissed

### Terms & privacy acceptance
New signups must:
- accept Pilot Terms version `2026-10-14`
- acknowledge Privacy Summary version `2026-10-14`
- confirm age 16+ (job seeker), or business authority (employer)

Existing accounts are NOT falsely backfilled as having consented. They can review and accept from Account & Privacy.

Static beta documents:
- `/terms.html`
- `/privacy.html`

These are deliberately labelled pilot documents. They require final legal review and operator/contact details before public commercial launch.

## Database

Run:

`migration-privacy-safety-v14.sql`

once in the live D1 database before deploying v14.

The migration creates:
- `legal_consents`
- `privacy_preferences`
- `user_blocks`
- `safety_reports`

It also gives existing accounts default privacy preferences without creating false consent records.

## Deployment test

1. Run migration.
2. Deploy v14.
3. Existing account -> Profile/Business -> Account & Privacy.
4. Accept current pilot terms/privacy if prompted.
5. Export account data.
6. Test job-seeker privacy toggles with an employer account.
7. Report a test job.
8. Open Admin -> Reports and resolve it.
9. Test block/unblock using test accounts.
10. Create a new account and verify signup checkboxes are required.
11. Set a job seeker to age 16–17 and verify employer cannot see email/CV/photo.
12. Test account deletion only with disposable test accounts.

## Important beta limitation

Employer self-deletion currently removes that employer's jobs and related Buisder recruitment records through the existing database cascade. Before a large public production launch, consider an archival/pseudonymisation model so candidate application history can be retained where appropriate without retaining the deleted employer account.
