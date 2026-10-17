# Buisder v20 Pilot Management Test

Use test accounts for this sequence.

## Invite flow
- Create a cohort.
- Add a pilot organisation.
- Create a job-seeker invite code linked to both.
- Copy the code.
- Create a new job-seeker account using the code.
- Confirm the user appears under Admin -> Pilot with the correct cohort/organisation.
- Create an employer invite code and repeat for an employer.
- Disable an invite and confirm it is rejected.
- Test a one-use code and confirm a second redemption is rejected.
- Test invite expiry.
- Email an invite code and confirm the email arrives.

## Controlled access
- After invite flows are proven, enable Require invite code for new signups.
- Confirm signup without a code is rejected.
- Confirm signup with a valid role-appropriate code succeeds.
- Disable invite-required mode again if the pilot is not yet gated.

## Existing users
- Open Account & Privacy -> Pilot on an existing user.
- Join using a valid code.
- Confirm Admin -> Pilot reflects the membership.
- Use Add existing user from Admin -> Pilot with a separate test account.

## Feedback
- Submit onboarding/general feedback.
- Include rating, ease and recommend score.
- Confirm Admin -> Pilot updates the feedback count and averages.
- Submit a recommendation score and confirm NPS is calculated.

## Pilot issues
- Log a usability or bug issue from a participant account.
- Confirm the admin receives an in-app pilot-issue notification.
- Open the issue in Admin -> Pilot.
- Change it to Reviewing, then Resolved.
- Confirm the participant receives the resolution notification.

## UI / aesthetic checks
Check at 320–430px mobile widths and on desktop:
- no pale text disappears on white cards
- outline buttons remain legible on light cards and modals
- long emails wrap instead of overlapping status badges/buttons
- long organisation and cohort names wrap
- Admin and Employer bottom navigation scrolls horizontally rather than overlapping
- title rows wrap cleanly
- two-column forms collapse cleanly
- analytics/admin tables scroll horizontally
- modal content remains scrollable
- topbar controls do not overlap the Buisder brand
