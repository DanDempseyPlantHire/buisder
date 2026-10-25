# Deas Jobs v13.3 — Turnstile whitespace hardening

The Turnstile widget failed because the configured site key contained trailing whitespace.

v13.3 now trims leading/trailing whitespace from:
- TURNSTILE_SITE_KEY
- TURNSTILE_SECRET_KEY

You should still correct the values in Cloudflare, but the app is now more tolerant of accidental spaces.

No D1 migration is required.
