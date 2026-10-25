# Deas Jobs v25.13 — Language selector in Settings only

This is an **UPDATE-ONLY** patch built on **v25.12**. It does not contain the full application.

## Changes

- Removed the language dropdown from the public Home page header (`public/index.html`).
- Removed the language dropdown from the signed-out Login/Signup interface (`public/login.html`).
- Removed the language dropdown from the Contact Us page header (`public/contact.html`).
- **Kept the language selector under Settings → Language**, available after signing in for jobseekers, employers and administrators.
- Retained existing English, Gaeilge and Español translations, the saved language preference, and automatic translation on public pages.
- Bumped the service-worker cache identifier (`public/sw.js`) for the installed PWA.

## Installation

1. Ensure v25.12 is already installed in your GitHub repository.
2. Extract this ZIP and copy the **public** folder over the existing repository `public` folder, **replacing matching files**.
3. **Do not delete** the existing `public` or `functions` folders. This package contains only four changed application files.
4. Commit and push through GitHub Desktop, then check your Cloudflare Pages deployment.
5. After deployment, hard-refresh Home, Login and Contact Us. Sign in, open **Settings → Language** and check that English, Gaeilge and Español all work.
6. If using the installed PWA, close and reopen it so the new service worker and pages take effect.

No Cloudflare Functions or database migrations are required. The Functions count is unchanged.

## Verification performed

- Confirmed the only user-selectable language picker is in the `renderSettings()` screen (not in the public Home, Login or Contact headers).
- Confirmed all three language options and language-change handler remain available in Settings.
- Confirmed `/i18n.js` remains loaded on the public pages so the user's saved language is retained.
- JavaScript syntax checks passed for inline app scripts, the i18n script and service worker.
- ZIP integrity verified.
