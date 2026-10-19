# DEASJobs v19 — Email Notification Test Plan

Use disposable candidate and employer accounts whose inboxes you can access.

## Configuration check

Confirm existing Cloudflare Pages variables remain configured:

- `RESEND_API_KEY`
- `EMAIL_FROM`
- `APP_URL`
- `EMAIL_VERIFICATION_REQUIRED=true`

No new secret is required for v19.

## Candidate-to-employer tests

1. Candidate applies to an active job.
   - Employer receives in-app notification.
   - Employer receives `New application` email.
2. Candidate accepts an interview.
   - Employer receives interview-accepted email.
3. Candidate declines a disposable interview.
   - Employer receives interview-declined email.
4. Candidate accepts or declines a disposable offer.
   - Employer receives the matching offer-response email.
5. Candidate withdraws a disposable application.
   - Employer receives application-withdrawn email.

## Employer-to-candidate tests

1. Employer shortlists candidate.
   - Candidate receives shortlisted email.
2. Employer sends interview invitation.
   - Candidate receives date/time/location in the email.
3. Employer reschedules interview.
   - Candidate receives updated interview email.
4. Employer marks interview complete.
   - Candidate receives interview-completed email.
5. Employer makes an offer.
   - Candidate receives role, pay and start date.
6. Employer revises offer terms.
   - Candidate receives an updated-offer email.
7. Employer marks a disposable candidate unsuccessful.
   - Candidate receives a generic application-outcome email.
8. Employer marks an accepted offer hired.
   - Candidate receives hired email.

## Preference tests

From Account & privacy -> Email notifications:

1. Turn off `Applications` emails and save.
2. Trigger an application-category event.
3. Confirm the in-app notification still appears but no recruitment email arrives.
4. Turn the master `Recruitment emails` switch off.
5. Confirm all recruitment-category checkboxes become disabled in the UI.
6. Trigger a recruitment event and confirm no recruitment email is sent.
7. Request a password reset while recruitment emails are off.
8. Confirm the security/password-reset email still arrives.

## Reminder test

Use a disposable accepted interview scheduled within 24 hours.

1. Keep one authenticated DEASJobs session active long enough for bootstrap to run.
2. Confirm the 24-hour reminder email arrives.
3. Check that refreshing repeatedly does not create duplicate reminder emails.
4. For a test interview within one hour, confirm the one-hour reminder email is also deduplicated.

## Admin check

Open Admin -> Launch.

Confirm:

- `Recruitment email delivery` appears in automated preflight.
- no recent failures are shown after successful tests.
- the new manual checklist item `Recruitment email notifications and preferences tested` is available.
