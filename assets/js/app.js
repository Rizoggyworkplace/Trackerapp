let state=load(), currentSite=null, onefluxDraft=[], bastDraft=[];
let noteViewMode="active", noteEditColor="default";


const ONEFLUX_TEMPLATES={
  PERKUATAN:[
    {section:"Material Perkuatan",subject:"Fabrikasi Material Perkuatan",code:"PERK_GALVANIS",requirement:"Sertifikat Galvanis",required:true},
    {section:"Material Perkuatan",subject:"Fabrikasi Material Perkuatan",code:"PERK_INSPEKSI_MATERIAL",requirement:"Dokumentasi periksa material + Pengukuran dimensi material STR dan ketebalan galvanis",required:true},
    {section:"Material Perkuatan",subject:"NOD (Note of Delivery) Material STR",code:"PERK_NOD",requirement:"NOD by Mitra ke Fabrikator → jika Fabrikasi By Mitra",required:true},
    {section:"Material Perkuatan",subject:"Sortir dan Pickup Material",code:"PERK_SORTIR_PICKUP",requirement:"Foto Sortir + Pickup Material",required:true},
    {section:"Material Perkuatan",subject:"Sortir dan Pickup Material",code:"PERK_BA_SERAH_MATERIAL",requirement:"BA Serah terima + Check list Material dari pabrikator",required:true},
    {section:"Material Perkuatan",subject:"Material STR On Site",code:"PERK_MATERIAL_ONSITE",requirement:"BA Material Onsite + Foto Material Onsite",required:true},
    {section:"Pekerjaan Perkuatan",subject:"Implementasi Perkuatan Tower",code:"PERK_IMPL_0100",requirement:"Foto Proses Pekerjaan 0-100% (Per-Item Pekerjaan)",required:true},
    {section:"ATP Perkuatan",subject:"Undangan ATP Perkuatan",code:"PERK_ATP_EMAIL",requirement:"Capture Email Undangan ATP STR",required:true},
    {section:"ATP Perkuatan",subject:"Undangan ATP Perkuatan",code:"PERK_ATP_SOFTCOPY",requirement:"Dokumen Soft Copy Undangan ATP",required:true},
    {section:"ATP Perkuatan",subject:"Pelaksanaan ATP Perkuatan",code:"PERK_ATP_FOTO100",requirement:"Foto pekerjaan 100%",required:true},
    {section:"ATP Perkuatan",subject:"Closing Pending dan ATP Perkuatan",code:"PERK_CLOSING_CHECKLIST_BA",requirement:"Doc Cheklist ATP + BA ATP",required:true},
    {section:"ATP Perkuatan",subject:"Closing Pending dan ATP Perkuatan",code:"PERK_CLOSING_ABD",requirement:"ABD (Full sign)",required:true},
    {section:"ATP Perkuatan",subject:"Closing Pending dan ATP Perkuatan",code:"PERK_CLOSING_DOK",requirement:"Dokumentasi ATP",required:true},
    {section:"ATP Perkuatan",subject:"Closing Pending dan ATP Perkuatan",code:"PERK_CLOSING_AFTER_BEFORE",requirement:"BA Closing Pending & Dokumentasi After - Before (Jika ada Pendingan)",required:true},
    {section:"ATP Perkuatan",subject:"BAST Perkuatan",code:"PERK_BAST_FULLSIGN",requirement:"Doc BAST Full Sign",required:true}
  ],
  COLLOCATION:[
    {section:"CME PLN Colo",subject:"Mini CME Colo",code:"COLO_MINI_CME_0100",requirement:"Proses pekerjaan 0-100% (Galian/Batu Kali, lantai kerja, pembesian, pengecoran, finising, ME dan instalasi Tray + Mounting)",required:true},
    {section:"CME PLN Colo",subject:"Penyambungan PLN Colo",code:"COLO_PLN_PERMOHONAN",requirement:"Surat Permohonan Pemasangan PLN",required:true},
    {section:"CME PLN Colo",subject:"Penyambungan PLN Colo",code:"COLO_PLN_JAWABAN",requirement:"Surat Jawaban PLN",required:true},
    {section:"CME PLN Colo",subject:"Penyambungan PLN Colo",code:"COLO_PLN_SPK",requirement:"Surat Perintah Kerja (SPK) PLN",required:true},
    {section:"CME PLN Colo",subject:"Penyambungan PLN Colo",code:"COLO_PLN_KUITANSI",requirement:"Kuitansi BPU",required:true},
    {section:"CME PLN Colo",subject:"Penyambungan PLN Colo",code:"COLO_PLN_PKS_SPJBTL",requirement:"PKS / Document PLN / SPJBTL",required:true},
    {section:"CME PLN Colo",subject:"Penyambungan PLN Colo",code:"COLO_PLN_SLO",requirement:"Surat Laik Operasi / SLO",required:true},
    {section:"CME PLN Colo",subject:"Penyambungan PLN Colo",code:"COLO_PLN_AKLI",requirement:"Surat Jaminan Instalasi / AKLI",required:true},
    {section:"CME PLN Colo",subject:"Penyambungan PLN Colo",code:"COLO_PLN_GARANSI_TRAFO",requirement:"Kartu Garansi Trafo",required:false},
    {section:"CME PLN Colo",subject:"RFI Declare Colo",code:"COLO_RFI_NOTICE_DOC",requirement:"RFI Notice Dan Doc RFI (Sesuai Tenant)",required:true},
    {section:"ATP Colo",subject:"Undangan ATP Colo",code:"COLO_ATP_UNDANGAN",requirement:"Capture Email ATP Dan Doc Undangan ATP",required:true},
    {section:"ATP Colo",subject:"Pelaksanaan Pra ATP Colo",code:"COLO_ATP_FOTO100",requirement:"Foto pekerjaan 100%",required:true},
    {section:"ATP Colo",subject:"Closing Pending & ATP Colo",code:"COLO_CLOSING_GALVANIS",requirement:"Doc. Galvanis",required:true},
    {section:"ATP Colo",subject:"Closing Pending & ATP Colo",code:"COLO_CLOSING_PANEL",requirement:"Sertifikat Panel",required:true},
    {section:"ATP Colo",subject:"Closing Pending & ATP Colo",code:"COLO_CLOSING_CHECKLIST_BA",requirement:"Doc. Ceklist ATP + BA ATP",required:true},
    {section:"ATP Colo",subject:"Closing Pending & ATP Colo",code:"COLO_CLOSING_HANDOVER_KEY",requirement:"Doc. Hand Over Key",required:true},
    {section:"ATP Colo",subject:"Closing Pending & ATP Colo",code:"COLO_CLOSING_ABD_DOK",requirement:"ABD (Full sign) + Dokumentasi ATP",required:true},
    {section:"ATP Colo",subject:"Closing Pending & ATP Colo",code:"COLO_CLOSING_AFTER_BEFORE",requirement:"BA Closing Pending dan Doc. After - Before (Jika Ada Pendingan)",required:true},
    {section:"ATP Colo",subject:"BAST CME Colo",code:"COLO_BAST_FULLSIGN",requirement:"BAST Full Sign",required:true}
  ]
};
function normalizeSiteModules(s){
  if(!s)return s;
  if(s.clientSiteId==null)s.clientSiteId="";
  s.archived=s.archived===true;
  if(!Array.isArray(s.tasks))s.tasks=[];
  if(s.towerHeight==null)s.towerHeight="";
  if(!s.pln||typeof s.pln!=="object"||Array.isArray(s.pln))s.pln={};
  if(!Array.isArray(s.oneflux))s.oneflux=[];
  if(!Array.isArray(s.bast)){
    s.bast=BAST.map(label=>({label,done:false}))
  }else{
    const byLabel=Object.fromEntries(s.bast.filter(Boolean).map(x=>[String(x?.label||""),!!x?.done]));
    s.bast=BAST.map(label=>({label,done:!!byLabel[label]}))
  }
  if(!s.finance||typeof s.finance!=="object"||Array.isArray(s.finance))s.finance={rows:[]};
  if(!Array.isArray(s.finance.rows))s.finance.rows=[];
  s.finance.rows=s.finance.rows.map(r=>({
    ...r,
    payments:Array.isArray(r.payments)?r.payments:(
      financeNum(r.payment)>0?[{
        id:financePaymentId(),
        date:"",
        amount:financeNum(r.payment),
        note:"Data pembayaran lama"
      }]:[]
    )
  }));
  return s
}

function normalizeAllSiteModules(){
  state.sites.forEach(normalizeSiteModules);
}

function onefluxTemplate(workType){return ONEFLUX_TEMPLATES[String(workType||"").toUpperCase()]||[]}
function onefluxItems(s){
  if(!s)return [];
  const saved=Array.isArray(s.oneflux)?s.oneflux:[];
  const base=onefluxTemplate(s.workType);
  const defs=[...base,...saved.filter(x=>x&&x.code&&!base.some(t=>t.code===x.code))];
  return defs.map(x=>({...x,...saved.find(v=>v?.code===x.code),required:x.required!==false}));
}
function onefluxSummaryLocal(s){
  const tpl=onefluxItems(s), saved=Array.isArray(s.oneflux)?s.oneflux:[];
  if(!tpl.length)return{pct:0,state:"Belum",ok:0,total:0,nok:0};
  const map=Object.fromEntries(saved.map(x=>[x.code,x]));
  const req=tpl.filter(x=>x.required);
  const ok=req.filter(x=>(map[x.code]?.status||"Belum")==="OK").length;
  const nok=req.filter(x=>(map[x.code]?.status||"Belum")==="NOK").length;
  const pct=Math.round(ok/Math.max(1,req.length)*100);
  const state=nok?"Complicated":ok===req.length?"Completed":ok>0?"Progress":"Belum";
  return{pct,state,ok,total:req.length,nok}
}


const SITE_IMPORT_HEADERS={
  "SITE NAME":"siteName","PROJECT ID":"projectId","SITE ID":"siteId","SITE ID CLIENT":"clientSiteId","CLIENT":"client","TENANT":"tenant",
  "TINGGI TOWER":"towerHeight","TINGGI TOWER (M)":"towerHeight","REGIONAL":"region","SOW":"workType","NO SPMK":"spmkNo","TANGGAL SPMK":"spmkDate",
  "KOORDINAT":"coordinate","ALAMAT":"address","STATUS":"status"
};
function normalizeImportHeader(v){return String(v??"").trim().toUpperCase().replace(/\s+/g," ")}
function parseImportDate(v){
  if(typeof v==='number'){
    if(!Number.isFinite(v)||v<=0)return '';
    const d=new Date(Date.UTC(1899,11,30)+Math.floor(v)*86400000);
    return TrackersCore.date(d.toISOString().slice(0,10));
  }
  return TrackersCore.date(v);
}
function normalizeImportStatus(v){
  const s=String(v||"").trim().toLowerCase();
  if(!s)return "In Progress";
  if(s==="completed"||s==="done"||s==="selesai")return "Completed";
  if(s==="pending"||s==="belum")return "Pending";
  if(s==="blocked"||s==="block"||s==="hold")return "Blocked";
  return "In Progress"
}
function downloadSiteImportTemplate(){TrackersSheets.export([SITE_HEADERS],'Trackers_Format_Import_Data_Site.xlsx','FORMAT INPUT SITE');}

function existingSiteForImport(row){
  const key=v=>String(v||"").trim().toLowerCase();
  return state.sites.find(s=>key(s.projectId)===key(row.projectId)&&key(s.siteId)===key(row.siteId)&&key(s.workType)===key(row.workType))
}
function importSiteRows(rows){
  let read=0,created=0,updated=0,skipped=0;const notes=[];
  rows.forEach((raw,idx)=>{
    const obj={};
    Object.entries(raw||{}).forEach(([k,v])=>{const mapped=SITE_IMPORT_HEADERS[normalizeImportHeader(k)];if(mapped)obj[mapped]=v});
    if(!Object.values(obj).some(v=>String(v??"").trim()))return;
    read++;
    const row={
      siteName:String(obj.siteName??"").trim(),projectId:String(obj.projectId??"").trim(),siteId:String(obj.siteId??"").trim(),
      clientSiteId:String(obj.clientSiteId??"").trim(),client:String(obj.client??"").trim(),tenant:String(obj.tenant??"").trim(),
      towerHeight:String(obj.towerHeight??"").trim(),region:String(obj.region??"").trim(),
      workType:String(obj.workType??"").trim().toUpperCase(),spmkNo:String(obj.spmkNo??"").trim(),spmkDate:parseImportDate(obj.spmkDate),
      coordinate:String(obj.coordinate??"").trim(),address:String(obj.address??"").trim(),status:normalizeImportStatus(obj.status)
    };
    if((obj.spmkDate&&!row.spmkDate)||(row.towerHeight&&(!Number.isFinite(Number(row.towerHeight))||Number(row.towerHeight)<0))){skipped++;notes.push(`Baris ${idx+2} dilewati: tanggal atau tinggi tower tidak valid.`);return;}
    if(!row.siteName||!row.projectId||!row.siteId||!row.client||!row.tenant||!row.region||!row.workType){
      skipped++;notes.push(`Baris ${idx+2} dilewati: field wajib belum lengkap.`);return
    }
    if(!state.clients.some(c=>norm(c.name)===norm(row.client)))state.clients.push({id:uid("c"),name:row.client});
    if(!state.tenants.some(t=>norm(t)===norm(row.tenant)))state.tenants.push(row.tenant);
    const found=existingSiteForImport(row);
    if(found){
      dispatchPkbon({type:'TRACKLY_LINK_SITE',site:found,sites:state.sites});
      Object.assign(found,row);updated++;activity(row.siteName+" diperbarui via Import Excel",found.id)
    }else{
      const s={id:uid("s"),...row,pln:{},oneflux:[],bast:BAST.map(label=>({label,done:false})),finance:{rows:[]}};
      state.sites.unshift(s);created++;activity(row.siteName+" ditambahkan via Import Excel",s.id)
    }
  });
  save();renderAll();
  $("importReadCount").textContent=read;$("importNewCount").textContent=created;$("importUpdateCount").textContent=updated;$("importSkipCount").textContent=skipped;
  $("importSiteNotes").innerHTML=notes.length?notes.slice(0,30).map(n=>`<div class="import-note">${esc(n)}</div>`).join(""):`<div class="import-note">Import selesai. ${created} site baru dan ${updated} site diperbarui.</div>`;
  openModal("importSiteResultModal")
}
async function handleSiteExcelFile(file){
  if(!file)return;
  if(!window.XLSX){toast("Library Excel belum termuat. Pastikan internet aktif lalu coba lagi.");return}
  try{
    const data=await file.arrayBuffer();
    const wb=XLSX.read(data,{type:"array",cellDates:true});
    const sheetName=wb.SheetNames.includes("FORMAT INPUT SITE")?"FORMAT INPUT SITE":wb.SheetNames[0];
    const sheet=wb.Sheets[sheetName];
    const rows=XLSX.utils.sheet_to_json(sheet,{defval:"",raw:true});
    importSiteRows(rows)
  }catch(err){console.error(err);toast("Import Excel gagal: "+(err.message||err))}
}

