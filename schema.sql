-- Buisder database schema (Cloudflare D1 / SQLite)
-- Run with: wrangler d1 execute buisder-db --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('jobseeker','employer')),
  name TEXT,
  is_suspended INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);


CREATE TABLE IF NOT EXISTS verified_emails (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify_email','reset_password')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_purpose
ON auth_tokens(user_id, purpose);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  rate_key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL,
  blocked_until TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);


CREATE TABLE IF NOT EXISTS admin_users (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at);

CREATE TABLE IF NOT EXISTS jobseeker_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  age_band TEXT,
  phone TEXT,
  location TEXT,
  about TEXT,
  skills TEXT,
  education TEXT,
  experience TEXT,
  availability TEXT,
  interests TEXT,
  transport TEXT,
  cv_filename TEXT,
  photo_data TEXT,
  photo_key TEXT,
  cv_key TEXT,
  cv_content_type TEXT,
  cv_size INTEGER,
  onboarding_complete INTEGER NOT NULL DEFAULT 0,
  max_distance_km INTEGER NOT NULL DEFAULT 25,
  min_pay REAL,
  preferred_employment_type TEXT NOT NULL DEFAULT 'Any',
  latitude REAL,
  longitude REAL
);

CREATE TABLE IF NOT EXISTS employer_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT,
  legal_name TEXT,
  location TEXT,
  description TEXT,
  phone TEXT,
  website TEXT,
  registration_number TEXT,
  logo_data TEXT,
  logo_key TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','pending','verified','rejected')),
  verification_submitted_at TEXT,
  verification_reviewed_at TEXT,
  verification_note TEXT
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  employer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  company TEXT,
  location TEXT,
  pay TEXT,
  hours TEXT,
  experience TEXT,
  start_date TEXT,
  description TEXT,
  tags TEXT,                              -- JSON array, stored as text, e.g. ["Retail"]
  employment_type TEXT NOT NULL DEFAULT 'Part-time',
  min_age INTEGER NOT NULL DEFAULT 16,
  pay_min REAL,
  schedule_tags TEXT NOT NULL DEFAULT '[]',
  latitude REAL,
  longitude REAL,
  status TEXT NOT NULL DEFAULT 'active',  -- active | closed
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  jobseeker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'applied',
  shortlisted_at TEXT,
  interview_invited_at TEXT,
  interview_accepted_at TEXT,
  interview_declined_at TEXT,
  interview_completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(job_id, jobseeker_id)
);

CREATE TABLE IF NOT EXISTS application_status_history (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);




CREATE TABLE IF NOT EXISTS legal_consents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  terms_version TEXT NOT NULL,
  privacy_version TEXT NOT NULL,
  accepted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, terms_version, privacy_version)
);

CREATE INDEX IF NOT EXISTS idx_legal_consents_user
ON legal_consents(user_id, accepted_at);

