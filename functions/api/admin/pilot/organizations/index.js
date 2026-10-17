import { json, err, newId, requireAdmin } from "../../../../_lib/db.js";
const TYPES=new Set(["employer","school","college","youth_org","partner","other"]);
const STATUSES=new Set(["planned","active","paused","completed"]);
export async function onRequestPost(context){
  const {request,env}=context; const {user,error}=await requireAdmin(context); if(error)return error;
  const body=await request.json().catch(()=>null); if(!body)return err("Invalid request body");
  const name=String(body.name||"").trim().slice(0,160); const orgType=String(body.orgType||"employer"); const status=String(body.status||"active");
  if(!name)return err("Organisation name is required"); if(!TYPES.has(orgType))return err("Invalid organisation type"); if(!STATUSES.has(status))return err("Invalid organisation status");
  const id=newId();
  await env.DB.prepare(`INSERT INTO pilot_organizations (id,name,org_type,contact_name,contact_email,status,notes,created_by) VALUES (?,?,?,?,?,?,?,?)`)
    .bind(id,name,orgType,String(body.contactName||"").trim().slice(0,120),String(body.contactEmail||"").trim().toLowerCase().slice(0,200),status,String(body.notes||"").trim().slice(0,2000),user.id).run();
  return json({ok:true,id},{status:201});
}