const THEMES={
  default:{"name":"Default","tone1":"#ffffff","tone2":"#171717","bg":"#f9f9f9","sidebar":"#f9f9f9","workspace":"#ffffff","panel":"#ffffff","card":"#f7f7f8","hover":"#ececec","line":"#dedede","text":"#171717","muted":"#616161","accent":"#171717","danger":"#b42318","mode":"light"},
  midnight:{
    name:"Midnight Lime",tone1:"#141513",tone2:"#b7ff52",
    bg:"#141513",sidebar:"#191a18",panel:"#20211f",card:"#292a27",hover:"#31332e",
    line:"#353731",text:"#f3f4ed",muted:"#a5a89c",accent:"#b7ff52",danger:"#ffaaa0",mode:"dark"
  },
  light:{
    name:"Trackers Green",tone1:"#7fbd67",tone2:"#20363b",
    bg:"#7fbd67",sidebar:"#7fbd67",panel:"#c8e18f",card:"#e2efcf",hover:"#d6e9bd",
    line:"#536d63",text:"#20363b",muted:"#5d756d",accent:"#7fbd67",danger:"#ad302b",mode:"light"
  },
  sand:{"name": "Warm Sand", "tone1": "#d6b78b", "tone2": "#493424", "bg": "#d6b78b", "sidebar": "#d6b78b", "workspace": "#f8f0e4", "panel": "#eee0c8", "card": "#fffaf1", "hover": "#e6d4b8", "line": "#8a7050", "text": "#493424", "muted": "#74604a", "accent": "#e3bd87", "danger": "#a22f2f", "mode": "light"},
  stone:{"name":"Stone Gray","tone1":"#595959","tone2":"#9e9999","bg":"#595959","sidebar":"#595959","workspace":"#ececed","panel":"#c7c7c7","card":"#9e9999","hover":"#c7c7c7","line":"#303030","text":"#1f1f1f","muted":"#303030","accent":"#9e9999","danger":"#a22f2f","mode":"light","sidebarText":"#ffffff","workspaceText":"#1f1f1f"},
  sage:{"name":"Forest Sage","tone1":"#0d2d1e","tone2":"#779b7f","bg":"#0d2d1e","sidebar":"#0d2d1e","workspace":"#e0e6ec","panel":"#b7c9b9","card":"#f3f4fd","hover":"#b7c9b9","line":"#354d3d","text":"#142a1b","muted":"#354d3d","accent":"#779b7f","danger":"#a22f2f","mode":"light","sidebarText":"#ffffff","workspaceText":"#142a1b"},
  bluegray:{"name":"Cloud Blue","tone1":"#ffffff","tone2":"#669dfe","bg":"#ffffff","sidebar":"#ffffff","workspace":"#e0e6ec","panel":"#bbc5d2","card":"#ffffff","hover":"#bbc5d2","line":"#3b4c62","text":"#15263e","muted":"#3b4c62","accent":"#669dfe","danger":"#a22f2f","mode":"light","sidebarText":"#202020","workspaceText":"#15263e"},
  neon:{"name":"Mono Lime","tone1":"#000000","tone2":"#ccff02","bg":"#000000","sidebar":"#000000","workspace":"#5c5c5c","panel":"#dcdcdc","card":"#ffffff","hover":"#dcdcdc","line":"#505050","text":"#202020","muted":"#505050","accent":"#ccff02","danger":"#a22f2f","mode":"light","sidebarText":"#ffffff","workspaceText":"#ffffff"},
  chatgpt:{"name":"Default Dark","tone1":"#212121","tone2":"#ffffff","bg":"#171717","sidebar":"#171717","workspace":"#212121","panel":"#262626","card":"#303030","hover":"#3a3a3a","line":"#555555","text":"#ececec","muted":"#b4b4b4","accent":"#ffffff","danger":"#ff8585","mode":"dark"}
};
function applyTheme(){
  const t=THEMES[state.theme]||THEMES.default,r=document.documentElement.style;
  r.setProperty("--tone1",t.bg);r.setProperty("--tone2",t.text);
  r.setProperty("--tone1-soft",t.panel);r.setProperty("--tone2-soft",t.card);
  r.setProperty("--workspace",t.workspace||(state.theme==="midnight"?"#181f1b":"#e1efce"));
  r.setProperty("--bg",t.bg);r.setProperty("--sidebar",t.sidebar);r.setProperty("--panel",t.panel);
  r.setProperty("--card",t.card);r.setProperty("--hover",t.hover);r.setProperty("--text",t.text);
  r.setProperty("--muted",t.muted);r.setProperty("--line",t.line);r.setProperty("--accent",t.accent);
  r.setProperty("--danger",t.danger);r.setProperty("--warning","#d9b15c");r.setProperty("--success","#9ac66a");
  r.setProperty("--shadow",t.mode==="dark"?"0 18px 55px rgba(0,0,0,.22)":"0 18px 45px rgba(32,35,26,.10)");
  document.documentElement.dataset.theme=t.mode;
  document.documentElement.dataset.palette=state.theme;
  r.setProperty("--sidebar-text",t.sidebarText||t.text);
  r.setProperty("--workspace-text",t.workspaceText||t.text);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content",t.bg);
  if(typeof sendPkbonTheme==="function")sendPkbonTheme();
}
function renderThemeChoices(){
  const box=$("themeChoices");if(!box)return;
  box.innerHTML=Object.entries(THEMES).map(([k,t])=>`<button class="theme-choice ${state.theme===k?"active":""}" type="button" data-theme="${k}"><span class="theme-swatch"><i style="background:${t.tone1}"></i><i style="background:${t.tone2}"></i></span><span><strong>${t.name}</strong><br><small>Dua warna utama</small></span></button>`).join("");
  box.querySelectorAll("[data-theme]").forEach(b=>b.onclick=()=>{state.theme=b.dataset.theme;if(typeof opsCanEdit!=="function"||opsCanEdit())save();applyTheme();renderSettings();toast("Tema diubah")})
}
function renderClientSettingsList(){
  const box=$("clientSettingsList");if(!box)return;
  box.innerHTML=state.clients.length?state.clients.map(c=>`<div class="simple-list-item"><strong>${esc(c.name)}</strong><button class="rowbtn" type="button" data-sdelclient="${c.id}">Hapus</button></div>`).join(""):'<div class="empty"><div><h3>Belum ada client</h3><p>Tekan Tambah untuk membuat client.</p></div></div>';
  box.querySelectorAll("[data-sdelclient]").forEach(b=>b.onclick=()=>{const c=state.clients.find(x=>x.id===b.dataset.sdelclient);if(state.sites.some(s=>norm(s.client)===norm(c.name)))return toast("Client sedang dipakai");if(confirm("Hapus client "+c.name+"?")){state.clients=state.clients.filter(x=>x.id!==c.id);activity("Client "+c.name+" dihapus");save();renderAll()}})
}

function populateTenant(){
  const sel=$("tenantSelect");if(!sel)return;const cur=sel.value;
  sel.innerHTML='<option value="">Pilih Tenant</option>'+state.tenants.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join("");
  if([...sel.options].some(o=>o.value===cur))sel.value=cur
}
function renderTenantSettingsList(){
  const box=$("tenantSettingsList");if(!box)return;
  box.innerHTML=state.tenants.length?state.tenants.map(t=>`<div class="simple-list-item"><strong>${esc(t)}</strong><button class="rowbtn" type="button" data-deltenant="${esc(t)}">Hapus</button></div>`).join(""):'<div class="empty"><div><h3>Belum ada tenant</h3><p>Tekan Tambah untuk membuat tenant.</p></div></div>';
  box.querySelectorAll("[data-deltenant]").forEach(b=>b.onclick=()=>{const t=b.dataset.deltenant;if(state.sites.some(s=>norm(s.tenant)===norm(t)))return toast("Tenant sedang dipakai");if(confirm("Hapus tenant "+t+"?")){state.tenants=state.tenants.filter(x=>x!==t);activity("Tenant "+t+" dihapus");save();renderAll()}})
}

function renderTargetSettingsList(){
  const box=$("targetSettingsList");if(!box)return;
  box.innerHTML=state.rules.length?state.rules.map(r=>{const t=norm(r.workType)==="sacme"?`SITAC ${r.sitacDays||0}h • IMB ${r.imbDays||0}h • CME ${r.cmeDays||0}h`:`${r.days||0} hari`;return`<div class="simple-list-item"><span><strong>${esc(r.region)} · ${esc(r.workType)}</strong><br><span>${t}</span></span><button class="rowbtn" type="button" data-sdelrule="${r.id}">Hapus</button></div>`}).join(""):'<div class="empty"><div><h3>Belum ada target</h3><p>Tekan Tambah untuk membuat aturan target.</p></div></div>';
  box.querySelectorAll("[data-sdelrule]").forEach(b=>b.onclick=()=>{const r=state.rules.find(x=>x.id===b.dataset.sdelrule);if(confirm("Hapus target "+r.region+" - "+r.workType+"?")){state.rules=state.rules.filter(x=>x.id!==r.id);activity("Target dihapus");save();renderAll()}})
}


