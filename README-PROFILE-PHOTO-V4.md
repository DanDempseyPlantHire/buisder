# Buisder persistent profile photo + onboarding v4

## What changed
- Every job seeker, including existing accounts, can upload or change a profile picture from **Profile**.
- Existing job seeker accounts are prompted once to complete/confirm their profile after the database migration.
- New job seekers are prompted after first signup.
- Profile pictures are compressed in the browser and persisted in D1.
- Employers can see the applicant picture in the Applicants list and full applicant view.

## Required Cloudflare step for an existing database
Run `migration-profile-photo.sql` **once** in the D1 Console before deploying this version.

This migration adds:
- `photo_data`
- `onboarding_complete`

It does not delete existing users, jobs, applications, or interview invitations.
