# Buisder v23 deployment

1. Back up the existing `buisder-db` D1 database.
2. Run `migration-growth-v23-d1-safe.sql` against the existing database.
3. Deploy the complete v23 package through the existing GitHub -> Cloudflare Pages workflow.
4. Open Admin -> Growth and create a test partner/campaign/referral link.
5. Open the generated `/join/CODE` URL in a private browser and complete one test signup.
6. Confirm the signup and conversion data appears in Admin -> Growth.
7. Check Admin bottom navigation on a narrow mobile viewport. All 11 admin tabs should remain visible in a three-row grid.

v22 Payments remains parked. v23 does not activate Stripe, paid referrals, points, credits or cash rewards.
