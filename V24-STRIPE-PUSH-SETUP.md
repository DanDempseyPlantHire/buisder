# Buisder v24 Stripe and Web Push setup

## Stripe

Use Stripe test mode first.

### Cloudflare secrets
Configure these for the production Pages environment:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Do not place either value in the repository.

### Stripe catalogue
Create recurring monthly Stripe Prices for the Growth and Pro products and a one-time Price for Featured Job if you want that product enabled.

In Buisder go to Admin -> Billing and paste the Price IDs into:
- Growth monthly
- Pro monthly
- Featured job placement

The Buisder commercial plan display price and the corresponding Stripe Price must be kept aligned. v24 deliberately does not invent a price.

### Webhook
Create an HTTPS webhook/event destination pointing to:

`https://YOUR-BUISDER-DOMAIN/api/billing/webhook`

Enable at least these event types:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `checkout.session.completed`
- `checkout.session.async_payment_failed`
- `invoice.finalized`
- `invoice.paid`
- `invoice.payment_failed`
- `charge.refunded`

Copy the webhook signing secret into the Cloudflare `STRIPE_WEBHOOK_SECRET` secret.

### Customer Portal
Enable the Stripe Customer Portal and configure the subscription-management options you intend to offer. To support employer upgrades/downgrades in the portal, make the relevant Growth/Pro products and Prices available there. Buisder links employers to the Portal from Plan -> Manage billing.

### Account deletion
Buisder prevents self-service deletion of an employer account while it has an active/trialing/past-due/unpaid Stripe subscription. The employer must cancel/manage billing first so a paid subscription is not orphaned.

## Web Push / VAPID

Generate a key pair locally from the repository root:

`node scripts/generate-vapid-keys.mjs`

Configure:
- `VAPID_PUBLIC_KEY` as a normal Cloudflare environment variable.
- `VAPID_PRIVATE_KEY` as a Cloudflare secret.
- `VAPID_SUBJECT` as a contact URI such as `mailto:support@your-domain.example`.

Redeploy after adding/changing environment settings.

Users can then open Account & Privacy -> App notifications and enable background notifications on a supported browser/device.

## Guaranteed interview reminders while nobody is using Buisder

v24 includes a small separate Cloudflare Worker at `workers/reminders/index.js`. This is needed because a scheduled Cloudflare Worker can run independently of Pages traffic.

1. Copy `wrangler-reminders.toml.example` to `wrangler-reminders.toml`.
2. Put the same `buisder-db` database ID into that file.
3. Deploy the reminder Worker with Wrangler.
4. Configure `APP_URL`, Resend settings and the VAPID settings for that Worker as well.
5. Keep the included `*/15 * * * *` Cron Trigger unless you intentionally choose another cadence.

The Worker creates de-duplicated 24-hour and 1-hour in-app/Web Push reminders and runs the existing recruitment-email reminder sweep. The application itself continues to work if this separate Worker is not deployed, but closed-app scheduled reminders would then depend on normal app traffic.
