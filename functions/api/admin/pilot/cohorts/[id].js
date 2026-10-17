import { json, err, requireAdmin } from "../../../../_lib/db.js";
const STATUSES = new Set(["planned","active","paused","completed"]);
export async function onRequestPost(context) {
  const { request, env, params } = context;
  const { error } = await requireAdmin(context); if (error) return error;
  const body = await request.json().catch(() => null); if (!body) return err("Invalid request body");
  const current = await env.DB.prepare("SELECT * FROM pilot_cohorts WHERE id=?").bind(params.id).first();
  if (!current) return err("Cohort not found",404);
  const name = String(body.name ?? current.name).trim().slice(0,140);
  const description = String(body.description ?? current.description ?? "").trim().slice(0,1000);
  const status = String(body.status ?? current.status);
  if (!name) return err("Cohort name is required"); if (!STATUSES.has(status)) return err("Invalid cohort status");
  await env.DB.prepare(`UPDATE pilot_cohorts SET name=?,description=?,status=?,starts_at=?,ends_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .bind(name,description,status,body.startsAt ?? current.starts_at ?? null,body.endsAt ?? current.ends_at ?? null,params.id).run();
  return json({ok:true});
}
