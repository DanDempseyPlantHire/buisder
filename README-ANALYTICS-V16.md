# DEASJobs v16 — Analytics + Pilot Measurement

v15 Public Jobs + SEO remains deliberately deferred. v16 implements the next roadmap block.

## What v16 measures

### Admin pilot dashboard
Admin -> Analytics provides selectable:
- 7 days
- 30 days
- 90 days
- 365 days
- all time

Metrics include:
- new users
- new job seekers
- new employers
- candidate profile completion rate
- jobs posted
- active jobs
- applications
- shortlist rate
- interview rate
- offer rate
- hire rate
- offer acceptance
- average days from application to hire
- employer posting -> applicant conversion
- employer posting -> hire conversion
- job view -> application conversion
- apply vs skip decision rate
- active users recorded by v16
- top jobs
- demand by category
- demand by location
- 14-day signups/applications/hires pulse

The admin dashboard can export headline pilot KPIs as CSV.

### Employer analytics
Employers now have an Analytics tab showing:
- job views
- applications
- shortlist/interview/offer/hire conversion
- offer acceptance
- average time to hire
- performance by job

## First-party product analytics

v16 creates `analytics_events` in DEASJobs's own D1 database.

It records only a small set of product events:
- user_signup
- profile_completed
- job_posted
- app_open
- job_view
- job_skip
- application_submitted

No IP address is stored in analytics_events.
No advertising tracker or third-party analytics SDK is added.

`app_open` is de-duplicated to one event per user per UTC day.
`job_view` is de-duplicated to one event per user/job/day.
Application and job-post events are keyed to their underlying record.

When a user deletes an account, the analytics table uses `ON DELETE SET NULL`
for user_id so retained aggregate events are detached from that account.

The personal-data export includes analytics events that are still linked to the user.

## Historical data

The migration backfills what DEASJobs can reliably reconstruct:
- user signups
- job posts
- applications
- current skip rows

It cannot reconstruct old skip decisions that previous versions deleted after an undo or later application. The dashboard states this limitation.

App-open and job-view measurement begins with v16.

## Database

Run:

`migration-analytics-v16.sql`

once in the live D1 database before deploying the v16 files.

The migration uses CREATE TABLE / CREATE INDEX / INSERT OR IGNORE only.
It contains no ALTER TABLE statements.

## Test

1. Run the v16 migration.
2. Deploy v16.
3. Log in as a job seeker.
4. Open several job detail cards.
5. Apply to one and skip another.
6. Log in as an employer and open Analytics.
7. Confirm application metrics for that employer.
8. Log in as admin and open Admin -> Analytics.
9. Switch between 7d / 30d / 90d / 365d / All.
10. Export the pilot CSV.
11. Complete a recruitment workflow and verify funnel metrics increase.
12. Check data export still works under Account & Privacy.

## Interpretation

For a pilot, the most useful headline sequence is:

Signups -> completed profiles -> applications -> shortlisted -> interviews -> offers -> hires.

Do not judge conversion percentages from very small cohorts. Show both the absolute
counts and the conversion rate, which v16 does.
