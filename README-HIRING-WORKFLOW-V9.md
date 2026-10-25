# Deas Jobs v9 — Shortlisting + formal interview workflow

This version implements the next two roadmap items.

## 1. Shortlisting

Employers can now:
- shortlist an applicant
- remove a candidate from the shortlist before the interview stage
- see a Shortlisted badge
- see a shortlist count on the employer dashboard

Job seekers see the status change from Applied to Shortlisted.

## 2. Formal interview stage

Application statuses now use the formal sequence:

Applied
→ Shortlisted
→ Interview invited
→ Interview accepted / Interview declined
→ Interview completed

Existing old `invited` application statuses are migrated to `interview_invited`.

Employers can:
- create or reschedule an interview
- see whether the candidate accepted or declined
- mark an accepted interview as completed

Job seekers can:
- see the current application stage
- see the stage progression visually
- accept or decline interview invitations

## Status audit foundation

A new `application_status_history` table records status changes from v9 onward.
The UI does not yet expose the complete timeline; that remains a later roadmap item.

## Deployment

1. Run `migration-hiring-workflow-v9.sql` ONCE in the same D1 database used by Deas Jobs.
2. Commit/deploy the v9 files to GitHub.
3. Let Cloudflare Pages redeploy.
4. Test:
   - job seeker applies
   - employer shortlists
   - job seeker sees Shortlisted
   - employer sends interview
   - job seeker accepts
   - employer marks interview completed

## Important

This release does not yet add job offers, Hired/Unsuccessful outcomes, email notifications, or the full application timeline. Those remain separate roadmap steps.


## v9.1 migration correction

Cloudflare D1/SQLite does not allow `ALTER TABLE ... ADD COLUMN` with a non-constant
`datetime('now')` default. The corrected migration adds `updated_at` as a plain TEXT
column, backfills existing rows, and new applications explicitly set `updated_at`.
