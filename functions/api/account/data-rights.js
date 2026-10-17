import { json, err, newId, requireUser } from "../../_lib/db.js";

const TYPES = new Set(["access","rectification","erasure","restriction","objection","portability","other"]);

export async function onRequestGet(context) {
  const { env } = context;
  const { user, error } = await requireUser(context);
  if (error) return error;
  const { results } = await env.DB.prepare(
    `SELECT id, request_type AS requestType, details, status, due_at AS dueAt,
            admin_response AS adminResponse, created_at AS createdAt, completed_at AS completedAt
     FROM data_rights_requests WHERE user_id=? ORDER BY created_at DESC LIMIT 50`
  ).bind(user.id).all();
  return json({ requests: results || [] });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const { user, error } = await requireUser(context);
  if (error) return error;
  const body = await request.json().catch(() => null);
  const requestType = String(body?.requestType || "");
  const details = String(body?.details || "").trim().slice(0, 4000);
  if (!TYPES.has(requestType)) return err("Choose a valid data protection request type");
  const duplicate = await env.DB.prepare(
    `SELECT id FROM data_rights_requests WHERE user_id=? AND request_type=? AND status IN ('open','in_progress') LIMIT 1`
  ).bind(user.id, requestType).first();
  if (duplicate) return err("You already have an open request of this type.", 409);
  const id = newId();
  await env.DB.prepare(
    `INSERT INTO data_rights_requests (id,user_id,requestor_email,request_type,details)
     VALUES (?,?,?,?,?)`
  ).bind(id,user.id,user.email,requestType,details).run();
  return json({ ok:true, id }, { status:201 });
}
