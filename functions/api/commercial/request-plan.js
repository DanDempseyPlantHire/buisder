import { json, err, newId, requireUser, createNotification } from "../../_lib/db.js";
import { ensureCommercialAccount } from "../../_lib/commercial.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const { user, error } = await requireUser(context, "employer");
  if (error) return error;
  await ensureCommercialAccount(env, user.id);

  const body = await request.json().catch(() => null);
  const planCode = String(body?.planCode || "").trim().toLowerCase();
  const message = String(body?.message || "").trim().slice(0, 1000);

  const plan = await env.DB.prepare(
    "SELECT code, name FROM commercial_plans WHERE code=? AND is_public=1"
  ).bind(planCode).first();
  if (!plan) return err("That plan is not available for self-service requests");

  const current = await env.DB.prepare(
    "SELECT plan_code FROM employer_commercial_accounts WHERE employer_id=?"
  ).bind(user.id).first();
  if (current?.plan_code === planCode) return err("You are already on this plan");

  const pending = await env.DB.prepare(
    "SELECT id FROM commercial_plan_requests WHERE employer_id=? AND status='pending' LIMIT 1"
  ).bind(user.id).first();
  if (pending) return err("You already have a plan request waiting for review", 409);

  const id = newId();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO commercial_plan_requests
       (id, employer_id, requested_plan_code, message)
       VALUES (?, ?, ?, ?)`
    ).bind(id, user.id, planCode, message),
    env.DB.prepare(
      `INSERT INTO commercial_history
       (id, employer_id, event_type, plan_code, description, actor_user_id)
       VALUES (?, ?, 'plan_requested', ?, ?, ?)`
    ).bind(newId(), user.id, planCode, `${plan.name} plan requested.`, user.id)
  ]);

  const { results: admins } = await env.DB.prepare("SELECT user_id AS userId FROM admin_users").all();
  for (const admin of admins || []) {
    await createNotification(env, {
      userId: admin.userId,
      type: "commercial_plan_request",
      title: "Employer plan request",
      body: `${user.name || user.email} requested the ${plan.name} plan.`,
      eventKey: `commercial-request:${id}:${admin.userId}`
    });
  }

  return json({ ok: true, id }, { status: 201 });
}
