# Deas Jobs v25.18 — Dark and Light Appearance

Update-only patch based on v25.17. Copy the files into your existing repository, keeping paths intact; replace only these two files. Do not delete existing folders.

- `public/login.html`: explicitly dark job-card background, controls and contrast; Light mode toggle in **Settings → Appearance**; stored choice persists on the same device.
- `public/sw.js`: increments offline cache version.

Dark mode is the default. The selector changes the app appearance immediately and saves it in localStorage. No Cloudflare Functions or database changes.

After committing and pushing via GitHub Desktop, open Settings → Appearance and test Dark / Light, swipe card, job list, employer dashboard and login on an iPhone. Hard-refresh once after production deployment to refresh the service-worker cache.

Note: this patch changes the authenticated app at `login.html`. The separate public home/contact/legal pages are not part of the authenticated app Settings UI and are not recoloured here.
