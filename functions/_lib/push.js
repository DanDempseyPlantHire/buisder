function b64urlToBytes(value){
  const s=String(value||'').replace(/-/g,'+').replace(/_/g,'/');
  const padded=s+'='.repeat((4-s.length%4)%4);
  const bin=atob(padded); return Uint8Array.from(bin,c=>c.charCodeAt(0));
}
function bytesToB64url(bytes){
  let s=''; for(const b of new Uint8Array(bytes)) s+=String.fromCharCode(b);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function concat(...arrs){
  const len=arrs.reduce((n,a)=>n+a.length,0), out=new Uint8Array(len); let o=0;
  for(const a of arrs){out.set(a,o);o+=a.length;} return out;
}
async function hmac(keyBytes,data){
  const key=await crypto.subtle.importKey('raw',keyBytes,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC',key,data));
}
async function hkdfExpand(prk,info,len){
  const out=[]; let prev=new Uint8Array(0); let i=1;
  while(out.reduce((n,a)=>n+a.length,0)<len){
    prev=await hmac(prk,concat(prev,info,new Uint8Array([i++]))); out.push(prev);
  }
  return concat(...out).slice(0,len);
}
function text(s){return new TextEncoder().encode(s);}
function u32be(n){const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,n,false);return b;}

async function vapidJwt(env,endpoint){
  if(!env.VAPID_PUBLIC_KEY||!env.VAPID_PRIVATE_KEY) throw new Error('VAPID keys are not configured');
  const pub=b64urlToBytes(env.VAPID_PUBLIC_KEY), priv=b64urlToBytes(env.VAPID_PRIVATE_KEY);
  if(pub.length!==65||pub[0]!==4||priv.length!==32) throw new Error('VAPID key format is invalid');
  const x=bytesToB64url(pub.slice(1,33)), y=bytesToB64url(pub.slice(33,65)), d=bytesToB64url(priv);
  const key=await crypto.subtle.importKey('jwk',{kty:'EC',crv:'P-256',x,y,d,ext:true},{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  const header=bytesToB64url(text(JSON.stringify({typ:'JWT',alg:'ES256'})));
  const origin=new URL(endpoint).origin;
  const payload=bytesToB64url(text(JSON.stringify({aud:origin,exp:Math.floor(Date.now()/1000)+12*3600,sub:env.VAPID_SUBJECT||'mailto:support@deasjobs.com'})));
  const input=`${header}.${payload}`;
  const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,text(input));
  return `${input}.${bytesToB64url(sig)}`;
}

async function encryptPayload(subscription,payload){
  const clientPub=b64urlToBytes(subscription.p256dh), auth=b64urlToBytes(subscription.auth);
  const serverKeys=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const serverPub=new Uint8Array(await crypto.subtle.exportKey('raw',serverKeys.publicKey));
  const importedClient=await crypto.subtle.importKey('raw',clientPub,{name:'ECDH',namedCurve:'P-256'},false,[]);
  const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:importedClient},serverKeys.privateKey,256));
  const prkKey=await hmac(auth,shared);
  const ikm=await hkdfExpand(prkKey,concat(text('WebPush: info\0'),clientPub,serverPub),32);
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const prk=await hmac(salt,ikm);
  const cek=await hkdfExpand(prk,text('Content-Encoding: aes128gcm\0'),16);
  const nonce=await hkdfExpand(prk,text('Content-Encoding: nonce\0'),12);
  const aes=await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['encrypt']);
  const plain=concat(text(JSON.stringify(payload)),new Uint8Array([2]));
  const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},aes,plain));
  return concat(salt,u32be(4096),new Uint8Array([serverPub.length]),serverPub,encrypted);
}

export function pushConfigured(env){return Boolean(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY);}

export async function sendWebPush(env,subscription,payload){
  const body=await encryptPayload(subscription,payload);
  const jwt=await vapidJwt(env,subscription.endpoint);
  return fetch(subscription.endpoint,{method:'POST',headers:{TTL:'86400',Urgency:'normal','Content-Encoding':'aes128gcm',Authorization:`vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`},body});
}

export async function sendPushToUser(env,userId,payload){
  if(!pushConfigured(env)||!userId) return;
  let pref;
  try{pref=await env.DB.prepare('SELECT enabled FROM push_preferences WHERE user_id=?').bind(userId).first();}catch{return;}
  if(pref&&Number(pref.enabled)===0) return;
  const {results}=await env.DB.prepare(
    `SELECT id,endpoint,p256dh,auth FROM push_subscriptions WHERE user_id=? AND disabled_at IS NULL`
  ).bind(userId).all();
  for(const sub of results||[]){
    try{
      const res=await sendWebPush(env,sub,payload);
      if(res.ok){
        await env.DB.prepare('UPDATE push_subscriptions SET failure_count=0,last_success_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(sub.id).run();
      }else if([404,410].includes(res.status)){
        await env.DB.prepare('UPDATE push_subscriptions SET disabled_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(sub.id).run();
      }else{
        await env.DB.prepare('UPDATE push_subscriptions SET failure_count=failure_count+1,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(sub.id).run();
      }
    }catch{
      try{await env.DB.prepare('UPDATE push_subscriptions SET failure_count=failure_count+1,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(sub.id).run();}catch{}
    }
  }
}
