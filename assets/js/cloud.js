
const KEY="tracklyMidnightCleanV2";

const CLOUD_CONFIG_KEY="tracklySupabaseConfigV1";
const CLOUD_LOCAL_UPDATED_KEY="tracklyCloudLocalUpdatedAt";
const CLOUD_SYNCED_USER_KEY="tracklyCloudSyncedUser";
const CLOUD_TABLE="trackly_user_state";
const PKBON_CLOUD_KEYS=[
  "pkbon_history","pkbon_settings","pkbon_sites","pkbon_banks",
  "pkbon_templates","pkbon_officers"
];

let cloudClient=null;
let cloudSession=null;
let cloudPushTimer=null;
let cloudApplying=false;
let cloudReconciling=false;
let cloudLastError="";

const SUPABASE_URL=window.TRACKLY_CONFIG?.supabaseUrl||"";
const SUPABASE_PUBLISHABLE_KEY=window.TRACKLY_CONFIG?.supabasePublishableKey||"";

function cloudConfig(){
  return {url:SUPABASE_URL,key:SUPABASE_PUBLISHABLE_KEY}
}
function cloudConfigured(){
  return !!(SUPABASE_URL&&SUPABASE_PUBLISHABLE_KEY)
}
function cloudSetStatus(mode,label,sub=""){
  const syncLabel={
    local:"Belum Terhubung",
    syncing:"Menyinkronkan...",
    online:"Tersinkron",
    error:"Gagal Sinkron",paused:"Sinkronisasi ditunda"
  }[mode]||label||"";
  const indicator=$('syncIndicator');if(indicator){indicator.textContent={local:'Lokal',syncing:'Sync…',online:'Tersinkron',error:'Periksa sync',paused:'Sync ditunda'}[mode]||label;indicator.dataset.mode=mode;indicator.title=sub||syncLabel;indicator.setAttribute('aria-label',syncLabel+'. '+sub);}
  if($("cloudSyncStatus"))$("cloudSyncStatus").textContent=syncLabel;
  if($("cloudSyncTime")&&sub)$("cloudSyncTime").textContent=sub
}
const CLOUD_BASE_KEY='trackersCloudBaseAtV2';
const CLOUD_DIRTY_KEY='trackersCloudDirtyV2';
const CLOUD_CHANGE_KEY='trackersLocalRevisionV2';
let cloudReady=false,cloudBusy=false,cloudConflict=false,cloudBase=null;
function cloudChangeEntries(){return [[CLOUD_LOCAL_UPDATED_KEY,new Date().toISOString()],[CLOUD_DIRTY_KEY,'1'],[CLOUD_CHANGE_KEY,String(Number(localStorage.getItem(CLOUD_CHANGE_KEY)||0)+1)]];}
function cloudLocalTouch(){if(!cloudApplying)TrackersCore.writeBatch(localStorage,cloudChangeEntries());}
function cloudHasLocalData(){
  return ['sites','clients','tenants','rules','notes','bastProcesses'].some(k=>state[k]?.length)||
    ['pkbon_history','pkbon_banks','pkbon_templates','pkbon_officers'].some(k=>{try{return TrackersCore.decodeStored(localStorage.getItem(k)||'[]').length>0;}catch{return false;}});
}
function cloudReadPkbon(){
  const out={};for(const k of PKBON_CLOUD_KEYS){const raw=localStorage.getItem(k);if(raw!==null){try{out[k]=TrackersCore.decodeStored(raw);}catch{throw new Error('Data '+k+' tidak terbaca. Download backup sebelum melanjutkan.');}}}return out;
}
function cloudSnapshot(){return {version:61,trackly_c:TrackersCore.encodeEnvelope(JSON.stringify(state)),pkbon_c:TrackersCore.encodeEnvelope(JSON.stringify(cloudReadPkbon())),saved_at:new Date().toISOString()};}
function cloudApplySnapshot(snapshot,localChange=false){
  const norm=TrackersCore.normalizeSnapshot(snapshot);
  TrackersCore.validateSnapshot(norm);cloudApplying=true;
  try{
    const entries=[...(localChange?cloudChangeEntries():[]),[KEY,TrackersCore.encodeStored(norm.trackly)],...PKBON_CLOUD_KEYS.map(k=>[k,norm.pkbon?.[k]===undefined?null:TrackersCore.encodeStored(norm.pkbon[k])])];
    TrackersCore.writeBatch(localStorage,entries);return true;
  }finally{cloudApplying=false;}
}
function scheduleCloudPush(reason='change'){
  clearTimeout(cloudPushTimer);
  if(cloudApplying||!cloudReady||cloudConflict||!cloudSession||!cloudClient)return;
  cloudPushTimer=setTimeout(()=>cloudPush(reason),1200);
}
const CLOUD_DEFER_KEY='trackersDeferredConflictV1';
function cloudConflictDeferred(){return !!cloudSession&&localStorage.getItem(CLOUD_DEFER_KEY)===cloudIdentity();}
function cloudMarkConflictDeferred(){
  cloudConflict=true;cloudReady=false;clearTimeout(cloudPushTimer);
  localStorage.setItem(CLOUD_DEFER_KEY,cloudIdentity());
  cloudSetStatus('paused','Ditunda','Sinkronisasi ditunda. Perubahan tetap di perangkat. Klik status sync untuk memilih versi data.');
}
function cloudClearConflictDeferred(){localStorage.removeItem(CLOUD_DEFER_KEY);}
function cloudComparable(snapshot){
  const ordered=v=>Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordered(v[k])])):v;
  const norm=TrackersCore.normalizeSnapshot(snapshot);
  return JSON.stringify(ordered({trackly:norm.trackly,pkbon:norm.pkbon||{}}));
}
function cloudConflictDialog(force=false){
  cloudConflict=true;cloudReady=false;clearTimeout(cloudPushTimer);
  if(cloudConflictDeferred()&&!force){cloudMarkConflictDeferred();return;}
  if(force)cloudClearConflictDeferred();
  $('useLocalForCloud').disabled=typeof opsCanEdit==='function'&&!opsCanEdit();
  openModal('cloudConflictModal');
  cloudSetStatus('error','Konflik','Data cloud dan perangkat berbeda. Pilih sumber data.');
}
async function cloudPush(reason='manual'){
  if(window.TRACKERS_CORRUPT_KEYS?.length)return false;
  if(!cloudReady||cloudConflict||!cloudSession||!cloudClient||currentAccessProfile?.access_enabled!==true)return false;
  if(typeof workspaceStale!=='undefined'&&workspaceStale)return false;
  if(cloudBusy){scheduleCloudPush(reason);return false;}
  if(typeof opsCanEdit==='function'&&!opsCanEdit()){cloudSetStatus('online','Baca saja','Viewer: perubahan tidak dapat dikirim.');return false;}
  cloudBusy=true;const userId=cloudIdentity();
  const localVersion=localStorage.getItem(CLOUD_CHANGE_KEY);
  cloudSetStatus('syncing','Sync','Mengirim perubahan...');
  try{
    if(!await ensureCurrentUserAccess()||cloudIdentity()!==userId)throw new Error('Akses atau workspace berubah. Login ulang sebelum melanjutkan.');
    if(typeof opsCanEdit==='function'&&!opsCanEdit())throw new Error('Akun sekarang hanya baca.');
    const snap=cloudSnapshot();
    // The save_state RPC validates and diffs the plain v60 snapshot shape
    // ({trackly:{sites:[...]},pkbon}). Normalize the compressed v61 envelope
    // before upload; local storage stays compressed.
    const plain=TrackersCore.normalizeSnapshot(snap);
    const payload={version:60,trackly:plain.trackly,pkbon:plain.pkbon,saved_at:snap.saved_at};
    const {data,error}=await authTimeout(cloudClient.rpc('trackers_save_state',{new_snapshot:payload,expected_updated_at:cloudBase}),15000);
    if(error)throw error;
    if(cloudIdentity()!==userId)return false;
    if(!data?.ok){cloudConflictDialog();return false;}
    cloudBase=data.updated_at;localStorage.setItem(CLOUD_BASE_KEY,cloudBase);localStorage.setItem(CLOUD_SYNCED_USER_KEY,userId);
    if(localStorage.getItem(CLOUD_CHANGE_KEY)===localVersion)localStorage.removeItem(CLOUD_DIRTY_KEY);
    cloudSetStatus('online','Tersinkron','Terakhir sync '+new Date().toLocaleString('id-ID'));
    return true;
  }catch(err){
    cloudLastError=err?.message||String(err);
    const setup=/trackers_save_state|PGRST202/.test(cloudLastError)?'Jalankan migrasi 003_sync_safety.sql di Supabase.':cloudLastError;
    cloudSetStatus('error','Gagal','Perubahan lokal tetap tersimpan. '+setup);return false;
  }finally{cloudBusy=false;if(cloudReady&&!cloudConflict&&localStorage.getItem(CLOUD_CHANGE_KEY)!==localVersion)scheduleCloudPush('changes-during-sync');}
}
function cloudWorkspaceId(){return currentAccessProfile?.workspace_owner_id||cloudSession?.user.id;}
function cloudIdentity(){const user=cloudSession?.user.id,owner=cloudWorkspaceId();return owner&&owner!==user?user+':'+owner:user;}
async function cloudGetRow(){
  if(!cloudSession||!cloudClient)return null;
  const {data,error}=await authTimeout(cloudClient.from(CLOUD_TABLE).select('snapshot,updated_at').eq('user_id',cloudWorkspaceId()).maybeSingle(),15000);
  if(error)throw error;return data||null;
}
function cloudReloadFromSnapshot(snapshot,updatedAt){
  if(!cloudApplySnapshot(snapshot))return;
  cloudClearConflictDeferred();
  localStorage.setItem(CLOUD_BASE_KEY,updatedAt||'');localStorage.removeItem(CLOUD_DIRTY_KEY);
  localStorage.setItem(CLOUD_LOCAL_UPDATED_KEY,updatedAt||new Date().toISOString());
  localStorage.setItem(CLOUD_SYNCED_USER_KEY,cloudIdentity());location.reload();
}
async function cloudReconcile(){
  if(cloudConflictDeferred()){cloudMarkConflictDeferred();return;}
  if(window.TRACKERS_CORRUPT_KEYS?.length){cloudSetStatus('error','Gagal','Data lokal tidak terbaca. Pulihkan backup sebelum sync.');return;}
  if(cloudReconciling||!cloudSession||!cloudClient||currentAccessProfile?.access_enabled!==true)return;
  cloudReconciling=true;cloudReady=false;cloudSetStatus('syncing','Sync','Mengecek versi data...');
  try{
    const owner=localStorage.getItem(CLOUD_SYNCED_USER_KEY),userId=cloudIdentity();
    // Keep a separate local snapshot before switching accounts. Never upload another user's data.
    if(owner&&owner!==userId){
      const saved=localStorage.getItem('trackersAccount:'+userId);
      const blank={version:60,trackly:{sites:[],clients:[],tenants:[],rules:[],activities:[],notes:[],bastProcesses:[],pinned:[],theme:state.theme},pkbon:{}};
      const previous=JSON.stringify({snapshot:cloudSnapshot(),base:localStorage.getItem(CLOUD_BASE_KEY),dirty:localStorage.getItem(CLOUD_DIRTY_KEY)});
      localStorage.setItem('trackersAccount:'+owner,previous);
      const account=saved?JSON.parse(saved):null;cloudApplySnapshot(account?.snapshot||blank);
      localStorage.setItem(CLOUD_SYNCED_USER_KEY,userId);localStorage.setItem(CLOUD_BASE_KEY,account?.base||'');
      if(account?.dirty)localStorage.setItem(CLOUD_DIRTY_KEY,'1');else localStorage.removeItem(CLOUD_DIRTY_KEY);
      location.reload();return;
    }
    const row=await cloudGetRow(),base=localStorage.getItem(CLOUD_BASE_KEY)||null;
    const dirty=localStorage.getItem(CLOUD_DIRTY_KEY)==='1';
    cloudBase=base;
    if(!row&&currentAccessProfile.role==='viewer'){cloudSetStatus('online','Baca saja','Workspace belum memiliki data. Minta admin menyinkronkan data.');return;}
    if(!row){cloudBase=null;cloudReady=true;localStorage.setItem(CLOUD_SYNCED_USER_KEY,userId);await cloudPush('first-upload');return;}
    // A retry after an acknowledged write must not conflict solely on key order or timestamp.
    if(cloudComparable(row.snapshot)===cloudComparable(cloudSnapshot())){
      cloudBase=row.updated_at;TrackersCore.writeBatch(localStorage,[[CLOUD_BASE_KEY,cloudBase],[CLOUD_DIRTY_KEY,null],[CLOUD_SYNCED_USER_KEY,userId]]);
      cloudConflict=false;cloudReady=true;cloudClearConflictDeferred();cloudSetStatus('online','Tersinkron','Data sudah sinkron.');return;
    }
    if(!base){
      if(cloudHasLocalData()){ 
        // Upgrade from old versions: identical snapshots need no user decision.
        const current=cloudSnapshot(),normRow=TrackersCore.normalizeSnapshot(row.snapshot),normCur=TrackersCore.normalizeSnapshot(current);
        if(JSON.stringify(normRow.trackly)!==JSON.stringify(normCur.trackly)||JSON.stringify(normRow.pkbon||{})!==JSON.stringify(normCur.pkbon||{})){cloudConflictDialog();return;}
      }
      cloudReloadFromSnapshot(row.snapshot,row.updated_at);return;
    }
    if(base!==row.updated_at){if(dirty){cloudConflictDialog();return;}cloudReloadFromSnapshot(row.snapshot,row.updated_at);return;}
    cloudBase=row.updated_at;cloudReady=true;localStorage.setItem(CLOUD_SYNCED_USER_KEY,userId);
    if(dirty)await cloudPush('pending-changes');else cloudSetStatus('online','Tersinkron','Data sudah sinkron.');
  }catch(err){cloudSetStatus('error','Gagal','Data cloud belum dapat dibaca. '+(err?.message||err));}
  finally{cloudReconciling=false;}
}
function cloudUpdateAccountUI(){
  const u=cloudSession?.user;
  const meta=u?.user_metadata||{};
  const name=meta.full_name||meta.name||u?.email?.split("@")[0]||"Trackers Workspace";
  const email=u?.email||"";
  const initial=(name||"T").slice(0,1).toUpperCase();

  if($("cloudUserName"))$("cloudUserName").textContent=u?name:"Trackers Workspace";
  if($("cloudUserEmail"))$("cloudUserEmail").textContent=u?email:"Belum login";
  if($("cloudAvatar"))$("cloudAvatar").textContent=initial;
  if($("cloudAvatarMini"))$("cloudAvatarMini").textContent=initial;
  if($("cloudAccountLabel"))$("cloudAccountLabel").textContent=u?name:"TRACKERS";
  if($("cloudAccountSub"))$("cloudAccountSub").textContent=u?(currentAccessProfile?roleLabel(currentAccessProfile.role):email):"Masuk";
}
function cloudShowAuth(show){
  $("cloudAuthGate")?.classList.toggle("show",!!show);document.body.classList.toggle("auth-locked",!!show);const app=document.querySelector(".app");if(app)app.inert=!!show
}
function setLoginInline(message="",type="info"){
  const el=$("loginInlineStatus");if(!el)return;
  el.textContent=message||"";
  el.className="login-inline-status"+(message?" show "+type:"")
}
function setLoginBusy(busy){
  const btn=$("loginSubmitBtn");if(!btn)return;
  btn.disabled=!!busy;
  btn.textContent=busy?"Memeriksa...":"Masuk"
}
function friendlyAuthError(err){
  const raw=String(err?.message||err||"").toLowerCase();
  if(raw.includes("invalid login credentials"))return "Email atau password tidak cocok.";
  if(raw.includes("email not confirmed"))return "Email belum dikonfirmasi.";
  if(raw.includes("failed to fetch")||raw.includes("network")||raw.includes("load failed"))
    return "Tidak bisa terhubung ke Supabase. Periksa koneksi internet.";
  if(raw.includes("rate limit"))return "Terlalu banyak percobaan login. Tunggu sebentar lalu coba lagi.";
  return "Login gagal. Periksa email, password, dan koneksi internet."
}
function authTimeout(promise,ms=15000){
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Koneksi timeout')),ms);Promise.resolve(promise).then(v=>{clearTimeout(timer);resolve(v);},err=>{clearTimeout(timer);reject(err);});});
}
async function ensureSupabaseSdk(){
  if(window.supabase?.createClient)return true;
  const urls=[
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.js",
    "https://unpkg.com/@supabase/supabase-js@2.57.4/dist/umd/supabase.js"
  ];
  for(const src of urls){
    try{
      await new Promise((resolve,reject)=>{
        const s=document.createElement("script");
        s.src=src;s.async=true;
        const timer=setTimeout(()=>{s.remove();reject(new Error("SDK timeout"));},8000);
        s.onload=()=>{clearTimeout(timer);resolve();};s.onerror=()=>{clearTimeout(timer);reject(new Error("SDK gagal dimuat"));};
        document.head.appendChild(s)
      });
      if(window.supabase?.createClient)return true
    }catch(_){}
  }
  return false
}
async function cloudHandleSession(session){
  cloudReady=false;cloudConflict=false;clearTimeout(cloudPushTimer);
  cloudSession=session||null;
  cloudUpdateAccountUI();

  if(!cloudSession){
    currentAccessProfile=null;
    cloudSetStatus("local","LOGIN","Masukkan email & password");
    setLoginBusy(false);
    cloudShowAuth(true);
    return
  }

  const allowed=await ensureCurrentUserAccess();
  if(!allowed)return;

  const owner=localStorage.getItem(CLOUD_SYNCED_USER_KEY);
  if(!owner||owner===cloudIdentity())cloudShowAuth(false);
  await cloudReconcile();
  if(localStorage.getItem(CLOUD_SYNCED_USER_KEY)===cloudIdentity())cloudShowAuth(false)
}
async function cloudInit(){
  const localMode=["file:","content:"].includes(location.protocol);
  if($("localTestHint"))$("localTestHint").style.display=localMode?"block":"none";

  const lastEmail=localStorage.getItem("tracklyLastLoginEmail")||"";
  if(lastEmail&&$("loginEmail")&&!$("loginEmail").value)$("loginEmail").value=lastEmail;

  cloudShowAuth(true);
  if(!cloudConfigured()){setLoginInline("Konfigurasi akun belum diisi. Lengkapi assets/js/config.js.","error");return;}
  const sdkReady=await ensureSupabaseSdk();
  if(!sdkReady){
    cloudSetStatus("error","ERROR","Library login gagal dimuat.");
    setLoginInline("Komponen login gagal dimuat. Pastikan internet aktif lalu refresh halaman.","error");
    cloudShowAuth(true);
    return
  }

  const c=cloudConfig();
  cloudClient=window.supabase.createClient(c.url,c.key,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });

  cloudClient.auth.onAuthStateChange((event,session)=>{
    if(event==='PASSWORD_RECOVERY'){
      cloudSession=session;recoveryMode=true;setTimeout(()=>openModal('resetPasswordModal'),0);return;
    }
    if(event==='SIGNED_OUT'){setTimeout(()=>cloudHandleSession(null),0);return;}
    if(event==='SIGNED_IN'&&session?.user.id!==cloudSession?.user.id)setTimeout(()=>cloudHandleSession(session),0);
  });
  const {data,error}=await authTimeout(cloudClient.auth.getSession(),15000);
  if(error){setLoginInline('Sesi login tidak terbaca. Muat ulang dan coba lagi.','error');return;}
  // Explicit recovery handling: don't rely solely on the PASSWORD_RECOVERY
  // event (it can be missed), and explain clearly when the link is unusable.
  const hashParams=new URLSearchParams(location.hash.replace(/^#/,''));const queryParams=new URLSearchParams(location.search);
  const hasRecoveryParams=hashParams.get('type')==='recovery'||queryParams.get('type')==='recovery';
  const hasAuthParams=!!(hashParams.get('access_token')||hashParams.get('error_description')||queryParams.get('code')||queryParams.get('error'));
  const cleanAuthUrl=()=>{try{history.replaceState(null,'',location.pathname+location.search);}catch(_){}};
  if(hasRecoveryParams&&data.session&&!recoveryMode){
    recoveryMode=true;cloudSession=data.session;cleanAuthUrl();openModal('resetPasswordModal');return;
  }
  if(!data.session&&hasAuthParams){
    cleanAuthUrl();setLoginInline('Link reset tidak valid atau sudah dipakai/kedaluwarsa. Minta link baru lewat Lupa password?','error');return;
  }
  if(!recoveryMode)await cloudHandleSession(data.session);

}
let currentAccessProfile=null;
let recoveryMode=false;

function roleLabel(role){
  return {
    owner:"Owner",
    admin:"Admin",
    project_manager:"Project Manager",
    regional_pic:"PIC Regional",
    viewer:"Viewer"
  }[role]||role||"-"
}
function isAdminRole(role){
  return role==="owner"||role==="admin"
}
async function fetchCurrentAccessProfile(){
  if(!cloudClient||!cloudSession?.user)return null;
  const {data,error}=await authTimeout(cloudClient
    .from("profiles")
    .select("*")
    .eq("user_id",cloudSession.user.id)
    .maybeSingle(),15000);
  if(error)throw error;
  return data||null
}
async function ensureCurrentUserAccess(){
  try{
    currentAccessProfile=await fetchCurrentAccessProfile();
    const allowed=!!currentAccessProfile&&currentAccessProfile.access_enabled===true;
    if(!allowed){
      cloudShowAuth(true);
      openModal("accessDeniedModal");
      return false
    }
    if($("userAccessSubtitle")){
      $("userAccessSubtitle").textContent=isAdminRole(currentAccessProfile.role)
        ? roleLabel(currentAccessProfile.role)+" • Kelola akses"
        : roleLabel(currentAccessProfile.role)+" • Tidak dapat mengelola user"
    }
    cloudUpdateAccountUI();
    window.trackersUpdateRoleUI?.();
    return true
  }catch(err){
    console.error(err);
    cloudShowAuth(true);setLoginInline("Gagal memeriksa akses akun. Periksa internet dan tabel profiles.","error");
    cloudSetStatus("error","ERROR","Gagal memeriksa akses.");
    return false
  }
}
async function emailPasswordLogin(email,password){
  if(!cloudClient){setLoginInline("Komponen login belum siap. Periksa internet lalu muat ulang.","error");throw new Error("Supabase client belum siap");}
  const normalizedEmail=String(email||"").trim().toLowerCase();
  if(!normalizedEmail||!password)throw new Error("Email dan password wajib diisi");

  cloudSetStatus("syncing","LOGIN","Memeriksa akun...");
  setLoginInline("Menghubungkan ke server...","info");
  setLoginBusy(true);

  try{
    const {data,error}=await authTimeout(
      cloudClient.auth.signInWithPassword({email:normalizedEmail,password}),
      15000
    );
    if(error)throw error;
    localStorage.setItem("tracklyLastLoginEmail",normalizedEmail);
    setLoginInline("Login berhasil. Membuka Trackers Workspace...","info");
    return data
  }catch(err){
    cloudSetStatus("error","ERROR","Login gagal");
    setLoginInline(friendlyAuthError(err),"error");
    throw err
  }finally{
    setLoginBusy(false)
  }
}
async function requestPasswordReset(email){
  if(!cloudClient)return;
  // Normalize to the canonical app URL (must exactly match Auth Redirect URLs).
  let redirectTo=location.origin&&location.origin!=="null"
    ? location.origin+location.pathname
    : location.href.split("#")[0].split("?")[0];
  redirectTo=redirectTo.replace(/index\.html?$/i,"");
  if(!redirectTo.endsWith("/"))redirectTo+="/";
  const {error}=await cloudClient.auth.resetPasswordForEmail(email,{redirectTo});
  if(error)throw error
}
async function setNewPassword(password){
  if(!cloudClient)return;
  const {error}=await cloudClient.auth.updateUser({password});
  if(error)throw error
}
async function loadAdminUsers(){
  const wrap=$("adminUserList");if(!wrap)return;
  if(!currentAccessProfile||!isAdminRole(currentAccessProfile.role)){
    wrap.innerHTML='<div class="admin-user-empty">Hanya Owner/Admin yang dapat mengelola akses user.</div>';
    return
  }
  wrap.innerHTML='<div class="admin-user-empty">Memuat user...</div>';
  const {data,error}=await cloudClient.rpc("trackly_admin_list_profiles");
  if(error){
    wrap.innerHTML='<div class="admin-user-empty">Gagal memuat user. Pastikan migrasi Supabase 004 sudah dijalankan.</div>';
    return
  }
  const rows=Array.isArray(data)?data:[];
  wrap.innerHTML=rows.length?rows.map(u=>`
    <div class="admin-user-row">
      <div class="admin-user-main">
        <strong>${esc(u.full_name||u.email||"User")}</strong>
        <small>${esc(u.email||"-")}</small>
      </div>
      <select class="admin-role-select" data-admin-role="${esc(u.user_id)}" ${u.role==="owner"?"disabled":""}>
        ${["admin","project_manager","regional_pic","viewer"].map(r=>
          `<option value="${r}" ${u.role===r?"selected":""}>${roleLabel(r)}</option>`
        ).join("")}
        ${u.role==="owner"?'<option value="owner" selected>Owner</option>':""}
      </select>
      <button type="button" class="btn light small" data-admin-access="${esc(u.user_id)}" data-enabled="${u.access_enabled===true}" ${u.role==="owner"||u.user_id===cloudSession?.user.id?"disabled":""}>${u.access_enabled===false?"Aktifkan":"Nonaktifkan"}</button>
    </div>`).join("")
    :'<div class="admin-user-empty">Belum ada user.</div>';

  document.querySelectorAll('[data-admin-access]').forEach(btn=>btn.onclick=async()=>{
    const enabled=btn.dataset.enabled!=='true';
    if(!confirm((enabled?'Aktifkan':'Nonaktifkan')+' akses akun ini?'))return;
    btn.disabled=true;const {error}=await cloudClient.rpc('trackers_admin_set_access',{target_user:btn.dataset.adminAccess,enabled});
    if(error)toast('Gagal mengubah akses: '+error.message);else toast('Akses diperbarui');await loadAdminUsers();
  });
  document.querySelectorAll("[data-admin-role]").forEach(sel=>sel.onchange=async()=>{
    const userId=sel.dataset.adminRole;
    const role=sel.value;
    const {error}=await cloudClient.rpc("trackly_admin_set_role",{target_user:userId,new_role:role});
    if(error){
      toast("Gagal ubah role: "+error.message);
      await loadAdminUsers();
      return
    }
    toast("Role user diperbarui")
  })
}
async function cloudSignOut(){
  if(!cloudClient)return;
  clearTimeout(cloudPushTimer);
  if(cloudReady&&localStorage.getItem(CLOUD_DIRTY_KEY)==='1'){
    const ok=await cloudPush('sign-out');
    if(!ok&&!confirm('Ada perubahan yang belum tersinkron. Keluar? Data lokal tetap disimpan untuk akun ini.'))return;
  }
  cloudReady=false;cloudConflict=false;
  const {error}=await cloudClient.auth.signOut();
  if(error){toast('Gagal keluar. Periksa koneksi lalu coba lagi.');return;}
  cloudSession=null;currentAccessProfile=null;cloudUpdateAccountUI();
  document.querySelectorAll('.modalbg.open').forEach(m=>closeModal(m.id));cloudShowAuth(true);
}



const BAST=["BOQ","PO","BAUT","BAPWP","BAST","GR"];
// Production build: never auto-delete existing user data on startup.
// Data removal is available only through Settings → Reset Semua Data.
function clearBundledDemoDataOnce(){ return; }
clearBundledDemoDataOnce();

window.addEventListener('online',()=>{if(cloudSession)cloudReconcile();});
