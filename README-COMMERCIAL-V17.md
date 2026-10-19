# DEASJobs v17 - Employer Plans + Commercial Controls

v17 adds the commercial structure without enabling card payments.

## Employer plans

Four plan records are created:

- Free: 1 active job, 0 featured jobs, EUR0
- Pilot: 5 active jobs, 2 featured jobs, admin-only, EUR0
- Growth: 5 active jobs, 2 featured jobs, price initially unset
- Pro: 20 active jobs, 5 featured jobs, price initially unset

Growth and Pro prices are deliberately not invented. An admin can set the monthly price in Admin -> Commercial before using them commercially.

## Plan enforcement

The server enforces active job limits when an employer:

- publishes a new job
- reopens a paused or closed job

If an employer is already above a lower plan limit after a downgrade, existing active jobs are not automatically closed. The employer cannot activate another job until usage falls below the limit.

## Featured jobs

Eligible plans receive featured-job slots.

Employers can feature or unfeature their own active roles from the employer dashboard. Featured jobs:

- show a Featured badge
- are ordered before ordinary jobs in the candidate feed
- remain subject to candidate filtering and blocking
- stop being featured when timed plan access expires

## Employer plan page

Employers can see:

- current plan and access status
- active-job usage
- featured-job usage
- public plan comparison
- pending upgrade request
- promo/referral-code field
- their referral code and referral count
- commercial history

Online payment is explicitly shown as not enabled.

## Upgrade requests

An employer can request a public plan. The request enters Admin -> Commercial. An admin can:

- approve it with no expiry
- approve it as a timed trial
- reject it

The employer receives an in-app notification when reviewed.

## Promo codes

Admins can create codes with:

- target plan
- access duration in days
- optional redemption limit
- optional expiry

Codes can be activated or deactivated. Each employer can redeem a given promo once.

## Referral tracking

Each employer gets a referral code. Another employer can enter that code from the Plan page. v17 records the referral and notifies the referrer.

v17 does not automatically award credit, cash, discounts or free months for referrals. That rule can be added once the commercial model is decided.

## Admin commercial dashboard

Admin -> Commercial includes:

- employer plan mix
- active trials
- access ending within 7 days
- pending upgrade requests
- featured-job count
- assigned monthly plan value
- editable plan names/descriptions/prices/limits
- employer plan assignment
- timed trial assignment
- promo-code management
- referral counts
- recent commercial history

Assigned monthly plan value is NOT recognised revenue and is clearly labelled as such. There is no payment collection in v17.

## Data protection

Commercial plan history and requests are included in employer data export. Commercial records tied to an employer account are deleted with the account through foreign-key cascades.

## Database

Run this once BEFORE deploying v17:

`migration-commercial-v17-d1-safe.sql`

The migration intentionally contains no ALTER TABLE statements. It creates new commercial tables, seeds the four plan definitions and assigns existing employer accounts to Free unless they already have a commercial account.

## Recommended test

1. Run the v17 D1 migration.
2. Deploy v17.
3. Log in as an employer.
4. Open Plan and confirm the Free plan shows 1 active job / 0 featured jobs.
5. With a Free account, verify a second active job is rejected.
6. Log in as admin -> Commercial.
7. Assign the employer a 30-day Pilot trial.
8. Log back in as employer and confirm 5 active jobs / 2 featured jobs.
9. Feature a live job and confirm it shows Featured to the candidate and is ordered ahead of ordinary jobs.
10. Test an upgrade request.
11. Create and redeem a test promo code.
12. Test a referral code with two disposable employer accounts.
13. Verify Account & Privacy -> Export my data still works.

## Not included yet

v17 deliberately does not add:

- Stripe or other card payments
- invoices or receipts
- VAT/tax calculation
- failed-payment handling
- automated subscription renewal/cancellation
- partner/school/college cohort management

Those belong in later Payments and Pilot Management releases.

## Applicant access

v17 does not limit or hide existing applicants by plan. Once a candidate has applied, the employer can continue the recruitment workflow. This avoids commercial rules interfering with an active application. If applicant-volume pricing is wanted later, it should be designed separately and prospectively.
