# Deas Jobs v10 — Job offer workflow

This version adds the next hiring-stage workflow after interview completion.

## Flow

Applied
→ Shortlisted
→ Interview invited
→ Interview accepted / declined
→ Interview completed
→ Offer made
→ Offer accepted / declined
→ Hired

## Employer

After an interview is marked completed, the employer can create an offer containing:

- role / position
- pay
- start date
- message to candidate

While an offer is pending, it can be edited/resubmitted.

If the candidate declines, the employer may send a revised offer.

If the candidate accepts, the employer can mark the candidate Hired.

## Job seeker

The Applications screen shows the offer and its details.

A pending offer has:
- Accept offer
- Decline offer

The application status updates immediately after the response.

## Audit trail

The existing `application_status_history` table receives:
- offer_made
- offer_accepted
- offer_declined
- hired

## Database

v10 uses a new `job_offers` table instead of adding more columns to `applications`.

That makes the D1 migration simpler and avoids the ALTER TABLE/default issue encountered in v9.

## Deployment

1. Ensure v9/v9.1 database setup is complete.
2. Run `migration-offers-v10.sql` once.
3. Commit/deploy the v10 files.
4. Let Cloudflare Pages redeploy.
5. Test:
   - candidate applies
   - employer shortlists
   - interview is accepted and completed
   - employer sends offer
   - candidate accepts/declines
   - if accepted, employer marks Hired
