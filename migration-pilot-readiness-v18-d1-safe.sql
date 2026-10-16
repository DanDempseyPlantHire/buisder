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
