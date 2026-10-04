# Buisder — database + accounts

This adds a real backend to the prototype: Cloudflare D1 (SQLite) for storage and
Cloudflare Pages Functions for the API (signup, login, sessions, jobs, applications).
No separate server to run — it deploys together with the site.

## What's here

```
buisder-app/
  public/index.html       the app (now talks to /api/* instead of localStorage)
  functions/               the backend — each file is one API route
    _lib/db.js              shared helpers (password hashing, sessions, cookies)
    api/auth/               signup, login, logout
    api/bootstrap.js        one call that returns everything the signed-in user needs
    api/jobs/                post / close a job (employer)
    api/applications/        apply, undo, invite
    api/skips/                skip, undo
    api/profile.js           save jobseeker or employer profile
    api/reset.js              wipe your own applications/skips (demo convenience)
  schema.sql                the database tables
  wrangler.toml              Cloudflare config
```

Passwords are hashed with PBKDF2 (100,000 iterations, random salt per user) — never stored
in plain text. Sessions are random tokens in a `sessions` table, sent as an `HttpOnly`
cookie, so they can't be read or stolen by page JavaScript.

## One-time setup

You'll need a Cloudflare account and Node installed.

```bash
npm install -g wrangler
wrangler login
```

## 1. Create the database

```bash
cd buisder-app
wrangler d1 create buisder-db
```

This prints a `database_id`. Paste it into `wrangler.toml`, replacing
`REPLACE-WITH-YOUR-DATABASE-ID`.

Then create the tables:

```bash
wrangler d1 execute buisder-db --remote --file=./schema.sql
```

## 2. Deploy

```bash
wrangler pages deploy public --project-name=buisder
```

First run will ask to create the Pages project — say yes. Wrangler uploads `public/`
as the site and auto-detects the sibling `functions/` folder as your API.

## 3. Bind the database to the deployed site

The dashboard binding is what actually matters in production (wrangler.toml mainly
drives local dev):

1. Cloudflare dashboard → **Workers & Pages** → your `buisder` project → **Settings** → **Functions**
2. Under **D1 database bindings**, add a binding:
   - Variable name: `DB`
   - D1 database: `buisder-db`
3. Redeploy (`wrangler pages deploy public --project-name=buisder` again) so the new
   binding takes effect.

That's it — visit the `*.pages.dev` URL, sign up as a job seeker or an employer, and
the feed/applications/jobs are now real rows in D1 instead of browser storage.

## Local development

```bash
wrangler d1 execute buisder-db --local --file=./schema.sql
wrangler pages dev public --d1=DB=buisder-db
```

Note: session cookies are marked `Secure`, so they're only sent over HTTPS. Wrangler's
local dev server runs on plain `http://localhost`, so login/signup won't persist a
session locally unless you temporarily remove `Secure` from the cookie strings in
`functions/_lib/db.js` (`sessionCookie` / `clearSessionCookie`). Put it back before
deploying.

## What's deliberately left as a next step

- **CV upload**: the form only stores the file's name right now, not the file itself.
  Hooking it up to Cloudflare R2 (object storage) is the natural next step.
- **Closing a job**: the API (`DELETE /api/jobs/:id`) exists but there's no button for
  it in the UI yet.
- **Email verification / password reset**: not implemented — signup currently trusts
  whatever email address is entered.
- **Employer verification**: anyone can sign up as an employer and post jobs; a real
  product would want some identity check before a listing reaches the candidate feed.
