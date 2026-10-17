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
