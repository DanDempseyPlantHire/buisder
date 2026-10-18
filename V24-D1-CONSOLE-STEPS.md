# Buisder v24 D1 migration

Database: `buisder-db`

## If using a terminal
From the folder containing the migration file:

`npx wrangler d1 execute buisder-db --file=./migration-production-expansion-v24-d1-safe.sql --remote`

## If using the Cloudflare D1 SQL console
The D1 console accepts SQL only. Do not paste the `npx` command into the SQL console.

Open `migration-production-expansion-v24-d1-safe.sql`, copy the SQL contents, paste them into the `buisder-db` console and execute them.

The migration is idempotent and contains no `ALTER TABLE` statements.

## Verification
Run:

```sql
SELECT name
FROM sqlite_master
WHERE type='table'
AND name IN (
  'billing_catalog','billing_customers','billing_subscriptions','billing_purchases',
  'billing_events','billing_invoice_records','push_subscriptions','push_preferences',
  'application_messages','message_reports','risk_flags','integration_api_keys',
  'integration_job_links','integration_events','matching_model_versions'
)
ORDER BY name;
```

You should see 15 v24 tables.
