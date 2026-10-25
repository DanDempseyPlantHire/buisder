# Deas Jobs v24.4 Compact Functions

This release keeps the v24.3 launch-fix behaviour but restructures Cloudflare Pages Functions so the `functions/` directory contains fewer than 100 files.

## Why

The previous v24.3 package contained 122 files under `functions/`. v24.4 consolidates related routes into catch-all route modules while preserving their public URL paths and HTTP methods.

## Result

- Previous `functions/` file count: 122
- v24.4 `functions/` file count: 89
- No D1 migration required
- No public API URL changes intended
- No database schema changes
- No user-facing feature changes from v24.3

## Consolidated route groups

The following groups are now handled by one route module per group:

- `/api/auth/*`
- `/api/account/*`
- `/api/pilot/*`
- `/api/push/*`
- `/api/security/*`
- `/api/blocks/*`
- `/api/skips/*`
- `/api/employer/*`
- `/api/commercial/*`
- `/api/admin/compliance/*`
- `/api/admin/commercial/*`

Existing endpoint URLs remain the same. For example `/api/auth/login`, `/api/account/export`, `/api/push/test`, and `/api/admin/compliance/settings` continue to use their existing URLs.

## Recommended long-term GitHub workflow

The compact structure makes browser uploads possible again, but the preferred long-term workflow is to stop uploading application folders through the GitHub website.

Use GitHub Desktop or normal Git instead:

1. Clone the Deas Jobs repository locally.
2. Replace the repository files with the contents of the latest Deas Jobs release.
3. Review the changed files.
4. Commit the update.
5. Push to `main`.
6. Let Cloudflare Pages deploy from GitHub.

This avoids browser file-count upload limits and ensures deleted/renamed files are correctly reflected in the repository.

## Important when upgrading from v24.3 or earlier

Replace the old `functions/` directory completely. Do not add the v24.4 files on top of the old route files, because both the original route modules and the compact catch-all modules could otherwise coexist.
