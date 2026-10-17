import { json, err, newId, requireAdmin } from "../../../../_lib/db.js";
import { normalizePilotCode } from "../../../../_lib/pilot.js";
const ROLES=new Set(["any","jobseeker","employer"]);
function generated(){ return `BUI-${newId().replaceAll('-','').slice(0,8).toUpperCase()}`; }
export async function onRequestPost(context){
  const {request,env}=context; const {user,error}=await requireAdmin(context); if(error)return error;
  const body=await request.json().catch(()=>null); if(!body)return err("Invalid request body");
  const allowedRole=String(body.allowedRole||"any"); if(!ROLES.has(allowedRole))return err("Invalid invite role");
  const code=normalizePilotCode(body.code)||generated();
  const maxUses=body.maxUses===null||body.maxUses===undefined||body.maxUses===""?null:Number(body.maxUses);
  if(maxUses!==null && (!Number.isInteger(maxUses)||maxUses<1||maxUses>10000))return err("Max uses must be between 1 and 10000");
  const existing=await env.DB.prepare("SELECT id FROM pilot_invite_codes WHERE code=?").bind(code).first(); if(existing)return err("That invite code already exists",409);
  const id=newId();
  await env.DB.prepare(`INSERT INTO pilot_invite_codes (id,code,label,allowed_role,cohort_id,organization_id,max_uses,expires_at,status,created_by) VALUES (?,?,?,?,?,?,?,?, 'active', ?)`)
    .bind(id,code,String(body.label||"").trim().slice(0,140),allowedRole,body.cohortId||null,body.organizationId||null,maxUses,body.expiresAt||null,user.id).run();
  return json({ok:true,id,code},{status:201});
}