function load(){
  try{
    const raw=localStorage.getItem(KEY);
    const r=raw?TrackersCore.validateSnapshot({trackly:TrackersCore.decodeStored(raw)}).trackly:{};
    return{
      sites:Array.isArray(r.sites)?r.sites:[],
      clients:Array.isArray(r.clients)?r.clients:[],
      rules:Array.isArray(r.rules)?r.rules:[],
      auditTrail:Array.isArray(r.auditTrail)?r.auditTrail:[],
      activities:Array.isArray(r.activities)?r.activities:[],
      theme:(["default","light","midnight","sand","stone","sage","bluegray","neon","chatgpt"].includes(r.theme)?r.theme:(["ocean","lavender","navy","graphite"].includes(r.theme)?"sand":"default")),
      pinned:Array.isArray(r.pinned)?r.pinned:[],
      tenants:Array.isArray(r.tenants)?r.tenants:[],
      lastNotificationSeen:r.lastNotificationSeen||"",
      bastProcesses:Array.isArray(r.bastProcesses)?r.bastProcesses:[],
      notes:Array.isArray(r.notes)?r.notes:[]
    }
  }catch{
    window.TRACKERS_CORRUPT_KEYS=[...(window.TRACKERS_CORRUPT_KEYS||[]),KEY];
    return{sites:[],clients:[],rules:[],activities:[],theme:"default",pinned:[],tenants:[],lastNotificationSeen:"",bastProcesses:[],notes:[]}
  }
}
function save(){
  if(window.TRACKERS_CORRUPT_KEYS?.length){toast('Data lama tidak terbaca. Download data pemulihan lalu restore backup yang valid.');throw new Error('CORRUPT_WORKSPACE');}
  try{TrackersCore.writeBatch(localStorage,[...cloudChangeEntries(),[KEY,TrackersCore.encodeStored(state)]]);}
  catch(err){toast('Data belum tersimpan. Penyimpanan penuh; unduh backup dari Settings.');throw err;}
  scheduleCloudPush('trackly-save');
}
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
const norm=v=>String(v||"").trim().toLowerCase();
const uid=p=>p+"_"+Date.now()+"_"+Math.random().toString(16).slice(2);
function toast(t){$("toast").textContent=t;$("toast").classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>$("toast").classList.remove("show"),1800)}
function activity(t,siteRef=null){
  const s=siteRef?site(siteRef):null;
  state.activities.unshift({actor:cloudSession?.user?.email||"Lokal",id:uid("a"),text:t,time:new Date().toISOString(),siteId:s?.id||"",siteName:s?.siteName||""});
  state.activities=state.activities.slice(0,100)
}
function openModal(id){$(id).classList.add("open");document.body.style.overflow="hidden"}
function closeModal(id){$(id).classList.remove("open");if(!document.querySelector(".modalbg.open"))document.body.style.overflow=""}
function fmt(d){const value=TrackersCore.date(d);if(!value)return "-";return new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(value+"T00:00:00"))}
function addDays(d,n){if(!d||!n)return"";const x=new Date(d+"T00:00:00");x.setDate(x.getDate()+Number(n));return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0")}

function syncCustomRequired(presetEl, customEl){
  const isCustom=presetEl.value==="__custom";
  customEl.classList.toggle("hidden",!isCustom);
  customEl.required=isCustom;
  if(!isCustom) customEl.value="";
}

function resolvedSelectValue(presetEl,customEl){
  return presetEl.value==="__custom" ? customEl.value.trim() : presetEl.value.trim()
}
function setPresetAndCustom(presetEl,customEl,value,defaults){
  if(!value){ presetEl.value=""; customEl.value=""; customEl.classList.add("hidden"); return; }
  if(defaults.includes(value)){ presetEl.value=value; customEl.value=""; customEl.classList.add("hidden"); }
  else{ presetEl.value="__custom"; customEl.value=value; customEl.classList.remove("hidden"); }
}
function ruleFor(region,work){return state.rules.find(r=>norm(r.region)===norm(region)&&norm(r.workType)===norm(work))}
function targetOf(s){
  const r=ruleFor(s.region,s.workType);
  if(!r) return {days:0,date:"",sacme:null};
  if(norm(r.workType)==="sacme"){
    const sitac=Number(r.sitacDays||0), imb=Number(r.imbDays||0), cme=Number(r.cmeDays||0);
    const maxDays=Math.max(sitac,imb,cme,0);
    return {
      days:maxDays,
      date:s.spmkDate&&maxDays?addDays(s.spmkDate,maxDays):"",
      sacme:{
        sitacDays:sitac, imbDays:imb, cmeDays:cme,
        sitacDate:s.spmkDate&&sitac?addDays(s.spmkDate,sitac):"",
        imbDate:s.spmkDate&&imb?addDays(s.spmkDate,imb):"",
        cmeDate:s.spmkDate&&cme?addDays(s.spmkDate,cme):""
      }
    };
  }
  return {days:Number(r.days||0),date:r&&s.spmkDate?addDays(s.spmkDate,r.days):"",sacme:null}
}
function deadline(s){if(s.status==="Completed")return{label:"Completed",cls:"completed"};const t=targetOf(s);if(!t.date)return{label:s.status||"Pending",cls:s.status==="In Progress"?"progress":norm(s.status).replaceAll(" ","-")};const now=new Date();now.setHours(0,0,0,0);const td=new Date(t.date+"T00:00:00");const diff=Math.ceil((td-now)/86400000);if(diff<0)return{label:"Overdue",cls:"overdue"};if(diff<=7)return{label:"Due Soon",cls:"due"};return{label:s.status||"Pending",cls:s.status==="In Progress"?"progress":norm(s.status).replaceAll(" ","-")}}
function site(id){return state.sites.find(s=>s.id===id)}

let pkbonModuleReady=false;
let pkbonModuleLoading=false;
const PKBON_MODULE_VERSION='20260923.77';
let pendingPkbonCommands=[];
let pkbonHistoryCache=null;
function currentPkbonTheme(){
  const s=getComputedStyle(document.documentElement);
  return {mode:document.documentElement.dataset.theme||'dark',bg:s.getPropertyValue('--bg').trim(),panel:s.getPropertyValue('--panel').trim(),card:s.getPropertyValue('--card').trim(),text:s.getPropertyValue('--text').trim(),muted:s.getPropertyValue('--muted').trim(),line:s.getPropertyValue('--line').trim(),accent:s.getPropertyValue('--accent').trim(),hover:s.getPropertyValue('--hover').trim(),danger:s.getPropertyValue('--danger').trim()}
}
function pkbonSitePayload(){return (state.sites||[]).map(s=>({siteName:s.siteName||'',projectId:s.projectId||'',workspaceSiteId:s.id,siteId:s.siteId||'',workType:s.workType||''}))}
function dispatchPkbon(message){window.dispatchEvent(new CustomEvent('trackly:pkbon-command',{detail:message}));return true}
function sendPkbonTheme(){dispatchPkbon({type:'TRACKLY_THEME',theme:currentPkbonTheme()})}
function sendPkbonSites(){dispatchPkbon({type:'TRACKLY_SYNC_SITES',sites:pkbonSitePayload()})}
function flushPkbonCommands(){if(!pkbonModuleReady)return;const q=[...pendingPkbonCommands];pendingPkbonCommands=[];q.forEach(dispatchPkbon)}
function syncPkbonModuleData(){sendPkbonTheme();sendPkbonSites();if(pkbonModuleReady)dispatchPkbon({type:'TRACKLY_REQUEST_HISTORY'})}
function ensurePkbonModule(){
  if(!pkbonModuleReady&&!pkbonModuleLoading){
    pkbonModuleLoading=true;
    try{
      const s=document.createElement('script');
      s.src='assets/js/pkbon.js?v='+PKBON_MODULE_VERSION;
      s.onerror=()=>{pkbonModuleLoading=false;console.warn('Trackers: modul PKBON gagal dimuat')};
      (document.head||document.documentElement).appendChild(s);
    }catch(_){pkbonModuleLoading=false}
  }
  syncPkbonModuleData();flushPkbonCommands()
}
function queuePkbonCommand(message){ensurePkbonModule();if(pkbonModuleReady)dispatchPkbon(message);else pendingPkbonCommands.push(message)}

function noteColorKey(v){return ["default","lime","sand","blue","rose","violet"].includes(v)?v:"default"}
function noteUpdatedLabel(v){
  if(!v)return"";
  try{return new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(v))}catch{return""}
}
function noteCardHtml(n){
  const title=String(n.title||"").trim();
  const body=String(n.body||"").trim();
  const archived=!!n.archived;
  return `<article class="note-card note-color-${noteColorKey(n.color)}${n.pinned&&!archived?' is-pinned':''}" data-note-open="${esc(n.id)}">
    <div class="note-card-head"><strong>${title?esc(title):'<span class="note-untitled">Tanpa judul</span>'}</strong>${n.pinned&&!archived?'<span class="note-pin-badge">PIN</span>':''}</div>
    ${body?`<div class="note-card-body">${esc(body)}</div>`:'<div class="note-card-body note-card-empty">Catatan kosong</div>'}
    <div class="note-card-footer"><small>${noteUpdatedLabel(n.updatedAt||n.createdAt)}</small><div class="note-card-actions">
      ${archived?'':`<button type="button" data-note-pin="${esc(n.id)}" title="${n.pinned?'Lepas pin':'Sematkan'}">${n.pinned?'Unpin':'Pin'}</button>`}
      <button type="button" data-note-archive="${esc(n.id)}" title="${archived?'Pulihkan':'Arsipkan'}">${archived?'Pulihkan':'Arsip'}</button>
      <button type="button" data-note-delete="${esc(n.id)}" title="Hapus">Hapus</button>
    </div></div>
  </article>`
}
function renderNotes(){
  if(!$("notesView"))return;
  if(!Array.isArray(state.notes))state.notes=[];
  const q=norm($("noteSearchInput")?.value||"");
  const archivedMode=noteViewMode==="archive";
  let rows=state.notes.filter(n=>!!n.archived===archivedMode);
  if(q)rows=rows.filter(n=>norm(`${n.title||""} ${n.body||""}`).includes(q));
  rows=rows.slice().sort((a,b)=>new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0));
  const pinned=archivedMode?[]:rows.filter(n=>n.pinned);
  const normal=archivedMode?rows:rows.filter(n=>!n.pinned);
  $("notesPinnedSection").style.display=pinned.length?"block":"none";
  $("notesPinnedGrid").innerHTML=pinned.map(noteCardHtml).join("");
  $("notesMainGrid").innerHTML=normal.map(noteCardHtml).join("");
  $("notesPinnedCount").textContent=String(pinned.length);
  $("notesMainCount").textContent=String(normal.length);
  $("notesMainLabel").textContent=archivedMode?"ARSIP":"CATATAN";
  $("notesEmpty").style.display=rows.length?"none":"grid";
  $("notesActiveMode").classList.toggle("active",!archivedMode);
  $("notesArchiveMode").classList.toggle("active",archivedMode);
  document.querySelectorAll("[data-note-open]").forEach(card=>card.onclick=e=>{if(e.target.closest("button"))return;openNoteModal(card.dataset.noteOpen)});
  document.querySelectorAll("[data-note-pin]").forEach(b=>b.onclick=e=>{e.stopPropagation();toggleNotePin(b.dataset.notePin)});
  document.querySelectorAll("[data-note-archive]").forEach(b=>b.onclick=e=>{e.stopPropagation();toggleNoteArchive(b.dataset.noteArchive)});
  document.querySelectorAll("[data-note-delete]").forEach(b=>b.onclick=e=>{e.stopPropagation();deleteNote(b.dataset.noteDelete)});
}
function selectNoteColor(color){
  noteEditColor=noteColorKey(color);
  document.querySelectorAll("[data-note-color]").forEach(b=>b.classList.toggle("selected",b.dataset.noteColor===noteEditColor));
}
function openNoteModal(id=""){
  const n=state.notes.find(x=>x.id===id);
  $("noteForm").reset();
  $("noteId").value=n?.id||"";
  $("noteTitle").value=n?.title||"";
  $("noteBody").value=n?.body||"";
  $("notePinned").checked=!!n?.pinned;
  $("noteModalTitle").textContent=n?"Edit Catatan":"Catatan Baru";
  selectNoteColor(n?.color||"default");
  openModal("noteModal");
  setTimeout(()=>$(n?.title?"noteBody":"noteTitle")?.focus(),60)
}
function saveNoteFromForm(e){
  e.preventDefault();
  const id=$("noteId").value;
  const title=$("noteTitle").value.trim();
  const body=$("noteBody").value.trim();
  if(!title&&!body)return toast("Isi judul atau catatan terlebih dahulu");
  const now=new Date().toISOString();
  const old=state.notes.find(n=>n.id===id);
  const data={
    id:old?.id||uid("note"),title,body,color:noteEditColor,pinned:$("notePinned").checked,
    archived:old?.archived||false,createdAt:old?.createdAt||now,updatedAt:now
  };
  if(old)state.notes=state.notes.map(n=>n.id===old.id?data:n);else state.notes.unshift(data);
  save();closeModal("noteModal");renderNotes();toast(old?"Catatan diperbarui":"Catatan disimpan")
}
function toggleNotePin(id){
  const n=state.notes.find(x=>x.id===id);if(!n)return;n.pinned=!n.pinned;n.updatedAt=new Date().toISOString();save();renderNotes()
}
function toggleNoteArchive(id){
  const n=state.notes.find(x=>x.id===id);if(!n)return;n.archived=!n.archived;if(n.archived)n.pinned=false;n.updatedAt=new Date().toISOString();save();renderNotes();toast(n.archived?"Catatan diarsipkan":"Catatan dipulihkan")
}
function deleteNote(id){
  const n=state.notes.find(x=>x.id===id);if(!n)return;
  if(!confirm(`Hapus catatan${n.title?` “${n.title}”`:""}?`))return;
  state.notes=state.notes.filter(x=>x.id!==id);save();renderNotes();toast("Catatan dihapus")
}

window.addEventListener('storage',e=>{if(e.key==='pkbon_history'){pkbonHistoryCache=null;renderDashboard();if($('detailView')?.classList.contains('active'))renderDetail();if($('pkbonSiteModal')?.classList.contains('open'))renderPkbonSiteModal()}});
window.addEventListener('trackly:pkbon-event',e=>{
  const d=e?.detail||{};
  if(d.type==='PKBON_READY'){
    pkbonModuleReady=true;if(Array.isArray(d.history))pkbonHistoryCache=d.history;syncPkbonModuleData();flushPkbonCommands()
  }
  if(d.type==='PKBON_CHANGED'||d.type==='PKBON_HISTORY'){
    if(Array.isArray(d.history))pkbonHistoryCache=d.history;renderDashboard();if($('detailView')?.classList.contains('active'))renderDetail();if($('pkbonSiteModal')?.classList.contains('open'))renderPkbonSiteModal()
  }
  if(d.type==='PKBON_CHANGED')scheduleCloudPush('pkbon-change');
  if(d.type==='PKBON_ERROR')console.error('PKBON:',d.message||'Unknown error')
});
function route(name){
  if(!["dashboard","sites","reporting","bastprocess","pkbon","notes","settings","detail"].includes(name))name="dashboard";
  document.body.dataset.view=name;
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  $(name+"View")?.classList.add("active");
  document.querySelectorAll("[data-route]").forEach(b=>b.classList.toggle("active",b.dataset.route===(name==="detail"?"sites":name)));
  const map={dashboard:["DASHBOARD","TRACKERS WORKSPACE"],sites:["DATA PROJECT","TRACKERS WORKSPACE"],reporting:["REPORTING","TRACKERS WORKSPACE"],bastprocess:["BAST PROSES","TRACKERS WORKSPACE"],pkbon:["PKBON","TRACKERS WORKSPACE"],notes:["NOTE PAD","TRACKERS WORKSPACE"],settings:["SETTINGS","TRACKERS WORKSPACE"],detail:["DETAIL SITE","TRACKERS WORKSPACE"]};
  if($("title"))$("title").textContent=map[name][0];if($("subtitle"))$("subtitle").textContent=map[name][1];
  $("workspace").classList.toggle("single-column",name!=="dashboard");
  if(name==="dashboard")renderDashboard(); if(name==="sites")renderSites(); if(name==="reporting")renderReporting(); if(name==="bastprocess")renderBastProcesses(); if(name==="pkbon")ensurePkbonModule(); if(name==="notes")renderNotes(); if(name==="settings")renderSettings(); if(name==="detail")renderDetail();
}
function renderAll(){syncAllBastProcessToSites();renderDashboard();renderSites();renderReporting();renderBastProcesses();renderNotes();renderSettings();populateClient();populateTenant();renderLists();refreshNotificationState();syncPkbonModuleData()}
function renderDashboard(){
  const activeSites=state.sites.filter(s=>!s.archived);
  const done=activeSites.filter(s=>s.status==="Completed").length, prog=activeSites.filter(s=>s.status==="In Progress").length;
  const due=activeSites.filter(s=>deadline(s).label==="Due Soon").length, late=activeSites.filter(s=>deadline(s).label==="Overdue").length;
  $("mTotal").textContent=activeSites.length;$("mDone").textContent=done;$("mProgress").textContent=prog;$("mDue").textContent=due+late;
  const p=activeSites.length?Math.round(done/activeSites.length*100):0;$("overall").textContent=p+"%";$("ring").style.setProperty("--p",p);$("overallCard").style.setProperty("--p",p+"%");$("overallStatus").textContent=activeSites.length?(p===100?"Completed":"In Progress"):"Belum ada data";$("sSites").textContent=done;$("sClients").textContent=prog;

  const pinned=activeSites.filter(s=>state.pinned.includes(s.id));
  const pinnedSlots=[...pinned];
  while(pinnedSlots.length<3)pinnedSlots.push(null);
  $("pinnedSites").innerHTML='<div class="quicklist">'+pinnedSlots.map(s=>{if(!s)return `<div class="quickrow dashboard-pin-placeholder"><div><h4>Pinned Site</h4><p>Belum ada project dipin</p></div></div>`;const d=deadline(s);return`<button class="quickrow" type="button" data-qsite="${s.id}"><div><h4>${esc(s.siteName)}</h4><p>${esc(s.projectId)} • ${esc(s.siteId)} • ${esc(s.region)}</p></div><span class="badge ${d.cls}">${d.label}</span></button>`}).join("")+"</div>";
  document.querySelectorAll("[data-qsite]").forEach(e=>e.onclick=()=>openDetail(e.dataset.qsite));
  const dashActivity=$("dashboardActivityList");
  if(dashActivity){
    const rows=(state.activities||[]).slice(0,4);
    dashActivity.innerHTML=rows.length?rows.map(a=>{
      const when=new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(a.time));
      return `<button class="dashboard-activity-row" type="button" data-dashboard-activity="${esc(a.id)}"><span><strong>${esc(activityDisplay(a.text))}</strong><small>${esc(a.siteName||"Workspace")}</small></span><time>${esc(when)}</time></button>`
    }).join(""):'<div class="dashboard-activity-empty">Belum ada aktivitas terbaru.</div>';
    dashActivity.querySelectorAll("[data-dashboard-activity]").forEach(btn=>btn.onclick=()=>openActivityDetail(btn.dataset.dashboardActivity));
  }
  refreshNotificationState();
}

function summarySites(type){
  const activeSites=state.sites.filter(s=>!s.archived);
  if(type==="completed") return activeSites.filter(s=>s.status==="Completed");
  if(type==="progress") return activeSites.filter(s=>s.status==="In Progress");
  if(type==="attention") return activeSites.filter(s=>["Due Soon","Overdue"].includes(deadline(s).label));
  if(type==="due") return activeSites.filter(s=>deadline(s).label==="Due Soon");
  if(type==="overdue") return activeSites.filter(s=>deadline(s).label==="Overdue");
  return [...activeSites];
}
function openSummary(type){
  const sites=summarySites(type);
  const titles={all:"Total Site",completed:"Completed",progress:"In Progress",attention:"Need Attention",due:"Due Soon",overdue:"Overdue"};
  $("summaryModalTitle").textContent=titles[type]||"Site";
  const regions={};
  sites.forEach(s=>{const r=s.region||"Tanpa Regional";regions[r]=(regions[r]||0)+1});
  $("summaryRegional").innerHTML=Object.entries(regions).map(([r,n])=>`<div class="summary-region-card"><span>${esc(r)}</span><strong>${n}</strong></div>`).join("");
  $("summarySiteList").innerHTML=sites.length
    ? sites.map(s=>{const d=deadline(s);return`<div class="simple-list-item" data-summary-site="${s.id}" style="cursor:pointer"><span><strong>${esc(s.siteName)} · ${esc(s.siteId)}</strong><br><span>${esc(s.region)} • ${esc(s.projectId)} • ${esc(s.workType)}</span></span><span class="badge ${d.cls}">${d.label}</span></div>`}).join("")
    : '<div class="empty"><div><h3>Belum ada data</h3><p>Tidak ada site pada kategori ini.</p></div></div>';
  $("summarySiteList").querySelectorAll("[data-summary-site]").forEach(el=>el.onclick=()=>{closeModal("summaryModal");openDetail(el.dataset.summarySite)});
  openModal("summaryModal");
}

function activityDisplay(text){
  let out=String(text||"");
  state.sites.forEach(s=>{
    if(s.siteId)out=out.replaceAll(s.siteId,s.siteName);
  });
  return out.replace(/\bSite\s+/i,"").trim()
}

