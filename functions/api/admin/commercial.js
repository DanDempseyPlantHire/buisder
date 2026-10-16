import { json, requireAdmin } from "../../_lib/db.js";

export async function onRequestGet(context) {
  const { env } = context;
  const { error } = await requireAdmin(context);
  if (error) return error;

  const { results: plans } = await env.DB.prepare(
    `SELECT code, name, description, price_mode AS priceMode,
            monthly_price_cents AS monthlyPriceCents,
            active_job_limit AS activeJobLimit,
            featured_job_limit AS featuredJobLimit,
            is_public AS isPublic, sort_order AS sortOrder,
            updated_at AS updatedAt
     FROM commercial_plans ORDER BY sort_order, name`
  ).all();

  const { results: employers } = await env.DB.prepare(
    `SELECT u.id, u.email, u.name,
            ep.company_name AS companyName,
            a.plan_code AS planCode, p.name AS planName,
            a.status, a.source, a.access_ends_at AS accessEndsAt,
            p.price_mode AS priceMode, p.monthly_price_cents AS monthlyPriceCents,
            p.active_job_limit AS activeJobLimit,
            p.featured_job_limit AS featuredJobLimit,
            (SELECT COUNT(*) FROM jobs j WHERE j.employer_id=u.id AND j.status='active') AS activeJobs,
            (SELECT COUNT(*) FROM job_promotions jp JOIN jobs j2 ON j2.id=jp.job_id
             WHERE jp.employer_id=u.id AND j2.status='active'
               AND (jp.ends_at IS NULL OR datetime(jp.ends_at)>datetime('now'))) AS featuredJobs,
            (SELECT COUNT(*) FROM employer_referrals er WHERE er.referrer_employer_id=u.id) AS referralCount
     FROM users u
     LEFT JOIN employer_profiles ep ON ep.user_id=u.id
     LEFT JOIN employer_commercial_accounts a ON a.employer_id=u.id
     LEFT JOIN commercial_plans p ON p.code=COALESCE(a.plan_code,'free')
     WHERE u.role='employer' AND u.id<>'seed-employer'
     ORDER BY u.created_at DESC`
  ).all();

  const { results: requests } = await env.DB.prepare(
    `SELECT r.id, r.employer_id AS employerId,
            u.email, u.name, ep.company_name AS companyName,
            r.requested_plan_code AS requestedPlanCode,
            p.name AS requestedPlanName,
            r.message, r.status, r.admin_note AS adminNote,
            r.created_at AS createdAt, r.reviewed_at AS reviewedAt
     FROM commercial_plan_requests r
     JOIN users u ON u.id=r.employer_id
     LEFT JOIN employer_profiles ep ON ep.user_id=u.id
     JOIN commercial_plans p ON p.code=r.requested_plan_code
     ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.created_at DESC
     LIMIT 100`
  ).all();

  const { results: promos } = await env.DB.prepare(
    `SELECT pc.id, pc.code, pc.plan_code AS planCode, p.name AS planName,
            pc.duration_days AS durationDays,
            pc.max_redemptions AS maxRedemptions,
            pc.redemption_count AS redemptionCount,
            pc.active, pc.expires_at AS expiresAt,
            pc.created_at AS createdAt
     FROM commercial_promo_codes pc
     JOIN commercial_plans p ON p.code=pc.plan_code
     ORDER BY pc.created_at DESC`
  ).all();

  const { results: history } = await env.DB.prepare(
    `SELECT h.id, h.employer_id AS employerId,
            ep.company_name AS companyName, u.email,
            h.event_type AS eventType, h.plan_code AS planCode,
            h.description, h.created_at AS createdAt
     FROM commercial_history h
     JOIN users u ON u.id=h.employer_id
     LEFT JOIN employer_profiles ep ON ep.user_id=u.id
     ORDER BY h.created_at DESC LIMIT 60`
  ).all();

  const summary = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM users WHERE role='employer' AND id<>'seed-employer') AS employers,
       (SELECT COUNT(*) FROM employer_commercial_accounts WHERE plan_code='free' AND employer_id<>'seed-employer') AS freeAccounts,
       (SELECT COUNT(*) FROM employer_commercial_accounts WHERE plan_code='pilot' AND employer_id<>'seed-employer') AS pilotAccounts,
       (SELECT COUNT(*) FROM employer_commercial_accounts WHERE plan_code='growth' AND employer_id<>'seed-employer') AS growthAccounts,
       (SELECT COUNT(*) FROM employer_commercial_accounts WHERE plan_code='pro' AND employer_id<>'seed-employer') AS proAccounts,
       (SELECT COUNT(*) FROM employer_commercial_accounts
        WHERE status='trial' AND access_ends_at IS NOT NULL
          AND datetime(access_ends_at)>datetime('now')) AS activeTrials,
       (SELECT COUNT(*) FROM employer_commercial_accounts
        WHERE access_ends_at IS NOT NULL
          AND datetime(access_ends_at)>datetime('now')
          AND datetime(access_ends_at)<=datetime('now','+7 days')) AS expiring7Days,
       (SELECT COUNT(*) FROM commercial_plan_requests WHERE status='pending') AS pendingRequests,
       (SELECT COUNT(*) FROM job_promotions jp JOIN jobs j ON j.id=jp.job_id
        WHERE j.status='active' AND (jp.ends_at IS NULL OR datetime(jp.ends_at)>datetime('now'))) AS featuredJobs,
       (SELECT COALESCE(SUM(CASE WHEN p.price_mode='fixed' THEN COALESCE(p.monthly_price_cents,0) ELSE 0 END),0)
        FROM employer_commercial_accounts a JOIN commercial_plans p ON p.code=a.plan_code
        WHERE a.status IN ('active','trial')) AS assignedMonthlyPlanValueCents`
  ).first();

  return json({
    summary: summary || {},
    plans: plans || [],
    employers: employers || [],
    requests: requests || [],
    promos: promos || [],
    history: history || []
  }, { headers: { "Cache-Control": "no-store" } });
}
