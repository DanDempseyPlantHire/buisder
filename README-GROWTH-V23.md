# DEASJobs v23 - Growth

This release adds first-party acquisition measurement without enabling paid referral rewards or ad-tech trackers.

## Included
- Admin > Growth dashboard
- Candidate and employer personal referral links
- Partner organisations and partner links
- Campaigns with UTM first-touch attribution
- Campaign and referral conversion through applications, jobs and hires
- Employer acquisition pipeline
- Geographic candidate-versus-live-job view
- Referral code status, expiry, target-role and usage controls
- Data export coverage for growth attribution/referrals
- Privacy/cookie disclosure update and v23 Privacy Notice acceptance
- Admin navigation changed to a 4-column / 3-row mobile grid so Growth does not clip the final buttons

## Deliberately not included
- Cash, credits or points for referrals
- Stripe/payments (v22 remains parked)
- Third-party advertising pixels
- Automated ad buying
- Using growth attribution in hiring decisions

Run `migration-growth-v23-d1-safe.sql` before deploying the v23 code.
