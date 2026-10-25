# Deas Jobs v25 deployment

1. Back up the existing Cloudflare D1 database.
2. Run `migration-deasjobs-rebrand-v25.sql` in the `buisder-db` D1 SQL console.
3. Replace the GitHub repository contents with this complete release using GitHub Desktop and push to `main`.
4. In Cloudflare Pages, set `APP_URL` to `https://deasjobs.com`.
5. Add `deasjobs.com` as the production custom domain. Add `www.deasjobs.com` if you want it accepted and redirected to the apex domain.
6. If you still control `buisder.com`, keep it attached temporarily so the included middleware can 301 redirect old links to the equivalent Deas Jobs URL.
7. Redeploy after changing `APP_URL`.
8. Check `https://deasjobs.com/`, `/jobs`, `/robots.txt`, `/sitemap.xml`, `/privacy.html` and `/terms.html`.
9. In Google Search Console, add/verify `deasjobs.com`, submit `https://deasjobs.com/sitemap.xml`, live-test the homepage and request indexing.
10. Test login, signup, password reset, job posting, applications, admin deletion and PWA installation.

No Cloudflare D1 or R2 resource rename is required.
