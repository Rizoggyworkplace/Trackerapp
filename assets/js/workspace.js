/* Workspace presentation and cross-module workflows. */
let taskDraft=[];
let workspaceStale=false;
let lastModalFocus=new Map();
let modalSequence=400;
const lockedModals=new Set(['accessDeniedModal','resetPasswordModal']);
function renderDetailExtras(s){
  $('dProjectInfo').textContent=s.projectId||'—';$('dSiteInfo').textContent=s.siteId||'—';
  const bp=latestBastProcessForSite(s.id);
  $('dTaskId').textContent=bp?.taskId||'—';$('dStatus').textContent=(s.status||'Pending')+(s.archived?' · Arsip':'');
  $('archiveSite').textContent=s.archived?'PULIHKAN':'ARCHIVE';
  const tasks=s.tasks||[],done=tasks.filter(x=>x.status==='Completed').length,active=tasks.filter(x=>x.status==='In Progress').length;
  const pct=tasks.length?Math.round(done/tasks.length*100):(s.status==='Completed'?100:0);
  $('dProgressPct').textContent=pct+'%';$('dProgressFill').style.width=pct+'%';$('dProgressBar').setAttribute('aria-valuenow',pct);
  $('dWorkDone').textContent=done;$('dWorkActive').textContent=active;$('dWorkPending').textContent=tasks.length-done-active;
  $('dProgressNote').textContent=tasks.length?`${done} dari ${tasks.length} pekerjaan selesai.`:s.status==='Completed'?'Project ditandai Completed. Belum ada rincian pekerjaan.':'Tambahkan pekerjaan untuk menghitung progres.';
  $('dTaskPreview').innerHTML=tasks.slice(0,6).map(t=>`<div><div class="task-preview-copy"><strong>${esc(t.title)}</strong>${t.date?`<small>Tanggal: ${esc(fmt(t.date))}</small>`:''}${t.dueDate?`<small>Tenggat: ${esc(fmt(t.dueDate))}</small>`:''}</div><span>${t.status==='Completed'?uiIcon('check')+' Selesai':t.status==='In Progress'?'Proses':'Pending'}</span></div>`).join('');
  const progress=bp?bastProcessProgress(bp):null;
  $('dBastStages').innerHTML=s.bast.map(b=>{const stage=progress?.stages.find(x=>x.name===b.label);return `<div class="bast-stage-row"><span class="bast-stage-name">${esc(b.label)}</span><span class="bast-stage-state">${esc(stage?.state||(b.done?'Done':'Belum'))}</span><span>${b.done?uiIcon('check'):'—'}</span></div>`;}).join('');
  const recent=state.activities.filter(a=>a.siteId===s.id).slice(0,6);
  $('dActivities').innerHTML=recent.length?recent.map(a=>`<div><strong>${esc(a.text)}</strong><small>${esc(new Date(a.time).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'}))}</small></div>`).join(''):'<p class="muted">Belum ada aktivitas untuk site ini.</p>';
}
function renderTasks(){
  $('taskEditor').innerHTML=taskDraft.map((t,i)=>`<div class="task-edit-row"><label class="field task-title-field"><span>Pekerjaan</span><input aria-label="Nama pekerjaan ${i+1}" data-task-title="${i}" value="${esc(t.title)}"/></label><label class="field task-date-field"><span>Tanggal pekerjaan</span><input type="date" aria-label="Tanggal pekerjaan ${i+1}" data-task-date="${i}" value="${esc(t.date||'')}"/></label><label class="field task-date-field"><span>Tenggat</span><input type="date" aria-label="Tenggat pekerjaan ${i+1}" data-task-due="${i}" value="${esc(t.dueDate||'')}"/></label><label class="field task-status-field"><span>Status</span><select aria-label="Status pekerjaan ${i+1}" data-task-status="${i}">${['Pending','In Progress','Completed'].map(st=>`<option ${st===t.status?'selected':''}>${st}</option>`).join('')}</select></label><button class="remove" aria-label="Hapus pekerjaan ${i+1}" data-task-remove="${i}" type="button">${uiIcon('close')}</button></div>`).join('')||'<p class="muted">Tambahkan pekerjaan pertama di bawah.</p>';
  $('taskEditor').querySelectorAll('[data-task-title]').forEach(e=>e.oninput=()=>taskDraft[+e.dataset.taskTitle].title=e.value);
  $('taskEditor').querySelectorAll('[data-task-date]').forEach(e=>{e.oninput=e.onchange=()=>taskDraft[+e.dataset.taskDate].date=e.value;});
  $('taskEditor').querySelectorAll('[data-task-due]').forEach(e=>{e.oninput=e.onchange=()=>taskDraft[+e.dataset.taskDue].dueDate=e.value;});
  $('taskEditor').querySelectorAll('[data-task-status]').forEach(e=>e.onchange=()=>taskDraft[+e.dataset.taskStatus].status=e.value);
  $('taskEditor').querySelectorAll('[data-task-remove]').forEach(e=>e.onclick=()=>{taskDraft.splice(+e.dataset.taskRemove,1);renderTasks();});
}
$('manageTasks').onclick=()=>{taskDraft=JSON.parse(JSON.stringify(site(currentSite)?.tasks||[]));$('newTaskTitle').value='';$('newTaskDate').value='';$('newTaskDueDate').value='';renderTasks();openModal('tasksModal');};
$('addTask').onclick=()=>{
  const title=$('newTaskTitle').value.trim(),date=$('newTaskDate').value,dueDate=$('newTaskDueDate').value;
  if($('newTaskDueDate').validity?.badInput||(dueDate&&!TrackersCore.date(dueDate)))return toast('Tenggat tidak valid.');
  if(!title)return toast('Isi nama pekerjaan.');
  if($('newTaskDate').validity?.badInput||(date&&!TrackersCore.date(date)))return toast('Tanggal pekerjaan tidak valid.');
  taskDraft.push({id:uid('task'),title,dueDate,date:date?TrackersCore.date(date):'',status:'Pending'});
  $('newTaskTitle').value='';$('newTaskDate').value='';$('newTaskDueDate').value='';renderTasks();$('newTaskTitle').focus();
};
for(const id of ['newTaskTitle','newTaskDate','newTaskDueDate'])$(id).onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('addTask').click();}};
$('saveTasks').onclick=()=>{
  const s=site(currentSite);if(!s)return;
  if(taskDraft.some(x=>!x.title.trim()))return toast('Nama pekerjaan tidak boleh kosong.');
  if(taskDraft.some(x=>x.date&&!TrackersCore.date(x.date))||[...$('taskEditor').querySelectorAll('[data-task-date]')].some(e=>e.validity?.badInput))return toast('Tanggal pekerjaan tidak valid.');
  if(taskDraft.some(x=>x.dueDate&&!TrackersCore.date(x.dueDate))||[...$('taskEditor').querySelectorAll('[data-task-due]')].some(e=>e.validity?.badInput))return toast('Tenggat tidak valid.');
  s.tasks=taskDraft.map(x=>({...x,title:x.title.trim(),date:x.date?TrackersCore.date(x.date):''}));
  activity('Progres pekerjaan '+s.siteName+' diperbarui',s.id);save();closeModal('tasksModal');renderDetail();renderDashboard();toast('Pekerjaan disimpan');
};
$('archiveSite').onclick=()=>{const s=site(currentSite);if(!s)return;s.archived=!s.archived;activity(s.siteName+(s.archived?' diarsipkan':' dipulihkan'),s.id);save();renderAll();renderDetail();toast(s.archived?'Site masuk arsip. Pulihkan kapan saja.':'Site dipulihkan.');};
$('editBastFromDetail').onclick=()=>{const bp=latestBastProcessForSite(currentSite);if(bp)openBastProcessModal(bp.id);else openBast();};
$('projectArchiveFilter').onchange=renderSites;
$('clearSiteFilters').onclick=()=>{for(const id of ['siteSearch','globalAppSearch','regionalFilter','tenantFilter','sowFilter','statusFilter'])$(id).value='';$('spmkSort').value='oldest';renderSites();};
$('reportArchive').onchange=renderReporting;
const reportBaseOriginal=reportBaseSites;
reportBaseSites=function(){const mode=$('reportArchive').value;return reportBaseOriginal().filter(s=>mode==='all'||(mode==='archive'?s.archived:!s.archived));};
const resetReportOriginal=$('resetReportFilters').onclick;
$('resetReportFilters').onclick=()=>{$('reportArchive').value='active';resetReportOriginal();};
$('quickAddClient').onclick=()=>{$('clientForm').reset();openModal('clientModal');};
$('quickAddTenant').onclick=()=>{$('tenantForm').reset();openModal('tenantModal');};
for(const [form,select]of [['clientForm','clientSelect'],['tenantForm','tenantSelect']]){
  const original=$(form).onsubmit;$(form).onsubmit=e=>{const value=e.currentTarget.elements.namedItem('name').value.trim();original(e);if(!$(form==='clientForm'?'clientModal':'tenantModal').classList.contains('open'))$(select).value=value;};
}
$('addChecklistItem').onclick=()=>{const title=$('newChecklistTitle').value.trim();if(!title)return toast('Isi nama item checklist.');onefluxDraft.push({section:'Checklist tambahan',subject:site(currentSite)?.workType||'Pekerjaan',code:uid('CUSTOM'),requirement:title,required:true,status:'Belum',note:'',custom:true});$('newChecklistTitle').value='';renderOneflux();};
const originalRenderOneflux=renderOneflux;
renderOneflux=function(){originalRenderOneflux();$('onefluxList').querySelectorAll('.of-row').forEach((row,i)=>{if(!onefluxDraft[i]?.custom)return;const b=document.createElement('button');b.type='button';b.className='rowbtn';b.textContent='Hapus item';b.onclick=()=>{onefluxDraft.splice(i,1);renderOneflux();};row.querySelector('.of-copy').appendChild(b);});};
const oldCloseModal=closeModal;
openModal=function(id){const m=$(id);if(!m)return;lastModalFocus.set(id,document.activeElement);m.style.zIndex=++modalSequence;m.classList.add('open');m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');const heading=m.querySelector('h2');if(heading){if(!heading.id)heading.id=id+'Heading';m.setAttribute('aria-labelledby',heading.id);}document.body.style.overflow='hidden';setTimeout(()=>m.querySelector('input:not([type=hidden]):not([disabled]),select,textarea,button')?.focus(),0);};
closeModal=function(id){if(id==='cloudConflictModal'&&cloudConflict)cloudMarkConflictDeferred();oldCloseModal(id);lastModalFocus.get(id)?.focus();lastModalFocus.delete(id);if(id==='financePaymentModal')renderFinance();};
document.querySelectorAll('.modalbg').forEach(m=>m.onclick=e=>{if(e.target===m&&!lockedModals.has(m.id))closeModal(m.id);});
// Capture Escape first so only the top dialog closes; never dismiss an access gate.
document.addEventListener('keydown',e=>{
  const all=[...document.querySelectorAll('.modalbg.open')].sort((a,b)=>Number(a.style.zIndex)-Number(b.style.zIndex)),top=all[all.length-1];
  if(e.key==='Escape'&&top){e.preventDefault();e.stopImmediatePropagation();if(!lockedModals.has(top.id))closeModal(top.id);}
  if(e.key==='Tab'&&top){const f=[...top.querySelectorAll('button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),a[href]')].filter(n=>n.getClientRects().length);if(!f.length)return;const first=f[0],last=f[f.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
},true);
for(const b of document.querySelectorAll('button.close'))if(!b.getAttribute('aria-label'))b.setAttribute('aria-label','Tutup dialog');
function downloadWorkspaceBackup(){if(window.TRACKERS_CORRUPT_KEYS?.length)return downloadRawRecovery();const snapshot=cloudSnapshot();TrackersSheets.download(new Blob([JSON.stringify({app:'Trackers Workspace',...snapshot},null,2)],{type:'application/json'}),'Trackers_Backup_'+financeToday()+'.json');}
function downloadRawRecovery(){const keys=[KEY,...PKBON_CLOUD_KEYS],raw=Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]));TrackersSheets.download(new Blob([JSON.stringify({app:'Trackers Raw Recovery',recoveryOnly:true,raw},null,2)],{type:'application/json'}),'Trackers_Raw_Recovery_'+financeToday()+'.json');}
$('backupWorkspaceRow').onclick=()=>openModal('backupWorkspaceModal');
$('downloadWorkspaceBackup').onclick=downloadWorkspaceBackup;
$('backupConflict').onclick=downloadWorkspaceBackup;
$('syncIndicator').onclick=()=>{if(cloudSession&&cloudConflict){cloudConflictDialog(true);return;}if(!cloudSession){cloudShowAuth(true);return;}cloudUpdateAccountUI();openModal('cloudAccountModal');};
$('restoreWorkspaceFile').onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{if(file.size>40*1024*1024)throw new Error('Backup melebihi 40 MB.');const snapshot=TrackersCore.validateSnapshot(TrackersCore.normalizeSnapshot(JSON.parse(await file.text())));if(!confirm('Pulihkan backup? Seluruh data kerja perangkat ini akan diganti. Download backup saat ini dahulu bila diperlukan.'))return;
    cloudApplySnapshot(snapshot,true);location.reload();
  }catch(err){toast('Restore gagal: '+err.message);}finally{e.target.value='';}
};
function showStorageNotice(message){const box=$('storageWarning');box.hidden=false;box.textContent=message;const b=document.createElement('button');b.type='button';b.textContent='Muat ulang';b.onclick=()=>location.reload();box.appendChild(b);}
window.addEventListener('storage',e=>{if(e.key===KEY||PKBON_CLOUD_KEYS.includes(e.key)){workspaceStale=true;clearTimeout(cloudPushTimer);showStorageNotice('Data berubah di tab lain. Muat ulang sebelum menyimpan agar perubahan tidak tertimpa.');}});
const originalSave=save;
save=function(){if(workspaceStale){showStorageNotice('Data berubah di tab lain. Muat ulang sebelum menyimpan.');throw new Error('STALE_WORKSPACE');}return originalSave();};
const SITE_HEADERS=['SITE NAME','PROJECT ID','SITE ID','SITE ID CLIENT','CLIENT','TENANT','TINGGI TOWER (M)','REGIONAL','SOW','NO SPMK','TANGGAL SPMK','KOORDINAT','ALAMAT','STATUS'];
function siteExportRow(s){return [s.siteName,s.projectId,s.siteId,s.clientSiteId,s.client,s.tenant,s.towerHeight,s.region,s.workType,s.spmkNo,s.spmkDate,s.coordinate,s.address,s.status];}
downloadSiteImportTemplate=function(){TrackersSheets.export([SITE_HEADERS], 'Trackers_Format_Import_Data_Site.xlsx','FORMAT INPUT SITE');};
$('exportSites').onclick=()=>{const ids=[...$('siteRows').querySelectorAll('[data-open]')].map(r=>r.dataset.open),rows=state.sites.filter(s=>ids.includes(s.id));TrackersSheets.export([SITE_HEADERS,...rows.map(siteExportRow)],'Trackers_Projects_'+financeToday()+'.xlsx','FORMAT INPUT SITE');};
$('exportReport').onclick=()=>{TrackersSheets.export([SITE_HEADERS,...reportBaseSites().map(siteExportRow)],'Trackers_Report_'+financeToday()+'.xlsx','Projects');};
async function legacyExcelLibrary(){
  if(window.XLSX)return true;
  return new Promise(resolve=>{const s=document.createElement('script'),t=setTimeout(()=>{s.remove();resolve(false);},10000);s.src='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';s.onload=()=>{clearTimeout(t);resolve(!!window.XLSX);};s.onerror=()=>{clearTimeout(t);resolve(false);};document.head.appendChild(s);});
}
handleSiteExcelFile=async function(file){if(!file)return;try{
  if(file.size>20*1024*1024)throw new Error('File maksimal 20 MB.');let rows;
  if(/\.csv$/i.test(file.name))rows=TrackersCore.csvParse(await file.text());
  else if(/\.xlsx$/i.test(file.name))rows=await TrackersSheets.readXlsx(await file.arrayBuffer());
  else if(/\.xls$/i.test(file.name)){if(!await legacyExcelLibrary())throw new Error('Pembaca XLS belum termuat. Simpan file sebagai XLSX atau CSV.');const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:'',raw:true});}
  else throw new Error('Gunakan XLSX, XLS, atau CSV.');
  if(!rows.length)return toast('File tidak berisi baris data. Isi template mulai baris kedua.');if(rows.length>20000)throw new Error('Maksimal 20.000 baris per import.');
  if(!Object.keys(rows[0]).some(k=>normalizeImportHeader(k)==='SITE NAME'))throw new Error('Header SITE NAME tidak ditemukan. Gunakan template dari aplikasi.');
  importSiteRows(rows);
}catch(err){toast('Import gagal: '+err.message);}finally{$('siteExcelInput').value='';}};
startWorkspace();
if(window.TRACKERS_VOLATILE_STORAGE)showStorageNotice('Penyimpanan browser tidak tersedia. Perubahan hanya bertahan di sesi ini. Unduh backup sebelum menutup aplikasi.');

if(window.TRACKERS_CORRUPT_KEYS?.length){
  showStorageNotice('Data lokal tidak terbaca: '+window.TRACKERS_CORRUPT_KEYS.join(', ')+'. Penyimpanan dan sync ditahan. Download data pemulihan lalu restore backup valid melalui Settings.');
  const b=document.createElement('button');b.type='button';b.textContent='Download data pemulihan';b.onclick=downloadRawRecovery;$('storageWarning').appendChild(b);
}