CREATE TABLE IF NOT EXISTS privacy_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  share_email INTEGER NOT NULL DEFAULT 1,
  share_cv INTEGER NOT NULL DEFAULT 1,
  share_photo INTEGER NOT NULL DEFAULT 1,
  share_location INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_blocks (
  id TEXT PRIMARY KEY,
  blocker_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(blocker_user_id, blocked_user_id),
  CHECK(blocker_user_id <> blocked_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker
ON user_blocks(blocker_user_id);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked
ON user_blocks(blocked_user_id);

CREATE TABLE IF NOT EXISTS safety_reports (
  id TEXT PRIMARY KEY,
  reporter_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL
    CHECK (target_type IN ('job','employer','applicant')),
  target_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  application_id TEXT REFERENCES applications(id) ON DELETE SET NULL,
  reason TEXT NOT NULL
    CHECK (reason IN ('scam_fraud','misleading','inappropriate','harassment','discrimination','unsafe','other')),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','reviewing','resolved','dismissed')),
  admin_note TEXT,
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_safety_reports_status
ON safety_reports(status, created_at);

CREATE INDEX IF NOT EXISTS idx_safety_reports_reporter
ON safety_reports(reporter_user_id, created_at);


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
('free', 'Free', 'For trying Buisder with one active role.', 'free', 0, 1, 0, 1, 10),
('pilot', 'Pilot', 'Controlled pilot access assigned by Buisder.', 'free', 0, 5, 2, 0, 20),
('growth', 'Growth', 'For employers hiring regularly.', 'unset', NULL, 5, 2, 1, 30),
('pro', 'Pro', 'For larger or higher-volume hiring.', 'unset', NULL, 20, 5, 1, 40);

INSERT OR IGNORE INTO employer_commercial_accounts
(employer_id, plan_code, status, source)
SELECT id, 'free', 'active', 'migration'
FROM users
WHERE role='employer';

CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  user_role TEXT,
  event_type TEXT NOT NULL,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  application_id TEXT REFERENCES applications(id) ON DELETE SET NULL,
  event_key TEXT UNIQUE,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type_created
ON analytics_events(event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_created
ON analytics_events(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_events_job_created
ON analytics_events(job_id, created_at);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  recruitment_emails INTEGER NOT NULL DEFAULT 1,
  application_updates INTEGER NOT NULL DEFAULT 1,
  interviews INTEGER NOT NULL DEFAULT 1,
  interview_reminders INTEGER NOT NULL DEFAULT 1,
  offers INTEGER NOT NULL DEFAULT 1,
  outcomes INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_delivery_log (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_key TEXT NOT NULL UNIQUE,
  application_id TEXT REFERENCES applications(id) ON DELETE SET NULL,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','failed','skipped')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  provider_message_id TEXT,
  last_error TEXT,
  sent_at TEXT,
  last_attempt_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_delivery_user_created
ON email_delivery_log(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_email_delivery_status_created
ON email_delivery_log(status, created_at);

CREATE TABLE IF NOT EXISTS email_scheduler_state (
  job_key TEXT PRIMARY KEY,
  last_run_at TEXT
);

INSERT OR IGNORE INTO notification_preferences (user_id)
SELECT id FROM users;

INSERT OR IGNORE INTO email_scheduler_state (job_key, last_run_at)
VALUES ('interview_reminders', NULL);


CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  application_id TEXT,
  job_id TEXT,
  event_key TEXT UNIQUE,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
ON notifications(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
ON notifications(user_id, read_at);

CREATE TABLE IF NOT EXISTS job_offers (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  employer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jobseeker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_title TEXT NOT NULL,
  pay TEXT NOT NULL,
  start_date TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_job_offers_employer ON job_offers(employer_id);
CREATE INDEX IF NOT EXISTS idx_job_offers_jobseeker ON job_offers(jobseeker_id);

CREATE TABLE IF NOT EXISTS skips (
  jobseeker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (jobseeker_id, job_id)
);

CREATE TABLE IF NOT EXISTS interview_invites (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  interview_at TEXT NOT NULL,
  location TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_jobs_employer ON jobs(employer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_applications_jobseeker ON applications(jobseeker_id);
CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_application_status_history_app ON application_status_history(application_id);
CREATE INDEX IF NOT EXISTS idx_skips_jobseeker ON skips(jobseeker_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_invites_application ON interview_invites(application_id);

CREATE TABLE IF NOT EXISTS pilot_launch_checklist (
  item_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  completed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_role_created ON users(role, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_employer_status ON jobs(employer_id, status);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status, created_at);
CREATE INDEX IF NOT EXISTS idx_interview_invites_time_status ON interview_invites(interview_at, status);

INSERT OR IGNORE INTO pilot_launch_checklist (item_key,label) VALUES ('backup_completed','Production D1 backup/export completed');
INSERT OR IGNORE INTO pilot_launch_checklist (item_key,label) VALUES ('auth_tested','Signup, verification, login and password reset tested');
INSERT OR IGNORE INTO pilot_launch_checklist (item_key,label) VALUES ('candidate_flow_tested','Candidate profile, swipe, apply and withdraw flow tested');
INSERT OR IGNORE INTO pilot_launch_checklist (item_key,label) VALUES ('employer_flow_tested','Employer verification, job posting and applicant review tested');
INSERT OR IGNORE INTO pilot_launch_checklist (item_key,label) VALUES ('recruitment_flow_tested','Shortlist, interview, offer and hire workflow tested end to end');
INSERT OR IGNORE INTO pilot_launch_checklist (item_key,label) VALUES ('privacy_safety_tested','Privacy, report, block, export and account deletion tested');
INSERT OR IGNORE INTO pilot_launch_checklist (item_key,label) VALUES ('commercial_controls_tested','Employer plan limits and commercial controls tested');
INSERT OR IGNORE INTO pilot_launch_checklist (item_key,label) VALUES ('mobile_ios_tested','Pilot tested on iPhone Safari');
INSERT OR IGNORE INTO pilot_launch_checklist (item_key,label) VALUES ('mobile_android_tested','Pilot tested on Android Chrome');
INSERT OR IGNORE INTO pilot_launch_checklist (item_key,label) VALUES ('desktop_tested','Pilot tested on desktop Chrome or Edge');
INSERT OR IGNORE INTO pilot_launch_checklist (item_key,label) VALUES ('support_process_ready','Pilot support contact and issue escalation process ready');
INSERT OR IGNORE INTO pilot_launch_checklist (item_key,label) VALUES ('pilot_docs_reviewed','Pilot Terms and Privacy Summary reviewed for pilot use');



INSERT OR IGNORE INTO pilot_launch_checklist (item_key, label)
VALUES ('recruitment_emails_tested', 'Recruitment email notifications and preferences tested');

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

CREATE TABLE IF NOT EXISTS legal_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL DEFAULT '',
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS data_rights_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  requestor_email TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('access','rectification','erasure','restriction','objection','portability','other')),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','refused')),
  due_at TEXT NOT NULL DEFAULT (datetime('now','+1 month')),
  admin_response TEXT,
  assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_data_rights_status_due ON data_rights_requests(status, due_at);
CREATE INDEX IF NOT EXISTS idx_data_rights_user ON data_rights_requests(user_id, created_at);

CREATE TABLE IF NOT EXISTS compliance_complaints (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  requestor_email TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'privacy',
  details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  due_at TEXT NOT NULL DEFAULT (datetime('now','+1 month')),
  admin_response TEXT,
  assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_compliance_complaints_status_due ON compliance_complaints(status, due_at);

CREATE TABLE IF NOT EXISTS processor_register (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  service TEXT NOT NULL,
  data_categories TEXT NOT NULL DEFAULT '',
  purpose TEXT NOT NULL DEFAULT '',
  location_notes TEXT NOT NULL DEFAULT '',
  contract_status TEXT NOT NULL DEFAULT 'review_required',
  transfer_review_status TEXT NOT NULL DEFAULT 'review_required',
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lawful_basis_register (
  id TEXT PRIMARY KEY,
  processing_activity TEXT NOT NULL,
  purpose TEXT NOT NULL,
  data_subjects TEXT NOT NULL,
  data_categories TEXT NOT NULL,
  lawful_basis TEXT NOT NULL,
  article_ref TEXT NOT NULL,
  children_consideration TEXT NOT NULL DEFAULT '',
  review_status TEXT NOT NULL DEFAULT 'legal_review_required',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS retention_register (
  id TEXT PRIMARY KEY,
  data_category TEXT NOT NULL,
  system TEXT NOT NULL,
  proposed_rule TEXT NOT NULL,
  deletion_method TEXT NOT NULL,
  rationale TEXT NOT NULL DEFAULT '',
  review_status TEXT NOT NULL DEFAULT 'legal_review_required',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compliance_checklist (
  item_key TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'incomplete' CHECK (status IN ('incomplete','complete','not_applicable')),
  evidence_note TEXT,
  completed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compliance_incidents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  discovered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  breach_confirmed INTEGER NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'under_review' CHECK (risk_level IN ('under_review','low','medium','high','severe')),
  affects_children INTEGER NOT NULL DEFAULT 0,
  dpc_notification_required INTEGER,
  dpc_notified_at TEXT,
  subjects_notified_at TEXT,
  summary TEXT NOT NULL DEFAULT '',
  actions_taken TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','contained','closed')),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_compliance_incidents_status ON compliance_incidents(status, discovered_at);

INSERT OR IGNORE INTO legal_settings(setting_key,setting_value) VALUES ('controller_name','');
INSERT OR IGNORE INTO legal_settings(setting_key,setting_value) VALUES ('controller_address','');
INSERT OR IGNORE INTO legal_settings(setting_key,setting_value) VALUES ('company_registration','');
INSERT OR IGNORE INTO legal_settings(setting_key,setting_value) VALUES ('privacy_email','');
INSERT OR IGNORE INTO legal_settings(setting_key,setting_value) VALUES ('support_email','');
INSERT OR IGNORE INTO legal_settings(setting_key,setting_value) VALUES ('dpo_email','');
INSERT OR IGNORE INTO legal_settings(setting_key,setting_value) VALUES ('dsa_contact_email','');
INSERT OR IGNORE INTO legal_settings(setting_key,setting_value) VALUES ('country','Ireland');

INSERT OR IGNORE INTO processor_register(id,provider,service,data_categories,purpose,location_notes,contract_status,transfer_review_status) VALUES
('cloudflare','Cloudflare','Pages, Functions, D1, R2 and Turnstile','Account, profile, recruitment and security data','Hosting, storage, security and application delivery','Confirm production region, DPA and any transfer safeguards before public launch','review_required','review_required');
INSERT OR IGNORE INTO processor_register(id,provider,service,data_categories,purpose,location_notes,contract_status,transfer_review_status) VALUES
('resend','Resend','Transactional email','Email address and email content','Account security and recruitment notifications','Confirm DPA, subprocessors and any transfer safeguards before public launch','review_required','review_required');

INSERT OR IGNORE INTO lawful_basis_register(id,processing_activity,purpose,data_subjects,data_categories,lawful_basis,article_ref,children_consideration) VALUES
('account_service','Account registration and service delivery','Create and operate Buisder accounts','Job seekers and employers','Identity, contact, account and profile data','Contract','GDPR Art. 6(1)(b)','Use child-oriented transparency for 16–17-year-old users.');
INSERT OR IGNORE INTO lawful_basis_register(id,processing_activity,purpose,data_subjects,data_categories,lawful_basis,article_ref,children_consideration) VALUES
('matching','Job matching and feed ranking','Filter and rank relevant jobs using user-selected preferences','Job seekers','Preferences, availability, approximate location, pay preferences and experience','Contract','GDPR Art. 6(1)(b)','Complete DPIA review before public launch because minors can use the service and ranking/profiling is involved.');
INSERT OR IGNORE INTO lawful_basis_register(id,processing_activity,purpose,data_subjects,data_categories,lawful_basis,article_ref,children_consideration) VALUES
('recruitment','Applications, interviews, offers and hiring workflow','Provide the recruitment service requested by users','Job seekers and employers','Profile, CV, application and recruitment workflow data','Contract','GDPR Art. 6(1)(b)','Minimise direct contact data for 16–17-year-old users.');
INSERT OR IGNORE INTO lawful_basis_register(id,processing_activity,purpose,data_subjects,data_categories,lawful_basis,article_ref,children_consideration) VALUES
('security','Security, fraud prevention and moderation','Protect users, detect abuse and enforce platform rules','All users','Security logs, reports, account and activity data','Legitimate interests','GDPR Art. 6(1)(f)','Document a legitimate-interests assessment and ensure the best interests of children are not overridden.');
INSERT OR IGNORE INTO lawful_basis_register(id,processing_activity,purpose,data_subjects,data_categories,lawful_basis,article_ref,children_consideration) VALUES
('analytics','First-party product analytics','Measure service use and recruitment outcomes','All users','Account-linked product events that are de-identified on account deletion','Legitimate interests','GDPR Art. 6(1)(f)','Document a legitimate-interests assessment for analytics involving minors.');
INSERT OR IGNORE INTO lawful_basis_register(id,processing_activity,purpose,data_subjects,data_categories,lawful_basis,article_ref,children_consideration) VALUES
('transactional_email','Transactional email','Deliver verification, security and recruitment workflow messages','All users','Email address and event content','Contract / legitimate interests','GDPR Art. 6(1)(b) / 6(1)(f)','Recruitment email preferences apply; security emails remain necessary for account operation.');
INSERT OR IGNORE INTO lawful_basis_register(id,processing_activity,purpose,data_subjects,data_categories,lawful_basis,article_ref,children_consideration) VALUES
('legal_compliance','Legal compliance and rights handling','Meet applicable legal obligations and respond to rights requests','All users','Request, complaint and compliance records','Legal obligation','GDPR Art. 6(1)(c)','Children have data protection rights in their own right.');

INSERT OR IGNORE INTO retention_register(id,data_category,system,proposed_rule,deletion_method,rationale) VALUES
('account_profile','Account and profile data','D1/R2','Account lifetime; final post-closure retention period requires legal approval before public launch','Self-service deletion plus backend deletion/cascade','Keep only what is needed to provide and secure the service.');
INSERT OR IGNORE INTO retention_register(id,data_category,system,proposed_rule,deletion_method,rationale) VALUES
('cv_photo','CVs and profile images','R2','Account lifetime unless removed earlier; confirm any post-application retention requirement','R2 object deletion on account deletion/replacement','High-sensitivity employment material should not be retained indefinitely.');
INSERT OR IGNORE INTO retention_register(id,data_category,system,proposed_rule,deletion_method,rationale) VALUES
('recruitment','Application, interview and offer history','D1','Policy decision required before public launch','Database deletion or pseudonymisation as approved','Balance candidate access, employer needs, disputes and data minimisation.');
INSERT OR IGNORE INTO retention_register(id,data_category,system,proposed_rule,deletion_method,rationale) VALUES
('security','Security and authentication records','D1','Short operational retention; v18 cleanup removes stale auth records','Automated/admin cleanup','Retain only long enough for account security and incident investigation.');
INSERT OR IGNORE INTO retention_register(id,data_category,system,proposed_rule,deletion_method,rationale) VALUES
('analytics','First-party analytics events','D1','Aggregate/de-identified retention policy to be approved before public launch','User ID detached on account deletion; aggregate deletion by policy','Measure product outcomes without retaining unnecessary user identity.');
INSERT OR IGNORE INTO retention_register(id,data_category,system,proposed_rule,deletion_method,rationale) VALUES
('moderation','Safety reports and moderation audit','D1','Retention period requires legal and safety review','Delete or pseudonymise according to approved schedule','May need longer evidence retention than ordinary profile data.');

INSERT OR IGNORE INTO compliance_checklist(item_key,category,label) VALUES ('controller_identity','governance','Controller identity and public contact details completed');
INSERT OR IGNORE INTO compliance_checklist(item_key,category,label) VALUES ('privacy_notice_reviewed','documents','Production Privacy Notice legally reviewed');
INSERT OR IGNORE INTO compliance_checklist(item_key,category,label) VALUES ('terms_reviewed','documents','Production Terms of Use legally reviewed');
INSERT OR IGNORE INTO compliance_checklist(item_key,category,label) VALUES ('child_notice_reviewed','children','Child-friendly privacy information reviewed for 16–17-year-old users');
INSERT OR IGNORE INTO compliance_checklist(item_key,category,label) VALUES ('cookie_audit','cookies','Cookie/tracking audit completed and strictly necessary cookie position confirmed');
INSERT OR IGNORE INTO compliance_checklist(item_key,category,label) VALUES ('ropa_reviewed','gdpr','Record of Processing Activities reviewed and approved');
INSERT OR IGNORE INTO compliance_checklist(item_key,category,label) VALUES ('dpia_completed','gdpr','Data Protection Impact Assessment completed for matching/minor-user risks');
INSERT OR IGNORE INTO compliance_checklist(item_key,category,label) VALUES ('lia_completed','gdpr','Legitimate Interests Assessments completed for security/moderation and analytics');
INSERT OR IGNORE INTO compliance_checklist(item_key,category,label) VALUES ('processor_dpas','processors','Cloudflare and Resend processor terms/DPA reviewed');
INSERT OR IGNORE INTO compliance_checklist(item_key,category,label) VALUES ('transfers_reviewed','processors','International transfer position and safeguards reviewed');
INSERT OR IGNORE INTO compliance_checklist(item_key,category,label) VALUES ('retention_approved','retention','Retention and deletion schedule legally approved');
INSERT OR IGNORE INTO compliance_checklist(item_key,category,label) VALUES ('breach_process','incidents','72-hour personal-data-breach assessment and escalation process approved');
INSERT OR IGNORE INTO compliance_checklist(item_key,category,label) VALUES ('dsa_applicability','dsa','Digital Services Act applicability and SME exemptions reviewed');
INSERT OR IGNORE INTO compliance_checklist(item_key,category,label) VALUES ('dsa_notice_action','dsa','Illegal-content notice-and-action workflow reviewed against DSA requirements');
INSERT OR IGNORE INTO compliance_checklist(item_key,category,label) VALUES ('dsa_moderation_reasons','dsa','Content/account moderation statement-of-reasons process reviewed');
INSERT OR IGNORE INTO compliance_checklist(item_key,category,label) VALUES ('minors_safety_review','children','Privacy, safety and security measures for minors reviewed before public launch');


-- A few seed jobs so the swipe feed isn't empty on a fresh database.
-- Safe to delete these rows once real employers start posting.
INSERT OR IGNORE INTO users (id, email, password_hash, password_salt, role, name)
VALUES ('seed-employer', 'seed@buisder.app', 'x', 'x', 'employer', 'Buisder Demo Employer');
INSERT OR IGNORE INTO employer_profiles
(user_id, company_name, legal_name, location, description, verification_status, verification_reviewed_at)
VALUES
('seed-employer', 'Harbour Sports', 'Harbour Sports Ltd', 'Cork',
 'Demo listings to preview the swipe feed.', 'verified', datetime('now'));

INSERT OR IGNORE INTO jobs
(id, employer_id, title, company, location, pay, hours, experience, start_date, description, tags,
 employment_type, min_age, pay_min, schedule_tags)
VALUES
('seed-job-1','seed-employer','Retail Assistant','Harbour Sports','Cork City Centre','€14.20/hr','Sat + 2 evenings','None','Next week','Fast-paced store role with customers and stock support.','["Retail"]','Part-time',16,14.20,'["Saturday","Evenings"]'),
('seed-job-2','seed-employer','Café Team Member','Bean & Co.','Douglas','€13.90/hr','Weekend shifts','None','Immediate','Friendly front-of-house role with coffee and customer service.','["Hospitality"]','Part-time',16,13.90,'["Saturday","Sunday"]'),
('seed-job-3','seed-employer','Event Crew','LiveWorks','Cork City Centre','€15.00/hr','Flexible evenings','None','This month','Set-up support for live events, venues and promotions.','["Events"]','Temporary / Seasonal',18,15.00,'["Evenings","Saturday","Sunday"]');


-- Existing built-in demo account is trusted for fresh development databases.
INSERT OR IGNORE INTO verified_emails (user_id)
VALUES ('seed-employer');

INSERT OR IGNORE INTO privacy_preferences (user_id)
SELECT id FROM users;


-- Backfill recoverable historical events so the first v16 dashboard
-- is useful immediately. Historical skips that were later undone/applied
-- cannot be reconstructed because older versions deleted those skip rows.

INSERT OR IGNORE INTO analytics_events
(id, user_id, user_role, event_type, event_key, created_at)
SELECT
  'legacy-signup-' || id,
  id,
  role,
  'user_signup',
  'user_signup:' || id,
  created_at
FROM users
WHERE id <> 'seed-employer';

INSERT OR IGNORE INTO analytics_events
(id, user_id, user_role, event_type, job_id, event_key, created_at)
SELECT
  'legacy-job-' || id,
  employer_id,
  'employer',
  'job_posted',
  id,
  'job_posted:' || id,
  created_at
FROM jobs
WHERE employer_id <> 'seed-employer';

INSERT OR IGNORE INTO analytics_events
(id, user_id, user_role, event_type, job_id, application_id, event_key, created_at)
SELECT
  'legacy-application-' || a.id,
  a.jobseeker_id,
  'jobseeker',
  'application_submitted',
  a.job_id,
  a.id,
  'application:' || a.id || ':submitted',
  a.created_at
FROM applications a
JOIN jobs j ON j.id=a.job_id
WHERE j.employer_id <> 'seed-employer';

INSERT OR IGNORE INTO analytics_events
(id, user_id, user_role, event_type, job_id, event_key, created_at)
SELECT
  'legacy-skip-' || s.jobseeker_id || '-' || s.job_id,
  s.jobseeker_id,
  'jobseeker',
  'job_skip',
  s.job_id,
  'job_skip:' || s.jobseeker_id || ':' || s.job_id,
  s.created_at
FROM skips s
JOIN jobs j ON j.id=s.job_id
WHERE j.employer_id <> 'seed-employer';


-- v23 Growth
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