function filteredActivities(){
  const date=$("notificationDateFilter")?.value||"";
  if(!date)return state.activities;
  return state.activities.filter(a=>TrackersCore.date(new Date(a.time))===date)
}
function renderNotifications(){
  const list=filteredActivities();
  $("notificationList").innerHTML=list.length
    ? list.map(a=>`<div class="simple-list-item">
        <span class="notification-item-main"><strong>${esc(activityDisplay(a.text))}</strong><span>${new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(a.time))}</span></span>
        <button class="rowbtn" type="button" data-activity-detail="${a.id}">Detail</button>
      </div>`).join("")
    : '<div class="empty"><div><h3>Belum ada aktivitas</h3><p>Tidak ada aktivitas pada filter tanggal ini.</p></div></div>';
  $("notificationList").querySelectorAll("[data-activity-detail]").forEach(btn=>btn.onclick=()=>openActivityDetail(btn.dataset.activityDetail));
}
function hasUnreadNotification(){
  if(!state.activities.length)return false;
  if(!state.lastNotificationSeen)return true;
  return new Date(state.activities[0].time)>new Date(state.lastNotificationSeen)
}
function refreshNotificationState(){
  $("notificationBtn")?.classList.toggle("has-new",hasUnreadNotification())
}
let activeActivityId="";
function openActivityDetail(id){
  const a=state.activities.find(x=>x.id===id);if(!a)return;
  activeActivityId=id;
  $("activityDetailText").textContent=activityDisplay(a.text);
  $("activityDetailTime").textContent=new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeStyle:"short"}).format(new Date(a.time));
  $("activityDetailSite").textContent=a.siteName||"-";
  $("activityGoSite").style.display=a.siteId&&site(a.siteId)?"inline-flex":"none";
  openModal("activityDetailModal")
}


function populateSiteFilters(){
  const regionSel=$("regionalFilter"),tenantSel=$("tenantFilter"),sowSel=$("sowFilter");
  if(!regionSel||!tenantSel||!sowSel)return;
  const current={r:regionSel.value,t:tenantSel.value,s:sowSel.value};
  const regions=[...new Set(state.sites.map(x=>x.region).filter(Boolean))].sort();
  const tenants=[...new Set(state.sites.map(x=>x.tenant).filter(Boolean))].sort();
  const sows=[...new Set(state.sites.map(x=>x.workType).filter(Boolean))].sort();
  regionSel.innerHTML='<option value="">Semua Regional</option>'+regions.map(v=>`<option>${esc(v)}</option>`).join("");
  tenantSel.innerHTML='<option value="">Semua Tenant</option>'+tenants.map(v=>`<option>${esc(v)}</option>`).join("");
  sowSel.innerHTML='<option value="">Semua SOW</option>'+sows.map(v=>`<option>${esc(v)}</option>`).join("");
  if(regions.includes(current.r))regionSel.value=current.r;
  if(tenants.includes(current.t))tenantSel.value=current.t;
  if(sows.includes(current.s))sowSel.value=current.s;
}

function renderSites(){
  populateSiteFilters();
  const q=norm($("siteSearch").value),st=$("statusFilter").value;
  const rf=$("regionalFilter").value,tf=$("tenantFilter").value,sf=$("sowFilter").value;
  const spmkSort=$("spmkSort")?.value||"oldest";

  const archive=$('projectArchiveFilter')?.value||'active';
  const rows=state.sites.filter(s=>
    (archive==='all'||(archive==='archive'?s.archived:!s.archived)) &&
    (!q||[s.siteName,s.projectId,s.siteId,s.clientSiteId,s.region,s.tenant].some(v=>norm(v).includes(q))) &&
    (!st||s.status===st) &&
    (!rf||s.region===rf) &&
    (!tf||s.tenant===tf) &&
    (!sf||s.workType===sf)
  ).sort((a,b)=>{
    const ta=a.spmkDate?new Date(a.spmkDate+"T00:00:00").getTime():NaN;
    const tb=b.spmkDate?new Date(b.spmkDate+"T00:00:00").getTime():NaN;
    const aValid=Number.isFinite(ta),bValid=Number.isFinite(tb);

    // Data tanpa Tanggal SPMK tetap diletakkan di bagian bawah.
    if(!aValid&&!bValid)return String(a.siteName||"").localeCompare(String(b.siteName||""),"id");
    if(!aValid)return 1;
    if(!bValid)return -1;

    const diff=spmkSort==="newest"?tb-ta:ta-tb;
    return diff||String(a.siteName||"").localeCompare(String(b.siteName||""),"id")
  });

  const siteEmpty=$("siteEmpty");
  if(siteEmpty){
    siteEmpty.classList.toggle("hidden",rows.length>0);
    siteEmpty.style.display=rows.length?"none":"grid";
  }
  $("siteRows").innerHTML=rows.map(s=>`<tr data-open="${esc(s.id)}" tabindex="0" role="button" aria-label="Buka ${esc(s.siteName)}">
      <td><span class="site-name-link">${esc(s.siteName)}</span></td>
      <td>${esc(s.projectId)}</td>
      <td>${esc(s.siteId)}</td>
      <td>${esc(s.tenant||"-")}</td>
      <td>${s.towerHeight?esc(String(s.towerHeight))+" m":"-"}</td>
      <td>${esc(s.region)}</td><td>${esc(s.workType)}</td><td><span class="badge ${deadline(s).cls}">${esc(s.status)}${s.archived?" · Arsip":""}</span></td>
    </tr>`).join("");

  $("siteRows").querySelectorAll("[data-open]").forEach(b=>{b.onclick=()=>openDetail(b.dataset.open);b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openDetail(b.dataset.open);}};});
  if($('siteResultCount'))$('siteResultCount').textContent=rows.length+' site';
  if(siteEmpty){siteEmpty.querySelector('h3').textContent=state.sites.length?'Tidak ada site sesuai filter':'Projects masih kosong';siteEmpty.querySelector('p').textContent=state.sites.length?'Ubah pencarian atau filter arsip.':'Tambahkan site pertama untuk mulai bekerja.';}
}

function populateReportFilters(){
  const defs=[
    ["reportRegional","Semua Regional",[...new Set(state.sites.map(s=>s.region).filter(Boolean))].sort()],
    ["reportTenant","Semua Tenant",[...new Set(state.sites.map(s=>s.tenant).filter(Boolean))].sort()],
    ["reportSow","Semua SOW",[...new Set(state.sites.map(s=>s.workType).filter(Boolean))].sort()]
  ];
  defs.forEach(([id,label,items])=>{
    const el=$(id); if(!el)return; const cur=el.value;
    el.innerHTML=`<option value="">${label}</option>`+items.map(v=>`<option>${esc(v)}</option>`).join("");
    if(items.includes(cur))el.value=cur;
  })
}
function reportBaseSites(){
  const r=$("reportRegional")?.value||"",t=$("reportTenant")?.value||"",w=$("reportSow")?.value||"",st=$("reportStatus")?.value||"";
  const from=$("reportDateFrom")?.value||"",to=$("reportDateTo")?.value||"";
  return state.sites.filter(s=>{
    if(r&&s.region!==r)return false;if(t&&s.tenant!==t)return false;if(w&&s.workType!==w)return false;if(st&&s.status!==st)return false;
    if(from&&(!s.spmkDate||s.spmkDate<from))return false;if(to&&(!s.spmkDate||s.spmkDate>to))return false;
    return true
  })
}
function breakdownHtml(items,field){
  const map={};items.forEach(s=>{const k=s[field]||"-";map[k]=(map[k]||0)+1});
  return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`<div class="report-break-row"><span>${esc(k)}</span><strong>${n}</strong></div>`).join("")||'<div class="muted">Belum ada data</div>'
}
function renderReporting(){
  populateReportFilters();
  const items=reportBaseSites();
  const completed=items.filter(s=>s.status==="Completed").length;
  const progress=items.filter(s=>s.status==="In Progress").length;
  const due=items.filter(s=>deadline(s).label==="Due Soon").length;
  const overdue=items.filter(s=>deadline(s).label==="Overdue").length;
  $("reportTotal").textContent=items.length;$("reportCompleted").textContent=completed;$("reportProgress").textContent=progress;$("reportDue").textContent=due;$("reportOverdue").textContent=overdue;
  $("reportByRegional").innerHTML=breakdownHtml(items,"region");
  $("reportByTenant").innerHTML=breakdownHtml(items,"tenant");
  $("reportBySow").innerHTML=breakdownHtml(items,"workType");
  $("reportRegionalCount").textContent=new Set(items.map(s=>s.region).filter(Boolean)).size+" regional";
  $("reportTenantCount").textContent=new Set(items.map(s=>s.tenant).filter(Boolean)).size+" tenant";
  $("reportSowCount").textContent=new Set(items.map(s=>s.workType).filter(Boolean)).size+" SOW";
  $("reportResultCount").textContent=items.length+" site";
  $("reportRows").innerHTML=items.map(s=>{const d=deadline(s),t=targetOf(s);return`<tr>
    <td><button class="site-name-link" data-report-site="${s.id}" type="button">${esc(s.siteName)}</button></td>
    <td>${esc(s.region||"-")}</td><td>${esc(s.tenant||"-")}</td><td>${esc(s.workType||"-")}</td>
    <td><span class="badge ${d.cls}">${d.label}</span></td>
    <td>${t.date?fmt(t.date):"-"}</td>
  </tr>`}).join("");
  document.querySelectorAll("[data-report-site]").forEach(b=>b.onclick=()=>openDetail(b.dataset.reportSite))
}
function openReportFocus(type){
  let items=reportBaseSites();
  if(type==="completed")items=items.filter(s=>s.status==="Completed");
  if(type==="progress")items=items.filter(s=>s.status==="In Progress");
  if(type==="due")items=items.filter(s=>deadline(s).label==="Due Soon");
  if(type==="overdue")items=items.filter(s=>deadline(s).label==="Overdue");
  const titles={all:"Total Site",completed:"Completed",progress:"In Progress",attention:"Need Attention",due:"Due Soon",overdue:"Overdue"};
  $("summaryModalTitle").textContent=titles[type]||"Site";
  const regions={};items.forEach(s=>{const k=s.region||"Tanpa Regional";regions[k]=(regions[k]||0)+1});
  $("summaryRegional").innerHTML=Object.entries(regions).map(([r,n])=>`<div class="summary-region-card"><span>${esc(r)}</span><strong>${n}</strong></div>`).join("");
  $("summarySiteList").innerHTML=items.length?items.map(s=>{const d=deadline(s);return`<div class="simple-list-item" data-summary-site="${s.id}" style="cursor:pointer"><span><strong>${esc(s.siteName)}</strong><br><span>${esc(s.region)} • ${esc(s.tenant||"-")} • ${esc(s.workType)}</span></span><span class="badge ${d.cls}">${d.label}</span></div>`}).join(""):'<div class="empty"><div><h3>Belum ada data</h3></div></div>';
  $("summarySiteList").querySelectorAll("[data-summary-site]").forEach(el=>el.onclick=()=>{closeModal("summaryModal");openDetail(el.dataset.summarySite)});
  openModal("summaryModal")
}


function bastProcessSiteLabel(s){return `${s.siteName} • ${s.siteId} • ${s.projectId} • ${s.workType}`}
function populateBastSiteOptions(){
  const dl=$("bastSiteOptions");if(!dl)return;
  dl.innerHTML=state.sites.map(s=>`<option value="${esc(bastProcessSiteLabel(s))}">${esc(s.projectId||"")} · ${esc(s.tenant||"")}</option>`).join("")
}
function findSiteFromBastLabel(label){
  const key=norm(label);
  const exact=state.sites.find(s=>norm(bastProcessSiteLabel(s))===key);if(exact)return exact;const matches=state.sites.filter(s=>norm(s.siteName)===key||norm(`${s.siteName} • ${s.siteId}`)===key);return matches.length===1?matches[0]:null
}
function bastProcessProgress(r){return TrackersCore.bastProgress(r)}
function latestBastProcessForSite(siteId){
  return state.bastProcesses
    .filter(r=>r.siteId===siteId)
    .sort((a,b)=>new Date(b.updatedAt||0)-new Date(a.updatedAt||0))[0]||null
}
function syncBastProcessToSite(record){
  const s=site(record.siteId);if(!s)return;
  normalizeSiteModules(s);

  const p=bastProcessProgress(record);
  const doneMap=Object.fromEntries(p.stages.map(x=>[x.name,x.done]));


  // Lima tahap pertama bersumber dari BAST PROSES.
  // GR tetap manual di Document Flow Data Site.
  const oldGR=s.bast.find(x=>x.label==="GR")?.done||false;
  s.bast=BAST.map(label=>({
    label,
    done:label==="GR"?(oldGR&&p.stages.every(x=>x.done)):!!doneMap[label],
    source:label==="GR"?"manual":"bast-process"
  }))
}
function syncSiteBastFromProcess(siteObj){
  if(!siteObj)return;
  const bp=latestBastProcessForSite(siteObj.id);
  if(bp)syncBastProcessToSite(bp)
}
function syncAllBastProcessToSites(){
  state.sites.forEach(syncSiteBastFromProcess)
}

function isHttpLink(v){
  const s=String(v||"").trim();
  return /^https?:\/\/\S+/i.test(s)
}
function bastSiteShareText(record){
  const s=site(record.siteId);
  const blocks=[];
  const add=(label,status,link)=>{
    if(status==="Done")return;
    if(!isHttpLink(link))return;
    blocks.push(`*${label} :*\n${status||"Need Approval PM"}\n${String(link).trim()}`)
  };

  add("BAUT",record.bautProcess,record.bautInput);
  add("BAPWP",record.bapwpProcess,record.bapwpInput);
  add("BAST",record.bastProcess,record.bastInput);

  const head=`*${s?.siteName||"-"}*`;
  return blocks.length
    ? `${head}\n\n${blocks.join("\n\n")}`
    : `${head}\n\nTidak ada dokumen pending dengan link tersedia.`
}
function openBastSiteShare(id){
  const r=state.bastProcesses.find(x=>x.id===id);if(!r)return;
  $("bastSiteShareText").value=bastSiteShareText(r);
  openModal("bastSiteShareModal")
}

