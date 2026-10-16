import { json, err, newId, requireUser } from "../../../_lib/db.js";
import { canFeatureJob } from "../../../_lib/commercial.js";

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const { user, error } = await requireUser(context, "employer");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const action = String(body?.action || "feature").toLowerCase();
  if (!["feature", "unfeature"].includes(action)) return err("Action must be feature or unfeature");

  const job = await env.DB.prepare(
    "SELECT id, title, status FROM jobs WHERE id=? AND employer_id=?"
  ).bind(params.id, user.id).first();
  if (!job) return err("Job not found", 404);

  if (action === "unfeature") {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM job_promotions WHERE job_id=? AND employer_id=?")
        .bind(job.id, user.id),
      env.DB.prepare(
        `INSERT INTO commercial_history
         (id, employer_id, event_type, description, actor_user_id)
         VALUES (?, ?, 'job_unfeatured', ?, ?)`
      ).bind(newId(), user.id, `${job.title} removed from featured placement.`, user.id)
    ]);
    return json({ ok: true, featured: false });
  }

  if (job.status !== "active") return err("Only active jobs can be featured");

  const entitlement = await canFeatureJob(env, user.id, job.id);
  if (!entitlement.allowed) {
    return err(`Your ${entitlement.snapshot.account.planName} plan allows ${entitlement.limit} featured job${entitlement.limit===1 ? "" : "s"}.`, 403);
  }

  const endsAt = entitlement.snapshot.account.accessEndsAt || null;
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO job_promotions (job_id, employer_id, source, started_at, ends_at)
       VALUES (?, ?, 'plan', CURRENT_TIMESTAMP, ?)
       ON CONFLICT(job_id) DO UPDATE SET
         employer_id=excluded.employer_id,
         source='plan',
         started_at=CURRENT_TIMESTAMP,
         ends_at=excluded.ends_at`
    ).bind(job.id, user.id, endsAt),
    env.DB.prepare(
      `INSERT INTO commercial_history
       (id, employer_id, event_type, plan_code, description, actor_user_id)
       VALUES (?, ?, 'job_featured', ?, ?, ?)`
    ).bind(
      newId(), user.id, entitlement.snapshot.account.planCode,
      `${job.title} set as a featured job.`, user.id
    )
  ]);

  return json({ ok: true, featured: true });
}
