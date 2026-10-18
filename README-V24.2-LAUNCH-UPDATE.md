# Buisder v24.2 Launch Update

Post-launch maintenance release.

Changes:
- Password minimum reduced from 10 to 8 characters.
- Employer plan/access screens and active-job plan gating hidden/disabled for the free launch.
- Admin can permanently delete non-admin accounts after explicit DELETE confirmation; R2 profile/CV/logo objects are removed first.
- Pre-launch wording removed from the application.
- Reload Jobs clears skips only and never deletes applications.
- Job seekers can remove an active application by withdrawing it; withdrawn applications disappear from their Applications list while the employer retains the withdrawal state.
- Swipe transitions are immediate/optimistic rather than waiting on the network.
- Employers can edit existing posted jobs.
- Work experience is available as a work type for posting, candidate preference and feed filtering.

No D1 migration is required. The existing jobs.employment_type TEXT field stores Work experience.
