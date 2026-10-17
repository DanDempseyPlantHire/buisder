-- Buisder v23 Growth migration (Cloudflare D1 / SQLite)
-- Safe to run more than once. No ALTER TABLE statements are used.

CREATE TABLE IF NOT EXISTS growth_partners (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  partner_type TEXT NOT NULL DEFAULT 'other'
    CHECK (partner_type IN ('school','college','youth_org','community','employer_network','other')),
  contact_name TEXT,
  contact_email TEXT,
  region TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('prospect','active','paused','closed')),
  notes TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS growth_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  campaign_key TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'direct',
  medium TEXT NOT NULL DEFAULT 'referral',
  target_role TEXT NOT NULL DEFAULT 'any'
    CHECK (target_role IN ('any','jobseeker','employer')),
  partner_id TEXT REFERENCES growth_partners(id) ON DELETE SET NULL,
  landing_path TEXT NOT NULL DEFAULT '/',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','paused','ended')),
  starts_at TEXT,
  ends_at TEXT,
  notes TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS growth_referral_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  referral_type TEXT NOT NULL
    CHECK (referral_type IN ('candidate','employer','partner','campaign')),
  target_role TEXT NOT NULL DEFAULT 'any'
    CHECK (target_role IN ('any','jobseeker','employer')),
  owner_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  partner_id TEXT REFERENCES growth_partners(id) ON DELETE SET NULL,
  campaign_id TEXT REFERENCES growth_campaigns(id) ON DELETE SET NULL,
  label TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paused')),
  max_uses INTEGER,
  use_count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS growth_attribution (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  referral_code_id TEXT REFERENCES growth_referral_codes(id) ON DELETE SET NULL,
  partner_id TEXT REFERENCES growth_partners(id) ON DELETE SET NULL,
  campaign_id TEXT REFERENCES growth_campaigns(id) ON DELETE SET NULL,
  first_utm_source TEXT,
  first_utm_medium TEXT,
  first_utm_campaign TEXT,
  first_utm_content TEXT,
  first_utm_term TEXT,
  landing_path TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS growth_referrals (
  id TEXT PRIMARY KEY,
  code_id TEXT REFERENCES growth_referral_codes(id) ON DELETE SET NULL,
  referrer_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  referred_user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  partner_id TEXT REFERENCES growth_partners(id) ON DELETE SET NULL,
  campaign_id TEXT REFERENCES growth_campaigns(id) ON DELETE SET NULL,
  target_role TEXT NOT NULL CHECK (target_role IN ('jobseeker','employer')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (referrer_user_id IS NULL OR referrer_user_id <> referred_user_id)
);

CREATE TABLE IF NOT EXISTS growth_employer_leads (
  id TEXT PRIMARY KEY,
  business_name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  location TEXT,
  stage TEXT NOT NULL DEFAULT 'prospect'
    CHECK (stage IN ('prospect','contacted','interested','invited','registered','verified','first_job','active')),
  source TEXT,
  partner_id TEXT REFERENCES growth_partners(id) ON DELETE SET NULL,
  campaign_id TEXT REFERENCES growth_campaigns(id) ON DELETE SET NULL,
  linked_employer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  next_follow_up_at TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_growth_partners_status ON growth_partners(status, created_at);
CREATE INDEX IF NOT EXISTS idx_growth_campaigns_status ON growth_campaigns(status, created_at);
CREATE INDEX IF NOT EXISTS idx_growth_codes_status ON growth_referral_codes(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_growth_codes_owner ON growth_referral_codes(owner_user_id, referral_type);
CREATE INDEX IF NOT EXISTS idx_growth_attribution_campaign ON growth_attribution(campaign_id, created_at);
CREATE INDEX IF NOT EXISTS idx_growth_attribution_partner ON growth_attribution(partner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_growth_referrals_referrer ON growth_referrals(referrer_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_growth_referrals_code ON growth_referrals(code_id, created_at);
CREATE INDEX IF NOT EXISTS idx_growth_leads_stage ON growth_employer_leads(stage, next_follow_up_at);

-- Preserve the employer referral network introduced in v17 by mirroring it into v23 growth.
INSERT OR IGNORE INTO growth_referral_codes
(id, code, referral_type, target_role, owner_user_id, label, status, use_count, created_by, created_at)
SELECT 'v17-code-' || employer_id, code, 'employer', 'employer', employer_id,
       'Employer referral link', 'active', 0, employer_id, created_at
FROM employer_referral_codes;

INSERT OR IGNORE INTO growth_referrals
(id, code_id, referrer_user_id, referred_user_id, target_role, created_at)
SELECT 'v17-ref-' || er.id, grc.id, er.referrer_employer_id, er.referred_employer_id, 'employer', er.created_at
FROM employer_referrals er
JOIN growth_referral_codes grc ON grc.code=er.referral_code;

INSERT OR IGNORE INTO growth_attribution
(user_id, referral_code_id, created_at)
SELECT er.referred_employer_id, grc.id, er.created_at
FROM employer_referrals er
JOIN growth_referral_codes grc ON grc.code=er.referral_code;

UPDATE growth_referral_codes
SET use_count=(SELECT COUNT(*) FROM growth_referrals gr WHERE gr.code_id=growth_referral_codes.id),
    updated_at=CURRENT_TIMESTAMP
WHERE referral_type='employer' AND owner_user_id IS NOT NULL;

INSERT OR IGNORE INTO lawful_basis_register
(id, processing_activity, purpose, data_subjects, data_categories, lawful_basis, article_ref, children_consideration, review_status)
VALUES
('growth_attribution',
 'Referral and acquisition attribution',
 'Measure which first-party referral, partner and campaign channels lead to meaningful use and hires',
 'Job seekers and employers',
 'Referral code and first-touch campaign parameters linked to the account after signup',
 'Legitimate interests - proposed',
 'GDPR Art. 6(1)(f) - subject to legal review',
 'Do not use growth attribution to make hiring decisions or profile a young person for advertising.',
 'legal_review_required');

INSERT OR IGNORE INTO retention_register
(id, data_category, system, proposed_rule, deletion_method, rationale, review_status)
VALUES
('growth_attribution',
 'Referral, partner and campaign attribution',
 'D1 and temporary browser storage before signup',
 'Retention period requires legal and ePrivacy review before scaled acquisition campaigns',
 'Delete with the user account; aggregate or de-identify campaign reporting under the approved retention schedule',
 'Keep acquisition measurement proportionate and separate from hiring decisions.',
 'legal_review_required');

INSERT OR IGNORE INTO compliance_checklist(item_key, category, label)
VALUES ('growth_tracking_review','growth','Referral, UTM and pre-signup device-storage attribution reviewed for GDPR/ePrivacy compliance');

INSERT OR IGNORE INTO compliance_checklist(item_key, category, label)
VALUES ('referral_terms_review','growth','Referral programme terms, anti-abuse rules and any future rewards legally reviewed before incentives are enabled');
