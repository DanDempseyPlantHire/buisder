import { newId } from "./db.js";

function cleanCode(value) {
  return String(value || "").trim().toUpperCase();
}

function dateAfterDays(days) {
  const n = Number(days || 0);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(Date.now() + n * 86400000)
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, "");
}

export async function ensureCommercialAccount(env, employerId) {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO employer_commercial_accounts
     (employer_id, plan_code, status, source)
     VALUES (?, 'free', 'active', 'default')`
  ).bind(employerId).run();

  let ref = await env.DB.prepare(
    "SELECT code FROM employer_referral_codes WHERE employer_id=?"
  ).bind(employerId).first();

  if (!ref) {
    const base = String(employerId).replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toUpperCase();
    let candidate = `BUI-${base || crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    for (let i = 0; i < 3; i++) {
      try {
        await env.DB.prepare(
          "INSERT INTO employer_referral_codes (employer_id, code) VALUES (?, ?)"
        ).bind(employerId, candidate).run();
        ref = { code: candidate };
        break;
      } catch {
        candidate = `BUI-${crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
      }
    }
  }

  if (ref?.code) {
    try {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO growth_referral_codes
         (id, code, referral_type, target_role, owner_user_id, label, status, created_by)
         VALUES (?, ?, 'employer', 'employer', ?, 'Employer referral link', 'active', ?)`
      ).bind(newId(), ref.code, employerId, employerId).run();
    } catch (e) {
      // v17 remains deployable before the optional v23 growth migration.
    }
  }

  await refreshCommercialAccess(env, employerId);
}

export async function refreshCommercialAccess(env, employerId) {
  const account = await env.DB.prepare(
    `SELECT employer_id AS employerId, plan_code AS planCode, status,
            access_ends_at AS accessEndsAt
     FROM employer_commercial_accounts
     WHERE employer_id=?`
  ).bind(employerId).first();

  if (!account || account.planCode === "free" || !account.accessEndsAt) return account;

  const expired = await env.DB.prepare(
    "SELECT CASE WHEN datetime(?) <= datetime('now') THEN 1 ELSE 0 END AS yes"
  ).bind(account.accessEndsAt).first();

  if (expired?.yes) {
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE employer_commercial_accounts
         SET plan_code='free', status='active', source='expired',
             access_ends_at=NULL, updated_at=CURRENT_TIMESTAMP
         WHERE employer_id=?`
      ).bind(employerId),
      env.DB.prepare("DELETE FROM job_promotions WHERE employer_id=?").bind(employerId),
      env.DB.prepare(
        `INSERT INTO commercial_history
         (id, employer_id, event_type, plan_code, description)
         VALUES (?, ?, 'plan_expired', 'free', 'Timed plan access ended; account returned to Free.')`
      ).bind(newId(), employerId)
    ]);
  }
}

export async function applyPlan(env, employerId, planCode, {
  status = "active",
  durationDays = null,
  source = "admin",
  actorUserId = null,
  description = null
} = {}) {
  const plan = await env.DB.prepare(
    `SELECT code, name, featured_job_limit AS featuredJobLimit
     FROM commercial_plans WHERE code=?`
  ).bind(planCode).first();
  if (!plan) throw new Error("Plan not found");

  await ensureCommercialAccount(env, employerId);
  const endsAt = durationDays ? dateAfterDays(durationDays) : null;

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE employer_commercial_accounts
       SET plan_code=?, status=?, source=?, started_at=CURRENT_TIMESTAMP,
           access_ends_at=?, updated_at=CURRENT_TIMESTAMP
       WHERE employer_id=?`
    ).bind(planCode, status, source, endsAt, employerId),
    env.DB.prepare(
      `INSERT INTO commercial_history
       (id, employer_id, event_type, plan_code, description, actor_user_id)
       VALUES (?, ?, 'plan_assigned', ?, ?, ?)`
    ).bind(
      newId(), employerId, planCode,
      description || `${plan.name} plan assigned${endsAt ? ` until ${endsAt}` : ""}.`,
      actorUserId
    )
  ]);

  if (Number(plan.featuredJobLimit || 0) <= 0) {
    await env.DB.prepare("DELETE FROM job_promotions WHERE employer_id=?")
      .bind(employerId).run();
  }

  return { plan, accessEndsAt: endsAt };
}

