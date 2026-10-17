# Buisder v20 D1 migration steps

The preferred method is to run `migration-pilot-management-v20-d1-safe.sql` against the existing Buisder D1 database.

If the Cloudflare D1 Console gives an error when a large multi-statement paste is used, run the migration in smaller groups in this order:

1. `pilot_settings`, `pilot_cohorts`, `pilot_organizations`
2. `pilot_invite_codes`, `pilot_memberships`, `pilot_invite_redemptions`
3. `pilot_feedback`, `pilot_issues`
4. the v20 indexes
5. the `pilot_management_tested` launch-checklist insert

Do not create a second D1 database. Use the same production database already bound to Buisder as `DB`.

The migration is idempotent: the CREATE statements use `IF NOT EXISTS` and the checklist/settings seed rows use `INSERT OR IGNORE`.