function renderBastProcesses(){
  populateBastSiteOptions();
  const q=norm($("bastProcessSearch")?.value),filter=$("bastProcessStatusFilter")?.value||"";
  const areaSel=$("bastProcessAreaFilter");
  if(areaSel){
    const cur=areaSel.value;
    const areas=[...new Set(state.sites.map(s=>String(s.region||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"id"));
    areaSel.innerHTML='<option value="">Semua Area</option>'+areas.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");
    if(areas.includes(cur))areaSel.value=cur;
  }
  const area=areaSel?.value||"";
  const archiveFilter=$("bastProcessArchiveFilter")?.value||"active";
  const rows=state.bastProcesses.filter(r=>{
    const s=site(r.siteId);if(!s)return false;
    const p=bastProcessProgress(r);
    const archived=p.archived||r.archived===true;
    const match=!q||[s.siteName,s.siteId,s.clientSiteId,s.projectId,r.taskId].some(v=>norm(v).includes(q));
    const areaMatch=!area||s.region===area;
    const processMatch=!filter||p.stages.some(x=>x.state===filter);
    const archiveMatch=archiveFilter==="all"
        ? true
        : archiveFilter==="archive"
          ? archived
          : !archived;
    return match&&areaMatch&&processMatch&&archiveMatch
  });
  $("bastProcessEmpty").style.display=rows.length?"none":"grid";
  $("bastProcessGrid").innerHTML=rows.map(r=>{
    const s=site(r.siteId),p=bastProcessProgress(r),archived=p.archived||r.archived===true;
    return `<div class="bast-process-card ${archived?"archived":""}">
      <div class="bast-process-head">
        <div>
  <div class="bast-region-top">${esc(s?.region||"-")}</div>
  <h3>${esc(s?.siteName||"-")}</h3>
  <p>${esc(s?.projectId||"-")} · ${esc(s?.siteId||"-")}</p>
</div>
        ${archived?'<span class="archive-label">ARSIP</span>':`<span class="badge progress">${p.pct}%</span>`}
      </div>
      <div class="bast-task">TASK ID · <b>${esc(r.taskId||"-")}</b></div>
      <div class="bast-stage-list">
        ${p.stages.map(x=>`<div class="bast-stage-row"><span class="bast-stage-name">${x.name}</span><span class="bast-stage-state">${esc(x.state)}</span><span class="bast-stage-done">${x.done?uiIcon('check'):'—'}</span></div>`).join("")}
      </div>
      <div class="bast-card-actions">
        <button class="btn light small" type="button" data-bp-share="${r.id}">Share</button>
        <button class="btn light small" type="button" data-bp-site="${r.siteId}">Buka Site</button>
        <button class="btn dark small" type="button" data-bp-edit="${r.id}">Edit</button>
      </div>
    </div>`
  }).join("");
  document.querySelectorAll("[data-bp-edit]").forEach(b=>b.onclick=()=>openBastProcessModal(b.dataset.bpEdit));
  document.querySelectorAll("[data-bp-site]").forEach(b=>b.onclick=()=>openDetail(b.dataset.bpSite));
  document.querySelectorAll("[data-bp-share]").forEach(b=>b.onclick=()=>openBastSiteShare(b.dataset.bpShare))
}
function openBastProcessModal(id=null){
  populateBastSiteOptions();
  const f=$("bastProcessForm");f.reset();f.recordId.value="";
  $("bastProcessModalTitle").textContent=id?"Edit BAST PROSES":"New BAST PROSES";
  if(id){
    const r=state.bastProcesses.find(x=>x.id===id);if(!r)return;
    const s=site(r.siteId);
    f.recordId.value=r.id;f.siteSearch.value=s?bastProcessSiteLabel(s):"";
    f.taskId.value=r.taskId||"";f.poLink.value=r.poLink||"";f.poNumber.value=r.poNumber||"";f.poDate.value=r.poDate||"";
    f.boqLink.value=r.boqLink||"";f.bautInput.value=r.bautInput||"";f.bautProcess.value=r.bautProcess||"Need Approval PM";
    f.bapwpInput.value=r.bapwpInput||"";f.bapwpProcess.value=r.bapwpProcess||"Need Approval PM";
    f.bastInput.value=r.bastInput||"";f.bastProcess.value=r.bastProcess||"Need Approval PM"
  }
  openModal("bastProcessModal")
}

function renderSettings(){
  $("clientSettingSubtitle").textContent=`${state.clients.length} client tersimpan`;
  $("tenantSettingSubtitle").textContent=`${state.tenants.length} tenant tersimpan`;
  $("targetSettingSubtitle").textContent=`${state.rules.length} aturan target`;
  const t=THEMES[state.theme]||THEMES.default;
  $("themeSettingSubtitle").textContent=t.name;
  $("themeDot1").style.background=t.tone1;$("themeDot2").style.background=t.tone2;
    renderThemeChoices();renderClientSettingsList();renderTenantSettingsList();renderTargetSettingsList()
}
function populateClient(){
  const sel=$("clientSelect"),cur=sel.value;sel.innerHTML='<option value="">Pilih Client</option>'+state.clients.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join("");if([...sel.options].some(o=>o.value===cur))sel.value=cur
}
function renderLists(){}
function updatePreview(){
  const f=$("siteForm");
  const region=resolvedSelectValue($("siteRegionPreset"),$("siteRegionCustom"));
  const work=resolvedSelectValue($("siteWorkPreset"),$("siteWorkCustom"));
  const r=ruleFor(region,work);
  if(!r){ f.targetPreview.value="Belum ada target"; return; }
  if(norm(work)==="sacme"){
    const d=f.spmkDate.value;
    const parts=[
      `SITAC ${r.sitacDays||0}h${d&&r.sitacDays?" ("+fmt(addDays(d,r.sitacDays))+")":""}`,
      `IMB ${r.imbDays||0}h${d&&r.imbDays?" ("+fmt(addDays(d,r.imbDays))+")":""}`,
      `CME ${r.cmeDays||0}h${d&&r.cmeDays?" ("+fmt(addDays(d,r.cmeDays))+")":""}`
    ];
    f.targetPreview.value=parts.join(" • ");
    return;
  }
  f.targetPreview.value=f.spmkDate.value?`${r.days} hari • ${fmt(addDays(f.spmkDate.value,r.days))}`:`${r.days} hari • isi tanggal SPMK`
}
function openSiteModal(id=null){
  const f=$("siteForm");f.reset();populateClient();populateTenant();$("siteRegionCustom").classList.add("hidden");$("siteRegionCustom").required=false;$("siteWorkCustom").classList.add("hidden");$("siteWorkCustom").required=false;$("siteModalTitle").textContent=id?"Edit Site":"New Site";f.recordId.value="";
  if(id){const s=site(id);if(!s)return;if(s.tenant&&!state.tenants.includes(s.tenant)){state.tenants.push(s.tenant);populateTenant();}if(!state.clients.some(c=>norm(c.name)===norm(s.client))&&s.client){state.clients.push({id:uid("c"),name:s.client});save();populateClient()}f.recordId.value=s.id;f.client.value=s.client;f.tenant.value=s.tenant||"";f.projectId.value=s.projectId;f.siteName.value=s.siteName;f.siteId.value=s.siteId;f.clientSiteId.value=s.clientSiteId||"";f.towerHeight.value=s.towerHeight||"";
setPresetAndCustom($("siteRegionPreset"),$("siteRegionCustom"),s.region,["Sumbagsel","Jawa Tengah","Jawa Timur"]);
setPresetAndCustom($("siteWorkPreset"),$("siteWorkCustom"),s.workType,["SACME","COLLOCATION","PERKUATAN"]);
f.spmkNo.value=s.spmkNo||"";f.spmkDate.value=s.spmkDate||"";f.coordinate.value=s.coordinate||"";f.address.value=s.address||"";f.status.value=s.status||"Pending"}
  updatePreview();openModal("siteModal")
}
function openDetail(id){currentSite=id;route("detail")}
function renderDetail(){
  const s=normalizeSiteModules(site(currentSite));if(!s)return route("sites");syncSiteBastFromProcess(s);const t=targetOf(s),d=deadline(s);
  $("pinSite").classList.toggle("active",state.pinned.includes(s.id));$("pinSite").innerHTML=uiIcon("keep")+(state.pinned.includes(s.id)?" Pinned":" Pin");$("dProject").textContent=s.projectId;$("dName").textContent=s.siteName;$("dId").textContent=s.siteId;$("dClient").textContent=s.client||"-";$("dClientSiteId").textContent=s.clientSiteId||"-";$("dTenant").textContent=s.tenant||"-";$("dTowerHeight").textContent=s.towerHeight?`${s.towerHeight} m`:"-";$("dRegion").textContent=s.region||"-";$("dWork").textContent=s.workType||"-";$("dSpmk").textContent=s.spmkNo||"-";$("dDate").textContent=fmt(s.spmkDate);$("dTarget").textContent=t.sacme
    ? `SITAC ${t.sacme.sitacDays}h${t.sacme.sitacDate?" ("+fmt(t.sacme.sitacDate)+")":""} • IMB ${t.sacme.imbDays}h${t.sacme.imbDate?" ("+fmt(t.sacme.imbDate)+")":""} • CME ${t.sacme.cmeDays}h${t.sacme.cmeDate?" ("+fmt(t.sacme.cmeDate)+")":""}`
    : (t.date?fmt(t.date)+" • "+t.days+" hari":"Belum diatur");$("dCoord").textContent=s.coordinate||"-";$("dAddress").textContent=s.address||"-";$("dBadge").className="badge "+d.cls;$("dBadge").textContent=d.label;
  const p=s.pln||{};$("plnSub").textContent=p.status&&p.status!=="Belum"?p.status+(p.power?" • "+p.power:""):"Belum ada data";
  const ofs=onefluxSummaryLocal(s);$("onefluxSub").textContent=ofs.total?`${ofs.pct}% • ${ofs.state} • ${ofs.ok}/${ofs.total} OK`:"Checklist belum tersedia";
  const ba=Array.isArray(s.bast)?s.bast:BAST.map(label=>({label,done:false})),bd=ba.filter(x=>x.done).length;$("bastSub").textContent=`${Math.round(bd/6*100)}% • ${bd}/6 selesai`;
  $("financeSub").textContent=financeSummaryText(s);$("pkbonSiteSub").textContent=pkbonSiteSummaryText(s);
  if(typeof renderDetailExtras==="function")renderDetailExtras(s);
}
async function shareText(title,text){
  try{
    if(navigator.share){await navigator.share({title,text});return true}
  }catch(err){if(err?.name==="AbortError")return false}
  try{
    if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);toast("Data disalin");return true}
  }catch(_){}
  return false
}
let shareSiteMode="default";
function refreshShareSiteText(){
  const s=site(currentSite);if(!s)return;
  $("shareSiteText").value=siteText(s,shareSiteMode);
  $("shareModeDefault").classList.toggle("active",shareSiteMode==="default");
  $("shareModeHide").classList.toggle("active",shareSiteMode==="hide");
  $("shareModeNote").textContent=shareSiteMode==="hide"
    ?"Hide hanya menyalin data utama: Project ID, Site Name, Site ID, Koordinat, Alamat, dan Link Google Maps."
    :"Default menyalin seluruh data site."
}
function openShareSite(){
  const s=site(currentSite);if(!s)return;
  shareSiteMode="default";
  refreshShareSiteText();
  openModal("shareSiteModal")
}
function copyTextFallback(text){
  const ta=document.createElement("textarea");ta.value=text;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();
  let ok=false;try{ok=document.execCommand("copy")}catch(_){}
  ta.remove();return ok
}
function googleMapsLink(coord){
  const c=String(coord||"").trim();
  if(!c)return "-";
  return "https://www.google.com/maps?q="+encodeURIComponent(c)
}
function fieldBlock(label,value){return `${label} :\n${value||"-"}`}
function siteText(s,mode="default"){
  const t=targetOf(s);
  const maps=googleMapsLink(s.coordinate);

  if(mode==="hide"){
    return [
      fieldBlock("PROJECT ID",s.projectId),
      fieldBlock("Site Name",s.siteName),
      fieldBlock("Site ID",s.siteId),
      fieldBlock("Site ID Client",s.clientSiteId),
      fieldBlock("Tinggi Tower",s.towerHeight?`${s.towerHeight} m`:"-"),
      fieldBlock("Koordinat",s.coordinate),
      fieldBlock("Alamat",s.address),
      fieldBlock("Link Google Maps",maps)
    ].join("\n\n")
  }

  return [
    fieldBlock("PROJECT ID",s.projectId),
    fieldBlock("Site Name",s.siteName),
    fieldBlock("Site ID",s.siteId),
    fieldBlock("Site ID Client",s.clientSiteId),
    fieldBlock("Client",s.client),
    fieldBlock("Tenant",s.tenant),
    fieldBlock("Tinggi Tower",s.towerHeight?`${s.towerHeight} m`:"-"),
    fieldBlock("Regional",s.region),
    fieldBlock("SOW",s.workType),
    fieldBlock("No. SPMK",s.spmkNo),
    fieldBlock("Tanggal SPMK",fmt(s.spmkDate)),
    fieldBlock("Target",t.sacme
      ? `SITAC ${t.sacme.sitacDays} Hari\nIMB ${t.sacme.imbDays} Hari\nCME ${t.sacme.cmeDays} Hari`
      : (t.date?fmt(t.date):"-")),
    fieldBlock("Koordinat",s.coordinate),
    fieldBlock("Alamat",s.address),
    fieldBlock("Link Google Maps",maps)
  ].join("\n\n")
}
function openPln(){
  const s=site(currentSite);if(!s)return;
  const f=$("plnForm"),p=(s.pln&&typeof s.pln==="object"&&!Array.isArray(s.pln))?s.pln:{};
  f.reset();
  f.status.value=p.status||"Belum";
  f.power.value=p.power||"";
  f.customerId.value=p.customerId||"";
  f.rfi.checked=!!p.rfi;
  f.ho.checked=!!p.ho;
  f.completeness.checked=!!p.completeness;
  f.notes.value=p.notes||"";
  openModal("plnModal")
}



function pkbonHistoryAll(){
  if(Array.isArray(pkbonHistoryCache))return pkbonHistoryCache;
  try{
    const v=TrackersCore.decodeStored(localStorage.getItem("pkbon_history")||"[]");
    return Array.isArray(v)?v:[]
  }catch{return []}
}
function pkbonForSite(s){
  return pkbonHistoryAll().filter(d=>TrackersCore.belongs(d,s,state.sites)).sort((a,b)=>String(b.savedAt||b.tanggal||'').localeCompare(String(a.savedAt||a.tanggal||'')));
}
function pkbonSiteStats(s){
  const rows=pkbonForSite(s);
  const paidStatuses=["terbayar","selesai"];
  const paid=rows.filter(d=>paidStatuses.includes(norm(d.status)));
  const outstanding=rows.filter(d=>!paidStatuses.includes(norm(d.status)));
  const sum=a=>a.reduce((x,d)=>x+(Number(d.total)||0),0);
  return {rows,total:sum(rows),paid:sum(paid),outstanding:sum(outstanding),paidCount:paid.length,outstandingCount:outstanding.length}
}
function pkbonSiteSummaryText(s){
  const x=pkbonSiteStats(s);
  if(!x.rows.length)return "Belum ada PKBON";
  return `${x.rows.length} PKBON • Outstanding ${rupiah(x.outstanding)}`
}
function ensurePkbonAndSend(message){
  route("pkbon");
  queuePkbonCommand(message)
}
function newPkbonFromSite(){
  const s=site(currentSite);if(!s)return;
  closeModal("pkbonSiteModal");
  ensurePkbonAndSend({type:"TRACKLY_NEW_PKBON",siteName:s.siteName,projectId:s.projectId,workspaceSiteId:s.id})
}
function openPkbonDocFromSite(id){
  closeModal("pkbonSiteModal");
  ensurePkbonAndSend({type:"TRACKLY_OPEN_PKBON",id})
}
function renderPkbonSiteModal(){
  const s=site(currentSite);if(!s)return;
  const x=pkbonSiteStats(s);
  $("pkbonSiteModalInfo").textContent=`${s.siteName} • ${s.projectId||"-"}`;
  $("pkbonSiteCount").textContent=x.rows.length;
  $("pkbonSiteTotal").textContent=rupiah(x.total);
  $("pkbonSiteOutstandingCount").textContent=x.outstandingCount;
  $("pkbonSiteOutstanding").textContent=rupiah(x.outstanding);
  $("pkbonSitePaidCount").textContent=x.paidCount;
  $("pkbonSitePaid").textContent=rupiah(x.paid);

  $("pkbonSiteHistory").innerHTML=x.rows.length?x.rows.map(d=>`
    <div class="pkbon-site-row">
      <div>
        <h4>${esc(d.pkbonNo||"(tanpa nomor)")}</h4>
        <p>${esc(d.tanggal||"-")} • ${esc(d.status||"Draft")}${d.pekerjaan?" • "+esc(d.pekerjaan):""}</p>
      </div>
      <div class="pkbon-site-row-right">
        <span class="pkbon-site-amount">${rupiah(d.total||0)}</span>
        <button class="btn light small" type="button" data-open-site-pkbon="${esc(String(d.id))}">Buka</button>
      </div>
    </div>`).join("")
    : `<div class="pkbon-empty-site">Belum ada PKBON untuk site ini.</div>`;

  document.querySelectorAll("[data-open-site-pkbon]").forEach(b=>b.onclick=()=>openPkbonDocFromSite(b.dataset.openSitePkbon))
}
function openPkbonSiteModal(){
  renderPkbonSiteModal();
  openModal("pkbonSiteModal")
}

