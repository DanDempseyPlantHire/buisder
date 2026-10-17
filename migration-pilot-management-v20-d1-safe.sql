CREATE TABLE IF NOT EXISTS pilot_settings (
  id TEXT PRIMARY KEY CHECK (id='default'),
  pilot_name TEXT NOT NULL DEFAULT 'Buisder Pilot',
  invite_required INTEGER NOT NULL DEFAULT 0,
  feedback_enabled INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('planned','active','paused','completed')),
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO pilot_settings
(id, pilot_name, invite_required, feedback_enabled, status)
VALUES ('default', 'Buisder Pilot', 0, 1, 'active');

CREATE TABLE IF NOT EXISTS pilot_cohorts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','active','paused','completed')),
  starts_at TEXT,
  ends_at TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pilot_organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  org_type TEXT NOT NULL DEFAULT 'employer' CHECK (org_type IN ('employer','school','college','youth_org','partner','other')),
  contact_name TEXT,
  contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('planned','active','paused','completed')),
  notes TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pilot_invite_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  label TEXT,
  allowed_role TEXT NOT NULL DEFAULT 'any' CHECK (allowed_role IN ('any','jobseeker','employer')),
  cohort_id TEXT REFERENCES pilot_cohorts(id) ON DELETE SET NULL,
  organization_id TEXT REFERENCES pilot_organizations(id) ON DELETE SET NULL,
  max_uses INTEGER,
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pilot_memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  cohort_id TEXT REFERENCES pilot_cohorts(id) ON DELETE SET NULL,
  organization_id TEXT REFERENCES pilot_organizations(id) ON DELETE SET NULL,
  invite_code_id TEXT REFERENCES pilot_invite_codes(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'admin' CHECK (source IN ('admin','invite_code')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','withdrawn')),
  notes TEXT,
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pilot_invite_redemptions (
  id TEXT PRIMARY KEY,
  invite_code_id TEXT NOT NULL REFERENCES pilot_invite_codes(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  redeemed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pilot_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  membership_id TEXT REFERENCES pilot_memberships(id) ON DELETE SET NULL,
  feedback_type TEXT NOT NULL DEFAULT 'general' CHECK (feedback_type IN ('onboarding','midpoint','exit','general')),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  ease_score INTEGER CHECK (ease_score BETWEEN 1 AND 5),
  recommend_score INTEGER CHECK (recommend_score BETWEEN 0 AND 10),
  comments TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pilot_issues (
  id TEXT PRIMARY KEY,
  reporter_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  membership_id TEXT REFERENCES pilot_memberships(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('bug','usability','content','notification','account','safety','other')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  title TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','closed')),
  admin_note TEXT,
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pilot_memberships_cohort ON pilot_memberships(cohort_id, status);
CREATE INDEX IF NOT EXISTS idx_pilot_memberships_org ON pilot_memberships(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_pilot_invites_status ON pilot_invite_codes(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_pilot_redemptions_code ON pilot_invite_redemptions(invite_code_id, redeemed_at);
CREATE INDEX IF NOT EXISTS idx_pilot_feedback_user ON pilot_feedback(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pilot_issues_status ON pilot_issues(status, severity, created_at);

INSERT OR IGNORE INTO pilot_launch_checklist (item_key,label) VALUES ('pilot_management_tested','Pilot invite, cohort, feedback and issue-management flow tested');
