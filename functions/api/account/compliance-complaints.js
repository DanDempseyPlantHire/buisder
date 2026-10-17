import { json, err, newId, requireUser } from "../../_lib/db.js";

export async function onRequestGet(context) {
  const { env } = context;
  const { user, error } = await requireUser(context);
  if (error) return error;
  const { results } = await env.DB.prepare(
    `SELECT id, category, details, status, due_at AS dueAt, admin_response AS adminResponse,
            created_at AS createdAt, resolved_at AS resolvedAt
     FROM compliance_complaints WHERE user_id=? ORDER BY created_at DESC LIMIT 50`
  ).bind(user.id).all();
  return json({ complaints: results || [] });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const { user, error } = await requireUser(context);
  if (error) return error;
  const body = await request.json().catch(() => null);
  const category = String(body?.category || "privacy").trim().slice(0,80);
  const details = String(body?.details || "").trim().slice(0,4000);
  if (details.length < 10) return err("Add a short description of the complaint.");
  const id = newId();
  await env.DB.prepare(
    `INSERT INTO compliance_complaints (id,user_id,requestor_email,category,details)
     VALUES (?,?,?,?,?)`
  ).bind(id,user.id,user.email,category,details).run();
  return json({ ok:true, id }, { status:201 });
}
