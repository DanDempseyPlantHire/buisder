-- Deas Jobs v24.1 FREE LAUNCH
-- Payments/Stripe are disabled. Safe to run after a partial v24 migration.
-- Existing billing tables, if any, are intentionally left dormant rather than dropped.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  failure_count INTEGER NOT NULL DEFAULT 0,
  disabled_at TEXT,
  last_success_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS push_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id, disabled_at);

CREATE TABLE IF NOT EXISTS application_messages (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  sender_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS message_reports (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES application_messages(id) ON DELETE CASCADE,
  reporter_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  admin_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_application_messages_application ON application_messages(application_id, created_at);
CREATE INDEX IF NOT EXISTS idx_application_messages_unread ON application_messages(application_id, read_at);
CREATE INDEX IF NOT EXISTS idx_message_reports_status ON message_reports(status, created_at);

CREATE TABLE IF NOT EXISTS risk_flags (
  id TEXT PRIMARY KEY,
  event_key TEXT UNIQUE,
  subject_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  subject_job_id TEXT REFERENCES jobs(id) ON DELETE CASCADE,
  subject_application_id TEXT REFERENCES applications(id) ON DELETE CASCADE,
  risk_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  reason TEXT NOT NULL,
  evidence_json TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','dismissed','actioned')),
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  admin_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_risk_flags_status ON risk_flags(status, severity, created_at);
CREATE INDEX IF NOT EXISTS idx_risk_flags_user ON risk_flags(subject_user_id, created_at);

CREATE TABLE IF NOT EXISTS integration_api_keys (
  id TEXT PRIMARY KEY,
  employer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  token_prefix TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT
);
CREATE TABLE IF NOT EXISTS integration_job_links (
  id TEXT PRIMARY KEY,
  employer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  external_job_id TEXT NOT NULL,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employer_id, external_job_id)
);
CREATE TABLE IF NOT EXISTS integration_events (
  id TEXT PRIMARY KEY,
  employer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  integration_type TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_integration_keys_employer ON integration_api_keys(employer_id, status);
CREATE INDEX IF NOT EXISTS idx_integration_events_employer ON integration_events(employer_id, created_at);

CREATE TABLE IF NOT EXISTS matching_model_versions (
  version TEXT PRIMARY KEY,
  model_type TEXT NOT NULL,
  description TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO matching_model_versions(version, model_type, description, active)
VALUES ('v24-rules-1','rules','Transparent rule-based ranking using age eligibility, availability, distance/location, pay, employment type, interests and experience. It does not rank candidates for employers or make hiring decisions.',1);

-- Initial launch is free: all access tiers have zero price and payment-specific compliance items are removed.
UPDATE commercial_plans SET price_mode='free', monthly_price_cents=0, updated_at=CURRENT_TIMESTAMP;
DELETE FROM compliance_checklist WHERE item_key='payments_review';
DELETE FROM processor_register WHERE id='stripe';
DELETE FROM lawful_basis_register WHERE id='billing';
DELETE FROM retention_register WHERE id='billing';
DELETE FROM pilot_launch_checklist WHERE item_key='payments_tested';

INSERT OR IGNORE INTO compliance_checklist(item_key, category, label) VALUES ('push_review','notifications','Web Push consent, preference and retention approach reviewed');
INSERT OR IGNORE INTO compliance_checklist(item_key, category, label) VALUES ('messaging_safety_review','safety','Application-only messaging safeguards and minor-user protections reviewed');
INSERT OR IGNORE INTO compliance_checklist(item_key, category, label) VALUES ('integration_security_review','security','Employer integration API-key controls and rotation process reviewed');

INSERT OR IGNORE INTO lawful_basis_register
(id,processing_activity,purpose,data_subjects,data_categories,lawful_basis,article_ref,children_consideration,review_status)
VALUES ('application_messaging','Application messaging and message safety','Enable recruitment communication connected to an application and investigate reported messages','Job seekers and employers','Message content, sender, application link and reports','Contract / legitimate interests - proposed','GDPR Art. 6(1)(b) / 6(1)(f) subject to legal review','Messaging is application-only; reporting/blocking and additional minor-user safeguards apply.','legal_review_required');
INSERT OR IGNORE INTO lawful_basis_register
(id,processing_activity,purpose,data_subjects,data_categories,lawful_basis,article_ref,children_consideration,review_status)
VALUES ('risk_controls','Fraud, abuse and safety risk controls','Identify behavioural patterns requiring human safety or security review','All users','Product activity counts, safety reports, reported messages and resulting risk flags','Legitimate interests - proposed','GDPR Art. 6(1)(f) subject to LIA/legal review','Risk flags do not rank candidates for employers or make automated hiring decisions.','legal_review_required');
INSERT OR IGNORE INTO lawful_basis_register
(id,processing_activity,purpose,data_subjects,data_categories,lawful_basis,article_ref,children_consideration,review_status)
VALUES ('employer_integrations','Employer API integrations','Allow verified employers to securely import or update their own jobs and export interview calendar data','Employer users and applicants associated with relevant interviews','Hashed API-key metadata, external job identifiers and integration events','Contract - proposed','GDPR Art. 6(1)(b) subject to legal review','Integration access must not expose broader candidate data or bypass minor-user protections.','legal_review_required');

INSERT OR IGNORE INTO retention_register
(id,data_category,system,proposed_rule,deletion_method,rationale,review_status)
VALUES ('messages','Application messages and message reports','D1','Retain for the active recruitment process plus an approved safety/dispute period','Delete or pseudonymise according to the approved retention schedule','Messages may be needed for user safety and dispute handling but should not be indefinite.','legal_review_required');
INSERT OR IGNORE INTO retention_register
(id,data_category,system,proposed_rule,deletion_method,rationale,review_status)
VALUES ('push','Web Push subscriptions and preferences','D1 / browser push service','Keep while the device subscription is active; remove disabled or expired endpoints promptly','Self-service disable, automatic disable on 404/410, account deletion cascade','Push endpoints are operational identifiers and should not be retained after they are unusable.','legal_review_required');
INSERT OR IGNORE INTO retention_register
(id,data_category,system,proposed_rule,deletion_method,rationale,review_status)
VALUES ('integration_keys','Employer integration key metadata and events','D1','Key metadata for account lifetime; integration-event retention period to be approved','Revoke keys immediately when requested; delete with employer account subject to approved audit retention','Full API secrets are never stored in readable form.','legal_review_required');

INSERT OR IGNORE INTO pilot_launch_checklist(item_key,label) VALUES ('push_tested','Installed-app Web Push tested with the app closed on supported devices');
INSERT OR IGNORE INTO pilot_launch_checklist(item_key,label) VALUES ('messaging_tested','Application messaging, reporting and blocking tested');
INSERT OR IGNORE INTO pilot_launch_checklist(item_key,label) VALUES ('risk_controls_tested','Risk flags and admin review workflow tested');
INSERT OR IGNORE INTO pilot_launch_checklist(item_key,label) VALUES ('integrations_tested','Employer API key, job import and interview calendar export tested');
INSERT OR IGNORE INTO pilot_launch_checklist(item_key,label) VALUES ('pwa_install_tested','PWA install and offline fallback tested on target devices');
