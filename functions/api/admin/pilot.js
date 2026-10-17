import { json, requireAdmin } from "../../_lib/db.js";
import { getPilotSettings } from "../../_lib/pilot.js";

async function all(env, sql, args=[]) {
  const { results } = await env.DB.prepare(sql).bind(...args).all();
  return results || [];
}

function n(v){ return Number(v || 0); }

export async function onRequestGet(context) {
  const { env } = context;
  const { error } = await requireAdmin(context);
  if (error) return error;

  const settings = await getPilotSettings(env);

  const overview = await env.DB.prepare(
    `SELECT
      (SELECT COUNT(*) FROM pilot_memberships) AS totalMembers,
      (SELECT COUNT(*) FROM pilot_memberships WHERE status='active') AS activeMembers,
      (SELECT COUNT(*) FROM pilot_memberships pm JOIN users u ON u.id=pm.user_id WHERE u.role='jobseeker') AS jobseekers,
      (SELECT COUNT(*) FROM pilot_memberships pm JOIN users u ON u.id=pm.user_id WHERE u.role='employer') AS employers,
      (SELECT COUNT(*) FROM pilot_organizations WHERE status='active') AS activeOrganizations,
      (SELECT COUNT(*) FROM pilot_cohorts WHERE status='active') AS activeCohorts,
      (SELECT COUNT(*) FROM pilot_issues WHERE status IN ('open','reviewing')) AS openIssues,
      (SELECT COUNT(*) FROM pilot_feedback) AS feedbackCount,
      (SELECT ROUND(AVG(rating),1) FROM pilot_feedback WHERE rating IS NOT NULL) AS avgRating,
      (SELECT ROUND(AVG(ease_score),1) FROM pilot_feedback WHERE ease_score IS NOT NULL) AS avgEase,
      (SELECT ROUND(AVG(recommend_score),1) FROM pilot_feedback WHERE recommend_score IS NOT NULL) AS avgRecommend,
      (SELECT COUNT(*) FROM pilot_memberships pm
         LEFT JOIN analytics_events ae ON ae.user_id=pm.user_id AND ae.event_type='app_open' AND datetime(ae.created_at)>=datetime('now','-7 days')
         WHERE pm.status='active'
         GROUP BY pm.id HAVING COUNT(ae.id)=0 LIMIT 1) AS anyInactiveMarker`
  ).first();

  const promoters = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN recommend_score>=9 THEN 1 ELSE 0 END) AS promoters,
       SUM(CASE WHEN recommend_score<=6 THEN 1 ELSE 0 END) AS detractors,
       COUNT(*) AS responses
     FROM pilot_feedback WHERE recommend_score IS NOT NULL`
  ).first();

  const inactive = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM pilot_memberships pm
     WHERE pm.status='active'
       AND NOT EXISTS (
         SELECT 1 FROM analytics_events ae
         WHERE ae.user_id=pm.user_id
           AND ae.event_type='app_open'
           AND datetime(ae.created_at)>=datetime('now','-7 days')
       )`
  ).first();

  const responses = n(promoters?.responses);
  const nps = responses
    ? Math.round(((n(promoters?.promoters) - n(promoters?.detractors)) / responses) * 100)
    : null;

  const cohorts = await all(env,
    `SELECT pc.id, pc.name, pc.description, pc.status,
            pc.starts_at AS startsAt, pc.ends_at AS endsAt,
            pc.created_at AS createdAt,
            COUNT(pm.id) AS memberCount,
            SUM(CASE WHEN pm.status='active' THEN 1 ELSE 0 END) AS activeCount,
            (SELECT COUNT(*) FROM pilot_memberships pm2 JOIN applications a ON a.jobseeker_id=pm2.user_id WHERE pm2.cohort_id=pc.id) AS applicationCount,
            (SELECT COUNT(*) FROM pilot_memberships pm2 JOIN applications a ON a.jobseeker_id=pm2.user_id WHERE pm2.cohort_id=pc.id AND a.status='hired') AS hireCount,
            (SELECT COUNT(*) FROM pilot_memberships pm2 JOIN jobs j ON j.employer_id=pm2.user_id WHERE pm2.cohort_id=pc.id) AS jobCount
     FROM pilot_cohorts pc
     LEFT JOIN pilot_memberships pm ON pm.cohort_id=pc.id
     GROUP BY pc.id
     ORDER BY pc.created_at DESC`
  );

  const organizations = await all(env,
    `SELECT po.id, po.name, po.org_type AS orgType,
            po.contact_name AS contactName, po.contact_email AS contactEmail,
            po.status, po.notes, po.created_at AS createdAt,
            COUNT(pm.id) AS memberCount,
            SUM(CASE WHEN u.role='employer' THEN 1 ELSE 0 END) AS employerCount,
            SUM(CASE WHEN u.role='jobseeker' THEN 1 ELSE 0 END) AS jobseekerCount,
            (SELECT COUNT(*) FROM pilot_memberships pm2 JOIN applications a ON a.jobseeker_id=pm2.user_id WHERE pm2.organization_id=po.id) AS applicationCount,
            (SELECT COUNT(*) FROM pilot_memberships pm2 JOIN applications a ON a.jobseeker_id=pm2.user_id WHERE pm2.organization_id=po.id AND a.status='hired') AS hireCount,
            (SELECT COUNT(*) FROM pilot_memberships pm2 JOIN jobs j ON j.employer_id=pm2.user_id WHERE pm2.organization_id=po.id) AS jobCount
     FROM pilot_organizations po
     LEFT JOIN pilot_memberships pm ON pm.organization_id=po.id
     LEFT JOIN users u ON u.id=pm.user_id
     GROUP BY po.id
     ORDER BY po.created_at DESC`
  );

  const invites = await all(env,
    `SELECT pic.id, pic.code, pic.label,
            pic.allowed_role AS allowedRole,
            pic.cohort_id AS cohortId, pc.name AS cohortName,
            pic.organization_id AS organizationId, po.name AS organizationName,
            pic.max_uses AS maxUses, pic.expires_at AS expiresAt,
            pic.status, pic.created_at AS createdAt,
            COUNT(pir.id) AS useCount
     FROM pilot_invite_codes pic
     LEFT JOIN pilot_cohorts pc ON pc.id=pic.cohort_id
     LEFT JOIN pilot_organizations po ON po.id=pic.organization_id
     LEFT JOIN pilot_invite_redemptions pir ON pir.invite_code_id=pic.id
     GROUP BY pic.id
     ORDER BY pic.created_at DESC`
  );

  const members = await all(env,
    `SELECT pm.id, pm.user_id AS userId, pm.status, pm.source,
            pm.joined_at AS joinedAt, pm.updated_at AS updatedAt, pm.notes,
            u.name, u.email, u.role, u.created_at AS accountCreatedAt,
            pc.id AS cohortId, pc.name AS cohortName,
            po.id AS organizationId, po.name AS organizationName,
            (SELECT MAX(ae.created_at) FROM analytics_events ae WHERE ae.user_id=u.id AND ae.event_type='app_open') AS lastActiveAt,
            CASE WHEN u.role='jobseeker' THEN COALESCE((SELECT onboarding_complete FROM jobseeker_profiles jp WHERE jp.user_id=u.id),0) ELSE NULL END AS profileComplete,
            CASE WHEN u.role='jobseeker' THEN (SELECT COUNT(*) FROM applications a WHERE a.jobseeker_id=u.id) ELSE NULL END AS applicationCount,
            CASE WHEN u.role='employer' THEN (SELECT COUNT(*) FROM jobs j WHERE j.employer_id=u.id) ELSE NULL END AS jobCount,
            CASE WHEN u.role='employer' THEN (SELECT verification_status FROM employer_profiles ep WHERE ep.user_id=u.id) ELSE NULL END AS verificationStatus
     FROM pilot_memberships pm
     JOIN users u ON u.id=pm.user_id
     LEFT JOIN pilot_cohorts pc ON pc.id=pm.cohort_id
     LEFT JOIN pilot_organizations po ON po.id=pm.organization_id
     ORDER BY pm.joined_at DESC
     LIMIT 250`
  );

  const feedback = await all(env,
    `SELECT pf.id, pf.feedback_type AS feedbackType, pf.rating,
            pf.ease_score AS easeScore, pf.recommend_score AS recommendScore,
            pf.comments, pf.created_at AS createdAt,
            u.name, u.email, u.role,
            pc.name AS cohortName, po.name AS organizationName
     FROM pilot_feedback pf
     LEFT JOIN users u ON u.id=pf.user_id
     LEFT JOIN pilot_memberships pm ON pm.id=pf.membership_id
     LEFT JOIN pilot_cohorts pc ON pc.id=pm.cohort_id
     LEFT JOIN pilot_organizations po ON po.id=pm.organization_id
     ORDER BY pf.created_at DESC LIMIT 150`
  );

  const issues = await all(env,
    `SELECT pi.id, pi.category, pi.severity, pi.title, pi.details,
            pi.status, pi.admin_note AS adminNote,
            pi.created_at AS createdAt, pi.updated_at AS updatedAt,
            u.name, u.email, u.role,
            pc.name AS cohortName, po.name AS organizationName
     FROM pilot_issues pi
     LEFT JOIN users u ON u.id=pi.reporter_user_id
     LEFT JOIN pilot_memberships pm ON pm.id=pi.membership_id
     LEFT JOIN pilot_cohorts pc ON pc.id=pm.cohort_id
     LEFT JOIN pilot_organizations po ON po.id=pm.organization_id
     ORDER BY
       CASE pi.status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END,
       CASE pi.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
       pi.created_at DESC
     LIMIT 200`
  );

  return json({
    settings,
    overview:{
      totalMembers:n(overview?.totalMembers),
      activeMembers:n(overview?.activeMembers),
      jobseekers:n(overview?.jobseekers),
      employers:n(overview?.employers),
      activeOrganizations:n(overview?.activeOrganizations),
      activeCohorts:n(overview?.activeCohorts),
      openIssues:n(overview?.openIssues),
      feedbackCount:n(overview?.feedbackCount),
      avgRating:overview?.avgRating === null || overview?.avgRating === undefined ? null : Number(overview.avgRating),
      avgEase:overview?.avgEase === null || overview?.avgEase === undefined ? null : Number(overview.avgEase),
      avgRecommend:overview?.avgRecommend === null || overview?.avgRecommend === undefined ? null : Number(overview.avgRecommend),
      nps,
      inactive7d:n(inactive?.count)
    },
    cohorts,
    organizations,
    invites,
    members,
    feedback,
    issues
  }, { headers:{ "Cache-Control":"no-store" } });
}
