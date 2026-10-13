/* Scope-local caches; never cache account/API responses. */
const CACHE_PREFIX='trackers:'+new URL(self.registration.scope).pathname+':';
const CACHE_NAME=CACHE_PREFIX+'v7.7';
const APP_SHELL=['./','./index.html','./manifest.webmanifest','./assets/css/workspace.css',
 './assets/js/storage-guard.js','./assets/js/operations-core.js','./assets/js/operations.js','./assets/js/core.js','./assets/js/sheets.js','./assets/js/config.js','./assets/js/cloud.js','./assets/js/app.js','./assets/js/workspace.js','./assets/js/boot.js',
 ...['trackers-logo-dark','icon-192','icon-512','icon-maskable-512'].map(n=>'./assets/img/'+n+'.png')];
APP_SHELL.push('./assets/js/icons.js','./assets/css/material-icons.css',...["dashboard", "folder", "description", "receipt_long", "bar_chart", "settings", "account_circle", "search", "edit_note", "calendar_clock", "notifications", "bolt", "checklist", "payments", "add", "close", "check", "arrow_outward", "chevron_right", "upload", "download", "keep", "list_alt", "note_add", "sticky_note_2", "sync", "delete", "edit", "share", "archive", "unarchive", "print", "table_view", "history", "refresh", "save", "group", "palette", "cloud_download", "install_desktop", "apartment", "person", "flag"].map(n=>'./assets/icons/material/'+n+'.svg'));
const VERSIONED_SHELL=APP_SHELL.map(p=>p==='./'||p==='./index.html'||p.includes('/icons/material/')?p:p+'?v=20261013.78');
const LIBRARIES=new Set(['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.7/dist/umd/supabase.js','https://unpkg.com/@supabase/supabase-js@2.57.7/dist/umd/supabase.js','https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js']);
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE_NAME).then(c=>Promise.all(VERSIONED_SHELL.map(p=>c.add(new Request(new URL(p,self.registration.scope),{cache:'reload'})).catch(()=>null))))));
self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting();if(e.data?.type==='GET_VERSION')e.ports[0]?.postMessage('7.7');});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(CACHE_PREFIX)&&k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const req=e.request,url=new URL(req.url);if(req.method!=='GET')return;
 if(url.origin!==self.location.origin){
   if(LIBRARIES.has(req.url))e.respondWith(caches.open(CACHE_NAME).then(async cache=>{const saved=await cache.match(req);if(saved)return saved;const r=await fetch(req);if(r.ok)await cache.put(req,r.clone());return r;}));
   return;
 }
 if(!url.href.startsWith(self.registration.scope))return;
 if(req.mode==='navigate'){
   e.respondWith(fetch(req,{cache:'no-cache'}).then(async r=>{if(r.ok){const c=await caches.open(CACHE_NAME);await c.put('./index.html',r.clone());}return r;}).catch(async()=>{const c=await caches.open(CACHE_NAME);return await c.match('./index.html')||new Response('Aplikasi belum tersedia offline.',{status:503});}));return;
 }
 const scopeAssetsPath=new URL('assets/',self.registration.scope).pathname;
 if(!APP_SHELL.some(p=>new URL(p,self.registration.scope).pathname===url.pathname)){
   // Lazily loaded app assets (e.g. pkbon.js) are cached on first use so they work offline afterwards.
   if(!url.pathname.startsWith(scopeAssetsPath))return;
   e.respondWith(caches.open(CACHE_NAME).then(async c=>{
     const saved=await c.match(req);if(saved)return saved;
     const response=await fetch(req,{cache:'no-cache'});
     if(response.ok)await c.put(req,response.clone());return response;
   }));
   return;
 }
 e.respondWith(caches.open(CACHE_NAME).then(async c=>{
   const saved=await c.match(req);if(saved)return saved;
   const response=await fetch(req,{cache:'no-cache'});
   if(response.ok)await c.put(req,response.clone());return response;
 }));
});
