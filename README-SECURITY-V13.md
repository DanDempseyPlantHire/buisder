# DEASJobs v13 — Authentication and security

This release adds the next roadmap block.

## Included

### Email verification
- Existing accounts are grandfathered as verified by the migration.
- New accounts can be required to verify their email.
- Verification links expire after 24 hours.
- Tokens are stored hashed in D1, not as raw secrets.
- Resend verification is rate-limited.

### Forgot / reset password
- Generic forgot-password response avoids revealing whether an email is registered.
- Reset links expire after 30 minutes.
- Password reset signs out all existing sessions.
- Resetting a password also verifies control of that email address.

### Cloudflare Turnstile
Turnstile support is built into:
- signup
- login
- forgot password
- resend verification

Turnstile is only enforced when `TURNSTILE_SECRET_KEY` is configured.

### Rate limiting
D1-backed limits protect:
- login
- signup
- forgot password
- verification resend

### Session hardening
- new sessions are 7 days rather than 30
- session cookie is HttpOnly + Secure + SameSite=Strict
- password reset deletes all sessions

### Security headers
Pages Functions middleware adds:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Referrer-Policy
- Permissions-Policy
- no-store caching for auth endpoints

## Cloudflare variables

In your Pages project, add these under Settings -> Variables and Secrets.

### Turnstile
Create a Turnstile widget for your DEASJobs domain and add:

TURNSTILE_SITE_KEY = the public Turnstile site key
TURNSTILE_SECRET_KEY = the Turnstile secret key

Store the secret key as a secret.

### Email delivery
v13 uses Resend for verification/reset emails.

Add:

RESEND_API_KEY = your Resend API key
EMAIL_FROM = DEASJobs <noreply@YOUR-VERIFIED-DOMAIN>
APP_URL = https://YOUR-DEASJOBS-DOMAIN

Store RESEND_API_KEY as a secret.

### Turn on mandatory verification
Only after email delivery has been tested, add:

EMAIL_VERIFICATION_REQUIRED = true

Until that variable is exactly `true`, new signups continue to work without mandatory email verification.

This prevents accidentally locking everyone out while email is being configured.

## Deployment order

1. Run `migration-security-v13.sql` once.
2. Deploy the v13 files.
3. Existing users should still be able to log in.
4. Create/configure a Turnstile widget.
5. Add TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY.
6. Redeploy and test signup/login.
7. Configure Resend and the three email variables.
8. Test forgot password.
9. Test verification email with EMAIL_VERIFICATION_REQUIRED still unset.
10. Set EMAIL_VERIFICATION_REQUIRED=true.
11. Redeploy.
12. Create a fresh test account and verify the complete flow.

## Important
Do not put TURNSTILE_SECRET_KEY or RESEND_API_KEY in index.html, GitHub, or client-side JavaScript.
They belong only in Cloudflare secrets.
