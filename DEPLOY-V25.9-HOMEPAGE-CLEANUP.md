# Deas Jobs v25.9 — Homepage tidy-up (update only)

**Apply after v25.8.** This is a small patch, not a full application release.

## Changes
- Removed the **How it works** section (three numbered steps) from the public homepage.
- Removed the **© Deas Jobs** footer line, keeping useful footer links.
- Reduced extra top space on the homepage (12px → 4px), while retaining the iPhone safe-area inset.
- Slightly reduced the homepage header's vertical padding.

## Deploy
1. In GitHub Desktop, ensure your repository is on the version with the v25.8 home/login split.
2. Extract this ZIP. Copy `public/index.html` to the matching path in your repository, replacing that file.
3. Commit and push to `main`. Wait for the Cloudflare Pages deployment to complete.
4. Refresh `https://deasjobs.com/` and test the homepage at iPhone width.

No database or Functions changes. Do not replace or delete the existing `functions/` directory for this patch.
