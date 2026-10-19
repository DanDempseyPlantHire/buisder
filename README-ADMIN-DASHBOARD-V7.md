# DEASJobs v7 — Admin dashboard

This version adds a secure DEASJobs admin layer.

## Admin account

The existing support account is granted admin access by `migration-admin-dashboard-v7.sql`.

The migration links admin access by the account email already stored in D1.
It does NOT store, change, or hard-code the account password.

After the migration and deployment, log in through the normal DEASJobs login screen.
That account will automatically open the DEASJobs Admin dashboard.

## Admin dashboard

### Overview
Shows:
- total users
- job seekers
- employers
- pending business verifications
- active jobs
- applications
- recent admin activity

### Business verification
Admin can:
- see business profile/logo
- see legal/trading name
- see registration number
- see phone, website and location
- approve a verification request
- reject/revoke verification
- add an admin note

### User management
Admin can:
- view recent users
- see job seeker/employer role
- suspend an account
- restore an account

Suspending deletes that user's active sessions so they are signed out.

### Job moderation
Admin can:
- see recent jobs
- see whether the employer is verified
- close a job
- reopen a job

### Audit log
Admin actions are recorded in `admin_audit_log`.

## Deployment order

1. Run `migration-admin-dashboard-v7.sql` in Cloudflare D1.
2. Confirm the final SELECT in the migration returns the DEASJobs support account.
3. Upload/commit the v7 files to GitHub.
4. Let Cloudflare Pages deploy.
5. Log out of DEASJobs if already signed in.
6. Log back in with the existing support account.
7. The Admin dashboard should open automatically.

## Security

Admin access is checked server-side against the `admin_users` table.
The front-end dashboard alone does not grant admin permission.

Do not hard-code admin passwords into HTML, JavaScript, migrations, or Cloudflare variables.