/* =========================================================
   FINANCE / HARGA & PEMBAYARAN
   - Harga SOW: input manual per item.
   - Pengeluaran: otomatis dari PKBON status Terbayar/Selesai.
   - Pembayaran Client: histori nominal per tanggal.
   ========================================================= */
const FINANCE_BASE_SECTIONS={
  SACME:["SITAC","CME","PANEL","PLN"],
  COLLOCATION:["COLLO"],
  COLLO:["COLLO"],
  PERKUATAN:["PERKUATAN"]
};

const FINANCE_PKBON_PAID_STATUSES=["terbayar","selesai"];
const FINANCE_ALIASES={
  SITAC:["sitac"],
  CME:["cme","civil mechanical electrical"],
  PANEL:["panel"],
  PLN:["pln","bpujl","spjbtl","slo"],
  COLLO:["collo","collocation"],
  PERKUATAN:["perkuatan","strengthening"]
};

let financeDraft=[];
let activeFinancePaymentRowId=null;

function financeNum(v){return TrackersCore.money(v)}
function rupiah(v){
  return "Rp"+new Intl.NumberFormat("id-ID",{maximumFractionDigits:0}).format(Number(v)||0)
}
function financeSignedRupiah(v){
  const n=Number(v)||0;
  return (n<0?"−":"")+rupiah(Math.abs(n))
}
function financeToday(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
}
function financeSectionsForSite(s){
  const key=String(s?.workType||"").trim().toUpperCase();
  return [...new Set([...(FINANCE_BASE_SECTIONS[key]||[key||"PEKERJAAN"]),...(s.finance?.rows||[]).map(r=>r.section).filter(Boolean)])]
}
function financeRowId(){
  return "fr_"+Date.now().toString(36)+Math.random().toString(36).slice(2,7)
}
function financePaymentId(){
  return "fp_"+Date.now().toString(36)+Math.random().toString(36).slice(2,7)
}
function financePaymentTotal(row){
  return (Array.isArray(row?.payments)?row.payments:[])
    .reduce((sum,p)=>sum+financeNum(p.amount),0)
}
function financeNormalizePayments(row){
  if(Array.isArray(row?.payments)){
    return row.payments.map(p=>({
      id:p.id||financePaymentId(),
      date:String(p.date||""),
      amount:financeNum(p.amount),
      note:String(p.note||"")
    }))
  }
  // Migrasi data v32-v37 yang masih menyimpan satu nominal pembayaran.
  const legacy=financeNum(row?.payment);
  return legacy?[{
    id:financePaymentId(),
    date:"",
    amount:legacy,
    note:"Data pembayaran lama"
  }]:[]
}
function prepareFinanceDraft(s){
  const saved=Array.isArray(s.finance?.rows)?s.finance.rows:[];
  const sections=financeSectionsForSite(s);
  const existing=[...saved];

  sections.forEach(section=>{
    if(!existing.some(r=>r.type==="main"&&norm(r.section)===norm(section))){
      existing.push({
        id:financeRowId(),section,type:"main",label:section,
        clientPrice:0,payments:[]
      })
    }
  });

  financeDraft=existing
    .filter(r=>r&&typeof r==='object')
    .map(r=>({
      id:r.id||financeRowId(),
      section:r.section,
      type:r.type==="addwork"?"addwork":"main",
      label:r.label||r.section,
      clientPrice:financeNum(r.clientPrice),
      payments:financeNormalizePayments(r)
    }))
}
function financePaidPkbonDocs(s){
  return pkbonForSite(s).filter(d=>FINANCE_PKBON_PAID_STATUSES.includes(norm(d.status)))
}
function financePkbonSearchText(doc){
  const itemText=(Array.isArray(doc.items)?doc.items:[])
    .map(x=>`${x.uraian||""} ${x.keterangan||""}`)
    .join(" ");
  return norm(`${doc.pekerjaan||""} ${doc.keteranganUmum||""} ${itemText}`)
}
function financeAliasesForRow(row){
  if(row.type==="addwork"){
    const label=norm(row.label);
    return label&&label!=="addwork"?[label]:[]
  }
  return (FINANCE_ALIASES[String(row.label||row.section||"").toUpperCase()]||[row.label||row.section])
    .map(norm).filter(Boolean)
}
function financeExpenseAllocation(s,rows=financeDraft){
  const allocation=Object.fromEntries(rows.map(r=>[r.id,0]));
  let unmatched=0;
  const docs=financePaidPkbonDocs(s);

  docs.forEach(doc=>{
    const total=Number(doc.total)||0;
    const text=financePkbonSearchText(doc);
    let winner=null;
    let winnerScore=0;

    rows.forEach(row=>{
      financeAliasesForRow(row).forEach(alias=>{
        if(alias&&text.includes(alias)){
          const addworkBonus=row.type==="addwork"?1000:0;
          const score=addworkBonus+alias.length;
          if(score>winnerScore){winner=row;winnerScore=score}
        }
      })
    });

    if(winner)allocation[winner.id]=(allocation[winner.id]||0)+total;
    else unmatched+=total
  });

  return {
    allocation,
    unmatched,
    total:docs.reduce((sum,d)=>sum+(Number(d.total)||0),0),
    count:docs.length
  }
}
function financeProjectMetrics(s,rows=financeDraft){
  const expense=financeExpenseAllocation(s,rows);
  const client=rows.reduce((sum,r)=>sum+financeNum(r.clientPrice),0);
  const payment=rows.reduce((sum,r)=>sum+financePaymentTotal(r),0);
  return {
    client,
    expense:expense.total,
    payment,
    receivable:client-payment,
    profit:client-expense.total,
    cashflow:payment-expense.total,
    allocation:expense.allocation,
    unmatched:expense.unmatched,
    pkbonCount:expense.count
  }
}
function moneyInputValue(v){
  return v?new Intl.NumberFormat("id-ID").format(financeNum(v)):""
}
function financeResultClass(value){
  return Number(value)<0?"finance-negative":"finance-positive"
}
function updateFinanceTotals(){
  const s=site(currentSite);if(!s)return;
  const m=financeProjectMetrics(s);

  $("financeTotalClient").textContent=rupiah(m.client);
  $("financeTotalExpense").textContent=rupiah(m.expense);
  $("financeTotalPayment").textContent=rupiah(m.payment);
  $("financeReceivable").textContent=financeSignedRupiah(m.receivable);
  $("financeProfit").textContent=financeSignedRupiah(m.profit);
  $("financeCashflow").textContent=financeSignedRupiah(m.cashflow);
  $("financeExpenseNote").textContent=`${m.pkbonCount} PKBON Terbayar / Selesai`;

  $("financeProfit").className=financeResultClass(m.profit);
  $("financeCashflow").className=financeResultClass(m.cashflow);

  $("financeUnallocated").textContent=rupiah(m.unmatched);
  $("financeUnallocatedWrap").style.display=m.unmatched>0?"flex":"none"
}
function addFinanceAddwork(section){
  financeDraft.push({
    id:financeRowId(),
    section,
    type:"addwork",
    label:"Addwork",
    clientPrice:0,
    payments:[]
  });
  renderFinance()
}
function financeRowMargin(row,expense){
  return financeNum(row.clientPrice)-financeNum(expense)
}
function renderFinance(){
  const s=site(currentSite);if(!s)return;
  const allocation=financeExpenseAllocation(s).allocation;

  $("financeSiteInfo").textContent=`${s.siteName} • ${s.projectId} • ${s.workType}`;
  $("financeSowTitle").textContent=`${s.workType||"SOW"} • Harga per item`;

  const sections=financeSectionsForSite(s);
  $("financeSections").innerHTML=sections.map(section=>{
    const rows=financeDraft.filter(r=>norm(r.section)===norm(section));
    return `<section class="finance-section">
      <div class="finance-section-head">
        <strong>${esc(section)}</strong>
        <button type="button" class="btn light small" data-fin-add="${esc(section)}">${uiIcon('add')} Addwork</button>
      </div>
      <div class="finance-table-wrap">
        <table class="finance-table finance-table-v38">
          <thead><tr>
            <th>Item</th>
            <th>Harga SOW Client</th>
            <th>Pengeluaran PKBON</th>
            <th>Pembayaran Client</th>
            <th>Untung / Rugi</th>
            <th></th>
          </tr></thead>
          <tbody>
            ${rows.map(r=>{
              const expense=allocation[r.id]||0;
              const payment=financePaymentTotal(r);
              const margin=financeRowMargin(r,expense);
              return `<tr>
                <td data-label="Item">
                  ${r.type==="addwork"
                    ? `<input class="finance-addwork-name" data-fin-label="${r.id}" value="${esc(r.label||"Addwork")}" placeholder="Nama Addwork">`
                    : `<div class="finance-item-name">${esc(r.label||r.section)}<small>Base SOW</small></div>`}
                </td>
                <td data-label="Harga SOW Client">
                  <input class="finance-money" inputmode="numeric" data-fin-price="${r.id}" value="${moneyInputValue(r.clientPrice)}" placeholder="0">
                </td>
                <td data-label="Pengeluaran PKBON">
                  <div class="finance-auto-value"><strong>${rupiah(expense)}</strong><small>Otomatis</small></div>
                </td>
                <td data-label="Pembayaran Client">
                  <button type="button" class="finance-payment-button" data-fin-payment="${r.id}">
                    <strong>${rupiah(payment)}</strong><small>${r.payments.length} pembayaran</small>
                  </button>
                </td>
                <td data-label="Untung / Rugi">
                  <strong class="${financeResultClass(margin)}">${financeSignedRupiah(margin)}</strong>
                </td>
                <td data-label="">${r.type==="addwork"
                  ? `<button type="button" class="finance-remove" data-fin-remove="${r.id}" title="Hapus Addwork">${uiIcon('close')}</button>`
                  : ""}</td>
              </tr>`
            }).join("")}
          </tbody>
        </table>
      </div>
    </section>`
  }).join("");

  document.querySelectorAll("[data-fin-add]").forEach(b=>b.onclick=()=>addFinanceAddwork(b.dataset.finAdd));

  document.querySelectorAll("[data-fin-remove]").forEach(b=>b.onclick=()=>{
    financeDraft=financeDraft.filter(r=>r.id!==b.dataset.finRemove);
    renderFinance()
  });

  document.querySelectorAll("[data-fin-label]").forEach(inp=>inp.onchange=()=>{
    const row=financeDraft.find(x=>x.id===inp.dataset.finLabel);
    if(row)row.label=inp.value;
    updateFinanceTotals()
  });

  document.querySelectorAll("[data-fin-price]").forEach(inp=>inp.oninput=()=>{
    const row=financeDraft.find(x=>x.id===inp.dataset.finPrice);if(!row)return;
    row.clientPrice=TrackersCore.moneyInput(inp);
    updateFinanceTotals()
  });

  document.querySelectorAll("[data-fin-payment]").forEach(b=>b.onclick=()=>{
    openFinancePayment(b.dataset.finPayment)
  });

  updateFinanceTotals()
}
function openFinance(){
  if($("financeBuild"))$("financeBuild").textContent="Input nominal v7.7 • sampai miliaran dan triliunan";
  const s=normalizeSiteModules(site(currentSite));if(!s)return;
  $("financeDueDate").value=s.finance.dueDate||"";
  prepareFinanceDraft(s);
  renderFinance();
  openModal("financeModal")
}
function financeSummaryText(s){
  const rows=Array.isArray(s?.finance?.rows)?s.finance.rows:[];
  const draftRows=rows.map(r=>({
    ...r,
    clientPrice:financeNum(r.clientPrice),
    payments:financeNormalizePayments(r)
  }));
  const m=financeProjectMetrics(s,draftRows);
  if(!m.client&&!m.expense&&!m.payment)return "Belum ada nominal";
  return `SOW ${rupiah(m.client)} • Keluar ${rupiah(m.expense)} • Bayar ${rupiah(m.payment)}`
}

/* ---------- Payment history per finance item ---------- */
function financePaymentRow(){
  return financeDraft.find(r=>r.id===activeFinancePaymentRowId)||null
}
function openFinancePayment(rowId){
  activeFinancePaymentRowId=rowId;
  renderFinancePayment();
  openModal("financePaymentModal")
}
function renderFinancePayment(){
  const row=financePaymentRow();if(!row)return;
  $("financePaymentTitle").textContent=`Pembayaran • ${row.label||row.section}`;
  $("financePaymentSubtitle").textContent=site(currentSite)?.siteName||"-";
  $("financePaymentTotal").textContent=rupiah(financePaymentTotal(row));

  $("financePaymentRows").innerHTML=row.payments.length
    ? row.payments.map(p=>`<div class="finance-payment-row">
        <label class="field">
          <span>Tanggal</span>
          <input type="date" data-fin-pay-date="${p.id}" value="${esc(p.date||"")}">
        </label>
        <label class="field">
          <span>Nominal</span>
          <input inputmode="numeric" data-fin-pay-amount="${p.id}" value="${moneyInputValue(p.amount)}" placeholder="0">
        </label>
        <label class="field finance-payment-note">
          <span>Keterangan</span>
          <input data-fin-pay-note="${p.id}" value="${esc(p.note||"")}" placeholder="Opsional">
        </label>
        <button type="button" class="finance-remove finance-payment-delete" aria-label="Hapus pembayaran" data-fin-pay-del="${p.id}">${uiIcon('close')}</button>
      </div>`).join("")
    : `<div class="finance-payment-empty">Belum ada pembayaran Client untuk item ini.</div>`;

  document.querySelectorAll("[data-fin-pay-date]").forEach(inp=>inp.onchange=()=>{
    const p=row.payments.find(x=>x.id===inp.dataset.finPayDate);if(p)p.date=inp.value
  });
  document.querySelectorAll("[data-fin-pay-amount]").forEach(inp=>inp.oninput=()=>{
    const p=row.payments.find(x=>x.id===inp.dataset.finPayAmount);if(!p)return;
    p.amount=TrackersCore.moneyInput(inp);
    $("financePaymentTotal").textContent=rupiah(financePaymentTotal(row));
    updateFinanceTotals()
  });
  document.querySelectorAll("[data-fin-pay-note]").forEach(inp=>inp.oninput=()=>{
    const p=row.payments.find(x=>x.id===inp.dataset.finPayNote);if(p)p.note=inp.value
  });
  document.querySelectorAll("[data-fin-pay-del]").forEach(b=>b.onclick=()=>{
    row.payments=row.payments.filter(x=>x.id!==b.dataset.finPayDel);
    renderFinancePayment();
    renderFinance()
  })
}
function addFinancePayment(){
  const row=financePaymentRow();if(!row)return;
  row.payments.unshift({
    id:financePaymentId(),
    date:financeToday(),
    amount:0,
    note:""
  });
  renderFinancePayment()
}

