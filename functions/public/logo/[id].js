export async function onRequestGet(context){
  const {env,params}=context;
  if(!env.FILES) return new Response("Not found",{status:404});
  const row=await env.DB.prepare(`SELECT ep.logo_key FROM employer_profiles ep JOIN users u ON u.id=ep.user_id WHERE ep.user_id=? AND ep.verification_status='verified' AND u.is_suspended=0 LIMIT 1`).bind(String(params.id||"")).first();
  if(!row?.logo_key) return new Response("Not found",{status:404});
  const object=await env.FILES.get(row.logo_key); if(!object) return new Response("Not found",{status:404});
  const headers=new Headers(); object.writeHttpMetadata(headers); headers.set("ETag",object.httpEtag); headers.set("Cache-Control","public, max-age=3600, s-maxage=86400"); return new Response(object.body,{headers});
}
