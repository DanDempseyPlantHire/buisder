# v23 D1 migration

Use the existing `buisder-db` database. Back it up first. Then run the contents of `migration-growth-v23-d1-safe.sql` in the Cloudflare D1 console, or use Wrangler from a terminal. The migration contains CREATE TABLE/INDEX and INSERT OR IGNORE statements only; it does not alter existing columns.
