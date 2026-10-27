# Deas Jobs v25.17 — update only

Apply this patch on top of v25.16. Copy the included `public/` and `functions/` files into your existing GitHub repository, preserving folder paths and replacing matching files. Do not delete existing folders. Commit and push using GitHub Desktop.

Changes:
- Removed the duplicate top Jobs / Work experience selector. Use the bottom bar.
- Cancelled and unsuccessful applications appear together under closed applications with a confirmed permanent-delete action for the owner.
- Changed major white/light app panels to navy surfaces; retained readable contrast and the square-edged design.
- Changed the service worker cache key.

No database migration. Test on your live Cloudflare site after deployment, including dark-panel readability, small-phone navigation and deletion with a test unsuccessful application. Permanent deletion cannot be reversed. Any records not relationally linked to the deleted application may remain.
