const CACHE='deasjobs-shell-v25.17-closed-apps-dark-ui';
const SHELL=['/','/login.html','/contact.html','/offline.html','/i18n.js','/manifest.webmanifest','/brand/deasjobs-logo.png','/icons/icon-192.png','/icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/')) return;
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request).catch(()=>caches.match('/offline.html'))); return;
  }
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r;}).catch(()=>cached)));
});
self.addEventListener('push',e=>{
  let d={title:'Deas Jobs update',body:'You have a new Deas Jobs notification.',url:'/'};
  try{if(e.data)d={...d,...e.data.json()};}catch{}
  e.waitUntil(self.registration.showNotification(d.title,{body:d.body,icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',data:{url:d.url||'/'},tag:d.type?`deasjobs-${d.type}`:undefined}));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close(); const url=e.notification.data?.url||'/';
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(ws=>{for(const w of ws){if('focus'in w){w.navigate(url);return w.focus();}}return clients.openWindow(url);}));
});
