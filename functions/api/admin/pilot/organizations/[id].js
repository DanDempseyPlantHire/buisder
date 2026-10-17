import { json, err, requireAdmin } from "../../../../_lib/db.js";
const TYPES=new Set(["employer","school","college","youth_org","partner","other"]);
const STATUSES=new Set(["planned","active","paused","completed"]);
export async function onRequestPost(context){
  const {request,env,params}=context; const {error}=await requireAdmin(context); if(error)return error;
  const body=await request.json().catch(()=>null); if(!body)return err("Invalid request body");
  const cur=await env.DB.prepare("SELECT * FROM pilot_organizations WHERE id=?").bind(params.id).first(); if(!cur)return err("Organisation not found",404);
  const name=String(body.name??cur.name).trim().slice(0,160), orgType=String(body.orgType??cur.org_type), status=String(body.status??cur.status);
  if(!name)return err("Organisation name is required"); if(!TYPES.has(orgType))return err("Invalid organisation type"); if(!STATUSES.has(status))return err("Invalid organisation status");
  await env.DB.prepare(`UPDATE pilot_organizations SET name=?,org_type=?,contact_name=?,contact_email=?,status=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .bind(name,orgType,String(body.contactName??cur.contact_name??"").trim().slice(0,120),String(body.contactEmail??cur.contact_email??"").trim().toLowerCase().slice(0,200),status,String(body.notes??cur.notes??"").trim().slice(0,2000),params.id).run();
  return json({ok:true});
}
