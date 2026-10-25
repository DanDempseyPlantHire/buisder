# Deas Jobs v25.10 — Settings and Contact Us (update-only patch)

This patch is designed to be applied **on top of v25.9** (and its earlier updates). It contains only changed or new files. It does **not** replace the entire application.

## Files in this patch
- `public/login.html` — Adds Settings tab for jobseekers, employers, and admins; consolidates working account controls; adds settings navigation.
- `public/index.html` — Adds Contact Us link to the public homepage.
- `public/contact.html` — New public page showing email and phone as clickable links.
- `public/sw.js` — Updates offline cache version and includes the contact page.

## Features
- Settings contains account details, profile link (for jobseekers/employers), password reset entry point, privacy and notification controls, contact details, data export/rights, and logout/deletion options appropriate to the user role.
- Existing password-reset flow via email is used. Users are told that they must sign out before entering the password reset flow; the existing Turnstile and email-based verification are preserved.
- Bottom navigation includes Settings with a non-emoji SVG icon. Employer navigation uses two equal-width rows on small screens to avoid compressed labels.
- Contact email: `deasjobscontact@gmail.com`; phone: `089 215 3926` (`tel:+353892153926`).

## Deploy
1. Ensure the v25.9 patch is deployed first.
2. Unzip this archive and **copy the `public/` files into the matching paths** in your existing GitHub Desktop repository. Choose replace/overwrite for the three existing files; `contact.html` is new.
3. Do **not** delete the `functions/` folder. This release does not change any Cloudflare Function routes.
4. Commit and push to `main` in GitHub Desktop. Cloudflare Pages will deploy automatically.
5. Verify `https://deasjobs.com/contact.html` and the Contact Us footer link. Log in as a jobseeker and an employer; check Settings and the notification and privacy actions. Check iPhone-sized bottom navigation and PWA refresh.

## Database and secrets
No D1 migration, new environment variables, new dependencies, or backend changes are required. The existing **72 Functions files** remain untouched.

The static JavaScript/CSS and packaging were checked locally. Confirm all flows against the live Cloudflare deployment after pushing.
