import { json, err, newId, requireAdmin, createNotification } from "../../../../_lib/db.js";
import { applyPlan } from "../../../../_lib/commercial.js";

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const { user, error } = await requireAdmin(context);
  if (error) return error;

  const body = await request.json().catch(() => null);
  const action = String(body?.action || "").toLowerCase();
  if (!["approve","reject"].includes(action)) return err("Action must be approve or reject");

  const req = await env.DB.prepare(
    `SELECT r.id, r.employer_id AS employerId, r.requested_plan_code AS planCode,
            r.status, p.name AS planName
     FROM commercial_plan_requests r
     JOIN commercial_plans p ON p.code=r.requested_plan_code
     WHERE r.id=?`
  ).bind(params.requestId).first();
  if (!req) return err("Plan request not found", 404);
  if (req.status !== "pending") return err("This request has already been reviewed");

  const note = String(body?.note || "").trim().slice(0, 500);
  const trialDays = body?.trialDays === "" || body?.trialDays === undefined || body?.trialDays === null
    ? null : Number(body.trialDays);
  if (trialDays !== null && (!Number.isInteger(trialDays) || trialDays < 1 || trialDays > 3650)) {
    return err("Trial duration must be between 1 and 3650 days");
  }

  if (action === "approve") {
    await applyPlan(env, req.employerId, req.planCode, {
      status: trialDays ? "trial" : "active",
      durationDays: trialDays,
      source: "upgrade_request",
      actorUserId: user.id,
      description: note || `${req.planName} request approved.`
    });
  }

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE commercial_plan_requests
       SET status=?, reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP, admin_note=?
       WHERE id=?`
    ).bind(action === "approve" ? "approved" : "rejected", user.id, note, req.id),
    env.DB.prepare(
      `INSERT INTO admin_audit_log
       (id, admin_user_id, action, target_type, target_id, details)
       VALUES (?, ?, ?, 'commercial_plan_request', ?, ?)`
    ).bind(newId(), user.id, action === "approve" ? "commercial_request_approved" : "commercial_request_rejected", req.id, JSON.stringify({ planCode: req.planCode, trialDays }))
  ]);

  await createNotification(env, {
    userId: req.employerId,
    type: "commercial_plan_request_update",
    title: action === "approve" ? "Plan request approved" : "Plan request reviewed",
    body: action === "approve"
      ? `Your request for the ${req.planName} plan was approved.`
      : `Your request for the ${req.planName} plan was not approved at this time.`,
    eventKey: `commercial-request-result:${req.id}:${action}`
  });

  return json({ ok: true, status: action === "approve" ? "approved" : "rejected" });
}
