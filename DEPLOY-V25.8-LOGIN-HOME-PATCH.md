# Deas Jobs v25.8 — Public Home + Dedicated Log In (update-only patch)

This patch is based on **v25.7**, including its bottom-navigation icons, and changes only the files in this ZIP. It does **not** contain a complete app. Keep all other repository files.

## Result

- `/` is the public Home page for signed-out visitors: static, crawlable, and designed around jobs, work experience, employers, and account links.
- `/login.html` is a dedicated, minimal Log in page, and continues to host the existing authenticated app.
- `/login.html?signup=1` opens Create account. Forgot password, email verification and password resets remain in the same app and are not advertised on Home.
- Signed-in visitors who open `/` are automatically forwarded to `/login.html` after a successful session check. Logging out returns to `/`.
- Links from public job listings and invitation/referral flows lead to `/login.html`.
- Previously issued `/?verify=...`, `/?reset=...`, `/?job=...` and `/?signup=1` links are redirected to the appropriate login page without dropping the query string.
- `/` remains indexable by search engines. `/login.html` has `noindex` metadata.
- PWA cache name updated to ensure the new pages refresh.

## Install via GitHub Desktop

1. Ensure v25.7 (or the latest v25.7-based code) is already present in your GitHub clone. Back up/commit before updating.
2. Extract this ZIP to a temporary folder **outside** the GitHub repository.
3. Copy its **`public/` and `functions/`** folders onto the matching folders in your repository, choosing **Replace files**, not replace/delete folders. The ZIP includes only the changed files.
4. Check in GitHub Desktop that the changes include the **new `public/login.html`** and the updated `public/index.html`.
5. Commit with the message `Deas Jobs v25.8 — public home and dedicated login`, then **Push origin**.
6. Confirm Cloudflare Pages deployed successfully, hard-refresh and restart the PWA if installed.

## Essential post-deployment tests

- Open `https://deasjobs.com/` while signed out. It should display Home with public content, not a login form.
- Select **Log in**. It should open `https://deasjobs.com/login.html` showing only account fields/links, not public jobs and descriptions.
- Test **Create account**, **Forgot password**, verification and reset links. Confirm a logged-in user opens the normal dashboard.
- Log out: you should return to `/`. Open the site in a signed-in session: you should be redirected to the app.
- Visit `/jobs` and an individual job page, then select the sign-in / apply links.
- Check mobile layout, 404 behaviour, Google Search Console live test and the public homepage's indexability after deployment.

## Technical notes

- **No D1 migration**; no payment changes.
- Functions folder remains **72 files**, so the patch does not increase the Functions count.
- The work experience views and v25.7 navigation are retained.
- Local syntax and simulated auth UI checks passed. Real Cloudflare deployment, Turnstile and live email delivery still require production testing.
