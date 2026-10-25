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
('account_service','Account registration and service delivery','Create and operate Deas Jobs accounts','Job seekers and employers','Identity, contact, account and profile data','Contract','GDPR Art. 6(1)(b)','Use child-oriented transparency for 16–17-year-old users.');
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
