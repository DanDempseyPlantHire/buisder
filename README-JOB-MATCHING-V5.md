# Buisder v5 — Job matching and filters

This upgrade adds:

## Job seeker
- Filter by category
- Maximum travel distance
- Minimum hourly pay
- Work type
- Experience requirement
- Availability matching
- Automatic age-eligibility filtering
- Feed sorted by calculated fit score
- Optional device location for real distance calculation
- Matching preferences in the permanent Profile page

## Employer
Job posting now captures structured:
- industry
- work type
- minimum age eligibility
- hourly pay for matching
- availability / schedule tags
- optional workplace device location

## Matching score
The feed ranks eligible jobs using:
- category/interests
- availability
- distance/location
- pay
- preferred work type
- experience requirement

## Cloudflare D1
Existing deployments must run `migration-job-matching-v5.sql` once before deploying the new code.

Distance note:
Exact kilometres are calculated only when both the job seeker and the job have coordinates. If coordinates are missing, the app uses location text as a weaker signal and does not hide the job solely for missing coordinates.
