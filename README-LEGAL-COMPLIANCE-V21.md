# DEASJobs v21 — Production Legal & Compliance + Analytics Redesign

v21 builds on the complete v20.1 package, including the helper modules required by Cloudflare Pages Functions.

## Legal & compliance workspace

New Admin -> Compliance includes:
- legal controller identity and contact settings
- production compliance checklist
- GDPR data-rights request queue with target response date
- privacy/service complaint queue
- processor/service-provider register
- proposed lawful-basis / RoPA working register
- retention/deletion working register
- personal-data incident/breach register
- DSA applicability and moderation-process checklist items
- child/minor privacy and safety review items

The working lawful-basis and retention registers are deliberately marked for legal review. v21 does not pretend that a generated legal analysis is final legal advice.

## User-facing rights and legal documents

New/updated public pages:
- `/privacy.html` — production-draft Privacy Notice
- `/terms.html` — production-draft Terms of Use
- `/children.html` — plain-language privacy guide for 16–17-year-old users
- `/cookies.html` — cookie/device-storage notice and audit position
- `/rights.html` — data-protection rights guide

Account & Privacy now includes:
- formal access/rectification/erasure/restriction/objection/portability request form
- privacy/service complaint form
- history and admin responses for those requests
- links to all current legal documents

Terms and Privacy versions are updated to `2026-10-17-v21`; existing accounts are prompted to accept the current versions.

## Data breach register

Admin can record suspected personal-data incidents, including:
- discovery time
- confirmed breach status
- risk level
- whether children may be affected
- whether DPC notification is required
- DPC notification time
- data-subject notification time
- summary/actions/status

The tool records the assessment. It does not automatically decide whether notification is legally required.

## Analytics redesign

Both Admin Analytics and Employer Analytics were rebuilt for mobile readability:
- no compressed multi-series chart
- no overlapping chart labels
- recruitment funnel is one horizontal bar per stage
- recent activity uses exact daily counts instead of stacked miniature bars
- top jobs/category/location use responsive ranked cards rather than wide tables
- conversion rates are separate high-contrast cards
- secondary analytics text uses substantially darker text on white backgrounds
- mobile layout collapses cleanly without horizontal chart overlap

## Database

Run `migration-legal-compliance-v21-d1-safe.sql` against the existing production D1 database before deploying v21.

The migration creates new tables only. It does not use `ALTER TABLE`.

## Important production gate

Before general public launch, qualified legal/privacy review is still required for:
- final controller identity and legal wording
- DPIA
- legitimate-interest assessments
- processor DPAs and international transfers
- approved retention schedule
- DSA classification/applicable exemptions
- cookie/local-storage audit
- final Terms liability/governing-law/payment provisions

See `LEGAL-COMPLIANCE-REVIEW-V21.md`.
