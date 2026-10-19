# DEASJobs v6 — Business verification + business profile images

## Added

### Employer profile image / logo
Every employer can now:
- upload a business profile image or logo
- change it later in Business Profile
- show it to job seekers on job cards and job details

The image currently uses the same compressed base64 approach as job-seeker profile images and is stored in D1.

### Business verification workflow
Employer profile now captures:
- business/trading name
- legal business name
- registration/company number
- business phone
- website
- location
- description
- business image/logo

Statuses:
- unverified
- pending
- verified
- rejected

Employers can submit their completed profile for verification.
The app changes the status to `pending`.

### Manual beta verification
There is intentionally no self-service "verify me" shortcut.
For the beta, the DEASJobs administrator checks the business and then changes the record to verified in the D1 console.

See `migration-business-verification-v6.sql` for example SQL to:
- list pending businesses
- approve a business
- reject a business

### Candidate experience
Job seekers now see:
- business profile image/logo on listings
- "Verified business" badge when the employer is verified
- "Not verified" otherwise

## Important
This is an initial manual verification system, not automated identity verification.
A later production version should add:
- document/evidence storage in Cloudflare R2
- email/domain verification
- automated CRO/business-registry checks where feasible
- admin review dashboard
- audit trail and reviewer identity
- moderation / report controls