function openOneflux(){
  const s=normalizeSiteModules(site(currentSite));if(!s)return;
  const tpl=onefluxItems(s),saved=Array.isArray(s.oneflux)?s.oneflux:[];
  const map=Object.fromEntries(saved.filter(x=>x.code).map(x=>[x.code,x]));
  onefluxDraft=tpl.map(x=>({...x,status:map[x.code]?.status||"Belum",note:map[x.code]?.note||""}));
  renderOneflux();openModal("onefluxModal")
}
function renderOneflux(){
  const s=site(currentSite),tpl=onefluxDraft;
  if(!tpl.length){
    $("onefluxPct").textContent="0% Completed";$("onefluxStateText").textContent="Belum";
    $("onefluxList").innerHTML="";$("onefluxEmpty").style.display="grid";
    $("onefluxEmptyText").textContent="Belum ada checklist untuk SOW ini. Tambahkan item sesuai persyaratan pekerjaan Anda.";
    return
  }
  $("onefluxEmpty").style.display="none";
  const req=onefluxDraft.filter(x=>x.required),ok=req.filter(x=>x.status==="OK").length,nok=req.filter(x=>x.status==="NOK").length;
  const pct=Math.round(ok/Math.max(1,req.length)*100),state=nok?"Complicated":ok===req.length?"Completed":ok>0?"Progress":"Belum";
  $("onefluxPct").textContent=pct+"% Completed";$("onefluxStateText").textContent=state;
  let section="";
  $("onefluxList").innerHTML=onefluxDraft.map((x,i)=>{
    const head=x.section!==section?`<div class="of-section">${esc(x.section)}</div>`:"";section=x.section;
    return `${head}<div class="of-row">
      <div class="of-copy"><strong>${esc(x.requirement||x.code)}${x.required?"":" · Optional"}</strong><small>${esc(x.subject)}</small></div>
      <div class="of-controls"><select data-ofstatus="${i}"><option ${x.status==="Belum"?"selected":""}>Belum</option><option ${x.status==="OK"?"selected":""}>OK</option><option ${x.status==="NOK"?"selected":""}>NOK</option></select><input data-ofnote="${i}" placeholder="Keterangan / issue..." value="${esc(x.note||"")}"></div>
    </div>`
  }).join("");
  $("onefluxList").querySelectorAll("[data-ofstatus]").forEach(el=>el.onchange=()=>{onefluxDraft[+el.dataset.ofstatus].status=el.value;renderOneflux()});
  document.querySelectorAll("[data-ofnote]").forEach(el=>el.oninput=()=>{onefluxDraft[+el.dataset.ofnote].note=el.value});
}
function openBast(){const s=normalizeSiteModules(site(currentSite));if(!s)return;syncSiteBastFromProcess(s);bastDraft=JSON.parse(JSON.stringify(s.bast));renderBast();openModal("bastModal")}
function renderBast(){
  const s=site(currentSite);
  const bp=s?latestBastProcessForSite(s.id):null;
  const d=bastDraft.filter(x=>x.done).length;
  $("bastPct").textContent=Math.round(d/6*100)+"% Completed";

  $("bastList").innerHTML=bastDraft.map((x,i)=>{
    const synced=!!bp&&x.label!=="GR";
    const locked=i>0&&!bastDraft.slice(0,i).every(v=>v.done)&&!x.done;
    const sourceText=synced
      ? (x.done?"Done • Sync BAST PROSES":"Belum • Sync BAST PROSES")
      : (x.done?"Selesai":locked?"Selesaikan tahap sebelumnya":"Siap diproses");

    const button=synced
      ? `<button class="bastbtn ${x.done?"done":""}" type="button" disabled>${x.done?uiIcon('check')+' Done':uiIcon('sync')+' Sync'}</button>`
      : `<button class="bastbtn ${x.done?"done":""}" data-bi="${i}" ${locked?"disabled":""}>${x.done?uiIcon('check')+' Selesai':'Tandai Selesai'}</button>`;

    return `<div class="checkrow">
      <div><h4>${i+1}. ${x.label}</h4><span class="muted">${sourceText}</span></div>
      ${button}
    </div>`
  }).join("");

  document.querySelectorAll("[data-bi]").forEach(b=>b.onclick=()=>{
    const i=+b.dataset.bi;
    TrackersCore.toggleBast(bastDraft,i);
    renderBast()
  })
};


document.querySelectorAll("[data-route]").forEach(b=>b.onclick=()=>route(b.dataset.route));
if($("quickNotesTop"))$("quickNotesTop").onclick=()=>route("notes");
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
document.querySelectorAll(".modalbg").forEach(m=>m.onclick=e=>{if(e.target===m)closeModal(m.id)});

$("addSiteBtn").onclick=()=>openModal("newSiteModal");
$("newSiteSingleBtn").onclick=()=>{closeModal("newSiteModal");openSiteModal()};
$("newSiteBulkBtn").onclick=()=>{closeModal("newSiteModal");openModal("bulkSiteModal")};
$("downloadSiteTemplate").onclick=()=>{downloadSiteImportTemplate();closeModal("bulkSiteModal")};
$("importSiteExcel").onclick=()=>{closeModal("bulkSiteModal");$("siteExcelInput").value="";$("siteExcelInput").click()};
$("siteExcelInput").onchange=e=>handleSiteExcelFile(e.target.files?.[0]);

$("siteSearch").oninput=renderSites;
$("statusFilter").onchange=renderSites;
$("regionalFilter").onchange=renderSites;
$("tenantFilter").onchange=renderSites;
$("sowFilter").onchange=renderSites;
$("spmkSort").onchange=renderSites;

$("siteRegionPreset").onchange=()=>{syncCustomRequired($("siteRegionPreset"),$("siteRegionCustom"));updatePreview()};
$("siteWorkPreset").onchange=()=>{syncCustomRequired($("siteWorkPreset"),$("siteWorkCustom"));updatePreview()};
$("siteRegionCustom").oninput=updatePreview;
$("siteWorkCustom").oninput=updatePreview;
$("siteForm").spmkDate.oninput=updatePreview;

$("siteForm").onsubmit=e=>{
  e.preventDefault();
  const f=e.currentTarget,id=f.recordId.value,old=id?site(id):null;
  const s={
    ...(old||{}),
    id:id||uid("s"),
    client:f.client.value,
    tenant:f.tenant.value,
    projectId:f.projectId.value.trim(),
    siteName:f.siteName.value.trim(),
    siteId:f.siteId.value.trim(),
    clientSiteId:f.clientSiteId.value.trim(),
    towerHeight:f.towerHeight.value.trim(),
    region:resolvedSelectValue($("siteRegionPreset"),$("siteRegionCustom")),
    workType:resolvedSelectValue($("siteWorkPreset"),$("siteWorkCustom")),
    spmkNo:f.spmkNo.value.trim(),
    spmkDate:f.spmkDate.value,
    coordinate:f.coordinate.value.trim(),
    address:f.address.value.trim(),
    status:f.status.value,
    pln:(old?.pln&&typeof old.pln==="object"&&!Array.isArray(old.pln))?old.pln:{},
    oneflux:Array.isArray(old?.oneflux)?old.oneflux:[],
    bast:Array.isArray(old?.bast)?old.bast:BAST.map(label=>({label,done:false})),finance:(old?.finance&&typeof old.finance==="object")?old.finance:{rows:[]}
  };
  if(!s.siteName||!s.projectId||!s.siteId||!s.client||!s.tenant||!s.region||!s.workType)return toast('Lengkapi field wajib.');
  if(state.sites.some(x=>x.id!==s.id&&norm(x.projectId)===norm(s.projectId)&&norm(x.siteId)===norm(s.siteId)&&norm(x.workType)===norm(s.workType)))return toast('Site dengan Project ID, Site ID, dan SOW ini sudah ada.');
  if(old){
    dispatchPkbon({type:'TRACKLY_LINK_SITE',site:old,sites:state.sites});
    state.sites=state.sites.map(x=>x.id===id?s:x);
    activity(s.siteName+" diperbarui",s.id)
  }else{
    state.sites.unshift(s);
    activity(s.siteName+" ditambahkan",s.id)
  }
  syncSiteBastFromProcess(s);
  save();closeModal("siteModal");renderAll();
  toast(old?"Data diperbarui":"Data ditambahkan");
  if(currentSite===s.id)renderDetail()
};

["reportRegional","reportTenant","reportSow","reportStatus","reportDateFrom","reportDateTo"].forEach(id=>$(id).onchange=renderReporting);
$("resetReportFilters").onclick=()=>{
  ["reportRegional","reportTenant","reportSow","reportStatus","reportDateFrom","reportDateTo"].forEach(id=>$(id).value="");
  renderReporting()
};
document.querySelectorAll("[data-report-focus]").forEach(b=>b.onclick=()=>openReportFocus(b.dataset.reportFocus));

$("newBastProcessBtn").onclick=()=>openBastProcessModal();
$("bastProcessSearch").oninput=renderBastProcesses;
$("bastProcessStatusFilter").onchange=renderBastProcesses;
if($("bastProcessAreaFilter"))$("bastProcessAreaFilter").onchange=renderBastProcesses;
$("bastProcessArchiveFilter").onchange=renderBastProcesses;
$("bastProcessForm").onsubmit=e=>{
  e.preventDefault();
  const f=e.currentTarget,s=findSiteFromBastLabel(f.siteSearch.value);
  if(!s)return toast("Pilih Name Site dari daftar");

  const id=f.recordId.value;
  if(!id&&state.bastProcesses.some(r=>r.siteId===s.id))return toast('BAST untuk site ini sudah ada. Gunakan Edit agar data tetap terhubung.');
  for(const k of ['baut','bapwp','bast'])if(f[k+'Process'].value==='Done'&&!f[k+'Input'].value.trim())return toast(k.toUpperCase()+' perlu link, nomor, atau keterangan sebelum Done.');
  const record={
    id:id||uid("bp"),
    siteId:s.id,
    taskId:f.taskId.value.trim(),
    poLink:f.poLink.value.trim(),
    poNumber:f.poNumber.value.trim(),
    poDate:f.poDate.value,
    boqLink:f.boqLink.value.trim(),
    bautInput:f.bautInput.value.trim(),
    bautProcess:f.bautProcess.value,
    bapwpInput:f.bapwpInput.value.trim(),
    bapwpProcess:f.bapwpProcess.value,
    bastInput:f.bastInput.value.trim(),
    bastProcess:f.bastProcess.value,
    updatedAt:new Date().toISOString()
  };
  record.archived=bastProcessProgress(record).archived;

  if(id)state.bastProcesses=state.bastProcesses.map(x=>x.id===id?record:x);
  else state.bastProcesses.unshift(record);

  syncBastProcessToSite(record);
  activity("BAST PROSES "+s.siteName+" diperbarui",s.id);
  save();closeModal("bastProcessModal");renderAll();if(currentSite===s.id)renderDetail();toast("BAST PROSES disimpan")
};


$("copyBastSiteShare").onclick=async()=>{
  const txt=$("bastSiteShareText").value;
  try{await navigator.clipboard.writeText(txt);toast("Data Site dicopy")}
  catch{const t=$("bastSiteShareText");t.select();document.execCommand("copy");toast("Data Site dicopy")}
};
$("whatsappBastSiteShare").onclick=()=>{
  const txt=$("bastSiteShareText").value;
  window.open("https://wa.me/?text="+encodeURIComponent(txt),"_blank")
};



$("newPkbonForSite").onclick=()=>newPkbonFromSite();
$("openPkbonModule").onclick=()=>{closeModal("pkbonSiteModal");route("pkbon")};

$("addFinancePayment").onclick=()=>addFinancePayment();

$("saveFinance").onclick=()=>{
  const s=normalizeSiteModules(site(currentSite));if(!s)return;

  const allocation=financeExpenseAllocation(s).allocation;

  // Addwork kosong tidak disimpan.
  const cleaned=financeDraft.filter(r=>{
    if(r.type!=="addwork")return true;
    return !!norm(r.label)&&norm(r.label)!=="addwork"&&(
      financeNum(r.clientPrice)>0||
      financePaymentTotal(r)>0||
      financeNum(allocation[r.id])>0
    )
  });

  if($("financeDueDate").validity?.badInput||($("financeDueDate").value&&!TrackersCore.date($("financeDueDate").value)))return toast("Tanggal jatuh tempo tidak valid.");
  s.finance={
    ...s.finance,dueDate:$("financeDueDate").value,
    rows:cleaned.map(r=>({
      id:r.id,
      section:r.section,
      type:r.type,
      label:r.label,
      clientPrice:financeNum(r.clientPrice),
      payments:(Array.isArray(r.payments)?r.payments:[])
        .filter(p=>financeNum(p.amount)>0||p.date||norm(p.note))
        .map(p=>({
          id:p.id||financePaymentId(),
          date:p.date||"",
          amount:financeNum(p.amount),
          note:String(p.note||"")
        }))
    }))
  };

  activity("Harga & Pembayaran "+s.siteName+" diperbarui",s.id);
  save();
  closeModal("financeModal");
  renderDetail();
  toast("Harga & pembayaran disimpan")
};


$("cloudAccountBtn").onclick=()=>{
  if(!cloudSession){cloudShowAuth(true);return}
  cloudUpdateAccountUI();
  openModal("cloudAccountModal")
};
$("emailLoginForm").onsubmit=async e=>{
  e.preventDefault();
  const email=$("loginEmail").value.trim().toLowerCase();
  const password=$("loginPassword").value;
  setLoginInline("");
  try{
    await emailPasswordLogin(email,password)
  }catch(_){}
};
$("forgotPasswordBtn").onclick=()=>{
  $("forgotEmail").value=$("loginEmail").value.trim();
  openModal("forgotPasswordModal")
};
$("forgotPasswordForm").onsubmit=async e=>{
  e.preventDefault();
  const email=$("forgotEmail").value.trim();
  try{
    await requestPasswordReset(email)
  }catch(_){}
  closeModal("forgotPasswordModal");
  toast("Jika email terdaftar, instruksi reset sudah dikirim")
};
$("resetPasswordForm").onsubmit=async e=>{
  e.preventDefault();
  const p1=$("newPassword").value;
  const p2=$("confirmNewPassword").value;
  if(p1.length<10)return toast("Password minimal 10 karakter");
  if(p1!==p2)return toast("Password tidak sama");
  try{
    await setNewPassword(p1);
    recoveryMode=false;
    closeModal("resetPasswordModal");
    toast("Password berhasil diperbarui");await cloudHandleSession(cloudSession)
  }catch(_){
    toast("Gagal mengganti password")
  }
};
$("accessDeniedSignOut").onclick=()=>cloudSignOut();
$("userAccessSettingRow").onclick=async()=>{
  if(!currentAccessProfile||!isAdminRole(currentAccessProfile.role)){
    toast("Menu ini hanya untuk Owner/Admin");
    return
  }
  openModal("userAccessModal");
  await loadAdminUsers()
};
$("refreshAdminUsers").onclick=()=>loadAdminUsers();

