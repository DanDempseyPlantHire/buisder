# Buisder v24 production expansion test plan

Run these tests before enabling live charging.

## Database and deployment
- v24 migration completes.
- Run Admin -> Launch and confirm there are no critical schema/configuration failures.
- `/api/health` returns healthy.
- Existing candidate, employer and admin accounts still sign in.

## Stripe test mode
- Admin Billing correctly shows whether Stripe secret and webhook secret are configured.
- Configure test-mode Growth/Pro/Featured Price IDs.
- Employer can start Growth checkout.
- Successful test subscription appears in Admin -> Billing and changes employer commercial access.
- Duplicate subscription checkout is prevented while an active subscription exists.
- Stripe Customer Portal opens.
- Configure Portal plan switching and test Growth -> Pro / Pro -> Growth if you intend to allow those changes.
- Cancel subscription and confirm Stripe webhook eventually returns the employer to Free after the subscription is deleted/ends.
- Trigger/test a failed invoice and confirm Buisder shows past-due state and a notification.
- Confirm a paid invoice appears in collected revenue.
- Buy a featured placement in test mode; confirm promotion starts and purchase is recorded.
- Refund the featured purchase; confirm the purchase becomes refunded and Stripe-funded promotion is removed.
- Confirm no card number/CVC is present anywhere in D1.

## PWA
- Android Chrome: install from browser/Buisder Install button.
- iPhone Safari: Add to Home Screen instructions are correct.
- Installed app opens standalone.
- Offline navigation shows the offline fallback rather than a blank page.
- Signed-in API content is not served from service-worker cache.

## Web Push
- Configure VAPID keys.
- Enable App notifications from Account & Privacy.
- Test push arrives.
- Close Buisder and trigger a recruitment notification from the other test account.
- Deploy the scheduled reminder Worker and confirm a due interview reminder is generated without opening the Pages app.
- Confirm push opens Buisder when tapped.
- Disable push and confirm no further push is sent to that subscription.

## Matching
- Candidate with age 16-17 cannot see an 18+ job after feed filtering.
- Availability, distance, pay, work type, interests and experience affect match score/reasons as expected.
- Match reason text is readable and does not overlap.
- Employer applicant ordering is not based on the candidate match score.

## Messaging and safety
- Candidate can message only the employer for an existing application.
- Employer can reply only for its own application.
- Unrelated user cannot access the thread.
- Blocked accounts cannot message.
- Candidate can report an employer message and employer can report a candidate message.
- Report appears in Admin -> Risk.
- Admin can set report Reviewing, Resolved or Dismissed.
- Repeated message/safety reports produce a risk flag for human review.

## Behavioural risk
- Test rapid-application flag using a non-production test account.
- Test high job-posting volume flag with a test employer if desired.
- Admin can move flags through Reviewing, Dismissed and Actioned.
- No risk flag automatically rejects an applicant or closes an employer account.

## Integrations
- Employer creates API key and sees the full secret only once.
- Database stores only hash/prefix, not the full secret.
- Verified employer can import a job using Bearer key.
- Reusing the same `externalId` updates the same Buisder job.
- Plan active-job limit is enforced.
- Revoked key returns authentication failure.
- Candidate/employer can download an ICS interview calendar event for an application they are allowed to see.

## Data protection
- Updated Terms/Privacy acceptance prompt appears after v24 deployment.
- Data export contains application messages and relevant billing/integration metadata.
- Employer with active Stripe subscription is prevented from deleting account until billing is cancelled.
- Account deletion still removes Buisder files and cascaded application data after billing condition is satisfied.
