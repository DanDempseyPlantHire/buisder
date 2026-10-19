# DEASJobs v13.1 — Turnstile Siteverify fix

This is a corrective release for v13.

## What was wrong

v13 checked for a Turnstile token in browser JavaScript before sending the
form to the backend. If the widget did not create a token, the browser showed:

`Complete the security check`

and stopped.

That meant the Pages Function never ran and therefore Cloudflare Siteverify
was never called. Cloudflare correctly reported:

`Siteverify isn't being called for DEASJobs`

## What v13.1 changes

- Protected form submissions are always allowed to reach the backend.
- The backend always calls Cloudflare Siteverify when TURNSTILE_SECRET_KEY is configured.
- Missing/invalid tokens are still rejected. There is no security bypass.
- Cloudflare Siteverify error codes are translated into useful messages.
- The frontend shows whether:
  - the Turnstile script loaded
  - the widget rendered
  - the token was created
  - the token expired
  - the widget returned an error
- New safe diagnostic endpoint:
  `/api/security/diagnostic`

It reports only booleans and the current hostname. It never displays either key.

## Deploy

No D1 migration is required.

Replace v13 with v13.1 in GitHub and let Cloudflare redeploy.

Then open:

`https://YOUR-DEASJOBS-HOST/api/security/diagnostic`

You should see:

- turnstileSiteKeyConfigured: true
- turnstileSecretKeyConfigured: true
- sameTurnstileConfigurationPresent: true

Then open Forgot Password.

The Turnstile area will now show an exact status.

If the widget still does not complete, submit the form once anyway. The server
will call Siteverify and display Cloudflare's actual validation failure.

## Expected result

After a valid Turnstile completes, Forgot Password will call Siteverify, pass
validation, and continue to the password-reset email flow.
