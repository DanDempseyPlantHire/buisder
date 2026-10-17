import { json, err, newId, requireAdmin } from "../../../../_lib/db.js";
const STATUSES = new Set(["planned","active","paused","completed"]);

export async function onRequestPost(context) {
  const { request, env } = context;
  const { user, error } = await requireAdmin(context);
  if (error) return error;
  const body = await request.json().catch(() => null);
  if (!body) return err("Invalid request body");
  const name = String(body.name || "").trim().slice(0,140);
  const description = String(body.description || "").trim().slice(0,1000);
  const status = String(body.status || "planned");
  if (!name) return err("Cohort name is required");
  if (!STATUSES.has(status)) return err("Invalid cohort status");
  const id = newId();
  await env.DB.prepare(
    `INSERT INTO pilot_cohorts
     (id,name,description,status,starts_at,ends_at,created_by)
     VALUES (?,?,?,?,?,?,?)`
  ).bind(id,name,description,status,body.startsAt || null,body.endsAt || null,user.id).run();
  return json({ ok:true,id }, { status:201 });
}
