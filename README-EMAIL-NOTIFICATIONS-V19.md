# DEASJobs v19 — Recruitment Email Notifications

v19 reuses the Resend configuration already used by DEASJobs authentication emails.
No additional email provider is required.

## Recruitment emails added

DEASJobs now sends preference-controlled emails for:

- new applications to employers
- candidate shortlisting and application updates
- interview invitations and reschedules
- interview accepted / declined responses to employers
- interview-completed updates
- interview reminders within 24 hours and within 1 hour
- job offers and revised offers
- offer accepted / declined responses to employers
- hired outcomes
- unsuccessful outcomes
- candidate withdrawal updates to employers

Blocking that closes an active recruitment interaction uses the same generic application outcome emails and does not tell the other party that they were blocked.

## User preferences

Both job seekers and employers now have:

`Account & privacy -> Email notifications`

They can control:

- master recruitment-email switch
- application emails
- interview emails
- interview reminders
- offer emails
- final-outcome emails

In-app notifications remain enabled regardless of email preferences.

Security and account-recovery messages are not governed by these preferences. Email verification and password-reset messages continue to send when required.

## Delivery safety

Recruitment email is deliberately non-blocking. A Resend outage must not stop an application, interview response, offer or hiring action from completing.

`email_delivery_log` provides:

- idempotent event keys to prevent duplicate sends
- sent / failed / skipped status
- attempt count
- provider message ID where available
- timestamps

Recipient email addresses and message bodies are not copied into the delivery log.

Admin -> Launch now warns when recruitment email delivery failures have occurred in the last 24 hours.

## Interview reminders

The existing DEASJobs application polls bootstrap while users are active. v19 uses a database throttle so any authenticated app activity can run the due-interview email sweep at most once every 15 minutes.

This is appropriate for the controlled pilot, but it is **not a guaranteed background scheduler**. If DEASJobs needs reminder emails to fire even when nobody is using the app, add a Cloudflare scheduled Worker/Cron trigger in a later release.

## Privacy update

The Pilot Privacy Summary is updated to version `2026-10-16` to describe recruitment email notifications. Existing users are prompted to review and accept the current privacy summary. The Pilot Terms version is unchanged.

## Database migration

Run:

`migration-email-notifications-v19-d1-safe.sql`

before deploying v19.

It creates:

- `notification_preferences`
- `email_delivery_log`
- `email_scheduler_state`

It also creates default preferences for existing users and adds `Recruitment email notifications and preferences tested` to the Admin -> Launch checklist.

No `ALTER TABLE` statements are used.

## Deployment order

1. Back up/export production D1.
2. Run the v19 migration.
3. Deploy v19.
4. Log in with a disposable candidate and employer account.
5. Test every event in `EMAIL-NOTIFICATIONS-TEST-V19.md`.
6. Check Admin -> Launch for email-delivery warnings.
7. Review and accept the updated Privacy Summary on existing test accounts.
