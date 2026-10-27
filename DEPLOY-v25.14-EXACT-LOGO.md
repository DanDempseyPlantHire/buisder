# Deas Jobs v25.14 – Exact Logo Fix

## What this update does
This patch replaces the previous logo files with the exact logo supplied by you.

Updated files:
- `public/brand/deasjobs-logo.png`
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`
- `public/sw.js`

## Why `sw.js` is included
The service worker cache version was updated so the app pulls the new logo files instead of continuing to show the old cached version.

## Deploy steps
1. Extract this ZIP.
2. Copy the included files into your existing repository, keeping the same folder structure.
3. Commit and push to GitHub.
4. After deployment, open the app and refresh once or twice.
5. If an old logo still appears, fully close the tab/app and reopen it.

## Expected result
The exact all-caps **DEAS JOBS** logo will appear everywhere the previous app logo was used, including:
- header/logo areas
- login page
- home page
- contact page
- offline page
- PWA/app icon locations using `icon-192` and `icon-512`