export async function getCommercialSnapshot(env, employerId) {
  await ensureCommercialAccount(env, employerId);

  const account = await env.DB.prepare(
    `SELECT a.employer_id AS employerId, a.plan_code AS planCode,
            a.status, a.source, a.started_at AS startedAt,
            a.access_ends_at AS accessEndsAt, a.updated_at AS updatedAt,
            p.name AS planName, p.description AS planDescription,
            p.price_mode AS priceMode, p.monthly_price_cents AS monthlyPriceCents,
            p.active_job_limit AS activeJobLimit,
            p.featured_job_limit AS featuredJobLimit,
            p.is_public AS isPublic
     FROM employer_commercial_accounts a
     JOIN commercial_plans p ON p.code=a.plan_code
     WHERE a.employer_id=?`
  ).bind(employerId).first();

  const usage = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM jobs WHERE employer_id=? AND status='active') AS activeJobs,
       (SELECT COUNT(*)
        FROM job_promotions jp
        JOIN jobs j ON j.id=jp.job_id
        WHERE jp.employer_id=? AND j.status='active'
          AND (jp.ends_at IS NULL OR datetime(jp.ends_at) > datetime('now'))) AS featuredJobs`
  ).bind(employerId, employerId).first();

  const { results: plans } = await env.DB.prepare(
    `SELECT code, name, description, price_mode AS priceMode,
            monthly_price_cents AS monthlyPriceCents,
            active_job_limit AS activeJobLimit,
            featured_job_limit AS featuredJobLimit,
            is_public AS isPublic, sort_order AS sortOrder
     FROM commercial_plans
     WHERE is_public=1 OR code=?
     ORDER BY sort_order, name`
  ).bind(account.planCode).all();

  const { results: requests } = await env.DB.prepare(
    `SELECT r.id, r.requested_plan_code AS requestedPlanCode,
            p.name AS requestedPlanName, r.message, r.status,
            r.admin_note AS adminNote, r.created_at AS createdAt,
            r.reviewed_at AS reviewedAt
     FROM commercial_plan_requests r
     JOIN commercial_plans p ON p.code=r.requested_plan_code
     WHERE r.employer_id=?
     ORDER BY r.created_at DESC LIMIT 20`
  ).bind(employerId).all();

  const { results: history } = await env.DB.prepare(
    `SELECT event_type AS eventType, plan_code AS planCode,
            description, created_at AS createdAt
     FROM commercial_history
     WHERE employer_id=?
     ORDER BY created_at DESC LIMIT 30`
  ).bind(employerId).all();

  const referral = await env.DB.prepare(
    `SELECT rc.code,
            (SELECT COUNT(*) FROM employer_referrals er
             WHERE er.referrer_employer_id=rc.employer_id) AS referralCount
     FROM employer_referral_codes rc
     WHERE rc.employer_id=?`
  ).bind(employerId).first();

  return {
    account,
    usage: {
      activeJobs: Number(usage?.activeJobs || 0),
      featuredJobs: Number(usage?.featuredJobs || 0)
    },
    plans: plans || [],
    requests: requests || [],
    history: history || [],
    referralCode: referral?.code || null,
    referralCount: Number(referral?.referralCount || 0)
  };
}

export async function canActivateJob(env, employerId, excludeJobId = null) {
  const snapshot = await getCommercialSnapshot(env, employerId);
  const limit = Number(snapshot.account.activeJobLimit || 0);
  let count;
  if (excludeJobId) {
    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM jobs WHERE employer_id=? AND status='active' AND id<>?"
    ).bind(employerId, excludeJobId).first();
    count = Number(row?.n || 0);
  } else {
    count = snapshot.usage.activeJobs;
  }
  return { allowed: limit < 0 || count < limit, count, limit, snapshot };
}

export async function canFeatureJob(env, employerId, jobId = null) {
  const snapshot = await getCommercialSnapshot(env, employerId);
  const limit = Number(snapshot.account.featuredJobLimit || 0);
  const existing = jobId ? await env.DB.prepare(
    `SELECT job_id FROM job_promotions
     WHERE job_id=? AND employer_id=?
       AND (ends_at IS NULL OR datetime(ends_at)>datetime('now'))`
  ).bind(jobId, employerId).first() : null;

  return {
    allowed: Boolean(existing) || limit < 0 || snapshot.usage.featuredJobs < limit,
    existing: Boolean(existing),
    count: snapshot.usage.featuredJobs,
    limit,
    snapshot
  };
}

export function normalizeCommercialCode(value) {
  return cleanCode(value);
}

export function accessEndFromDays(days) {
  return dateAfterDays(days);
}
