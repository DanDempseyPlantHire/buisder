export const EXPECTED_TABLES = [
  "users","verified_emails","auth_tokens","auth_rate_limits","sessions",
  "admin_users","admin_audit_log","jobseeker_profiles","employer_profiles",
  "jobs","applications","application_status_history","legal_consents",
  "privacy_preferences","user_blocks","safety_reports","commercial_plans",
  "employer_commercial_accounts","commercial_plan_requests",
  "commercial_promo_codes","commercial_promo_redemptions",
  "employer_referral_codes","employer_referrals","job_promotions",
  "commercial_history","analytics_events","notifications","job_offers",
  "notification_preferences","email_delivery_log","email_scheduler_state",
  "skips","interview_invites","pilot_launch_checklist",
  "pilot_settings","pilot_cohorts","pilot_organizations","pilot_invite_codes",
  "pilot_memberships","pilot_invite_redemptions","pilot_feedback","pilot_issues"
];

export const LAUNCH_CHECKLIST = [
  { key:"backup_completed", label:"Production D1 backup/export completed" },
  { key:"auth_tested", label:"Signup, verification, login and password reset tested" },
  { key:"candidate_flow_tested", label:"Candidate profile, swipe, apply and withdraw flow tested" },
  { key:"employer_flow_tested", label:"Employer verification, job posting and applicant review tested" },
  { key:"recruitment_flow_tested", label:"Shortlist, interview, offer and hire workflow tested end to end" },
  { key:"privacy_safety_tested", label:"Privacy, report, block, export and account deletion tested" },
  { key:"commercial_controls_tested", label:"Employer plan limits and commercial controls tested" },
  { key:"recruitment_emails_tested", label:"Recruitment email notifications and preferences tested" },
  { key:"mobile_ios_tested", label:"Pilot tested on iPhone Safari" },
  { key:"mobile_android_tested", label:"Pilot tested on Android Chrome" },
  { key:"desktop_tested", label:"Pilot tested on desktop Chrome or Edge" },
  { key:"support_process_ready", label:"Pilot support contact and issue escalation process ready" },
  { key:"pilot_docs_reviewed", label:"Pilot Terms and Privacy Summary reviewed for pilot use" },
  { key:"pilot_management_tested", label:"Pilot invite, cohort, feedback and issue-management flow tested" }
];
