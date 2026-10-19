CREATE TABLE IF NOT EXISTS commercial_plans (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_mode TEXT NOT NULL DEFAULT 'free'
    CHECK (price_mode IN ('free','unset','fixed')),
  monthly_price_cents INTEGER,
  active_job_limit INTEGER NOT NULL DEFAULT 1,
  featured_job_limit INTEGER NOT NULL DEFAULT 0,
  is_public INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employer_commercial_accounts (
  employer_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL DEFAULT 'free' REFERENCES commercial_plans(code),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','trial','expired','cancelled')),
  source TEXT NOT NULL DEFAULT 'default',
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  access_ends_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employer_commercial_plan
ON employer_commercial_accounts(plan_code, status);

CREATE TABLE IF NOT EXISTS commercial_plan_requests (
  id TEXT PRIMARY KEY,
  employer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_plan_code TEXT NOT NULL REFERENCES commercial_plans(code),
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','cancelled')),
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  admin_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_commercial_plan_requests_status
ON commercial_plan_requests(status, created_at);

CREATE TABLE IF NOT EXISTS commercial_promo_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  plan_code TEXT NOT NULL REFERENCES commercial_plans(code),
  duration_days INTEGER NOT NULL DEFAULT 30,
  max_redemptions INTEGER,
  redemption_count INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_commercial_promos_active
ON commercial_promo_codes(active, expires_at);

CREATE TABLE IF NOT EXISTS commercial_promo_redemptions (
  id TEXT PRIMARY KEY,
  promo_id TEXT NOT NULL REFERENCES commercial_promo_codes(id) ON DELETE CASCADE,
  employer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  previous_plan_code TEXT,
  redeemed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  access_ends_at TEXT,
  UNIQUE(promo_id, employer_id)
);

CREATE TABLE IF NOT EXISTS employer_referral_codes (
  employer_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employer_referrals (
  id TEXT PRIMARY KEY,
  referrer_employer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_employer_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (referrer_employer_id <> referred_employer_id)
);

CREATE INDEX IF NOT EXISTS idx_employer_referrals_referrer
ON employer_referrals(referrer_employer_id, created_at);

CREATE TABLE IF NOT EXISTS job_promotions (
  job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  employer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'plan',
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ends_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_job_promotions_employer
ON job_promotions(employer_id, ends_at);

CREATE TABLE IF NOT EXISTS commercial_history (
  id TEXT PRIMARY KEY,
  employer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  plan_code TEXT,
  description TEXT,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_commercial_history_employer
ON commercial_history(employer_id, created_at);

INSERT OR IGNORE INTO commercial_plans
(code, name, description, price_mode, monthly_price_cents, active_job_limit, featured_job_limit, is_public, sort_order)
VALUES
('free', 'Free', 'For trying DEASJobs with one active role.', 'free', 0, 1, 0, 1, 10),
('pilot', 'Pilot', 'Controlled pilot access assigned by DEASJobs.', 'free', 0, 5, 2, 0, 20),
('growth', 'Growth', 'For employers hiring regularly.', 'unset', NULL, 5, 2, 1, 30),
('pro', 'Pro', 'For larger or higher-volume hiring.', 'unset', NULL, 20, 5, 1, 40);

INSERT OR IGNORE INTO employer_commercial_accounts
(employer_id, plan_code, status, source)
SELECT id, 'free', 'active', 'migration'
FROM users
WHERE role='employer';
