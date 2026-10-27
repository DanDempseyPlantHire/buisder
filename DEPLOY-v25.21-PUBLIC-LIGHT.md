# Deas Jobs v25.21 — Public Light Appearance

Update-only patch based on v25.20.

## Changes
- Public homepage and Contact Us page use light navy/white styling by default.
- Signed-out authentication pages (login, signup, password reset, verification) use a light background and white forms.
- Logged-in app retains the user's Settings → Appearance theme preference, including the Dark default.
- Service worker cache version bumped so updates are loaded.

## Installation
1. Extract this ZIP.
2. Copy its `public` files into the matching locations in the existing GitHub repository, replacing files with the same names. Do not delete folders.
3. Commit and push with GitHub Desktop.
4. Test the homepage, login/signup, and Contact Us while signed out, and both app themes while signed in.

No database migration or Functions changes.
