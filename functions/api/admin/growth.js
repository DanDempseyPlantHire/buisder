import { json, requireAdmin } from "../../_lib/db.js";

async function all(env, sql, args=[]) {
  const { results } = await env.DB.prepare(sql).bind(...args).all();
  return results || [];
}
function n(v){ return Number(v || 0); }

export async function onRequestGet(context) {
  const { env } = context;
  const { error } = await requireAdmin(context);
  if (error) return error;

  const overview = await env.DB.prepare(
    `SELECT
      (SELECT COUNT(*) FROM growth_attribution) AS attributedSignups,
      (SELECT COUNT(*) FROM growth_attribution WHERE referral_code_id IS NOT NULL) AS referralSignups,
      (SELECT COUNT(*) FROM growth_attribution WHERE campaign_id IS NOT NULL) AS campaignSignups,
      (SELECT COUNT(*) FROM growth_attribution WHERE partner_id IS NOT NULL) AS partnerSignups,
      (SELECT COUNT(*) FROM growth_campaigns WHERE status='active') AS activeCampaigns,
      (SELECT COUNT(*) FROM growth_partners WHERE status='active') AS activePartners,
      (SELECT COUNT(*) FROM growth_employer_leads WHERE stage NOT IN ('active')) AS openEmployerLeads`
  ).first();

  const candidateFunnel = await env.DB.prepare(
    `SELECT COUNT(DISTINCT ga.user_id) AS signups,
            COUNT(DISTINCT CASE WHEN COALESCE(jp.onboarding_complete,0)=1 THEN ga.user_id END) AS profileComplete,
            COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN ga.user_id END) AS applicants,
            COUNT(DISTINCT CASE WHEN ii.id IS NOT NULL THEN ga.user_id END) AS interviews,
            COUNT(DISTINCT CASE WHEN a.status='hired' THEN ga.user_id END) AS hires
     FROM growth_attribution ga
     JOIN users u ON u.id=ga.user_id AND u.role='jobseeker'
     LEFT JOIN jobseeker_profiles jp ON jp.user_id=ga.user_id
     LEFT JOIN applications a ON a.jobseeker_id=ga.user_id
     LEFT JOIN interview_invites ii ON ii.application_id=a.id`
  ).first();

  const employerFunnel = await env.DB.prepare(
    `SELECT COUNT(DISTINCT ga.user_id) AS signups,
            COUNT(DISTINCT CASE WHEN ep.verification_status='verified' THEN ga.user_id END) AS verified,
            COUNT(DISTINCT CASE WHEN j.id IS NOT NULL THEN ga.user_id END) AS jobPosted,
            COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN ga.user_id END) AS receivedApplicant,
            COUNT(DISTINCT CASE WHEN a.status='hired' THEN ga.user_id END) AS hires
     FROM growth_attribution ga
     JOIN users u ON u.id=ga.user_id AND u.role='employer'
     LEFT JOIN employer_profiles ep ON ep.user_id=ga.user_id
     LEFT JOIN jobs j ON j.employer_id=ga.user_id
     LEFT JOIN applications a ON a.job_id=j.id`
  ).first();

  const partners = await all(env,
    `SELECT gp.id, gp.name, gp.partner_type AS partnerType, gp.contact_name AS contactName,
            gp.contact_email AS contactEmail, gp.region, gp.status, gp.notes,
            gp.created_at AS createdAt,
            COUNT(DISTINCT ga.user_id) AS signups,
            COUNT(DISTINCT CASE WHEN u.role='jobseeker' THEN ga.user_id END) AS jobseekers,
            COUNT(DISTINCT CASE WHEN u.role='employer' THEN ga.user_id END) AS employers,
            COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN ga.user_id END) AS applicants,
            COUNT(DISTINCT CASE WHEN a.status='hired' THEN ga.user_id END) AS hires,
            COUNT(DISTINCT CASE WHEN j.id IS NOT NULL AND u.role='employer' THEN ga.user_id END) AS employersWithJobs
     FROM growth_partners gp
     LEFT JOIN growth_attribution ga ON ga.partner_id=gp.id
     LEFT JOIN users u ON u.id=ga.user_id
     LEFT JOIN applications a ON a.jobseeker_id=ga.user_id
     LEFT JOIN jobs j ON j.employer_id=ga.user_id
     GROUP BY gp.id ORDER BY gp.created_at DESC`
  );

  const campaigns = await all(env,
    `SELECT gc.id, gc.name, gc.campaign_key AS campaignKey, gc.source, gc.medium,
            gc.target_role AS targetRole, gc.partner_id AS partnerId, gp.name AS partnerName,
            gc.landing_path AS landingPath, gc.status, gc.starts_at AS startsAt, gc.ends_at AS endsAt,
            gc.notes, gc.created_at AS createdAt,
            COUNT(DISTINCT ga.user_id) AS signups,
            COUNT(DISTINCT CASE WHEN u.role='jobseeker' THEN ga.user_id END) AS candidateSignups,
            COUNT(DISTINCT CASE WHEN u.role='employer' THEN ga.user_id END) AS employerSignups,
            COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN ga.user_id END) AS applicants,
            COUNT(DISTINCT CASE WHEN a.status='hired' THEN ga.user_id END) AS hires,
            COUNT(DISTINCT CASE WHEN j.id IS NOT NULL AND u.role='employer' THEN ga.user_id END) AS employersWithJobs
     FROM growth_campaigns gc
     LEFT JOIN growth_partners gp ON gp.id=gc.partner_id
     LEFT JOIN growth_attribution ga ON ga.campaign_id=gc.id
     LEFT JOIN users u ON u.id=ga.user_id
     LEFT JOIN applications a ON a.jobseeker_id=ga.user_id
     LEFT JOIN jobs j ON j.employer_id=ga.user_id
     GROUP BY gc.id ORDER BY gc.created_at DESC`
  );

  const codes = await all(env,
    `SELECT grc.id, grc.code, grc.referral_type AS referralType, grc.target_role AS targetRole,
            grc.owner_user_id AS ownerUserId, ou.name AS ownerName, ou.email AS ownerEmail,
            grc.partner_id AS partnerId, gp.name AS partnerName,
            grc.campaign_id AS campaignId, gc.name AS campaignName,
            grc.label, grc.status, grc.max_uses AS maxUses, grc.use_count AS useCount,
            grc.expires_at AS expiresAt, grc.created_at AS createdAt,
            COUNT(DISTINCT gr.referred_user_id) AS signups,
            COUNT(DISTINCT CASE WHEN a.status='hired' THEN gr.referred_user_id END) AS candidateHires,
            COUNT(DISTINCT CASE WHEN j.id IS NOT NULL AND ru.role='employer' THEN gr.referred_user_id END) AS employersWithJobs
     FROM growth_referral_codes grc
     LEFT JOIN users ou ON ou.id=grc.owner_user_id
     LEFT JOIN growth_partners gp ON gp.id=grc.partner_id
     LEFT JOIN growth_campaigns gc ON gc.id=grc.campaign_id
     LEFT JOIN growth_referrals gr ON gr.code_id=grc.id
     LEFT JOIN users ru ON ru.id=gr.referred_user_id
     LEFT JOIN applications a ON a.jobseeker_id=gr.referred_user_id
     LEFT JOIN jobs j ON j.employer_id=gr.referred_user_id
     GROUP BY grc.id ORDER BY grc.created_at DESC LIMIT 250`
  );

  const leads = await all(env,
    `SELECT gel.id, gel.business_name AS businessName, gel.contact_name AS contactName,
            gel.contact_email AS contactEmail, gel.location, gel.stage, gel.source,
            gel.partner_id AS partnerId, gp.name AS partnerName,
            gel.campaign_id AS campaignId, gc.name AS campaignName,
            gel.linked_employer_id AS linkedEmployerId, u.email AS linkedEmployerEmail,
            gel.notes, gel.next_follow_up_at AS nextFollowUpAt,
            gel.created_at AS createdAt, gel.updated_at AS updatedAt
     FROM growth_employer_leads gel
     LEFT JOIN growth_partners gp ON gp.id=gel.partner_id
     LEFT JOIN growth_campaigns gc ON gc.id=gel.campaign_id
     LEFT JOIN users u ON u.id=gel.linked_employer_id
     ORDER BY CASE gel.stage
       WHEN 'prospect' THEN 0 WHEN 'contacted' THEN 1 WHEN 'interested' THEN 2 WHEN 'invited' THEN 3
       WHEN 'registered' THEN 4 WHEN 'verified' THEN 5 WHEN 'first_job' THEN 6 ELSE 7 END,
       COALESCE(gel.next_follow_up_at,'9999-12-31'), gel.created_at DESC LIMIT 250`
  );

  const recentReferrals = await all(env,
    `SELECT gr.id, gr.target_role AS targetRole, gr.created_at AS createdAt,
            ru.name AS referredName, ru.email AS referredEmail,
            ou.name AS referrerName, ou.email AS referrerEmail,
            grc.code, gp.name AS partnerName, gc.name AS campaignName,
            CASE WHEN ru.role='jobseeker' THEN COALESCE(jp.onboarding_complete,0) ELSE NULL END AS activatedCandidate,
            CASE WHEN ru.role='employer' THEN ep.verification_status ELSE NULL END AS employerVerification,
            CASE WHEN ru.role='jobseeker' THEN (SELECT COUNT(*) FROM applications a2 WHERE a2.jobseeker_id=ru.id) ELSE NULL END AS applicationCount,
            CASE WHEN ru.role='jobseeker' THEN (SELECT COUNT(*) FROM applications a3 WHERE a3.jobseeker_id=ru.id AND a3.status='hired') ELSE NULL END AS hireCount,
            CASE WHEN ru.role='employer' THEN (SELECT COUNT(*) FROM jobs j2 WHERE j2.employer_id=ru.id) ELSE NULL END AS jobCount
     FROM growth_referrals gr
     JOIN users ru ON ru.id=gr.referred_user_id
     LEFT JOIN users ou ON ou.id=gr.referrer_user_id
     LEFT JOIN growth_referral_codes grc ON grc.id=gr.code_id
     LEFT JOIN growth_partners gp ON gp.id=gr.partner_id
     LEFT JOIN growth_campaigns gc ON gc.id=gr.campaign_id
     LEFT JOIN jobseeker_profiles jp ON jp.user_id=ru.id
     LEFT JOIN employer_profiles ep ON ep.user_id=ru.id
     ORDER BY gr.created_at DESC LIMIT 100`
  );

  const candidateLocations = await all(env,
    `SELECT trim(jp.location) AS location, COUNT(*) AS count
     FROM jobseeker_profiles jp JOIN users u ON u.id=jp.user_id
     WHERE trim(COALESCE(jp.location,''))<>'' AND COALESCE(u.is_suspended,0)=0
     GROUP BY lower(trim(jp.location)) ORDER BY count DESC LIMIT 20`
  );
  const jobLocations = await all(env,
    `SELECT trim(j.location) AS location, COUNT(*) AS count
     FROM jobs j JOIN users u ON u.id=j.employer_id
     WHERE j.status='active' AND COALESCE(u.is_suspended,0)=0 AND trim(COALESCE(j.location,''))<>''
     GROUP BY lower(trim(j.location)) ORDER BY count DESC LIMIT 20`
  );

  return json({
    overview:{
      attributedSignups:n(overview?.attributedSignups), referralSignups:n(overview?.referralSignups),
      campaignSignups:n(overview?.campaignSignups), partnerSignups:n(overview?.partnerSignups),
      activeCampaigns:n(overview?.activeCampaigns), activePartners:n(overview?.activePartners),
      openEmployerLeads:n(overview?.openEmployerLeads)
    },
    candidateFunnel:{signups:n(candidateFunnel?.signups),profileComplete:n(candidateFunnel?.profileComplete),applicants:n(candidateFunnel?.applicants),interviews:n(candidateFunnel?.interviews),hires:n(candidateFunnel?.hires)},
    employerFunnel:{signups:n(employerFunnel?.signups),verified:n(employerFunnel?.verified),jobPosted:n(employerFunnel?.jobPosted),receivedApplicant:n(employerFunnel?.receivedApplicant),hires:n(employerFunnel?.hires)},
    partners, campaigns, codes, leads, recentReferrals,
    geography:{candidateLocations,jobLocations}
  }, { headers:{"Cache-Control":"no-store"} });
}
