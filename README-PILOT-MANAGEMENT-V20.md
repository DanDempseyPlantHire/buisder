# Deas Jobs v20 — Pilot Management + UI Polish

v20 is built on Deas Jobs v19 and is intended to support a controlled real-world pilot with employers, job seekers and partner organisations.

## Pilot management

### Invite codes
Admins can create pilot invite codes with:
- job-seeker, employer or any-account eligibility
- optional cohort assignment
- optional partner/organisation assignment
- optional usage limit
- optional expiry date
- enable/disable control

Invite codes can be copied or emailed directly from Admin -> Pilot using the existing Resend configuration.

An admin can optionally turn on **Require invite code for new signups**. When enabled, a valid pilot invite code is required during account creation.

Existing Deas Jobs users can enter an invite code from Account & Privacy -> Pilot.

### Cohorts and organisations
Admin -> Pilot can create and track:
- pilot cohorts
- employers
- schools
- colleges
- youth organisations
- partner organisations
- other pilot groups

Cohort and organisation cards show participant counts plus jobs, applications and hires associated with their pilot members.

### Participants
The pilot dashboard shows:
- active pilot participants
- job seekers vs employers
- cohort / organisation assignment
- last recorded app open
- candidate profile completion and application count
- employer job count and verification status
- participants with no recorded app open in the last 7 days

Admins can also add an existing Deas Jobs user directly to a pilot by email and can change the user's pilot status, cohort or organisation.

### Feedback
Pilot participants can submit:
- onboarding feedback
- mid-pilot feedback
- exit feedback
- general feedback
- overall rating 1–5
- ease-of-use score 1–5
- recommendation score 0–10
- free-text comments

Admin -> Pilot shows average scores and Net Promoter Score (NPS) from submitted recommendation responses.

### Pilot issue log
Participants can report pilot issues with:
- category
- severity
- title
- details

Admins can review, resolve or close issues and add an admin note. The participant receives an in-app notification when an issue is resolved or closed.

### Privacy and export
The Privacy Summary is updated to version `2026-10-16-v2` to cover pilot participation data.

Pilot membership, linked feedback and pilot issues are included in the user's personal-data export. When an account is deleted, pilot feedback and issue records can remain in de-identified form so pilot findings can still be audited.

## Visual / aesthetic fixes

v20 also includes a UI polish pass based on the reported display issues:

- fixes pale/grey or inherited white text on white cards
- fixes outline buttons appearing white-on-white inside light cards and modal sheets
- fixes signup role selector contrast on white backgrounds
- makes long emails, organisation names, issue text and other long strings wrap rather than overlap adjacent controls
- makes title rows and top-bar controls wrap safely on narrow screens
- changes crowded employer/admin bottom navigation to horizontal scrolling rather than squeezing 6–9 labels into a 430px width
- makes action-button grids responsive
- makes two-column forms collapse safely when the screen is narrow
- keeps wide analytics/admin tables horizontally scrollable instead of forcing text on top of other columns
- improves small-screen spacing below 360px
- fixes the v18 Admin -> Launch routing branch so the Launch page is reachable from the admin navigation

## Database migration

Run:

`migration-pilot-management-v20-d1-safe.sql`

against the existing production Deas Jobs D1 database before deploying v20.

The migration creates:
- `pilot_settings`
- `pilot_cohorts`
- `pilot_organizations`
- `pilot_invite_codes`
- `pilot_memberships`
- `pilot_invite_redemptions`
- `pilot_feedback`
- `pilot_issues`

It also adds the v20 pilot-management test item to the existing launch checklist.

No `ALTER TABLE` statements are used.

## Recommended test sequence

1. Back up/export the production D1 database.
2. Run the v20 migration.
3. Deploy v20.
4. Sign in as admin and open Admin -> Pilot.
5. Create one cohort and one test organisation.
6. Create a one-use job-seeker invite code and one employer invite code.
7. Test a brand-new signup using a code.
8. Test an existing user's Account & Privacy -> Pilot join flow.
9. Submit feedback from a pilot account and confirm it appears in Admin -> Pilot.
10. Log a pilot issue and resolve it from Admin -> Pilot.
11. Test emailing an invite code.
12. Turn on invite-required mode only after the code flow has been tested.
13. Check the UI on iPhone Safari, Android Chrome and desktop Chrome/Edge, especially the bottom navigation, modals, long email addresses and admin tables.
14. Open Admin -> Launch and complete the new v20 pilot-management checklist item.

## Scope

v20 does not add payments or public SEO job pages. Those remain later roadmap items.
