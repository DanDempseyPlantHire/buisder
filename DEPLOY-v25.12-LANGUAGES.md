# Deas Jobs v25.12 — English, Irish and Spanish UI patch

**This is an update-only patch for v25.11**, not a full release. It includes only 8 changed/new application files. Keep all existing project files.

## Changes
- Added a **Language** section to Settings for jobseekers, employers and administrators.
- Added the language picker to the public Home, Login and Contact pages.
- Interface labels in the main navigation, account screens, job/application workflows, employer posting and common notifications can be displayed in **English, Gaeilge and Español**.
- The chosen language is saved in the browser (`localStorage`) and reused on subsequent visits across the same website. No account database changes.
- Application logic and database values remain in English, including option values for employment types and status fields. Translating an option's visible name does **not** alter its API value.
- Dynamic screens are localized again after re-rendering.
- The public jobs layout loads the same UI translation script; server-rendered English SEO copy is preserved.
- Updated the existing Cookies & Device Storage notice to disclose local storage of the language preference. The notice itself remains in English pending legal translation.
- PWA cache bumped to `deasjobs-shell-v25.12-three-languages` and includes `/i18n.js` for offline use.

## Scope and limitations
- This release localizes **398 reviewed, exact-match interface phrases**. Unmatched phrases remain in English rather than receiving an unreliable guessed translation. This can include specialist admin, pilot and compliance screens.
- Employer-created job titles, descriptions, locations and application messages **remain in their original language**. The feature does not translate user-generated content.
- Terms, privacy notices and other legally significant documents remain **English-language versions** until qualified legal translators review them. No translation should be construed as a legally approved equivalent.
- Content is not automatically translated via an online service: no extra API, cookies or per-user translation costs.
- Automated checks verify structural and technical behavior, not the equivalent of a professional native-speaker proofread. A native Irish and Spanish editorial review is recommended before marketing this as a fully localized experience.

## Update installation
1. Back up or commit the currently working v25.11 release.
2. Unzip `Deas-Jobs-v25.12-Languages-UPDATE-ONLY.zip`.
3. Copy the **8 included `public/` and `functions/` files** into the same paths in the existing GitHub repository. **Replace** matching files; **do not delete or merge entire directories from an old full release**.
4. Commit and push using GitHub Desktop. Cloudflare Pages will deploy from your existing branch.
5. On the site, choose English / Gaeilge / Español from Settings or the Login/Home picker; change pages and reload to verify the selection persists.
6. With an employer account, check that the visible label for `Part-time` translates while the submitted employment type remains `Part-time`.
7. Verify sign-in, signup, listing creation, job swiping, applying, settings and notification links on the actual deployed site.
8. Close and reopen the installed iPhone PWA if it still shows the old UI. The updated service-worker cache should take effect.

## Validation performed
- All 72 existing Cloudflare Functions JavaScript files passed `node --check` (no new Functions file added).
- Inline script(s) in core pages and `public/i18n.js` passed JavaScript syntax validation.
- Tested the translation engine in a simulated DOM, including a complete EN → GA → ES → EN language cycle; translated dropdown labels retained their original values.
- Tested Home, Contact and Login screens in Chromium using injected HTML/scripts (direct local navigation was blocked by the test environment). No browser JavaScript errors in these targeted tests.
- Checked glossary structure: 398 unique source phrases with both Irish and Spanish equivalents, no duplicate or empty entries.
- ZIP file integrity verified before release. **Live Cloudflare/D1 production behavior is not verified in this environment.**

No D1 migration, backend API schema or extra Function route is required.