$("cloudSyncNow").onclick=async()=>{
  if(!cloudSession){closeModal("cloudAccountModal");cloudShowAuth(true);return}
  cloudClearConflictDeferred();
  if(cloudConflict){cloudConflictDialog(true);return;}
  await cloudReconcile();
};
$("cloudSignOut").onclick=()=>cloudSignOut();
$("useLocalForCloud").onclick=async()=>{
  if(typeof opsCanEdit==='function'&&!opsCanEdit())return toast('Akun ini hanya dapat menggunakan data cloud.');
  const button=$('useLocalForCloud');button.disabled=true;
  try{const row=await cloudGetRow();cloudBase=row?.updated_at||null;cloudClearConflictDeferred();cloudConflict=false;cloudReady=true;
    const ok=await cloudPush('conflict-use-local');
    if(ok){closeModal('cloudConflictModal');cloudShowAuth(false);}
    else{cloudConflict=true;cloudReady=false;toast('Belum berhasil mengirim data. Data lokal tetap tersimpan.');}
  }catch(err){cloudConflict=true;cloudReady=false;toast('Sinkronisasi gagal: '+err.message);}
  finally{button.disabled=typeof opsCanEdit==='function'&&!opsCanEdit();}
};
$("useCloudForLocal").onclick=async()=>{
  try{const row=await cloudGetRow();if(row)cloudReloadFromSnapshot(row.snapshot,row.updated_at);else toast('Data cloud belum tersedia. Data perangkat tetap disimpan.');}
  catch(err){toast('Gagal mengambil data cloud: '+err.message);}
};

// PKBON is a native Trackly module and saves independently.
// When it changes, queue a cloud snapshot too.

window.addEventListener("storage",e=>{
  if(PKBON_CLOUD_KEYS.includes(e.key))scheduleCloudPush("pkbon-storage")
});

$("themeSettingRow").onclick=()=>openModal("themeModal");
$("clientSettingRow").onclick=()=>{renderClientSettingsList();openModal("clientSettingsModal")};

$("tenantSettingRow").onclick=()=>{renderTenantSettingsList();openModal("tenantSettingsModal")};
$("addTenantFromSettings").onclick=()=>{$("tenantForm").reset();openModal("tenantModal")};
$("tenantForm").onsubmit=e=>{e.preventDefault();const n=e.currentTarget.name.value.trim();if(!n)return;if(state.tenants.some(t=>norm(t)===norm(n)))return toast("Tenant sudah ada");state.tenants.push(n);activity("Tenant "+n+" ditambahkan");save();closeModal("tenantModal");renderAll();renderTenantSettingsList();toast("Tenant ditambahkan")};

$("targetSettingRow").onclick=()=>{renderTargetSettingsList();openModal("targetSettingsModal")};

function emptyWorkspaceStatePreservingTheme(){
  return{
    sites:[],clients:[],rules:[],activities:[],
    theme:THEMES[state.theme]?state.theme:"default",
    pinned:[],tenants:[],lastNotificationSeen:"",bastProcesses:[],notes:[]
  }
}

async function resetAllWorkspaceData(){
  const input=$("resetAllDataConfirmText");
  const button=$("confirmResetAllData");
  if(!input||input.value.trim().toUpperCase()!=="RESET"){
    toast('Ketik RESET untuk melanjutkan');
    input?.focus();
    return
  }
  clearTimeout(cloudPushTimer);
  const blank=emptyWorkspaceStatePreservingTheme();
  const now=new Date().toISOString();
  button.disabled=true;
  button.textContent='Mereset...';
  try{
    // Cloud first. If this fails, do not destroy the local copy.
    if(typeof cloudClient!=="undefined"&&cloudClient&&typeof cloudSession!=="undefined"&&cloudSession?.user){
      const payload={
        user_id:cloudSession.user.id,
        snapshot:{version:44,trackly:blank,pkbon:{},saved_at:now},
        updated_at:now
      };
      const {data,error}=await cloudClient.rpc('trackers_save_state',{new_snapshot:payload.snapshot,expected_updated_at:cloudBase});
      if(error)throw error;if(!data?.ok)throw new Error('Cloud berubah. Sinkronkan dahulu.');
      cloudBase=data.updated_at;localStorage.setItem(CLOUD_BASE_KEY,cloudBase);localStorage.removeItem(CLOUD_DIRTY_KEY);
    }

    state=blank;
    localStorage.setItem(KEY,TrackersCore.encodeStored(state));
    [
      'pkbon_history','pkbon_settings','pkbon_sites','pkbon_banks',
      'pkbon_templates','pkbon_officers'
    ].forEach(k=>localStorage.removeItem(k));
    if(typeof CLOUD_LOCAL_UPDATED_KEY!=="undefined")localStorage.setItem(CLOUD_LOCAL_UPDATED_KEY,now);
    if(typeof cloudSession!=="undefined"&&cloudSession?.user&&typeof CLOUD_SYNCED_USER_KEY!=="undefined"){
      localStorage.setItem(CLOUD_SYNCED_USER_KEY,cloudIdentity())
    }
    closeModal('resetAllDataModal');
    location.reload();
  }catch(err){
    console.error('Reset all data failed',err);
    button.disabled=false;
    button.textContent='Reset Semua Data';
    alert('Reset dibatalkan karena data cloud gagal dikosongkan. Periksa koneksi internet lalu coba lagi. Data lokal belum dihapus.');
  }
}

$("resetAllDataSettingRow").onclick=()=>{
  $("resetAllDataConfirmText").value='';
  $("confirmResetAllData").disabled=false;
  $("confirmResetAllData").textContent='Reset Semua Data';
  openModal('resetAllDataModal')
};
$("confirmResetAllData").onclick=resetAllWorkspaceData;
$("addClientFromSettings").onclick=()=>{$("clientForm").reset();openModal("clientModal")};
$("addRuleFromSettings").onclick=()=>{$("ruleForm").reset();$("ruleRegionCustom").classList.add("hidden");$("ruleWorkCustom").classList.add("hidden");syncRuleFormMode();openModal("ruleModal")};

$("clientForm").onsubmit=e=>{e.preventDefault();const n=e.currentTarget.name.value.trim();if(state.clients.some(c=>norm(c.name)===norm(n)))return toast("Client sudah ada");state.clients.push({id:uid("c"),name:n});activity("Client "+n+" ditambahkan");save();closeModal("clientModal");renderAll();renderClientSettingsList();toast("Client ditambahkan")};
function syncRuleFormMode(){
  const regionCustom=$("ruleRegionCustom"), workCustom=$("ruleWorkCustom");
  syncCustomRequired($("ruleRegionPreset"),regionCustom);
  syncCustomRequired($("ruleWorkPreset"),workCustom);
  const isSacme=norm(resolvedSelectValue($("ruleWorkPreset"),workCustom))==="sacme";
  $("singleTargetWrap").classList.toggle("hidden",isSacme);
  $("sacmeTargetWrap").classList.toggle("hidden",!isSacme);
  $("ruleForm").days.required=!isSacme;
  $("ruleForm").sitacDays.required=isSacme;
  $("ruleForm").imbDays.required=isSacme;
  $("ruleForm").cmeDays.required=isSacme;
}
$("ruleRegionPreset").onchange=syncRuleFormMode;
$("ruleWorkPreset").onchange=syncRuleFormMode;
$("ruleRegionCustom").oninput=syncRuleFormMode;
$("ruleWorkCustom").oninput=syncRuleFormMode;
$("ruleForm").onsubmit=e=>{
  e.preventDefault();
  const f=e.currentTarget;
  const region=resolvedSelectValue($("ruleRegionPreset"),$("ruleRegionCustom"));
  const workType=resolvedSelectValue($("ruleWorkPreset"),$("ruleWorkCustom"));
  if(!region||!workType) return toast("Regional dan SOW wajib dipilih");
  const existing=ruleFor(region,workType);
  const isSacme=norm(workType)==="sacme";
  const data={
    id:existing?.id||uid("r"),
    region,
    workType,
    days:isSacme?0:Number(f.days.value||0),
    sitacDays:isSacme?Number(f.sitacDays.value||0):0,
    imbDays:isSacme?Number(f.imbDays.value||0):0,
    cmeDays:isSacme?Number(f.cmeDays.value||0):0
  };
  if(isSacme && (!data.sitacDays||!data.imbDays||!data.cmeDays)) return toast("Target SITAC, IMB, dan CME wajib diisi");
  if(!isSacme && !data.days) return toast("Target hari wajib diisi");
  if(existing) state.rules=state.rules.map(r=>r.id===existing.id?data:r);
  else state.rules.push(data);
  activity("Pengaturan target "+region+" - "+workType+" diperbarui");
  save();closeModal("ruleModal");renderAll();renderTargetSettingsList();toast("Target disimpan")
};



$("newNoteBtn").onclick=()=>openNoteModal();
$("quickNewNoteBtn").onclick=()=>openNoteModal();
$("noteForm").onsubmit=saveNoteFromForm;
$("noteSearchInput").oninput=renderNotes;
$("notesActiveMode").onclick=()=>{noteViewMode="active";renderNotes()};
$("notesArchiveMode").onclick=()=>{noteViewMode="archive";renderNotes()};
document.querySelectorAll("[data-note-color]").forEach(b=>b.onclick=()=>selectNoteColor(b.dataset.noteColor));

if($("notificationBtn"))$("notificationBtn").onclick=()=>{
  state.lastNotificationSeen=new Date().toISOString();if(typeof opsCanEdit!=="function"||opsCanEdit())save();refreshNotificationState();renderNotifications();openModal("notificationModal")
};
$("notificationDateFilter").onchange=renderNotifications;
$("clearNotificationDate").onclick=()=>{$("notificationDateFilter").value="";renderNotifications()};
$("activityGoSite").onclick=()=>{const a=state.activities.find(x=>x.id===activeActivityId);if(a?.siteId&&site(a.siteId)){closeModal("activityDetailModal");closeModal("notificationModal");openDetail(a.siteId)}};
document.querySelectorAll("[data-summary]").forEach(b=>b.onclick=()=>openSummary(b.dataset.summary));
$("pinSite").onclick=()=>{
  const s=site(currentSite);if(!s)return;
  if(state.pinned.includes(s.id)){state.pinned=state.pinned.filter(id=>id!==s.id);activity("Pin dilepas dari "+s.siteName,s.id)}
  else{state.pinned.push(s.id);activity(s.siteName+" di-Pin",s.id)}
  save();renderDetail();renderDashboard();toast(state.pinned.includes(s.id)?"Site di-Pin":"Pin dilepas")
};

$("backSites").onclick=()=>route("sites");$("editSite").onclick=()=>openSiteModal(currentSite);$("shareSite").onclick=openShareSite;


$("shareModeDefault").onclick=()=>{shareSiteMode="default";refreshShareSiteText()};
$("shareModeHide").onclick=()=>{shareSiteMode="hide";refreshShareSiteText()};

$("copyShareSite").onclick=async()=>{const text=$("shareSiteText").value;let ok=false;try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);ok=true}}catch(_){}if(!ok)ok=copyTextFallback(text);toast(ok?"Data Site disalin":"Tidak bisa menyalin otomatis")};
$("whatsappShareSite").onclick=()=>{const text=$("shareSiteText").value;window.open("https://wa.me/?text="+encodeURIComponent(text),"_blank","noopener,noreferrer")};
$("nativeShareSite").onclick=async()=>{const s=site(currentSite);const ok=await shareText(s?.siteName||"Data Site",$("shareSiteText").value);if(!ok)toast("Gunakan Copy atau WhatsApp")};

$("mapsBtn").onclick=()=>{const s=site(currentSite);if(!s.coordinate)return toast("Koordinat belum diisi");window.open("https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(s.coordinate),"_blank")};
$("plnCard").onclick=()=>openPln();$("onefluxCard").onclick=()=>openOneflux();$("bastCard").onclick=()=>openBast();$("financeCard").onclick=()=>openFinance();$("pkbonSiteCard").onclick=()=>openPkbonSiteModal();
$("plnForm").onsubmit=e=>{e.preventDefault();const s=normalizeSiteModules(site(currentSite)),f=e.currentTarget;if(!s)return;s.pln={status:f.status.value,power:f.power.value,customerId:f.customerId.value.trim(),rfi:f.rfi.checked,ho:f.ho.checked,completeness:f.completeness.checked,notes:f.notes.value.trim()};activity("PLN "+s.siteName+" diperbarui",s.id);save();closeModal("plnModal");renderDetail();renderDashboard();toast("PLN disimpan")};
$("sharePln").onclick=()=>{const s=site(currentSite),f=$("plnForm");shareText("PLN "+s.siteName,[`SITE NAME : ${s.siteName}`,`SITE ID   : ${s.siteId}`,`STATUS PLN: ${f.status.value}`,`DAYA      : ${f.power.value||"-"}`,`ID PLN    : ${f.customerId.value||"-"}`,`RFI       : ${f.rfi.checked?"✓":"-"}`,`HO        : ${f.ho.checked?"✓":"-"}`,`KELENGKAPAN PLN : ${f.completeness.checked?"✓":"-"}`].join("\n"))};
$("saveOneflux").onclick=()=>{const s=normalizeSiteModules(site(currentSite));if(!s)return;s.oneflux=onefluxDraft;activity("Oneflux "+s.siteName+" diperbarui",s.id);save();closeModal("onefluxModal");renderDetail();renderDashboard();toast("Oneflux disimpan")};
$("saveBast").onclick=()=>{
  const s=normalizeSiteModules(site(currentSite));if(!s)return;
  const bp=latestBastProcessForSite(s.id);

  if(bp){
    syncBastProcessToSite(bp);
    const grDraft=bastDraft.find(x=>x.label==="GR");
    const gr=s.bast.find(x=>x.label==="GR");
    if(gr&&grDraft)gr.done=!!grDraft.done;
  }else{
    s.bast=bastDraft
  }

  activity("BAST "+s.siteName+" diperbarui",s.id);
  save();closeModal("bastModal");renderDetail();renderDashboard();renderBastProcesses();toast("BAST disimpan")
};

document.addEventListener("keydown",e=>{if(e.key==="Escape")document.querySelectorAll(".modalbg.open").forEach(m=>closeModal(m.id))});
function startWorkspace(){
  normalizeAllSiteModules();
  applyTheme();renderAll();route('dashboard');cloudInit().catch(err=>{setLoginInline('Aplikasi belum terhubung. '+friendlyAuthError(err),'error');cloudShowAuth(true);});
}
