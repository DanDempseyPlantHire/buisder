# Deas Jobs v25.16 – Update-only patch

Based on v25.15, and compatible with the v25.14.1 exact logo assets.

## Changed files
- `public/login.html` – evenly fills the swipe card; removes the square frame around header and authentication logo images; adds a Cancelled applications section and confirmation button.
- `public/sw.js` – updates the PWA cache version.
- `functions/api/applications/purge/[id].js` – new protected endpoint for permanent deletion of the signed-in jobseeker's own **withdrawn** application only.

## Deploy
1. Extract the ZIP.
2. Copy these files into the matching folders in your existing GitHub repository; replace only matching files. Do not delete other files.
3. Commit and push in GitHub Desktop.
4. Verify Cloudflare Pages production deployment; refresh or reopen the PWA.
5. Sign in as a jobseeker, withdraw an active test application, open **Applications > Cancelled applications**, and confirm **Delete permanently** removes it. Test with a second account to ensure it cannot delete another user's application.
6. Check the Jobs swipe screen and logo on a real iPhone.

## Important
- This operation deletes the application record and the database records linked through ON DELETE CASCADE, including application messages, interviews, offers and status history. Other records with nullable references may remain with a cleared link; this is not a blanket erasure of all analytics, notifications or separate user information.
- Employers can no longer access a permanently deleted application.
- No D1 migration is required.
- Adds **one** Functions file (72 to 73, assuming you were at 72). Do not replace or delete the Functions folder.
- JavaScript syntax and ZIP integrity have been checked. A live Cloudflare deployment and iPhone test are still necessary.
