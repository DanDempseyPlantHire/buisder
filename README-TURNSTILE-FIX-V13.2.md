# Deas Jobs v13.2 — Turnstile initialization fix

## Fix

v13.1 used `turnstile.ready()` after loading Cloudflare Turnstile with
`async defer`.

Cloudflare rejects that combination and returned:

`Remove async/defer from the Turnstile api.js script tag before using turnstile.ready().`

v13.2 removes the unnecessary `turnstile.ready()` call.

The app already waits until `window.turnstile` exists before trying to render,
so it can call `turnstile.render()` directly.

## Deployment

No D1 migration is required.

Deploy v13.2 over v13.1 and test Forgot Password again.

Expected status under the widget:

`Waiting for Cloudflare security check…`

followed by:

`Security check complete.`

Then submit Forgot Password. The backend will call Cloudflare Siteverify.
