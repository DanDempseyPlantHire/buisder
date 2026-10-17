import { json, err, requireAdmin } from "../../../../_lib/db.js";
export async function onRequestPost(context){
  const {request,env,params}=context; const {error}=await requireAdmin(context); if(error)return error;
  const body=await request.json().catch(()=>null); if(!body)return err("Invalid request body");
  const status=String(body.status||""); if(!["active","disabled"].includes(status))return err("Invalid invite status");
  const result=await env.DB.prepare("UPDATE pilot_invite_codes SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(status,params.id).run();
  if(!result.meta?.changes)return err("Invite not found",404); return json({ok:true});
}
