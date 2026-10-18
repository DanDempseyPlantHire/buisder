import { json, err, newId, requireUser } from '../../_lib/db.js';
import { randomToken, sha256Hex } from '../../_lib/security.js';

export async function onRequestGet(context){
  const {user,error}=await requireUser(context,'employer'); if(error)return error;
  const {results}=await context.env.DB.prepare(
    `SELECT id,name,token_prefix AS tokenPrefix,status,last_used_at AS lastUsedAt,created_at AS createdAt
     FROM integration_api_keys WHERE employer_id=? ORDER BY created_at DESC`
  ).bind(user.id).all();
  return json({keys:results||[]});
}
export async function onRequestPost(context){
  const {user,error}=await requireUser(context,'employer'); if(error)return error;
  const b=await context.request.json().catch(()=>({})); const name=String(b.name||'Integration key').trim().slice(0,80)||'Integration key';
  const token=`bui_live_${randomToken(30)}`, hash=await sha256Hex(token), id=newId();
  await context.env.DB.prepare(
    `INSERT INTO integration_api_keys(id,employer_id,name,token_hash,token_prefix) VALUES (?,?,?,?,?)`
  ).bind(id,user.id,name,hash,token.slice(0,16)).run();
  return json({id,token,tokenPrefix:token.slice(0,16)},{status:201});
}
export async function onRequestDelete(context){
  const {user,error}=await requireUser(context,'employer'); if(error)return error;
  const b=await context.request.json().catch(()=>null); if(!b?.id)return err('Key id is required');
  await context.env.DB.prepare("UPDATE integration_api_keys SET status='revoked',revoked_at=CURRENT_TIMESTAMP WHERE id=? AND employer_id=?").bind(b.id,user.id).run();
  return json({ok:true});
}
