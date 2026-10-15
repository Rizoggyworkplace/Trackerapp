(function(){
'use strict';
const root=document.getElementById('pkbonIntegrated');
if(!root)return;
const $=s=>root?.querySelector(s)||document.querySelector(s), $$=s=>[...(root?.querySelectorAll(s)||[])];
const fmt=n=>'Rp '+Number(n||0).toLocaleString('id-ID');
function parseRupiah(value){
  return TrackersCore.money(value);
}
function formatRupiahInput(value){
  const amount=parseRupiah(value);
  return amount?amount.toLocaleString('id-ID'):'';
}
const MONTHS=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const STATUSES=['Draft','Diajukan','Disetujui','Terbayar','Selesai'];
const DEFAULTS={
  settings:{nomorForm:'',formPrefix:'',autoForm:true,id:'',nama:'',kota:'',autoNumber:true,startNumber:1,pkbonSuffix:'3',approvalIds:{}},
  sites:[],
  banks:[],
  templates:[],
  officers:[]
};
let state={items:[],lampiranPengajuan:'',lampiranTransfer:'',lampiranBuktiBayar:'',currentId:null,driveDocId:null,bankSnapshot:null,pkbonAuto:false};
function clone(x){return JSON.parse(JSON.stringify(x))}
function loadJSON(k,f){try{const raw=localStorage.getItem(k);if(raw===null)return clone(f);const v=TrackersCore.decodeStored(raw);TrackersCore.validateSnapshot({trackly:{sites:[]},pkbon:{[k]:v}});return v;}catch{window.TRACKERS_CORRUPT_KEYS=[...(window.TRACKERS_CORRUPT_KEYS||[]),k];return clone(f)}}
function notifyTracklyHistory(type='PKBON_CHANGED'){
  try{
    window.dispatchEvent(new CustomEvent('trackly:pkbon-event',{detail:{type,history:Array.isArray(history)?clone(history):[]}}));
  }catch(_){}
}
function saveJSON(k,v,silent=false){
  if(window.TRACKERS_CORRUPT_KEYS?.length){if(silent)return false;alert('Data lama tidak terbaca. Download data pemulihan dari Settings lalu restore backup yang valid.');throw new Error('CORRUPT_WORKSPACE');}
  if(typeof workspaceStale!=='undefined'&&workspaceStale){alert('Data berubah di tab lain. Muat ulang sebelum menyimpan.');throw new Error('STALE_WORKSPACE');}
  if(!silent&&window.trackersUpdateRoleUI)opsAssertEdit();
  const data=TrackersCore.encodeStored(v);
  if(localStorage.getItem(k)===data)return true;
  const auditEntries=window.trackersBeforePkbonWrite?.(k,v,silent)||[];
  try{TrackersCore.writeBatch(localStorage,[...(silent?[]:cloudChangeEntries()),...auditEntries,[k,data]]);window.trackersAfterPkbonWrite?.();}
  catch(e){alert('Data belum tersimpan. Penyimpanan penuh. Download Backup dari Pengaturan PKBON.');throw e;}
  if(!silent)setTimeout(()=>notifyTracklyHistory('PKBON_CHANGED'),0);
  return true;
}
function normalizeSites(raw){
  const result=[];
  (Array.isArray(raw)?raw:[]).forEach(x=>{
    const name=String(typeof x==='string'?x:(x?.name||x?.site||'')).trim();
    const projectId=String(typeof x==='object'&&x?(x.projectId||''):'').trim();
    if(!name)return;
    const existing=result.find(s=>x?.workspaceSiteId&&s.workspaceSiteId?x.workspaceSiteId===s.workspaceSiteId:s.name.toLowerCase()===name.toLowerCase()&&s.projectId.toLowerCase()===projectId.toLowerCase());
    if(existing){if(!existing.projectId&&projectId)existing.projectId=projectId;return}
    result.push({name,projectId,workspaceSiteId:typeof x==='object'?x.workspaceSiteId||'':'',siteId:x?.siteId||'',workType:x?.workType||''});
  });
  return result.sort((a,b)=>a.name.localeCompare(b.name,'id'));
}
function uid(prefix='id'){return prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8)}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function attr(s=''){return esc(s)}
let settings=loadJSON('pkbon_settings',DEFAULTS.settings);
settings={...DEFAULTS.settings,...settings,approvalIds:settings.approvalIds||{}};
settings.autoNumber=true;
let sites=normalizeSites(loadJSON('pkbon_sites',DEFAULTS.sites));
let banks=loadJSON('pkbon_banks',DEFAULTS.banks);if(!Array.isArray(banks))banks=[];
let history=loadJSON('pkbon_history',[]);
let officers=loadJSON('pkbon_officers',DEFAULTS.officers);
let templates=loadJSON('pkbon_templates',DEFAULTS.templates);
if(!Array.isArray(templates))templates=clone(DEFAULTS.templates);
templates=templates.map(t=>t.id==='tpl_bpujl'&&(!t.sat||t.sat==='Pcs')?{...t,sat:'Ls'}:t);
history=Array.isArray(history)?history.map(d=>({...d,status:STATUSES.includes(d.status)?d.status:'Draft'})):[];

function migrateOfficers(){
  if(!Array.isArray(officers))officers=[];
  if(!settings.approvalIds)settings.approvalIds={};
}
migrateOfficers();
if(!settings.approvalIds.a1&&officers[0])settings.approvalIds.a1=officers[0].id;
if(!settings.approvalIds.a2&&officers[1])settings.approvalIds.a2=officers[1].id;
if(!settings.approvalIds.a3&&officers[2])settings.approvalIds.a3=officers[2].id;
if(!settings.approvalIds.a4&&officers[3])settings.approvalIds.a4=officers[3].id;
settings.pkbonSuffix='3';
// Normalization on startup does not mark cloud data as locally edited.

function toast(t){const e=$('#pkbonToast');e.textContent=t;e.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>e.classList.remove('show'),2200)}
function romanMonth(m){return ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][m-1]||''}
function dateID(v){if(!v)return'';const d=new Date(v+'T00:00:00');return d.toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric'})}
function longDateID(v){if(!v)return'';const d=new Date(v+'T00:00:00');return d.toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}
function dayNameID(v){if(!v)return'';const d=new Date(v+'T00:00:00');return d.toLocaleDateString('id-ID',{weekday:'long'})}
function terbilang(n){n=Math.floor(Number(n)||0);const a=['','Satu','Dua','Tiga','Empat','Lima','Enam','Tujuh','Delapan','Sembilan','Sepuluh','Sebelas'];function t(x){if(x<12)return a[x];if(x<20)return t(x-10)+' Belas';if(x<100)return t(Math.floor(x/10))+' Puluh'+(x%10?' '+t(x%10):'');if(x<200)return'Seratus'+(x-100?' '+t(x-100):'');if(x<1000)return t(Math.floor(x/100))+' Ratus'+(x%100?' '+t(x%100):'');if(x<2000)return'Seribu'+(x-1000?' '+t(x-1000):'');if(x<1e6)return t(Math.floor(x/1000))+' Ribu'+(x%1000?' '+t(x%1000):'');if(x<1e9)return t(Math.floor(x/1e6))+' Juta'+(x%1e6?' '+t(x%1e6):'');if(x<1e12)return t(Math.floor(x/1e9))+' Miliar'+(x%1e9?' '+t(x%1e9):'');if(x<1e15)return t(Math.floor(x/1e12))+' Triliun'+(x%1e12?' '+t(x%1e12):'');return String(x)}return n?`# ${t(n)} Rupiah #`:'# Nol Rupiah #'}
function today(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function total(){return TrackersCore.total(state.items)}
function currentSite(){return ($('#siteInput').value||'').trim()}
function currentProjectId(){return ($('#projectId').value||'').trim()}
function siteOptionLabel(s){return [s.name,s.projectId,s.siteId,s.workType].filter(Boolean).join(' · ')}
function siteIndex(name=currentSite()){const exact=sites.findIndex(x=>state.workspaceSiteId&&x.workspaceSiteId===state.workspaceSiteId);if(exact>=0)return exact;const matches=sites.filter(x=>x.name.toLowerCase()===String(name||'').trim().toLowerCase()&&x.projectId.toLowerCase()===currentProjectId().toLowerCase());return matches.length===1?sites.indexOf(matches[0]):-1;}
function savedSite(name=currentSite()){const i=siteIndex(name);return i>=0?sites[i]:null}
function cleanFilenamePart(value){return String(value||'').replace(/[\\/:*?"<>|\x00-\x1F]/g,' ').replace(/\s+/g,' ').replace(/[. ]+$/g,'').trim()}
function buildPrintTitle(pkbonNo,keterangan,site,uraian=''){
  const raw=String(pkbonNo||''),number=(raw.match(/^\s*(\d{5})/)||[])[1]||raw.replace(/\D/g,'').slice(0,5);
  const description=cleanFilenamePart(keterangan)||cleanFilenamePart(uraian);
  return [number?'PKBON '+number:'PKBON',description,cleanFilenamePart(site)].filter(Boolean).join(' - ');
}
function officerById(id){return officers.find(x=>x.id===id)||null}
function selectedBank(){const i=$('#bankSelect').value;if(i!=='')return banks[+i]||null;return state.bankSnapshot||null}

function extractSeq(no){const m=String(no||'').match(/^\s*(\d{1,10})/);return m?Number(m[1]):null}
function nextSequence(){const nums=history.map(x=>extractSeq(x.pkbonNo)).filter(Number.isFinite);const maxHist=nums.length?Math.max(...nums):0;return Math.max(Number(settings.startNumber)||1,maxHist+1)}
function buildPkbonNo(seq=nextSequence(),date=$('#tanggal').value||today()){
  const d=new Date(date+'T00:00:00');
  return String(seq).padStart(5,'0')+'-3/'+romanMonth(d.getMonth()+1)+'/'+d.getFullYear();
}
function currentFormNumber(date=$('#tanggal')?.value||today()){
  if(!settings.autoForm)return settings.nomorForm||'';
  const d=new Date(date+'T00:00:00'),prefix=String(settings.formPrefix||'MINK.002/PROJECT').replace(/\/+$/,'');
  return `${prefix}/${romanMonth(d.getMonth()+1)}/${d.getFullYear()}`;
}
function generatePkbonNo(show=true){$('#pkbonNo').value=buildPkbonNo();state.pkbonAuto=true;syncPreview();if(show)toast('Nomor PKBON dibuat otomatis')}
function refreshAutoNoForDate(){if(state.pkbonAuto&&!state.currentId){const seq=extractSeq($('#pkbonNo').value)||nextSequence();$('#pkbonNo').value=buildPkbonNo(seq,$('#tanggal').value||today())}}

function addItem(it={uraian:'',sat:'Ls',vol:1,harga:0,keterangan:''}){state.items.push({...it});renderRows();syncPreview()}
function applyTemplate(){const t=templates.find(x=>x.id===$('#templateSelect').value);if(!t)return toast('Pilih template terlebih dahulu');const row={uraian:t.uraian||'',sat:t.sat||'Ls',vol:1,harga:0,keterangan:t.keterangan||''};if(state.items.length===1&&!Number(state.items[0].harga))state.items[0]=row;else state.items.push(row);renderRows();syncPreview();toast('Template diterapkan')}
function saveFirstRowAsTemplate(){const row=state.items[0];if(!row?.uraian?.trim())return toast('Uraian baris pertama masih kosong');const name=prompt('Nama template:',row.uraian.slice(0,45));if(!name?.trim())return;templates.push({id:uid('tpl'),name:name.trim(),uraian:row.uraian.trim(),sat:row.sat||'Ls',keterangan:row.keterangan||''});saveJSON('pkbon_templates',templates);fillSelects();toast('Template disimpan')}
function renderRows(){
  const tb=$('#itemRows');tb.innerHTML='';
  state.items.forEach((it,i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${i+1}</td><td><input data-k="uraian" data-i="${i}" value="${attr(it.uraian)}"></td><td><input data-k="sat" data-i="${i}" value="${attr(it.sat)}"></td><td><input data-k="vol" data-i="${i}" type="number" min="0" step="any" value="${Number(it.vol)||0}"></td><td><input data-k="harga" data-i="${i}" type="text" inputmode="numeric" autocomplete="off" value="${formatRupiahInput(it.harga)}" placeholder="0"></td><td class="row-total">${fmt((Number(it.vol)||0)*(Number(it.harga)||0))}</td><td><input data-k="keterangan" data-i="${i}" value="${attr(it.keterangan)}"></td><td><button class="remove" aria-label="Hapus baris" data-remove="${i}">${uiIcon('close')}</button></td>`;
    tb.appendChild(tr);
  });
  $$('#itemRows input').forEach(e=>e.oninput=ev=>{
    const i=+ev.target.dataset.i,k=ev.target.dataset.k;
    if(k==='harga')state.items[i][k]=TrackersCore.moneyInput(ev.target);
    else state.items[i][k]=k==='vol'?Math.max(0,Number(ev.target.value)||0):ev.target.value;
    if(['vol','harga'].includes(k)){const tr=ev.target.closest('tr');tr.querySelector('.row-total').textContent=fmt((Number(state.items[i].vol)||0)*(Number(state.items[i].harga)||0))}
    syncPreview();
  });
  $$('[data-remove]').forEach(b=>b.onclick=()=>{state.items.splice(+b.dataset.remove,1);if(!state.items.length)state.items.push({uraian:'',sat:'Ls',vol:1,harga:0,keterangan:''});renderRows();syncPreview()});
}

function fillSelects(){
  const dl=$('#siteOptions'),bs=$('#bankSelect'),oldBank=bs.value,status=$('#status'),oldStatus=status.value||'Draft';
  dl.innerHTML=sites.map(x=>`<option value="${attr(siteOptionLabel(x))}">${esc(x.name)}</option>`).join('');
  bs.innerHTML='<option value="">-- Pilih Bank --</option>'+banks.map((x,i)=>`<option value="${i}">${esc(x.nama)} — ${esc(x.bank)}</option>`).join('');
  if([...bs.options].some(o=>o.value===oldBank))bs.value=oldBank;
  status.innerHTML=STATUSES.map(x=>`<option value="${x}">${x}</option>`).join('');status.value=STATUSES.includes(oldStatus)?oldStatus:'Draft';
  const ts=$('#templateSelect'),oldTemplate=ts.value;ts.innerHTML='<option value="">Pilih template uraian</option>'+templates.map(x=>`<option value="${attr(x.id)}">${esc(x.name)}</option>`).join('');if(templates.some(x=>x.id===oldTemplate))ts.value=oldTemplate;
  const hs=$('#historyStatusFilter'),rs=$('#rekapStatus');if(hs){const old=hs.value;hs.innerHTML='<option value="">Semua status</option>'+STATUSES.map(x=>`<option>${x}</option>`).join('');hs.value=old}if(rs){const old=rs.value;rs.innerHTML='<option value="">Semua status</option>'+STATUSES.map(x=>`<option>${x}</option>`).join('');rs.value=old}
  fillOfficerSelects();
}
function fillOfficerSelects(){
  ['sA1Officer','sA2Officer','sA3Officer','sA4Officer'].forEach((id,idx)=>{
    const el=$('#'+id);if(!el)return;const key='a'+(idx+1),old=settings.approvalIds[key]||el.value;
    el.innerHTML='<option value="">-- Tanpa Pejabat --</option>'+officers.map(o=>`<option value="${attr(o.id)}">${esc(o.name)} — ${esc(o.role)}</option>`).join('');
    el.value=old||'';
  });
}
function rememberSite(showToast=false){
  const name=currentSite(),projectId=currentProjectId();if(!name)return;
  const idx=siteIndex(name);
  if(idx<0){
    if(sites.filter(x=>x.name.toLowerCase()===name.toLowerCase()&&x.projectId.toLowerCase()===projectId.toLowerCase()).length>1)return;
    sites.push({name,projectId,workspaceSiteId:state.workspaceSiteId||''});sites.sort((a,b)=>a.name.localeCompare(b.name,'id'));
  }else{
    sites[idx].name=name;
    if(projectId)sites[idx].projectId=projectId;
  }
  saveJSON('pkbon_sites',sites);renderMasters();renderRekapFilters();
  if(showToast)toast(projectId?'Site dan Project ID tersimpan otomatis':'Site tersimpan otomatis');
}
function applySavedSite(){
  const matches=sites.filter(x=>x.name.toLowerCase()===currentSite().toLowerCase());const site=sites.find(x=>siteOptionLabel(x)===currentSite())||savedSite()||(matches.length===1?matches[0]:null);if(!site)return false;
  $('#siteInput').value=site.name;$('#projectId').value=site.projectId||'';state.workspaceSiteId=site.workspaceSiteId||'';syncPreview();return true;
}

function setSig(img,src){if(src){img.src=src;img.classList.remove('empty')}else{img.removeAttribute('src');img.classList.add('empty')}}
function renderAttachmentPreviews(){
  const map=[['previewPengajuan','lampiranPengajuan'],['previewTransfer','lampiranTransfer'],['previewBuktiBayar','lampiranBuktiBayar']];
  map.forEach(([id,key])=>{
    const box=$('#'+id),v=state[key],src=lampiranUrl(v),did=lampiranDriveId(v);
    box.innerHTML=src?`<img src="${attr(src)}"${did?` data-drive-id="${attr(did)}"`:''} alt="Preview lampiran">`:'<span>Belum ada gambar</span>';
    const img=box.querySelector('img[data-drive-id]');
    if(img)img.addEventListener('error',function onErr(){img.removeEventListener('error',onErr);driveImgFallback(img);});
    const button=$(`[data-remove-attachment="${key}"]`);if(button)button.disabled=!src;
  });
}
// Fallback berlapis untuk <img> lampiran Drive: thumb -> thumbnail Drive -> blob via Drive API.
function driveImgFallback(img){
  const D=window.TrackersDrive;if(!D)return;
  const id=img.getAttribute('data-drive-id');if(!id)return;
  if(img.src.indexOf('data:')===0){img.src=D.driveThumbUrl(id,1000);return;}
  if(D.driveIsConnected())D.driveFileBlobUrl(id).then(u=>{img.src=u;}).catch(()=>{});
}
function syncPreview(){
  const printSettings=state.documentSettings||settings;
  const b=selectedBank()||{nama:'',rekening:'',bank:''};
  $('#pvNomorForm').textContent=state.documentFormNumber||currentFormNumber();$('#pvPkbonNo').textContent=$('#pkbonNo').value;$('#pvTanggal').textContent=dateID($('#tanggal').value);$('#pvId').textContent=printSettings.id;$('#pvNama').textContent=printSettings.nama;$('#pvProjectId').textContent=$('#projectId').value||'';$('#pvPekerjaan').textContent=$('#pekerjaan').value||'';$('#pvSite').textContent=currentSite();
  const rows=[...state.items];while(rows.length<16)rows.push(null);
  $('#pvRows').innerHTML=rows.map((it,i)=>it?`<tr><td class="center">${i+1}</td><td>${esc(it.uraian)}</td><td class="center">${esc(it.sat)}</td><td class="center">${Number(it.vol)||0}</td><td class="money">${fmt(it.harga)}</td><td class="money">${fmt((Number(it.vol)||0)*(Number(it.harga)||0))}</td><td>${esc(it.keterangan)}</td></tr>`:'<tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('');
  const gt=total();$('#pvGrandTotal').textContent=fmt(gt);$('#grandTotalLabel').textContent='Grand Total: '+fmt(gt);$('#pvTerbilang').textContent=terbilang(gt);$('#pvBankNama').textContent=b.nama||'';$('#pvBankRek').textContent=b.rekening||'';$('#pvBank').textContent=b.bank||'';const tglValue=$('#tanggal').value;const hari=dayNameID(tglValue);$('#pvKotaTanggal').textContent=`${hari?hari+', ':''}${longDateID(tglValue)}`;
  /* Pejabat selalu diambil LIVE dari master (per id) agar update TTD/nama/jabatan di
     Pengaturan langsung tampil di preview/cetak; snapshot dokumen hanya fallback bila
     pejabat sudah dihapus dari master. */
  [1,2,3,4].forEach(n=>{const snap=state.documentOfficers?.[n-1]||officerById(settings.approvalIds['a'+n]);const o=(snap&&snap.id?officerById(snap.id):null)||snap;$('#pvAppr'+n+'Name').textContent=o?.name||'';$('#pvAppr'+n+'Role').textContent=o?.role||'';setSig($('#pvSig'+n),o?.signature||'')});
  const p2=$('#page2'),p3=$('#page3');setLampiranPrint($('#pvLampiranPengajuan'),state.lampiranPengajuan);setLampiranPrint($('#pvLampiranTransfer'),state.lampiranTransfer);setLampiranPrint($('#pvLampiranBuktiBayar'),state.lampiranBuktiBayar);p2.classList.toggle('hidden-print',!state.lampiranPengajuan&&!state.lampiranTransfer);p3.classList.toggle('hidden-print',!state.lampiranBuktiBayar);renderAttachmentPreviews();
}
// Gambar lampiran untuk area cetak: pakai URL resolusi penuh (bukan thumb mungil).
function setLampiranPrint(img,v){
  setSig(img,lampiranFullUrl(v));
  const did=lampiranDriveId(v);
  if(did)img.setAttribute('data-drive-id',did);else img.removeAttribute('data-drive-id');
}

function collect(){rememberSite(false);const b=selectedBank()||{};const match=sites.filter(x=>x.name.toLowerCase()===currentSite().toLowerCase()&&x.projectId.toLowerCase()===currentProjectId().toLowerCase());return{workspaceSiteId:state.workspaceSiteId||(match.length===1?match[0].workspaceSiteId||'':''),id:state.currentId||uid('pkbon'),pkbonNo:$('#pkbonNo').value.trim(),tanggal:$('#tanggal').value,status:$('#status').value||'Draft',nomorForm:state.documentFormNumber||currentFormNumber(),documentSettings:clone(state.documentSettings||settings),documentOfficers:clone(state.documentOfficers||[1,2,3,4].map(n=>officerById(settings.approvalIds['a'+n]))),site:currentSite(),projectId:$('#projectId').value.trim(),pekerjaan:$('#pekerjaan').value.trim(),keteranganUmum:$('#keteranganUmum').value.trim(),bank:clone(b),items:clone(state.items),lampiranPengajuan:state.lampiranPengajuan,lampiranTransfer:state.lampiranTransfer,lampiranBuktiBayar:state.lampiranBuktiBayar,total:total(),savedAt:new Date().toISOString()}}
function saveCurrent(){
  if(!$('#pkbonNo').value.trim())generatePkbonNo(false);
  const d=collect();if(!d.pkbonNo)return toast('Nomor PKBON wajib diisi');
  if(!d.site||!d.projectId||!TrackersCore.date(d.tanggal))return toast('Site, Project ID, dan tanggal wajib diisi.');
  if(d.status!=='Draft'){const errors=validateDocument();if(errors.length){alert(errors.join('\n'));return;}}

  const duplicate=history.find(x=>String(x.pkbonNo).toLowerCase()===d.pkbonNo.toLowerCase()&&x.id!==d.id);if(duplicate){alert('Nomor PKBON '+d.pkbonNo+' sudah ada di riwayat. Gunakan nomor lain.');return}
  const i=history.findIndex(x=>x.id===d.id);if(i>=0)history[i]=d;else history.unshift(d);
  if(!saveJSON('pkbon_history',history))return;state.currentId=d.id;state.bankSnapshot=clone(d.bank);state.pkbonAuto=false;renderHistory();renderRekapFilters();renderRekap();renderDashboard();toast('PKBON tersimpan');
}
function newDoc(){
  state={items:[],lampiranPengajuan:'',lampiranTransfer:'',lampiranBuktiBayar:'',currentId:null,driveDocId:null,bankSnapshot:null,pkbonAuto:false};
  $('#status').value='Draft';
  $('#tanggal').value=today();
  $('#siteInput').value='';
  $('#bankSelect').value='';
  $('#projectId').value='';
  $('#pekerjaan').value='';
  $('#keteranganUmum').value='';
  $('#lampiranPengajuan').value='';
  $('#lampiranTransfer').value='';
  $('#lampiranBuktiBayar').value='';
  state.items=[{uraian:'',sat:'Ls',vol:1,harga:0,keterangan:''}];
  renderRows();
  generatePkbonNo(false);
  syncPreview();
  showTab('formTab')
}
function loadDoc(d){
  if(!d)return;state.workspaceSiteId=d.workspaceSiteId||'';state.documentFormNumber=d.nomorForm||'';state.documentSettings=d.documentSettings||null;state.documentOfficers=d.documentOfficers||null;state.currentId=d.id;state.items=clone(d.items||[]);if(!state.items.length)state.items=[{uraian:'',sat:'Ls',vol:1,harga:0,keterangan:''}];state.lampiranPengajuan=d.lampiranPengajuan||'';state.lampiranTransfer=d.lampiranTransfer||'';state.lampiranBuktiBayar=d.lampiranBuktiBayar||'';state.bankSnapshot=clone(d.bank||null);state.pkbonAuto=false;$('#status').value=STATUSES.includes(d.status)?d.status:'Draft';$('#pkbonNo').value=d.pkbonNo||'';$('#tanggal').value=d.tanggal||today();$('#siteInput').value=d.site||'';$('#projectId').value=d.projectId||'';$('#pekerjaan').value=d.pekerjaan||'';const bi=banks.findIndex(x=>x.nama===d.bank?.nama&&x.rekening===d.bank?.rekening&&x.bank===d.bank?.bank);$('#bankSelect').value=bi>=0?String(bi):'';$('#keteranganUmum').value=d.keteranganUmum||'';$('#lampiranPengajuan').value='';$('#lampiranTransfer').value='';$('#lampiranBuktiBayar').value='';renderRows();syncPreview();showTab('formTab');toast('Riwayat dibuka untuk diedit')
}
function duplicateDoc(d){
  if(!d)return;const x=clone(d);x.id=null;x.nomorForm='';x.documentSettings=null;x.documentOfficers=null;x.status='Draft';x.tanggal=today();x.pkbonNo='';x.lampiranPengajuan='';x.lampiranTransfer='';x.lampiranBuktiBayar='';loadDoc(x);state.currentId=null;state.lampiranPengajuan='';state.lampiranTransfer='';state.lampiranBuktiBayar='';state.pkbonAuto=false;if(settings.autoNumber)generatePkbonNo(false);syncPreview();toast('Duplikat dibuat sebagai PKBON baru')
}
function renderHistory(){
  const q=($('#historySearch').value||'').toLowerCase(),status=$('#historyStatusFilter').value;const arr=history.filter(d=>(!status||d.status===status)&&JSON.stringify(d).toLowerCase().includes(q));
  $('#historyList').innerHTML=arr.length?arr.map(d=>`<div class="history-item"><div class="history-main"><span class="status-badge ${String(d.status).toLowerCase()}">${esc(d.status||'Draft')}</span><div><b>${esc(d.pkbonNo||'(tanpa nomor)')}</b><br><small>${esc(d.site||'')} • ${dateID(d.tanggal)} • ${fmt(d.total)}${d.pekerjaan?' • '+esc(d.pekerjaan):''}</small></div></div><div class="mini-actions"><select data-history-status="${d.id}">${STATUSES.map(x=>`<option${x===d.status?' selected':''}>${x}</option>`).join('')}</select><button data-open="${d.id}">Buka</button><button data-dup="${d.id}">Duplikat</button><button data-delhist="${d.id}">Hapus</button></div></div>`).join(''):'<p class="empty-state">Tidak ada PKBON sesuai filter.</p>';
  $$('[data-history-status]').forEach(s=>s.onchange=()=>{const d=history.find(x=>x.id==s.dataset.historyStatus);if(!d)return;if(s.value!=='Draft'){const errors=documentErrors(d);if(errors.length){s.value=d.status;alert('Buka dan lengkapi PKBON terlebih dahulu:\n'+errors.join('\n'));return;}}const next=history.map(x=>x===d?{...d,status:s.value}:x);saveJSON('pkbon_history',next);history=next;if(state.currentId===d.id)$('#status').value=s.value;renderHistory();renderRekap();renderDashboard();toast('Status diperbarui')});
  $$('[data-open]').forEach(b=>b.onclick=()=>loadDoc(history.find(x=>x.id==b.dataset.open)));$$('[data-dup]').forEach(b=>b.onclick=()=>duplicateDoc(history.find(x=>x.id==b.dataset.dup)));$$('[data-delhist]').forEach(b=>b.onclick=()=>{if(confirm('Hapus riwayat ini?')){history=history.filter(x=>x.id!=b.dataset.delhist);saveJSON('pkbon_history',history);renderHistory();renderRekapFilters();renderRekap();renderDashboard()}})
}

function renderMasters(){
  fillSelects();
  $('#siteList').innerHTML=sites.length?sites.map((x,i)=>`<div class="list-item site-master-row"><div class="site-master-fields"><label>Nama Site<input class="site-master-input" data-editsite="${i}" value="${attr(x.name)}"></label><label>Project ID<input data-editproject="${i}" value="${attr(x.projectId||'')}"></label></div><div class="mini-actions"><button data-delsite="${i}">Hapus</button></div></div>`).join(''):'<p>Belum ada site tersimpan. Isi Site dan Project ID pada Form, lalu keduanya akan tersimpan otomatis.</p>';
  $('#bankList').innerHTML=banks.length?banks.map((x,i)=>`<div class="list-item"><div class="bank-master-fields"><label>Nama<input data-bankname="${i}" value="${attr(x.nama)}"></label><label>Nomor Rekening<input data-bankrek="${i}" value="${attr(x.rekening||'')}"></label><label>Bank<input data-bankbank="${i}" value="${attr(x.bank||'')}"></label></div><div class="mini-actions"><button data-delbank="${i}">Hapus</button></div></div>`).join(''):'<p>Belum ada data bank.</p>';
  $('#templateList').innerHTML=templates.length?templates.map((x,i)=>`<div class="list-item"><div class="template-master-fields"><label>Nama<input data-tplname="${i}" value="${attr(x.name)}"></label><label>Uraian<input data-tpluraian="${i}" value="${attr(x.uraian)}"></label><label>Satuan<input data-tplsat="${i}" value="${attr(x.sat||'Ls')}"></label></div><div class="mini-actions"><button data-deltpl="${i}">Hapus</button></div></div>`).join(''):'<p>Belum ada template uraian.</p>';
  $('#officerList').innerHTML=officers.length?officers.map((o,i)=>`<div class="officer-item"><div class="officer-signature">${o.signature?`<img src="${attr(o.signature)}" alt="TTD">`:'<span>Tanpa TTD</span>'}</div><div class="officer-fields"><label>Nama<input data-offname="${i}" value="${attr(o.name)}"></label><label>Jabatan<input data-offrole="${i}" value="${attr(o.role)}"></label></div><div class="mini-actions vertical"><label class="tiny-file">Ganti TTD<input type="file" data-offsig="${i}" accept="image/png,image/jpeg,image/webp"></label>${o.signature?`<button data-clearsig="${i}">Hapus TTD</button>`:''}<button data-deloff="${i}">Hapus Pejabat</button></div></div>`).join(''):'<p>Belum ada pejabat.</p>';
  $$('[data-editsite]').forEach(inp=>inp.onchange=()=>{const i=+inp.dataset.editsite,name=inp.value.trim(),old=sites[i].name;if(!name){inp.value=old;return toast('Nama site tidak boleh kosong')}if(sites.some((x,j)=>j!==i&&x.name.toLowerCase()===name.toLowerCase())){inp.value=old;return toast('Site sudah ada')}if(currentSite().toLowerCase()===old.toLowerCase())$('#siteInput').value=name;sites[i].name=name;sites.sort((a,b)=>a.name.localeCompare(b.name,'id'));saveJSON('pkbon_sites',sites);renderMasters();renderRekapFilters();syncPreview();toast('Nama site diperbarui')});
  $$('[data-editproject]').forEach(inp=>inp.onchange=()=>{const i=+inp.dataset.editproject,site=sites[i];site.projectId=inp.value.trim();if(currentSite().toLowerCase()===site.name.toLowerCase())$('#projectId').value=site.projectId;saveJSON('pkbon_sites',sites);syncPreview();toast('Project ID diperbarui')});
  $$('[data-delsite]').forEach(b=>b.onclick=()=>{const i=+b.dataset.delsite;if(currentSite().toLowerCase()===sites[i].name.toLowerCase()){$('#siteInput').value='';$('#projectId').value=''}sites.splice(i,1);saveJSON('pkbon_sites',sites);renderMasters();renderRekapFilters();syncPreview()});
  $$('[data-bankname]').forEach(e=>e.onchange=()=>updateBank(+e.dataset.bankname,'nama',e.value));$$('[data-bankrek]').forEach(e=>e.onchange=()=>updateBank(+e.dataset.bankrek,'rekening',e.value));$$('[data-bankbank]').forEach(e=>e.onchange=()=>updateBank(+e.dataset.bankbank,'bank',e.value));
  $$('[data-delbank]').forEach(b=>b.onclick=()=>{if(confirm('Hapus data bank ini?')){banks.splice(+b.dataset.delbank,1);saveJSON('pkbon_banks',banks);state.bankSnapshot=null;renderMasters();syncPreview()}});
  $$('[data-tplname]').forEach(e=>e.onchange=()=>updateTemplate(+e.dataset.tplname,'name',e.value));$$('[data-tpluraian]').forEach(e=>e.onchange=()=>updateTemplate(+e.dataset.tpluraian,'uraian',e.value));$$('[data-tplsat]').forEach(e=>e.onchange=()=>updateTemplate(+e.dataset.tplsat,'sat',e.value));
  $$('[data-deltpl]').forEach(b=>b.onclick=()=>{templates.splice(+b.dataset.deltpl,1);saveJSON('pkbon_templates',templates);renderMasters();toast('Template dihapus')});
  $$('[data-offname]').forEach(inp=>inp.onchange=()=>updateOfficerField(+inp.dataset.offname,'name',inp.value));
  $$('[data-offrole]').forEach(inp=>inp.onchange=()=>updateOfficerField(+inp.dataset.offrole,'role',inp.value));
  $$('[data-offsig]').forEach(inp=>inp.onchange=async()=>{const f=inp.files[0];if(!f)return;officers[+inp.dataset.offsig].signature=await imageToDataURL(f,900,400,'image/png',0.92);saveJSON('pkbon_officers',officers);renderMasters();syncPreview();toast('Tanda tangan diperbarui')});
  $$('[data-clearsig]').forEach(b=>b.onclick=()=>{officers[+b.dataset.clearsig].signature='';saveJSON('pkbon_officers',officers);renderMasters();syncPreview();toast('Tanda tangan dihapus')});
  $$('[data-deloff]').forEach(b=>b.onclick=()=>{const i=+b.dataset.deloff,o=officers[i];if(!confirm('Hapus pejabat '+o.name+'?'))return;officers.splice(i,1);for(const k of ['a1','a2','a3','a4'])if(settings.approvalIds[k]===o.id)settings.approvalIds[k]='';saveJSON('pkbon_officers',officers);saveJSON('pkbon_settings',settings);renderMasters();renderSettings();syncPreview()});
}
function updateOfficerField(i,k,v){v=v.trim();if(!v)return renderMasters();officers[i][k]=v;saveJSON('pkbon_officers',officers);fillOfficerSelects();syncPreview();toast('Data pejabat tersimpan')}
function updateBank(i,k,v){if(!banks[i])return;banks[i][k]=v.trim();saveJSON('pkbon_banks',banks);fillSelects();syncPreview();toast('Data bank diperbarui')}
function updateTemplate(i,k,v){if(!templates[i])return;templates[i][k]=v.trim();saveJSON('pkbon_templates',templates);fillSelects();toast('Template diperbarui')}

function renderSettings(){
  $('#sNomorForm').value=settings.nomorForm||'';
  $('#sFormPrefix').value=settings.formPrefix||'MINK.002/PROJECT';
  $('#sAutoForm').checked=!!settings.autoForm;
  $('#sId').value=settings.id||'';
  $('#sNama').value=settings.nama||'';
  $('#sKota').value=settings.kota||'';
  $('#sStartNumber').value=Number(settings.startNumber)||1;
  $('#sPkbonSuffix').value='3';
  $('#sPkbonSuffix').readOnly=true;
  $('#sPkbonSuffix').title='Kode -3 bersifat paten';
  $('#formNumberPreview').textContent=currentFormNumber();
  fillOfficerSelects()
}
function saveSettings(){
  settings.nomorForm=$('#sNomorForm').value.trim();
  settings.formPrefix=$('#sFormPrefix').value.trim()||'MINK.002/PROJECT';
  settings.autoForm=$('#sAutoForm').checked;
  settings.id=$('#sId').value.trim();
  settings.nama=$('#sNama').value.trim();
  settings.kota=$('#sKota').value.trim();
  settings.autoNumber=true;
  settings.startNumber=Math.max(1,Number($('#sStartNumber').value)||1);
  settings.pkbonSuffix='3';
  settings.approvalIds={
    a1:$('#sA1Officer').value,
    a2:$('#sA2Officer').value,
    a3:$('#sA3Officer').value,
    a4:$('#sA4Officer').value
  };
  saveJSON('pkbon_settings',settings);
  if(!state.currentId&&!$('#pkbonNo').value.trim())generatePkbonNo(false);
  renderSettings();
  syncPreview();
  toast('Pengaturan disimpan')
}

function renderRekapFilters(){
  const m=$('#rekapMonth'),y=$('#rekapYear'),s=$('#rekapSite');if(!m||!y||!s)return;const oldM=m.value||String(new Date().getMonth()+1),oldY=y.value||String(new Date().getFullYear()),oldS=s.value||'';
  m.innerHTML='<option value="">Semua Bulan</option>'+MONTHS.map((x,i)=>`<option value="${i+1}">${x}</option>`).join('');m.value=oldM;
  const years=[...new Set([new Date().getFullYear(),...history.map(x=>Number(String(x.tanggal||'').slice(0,4))).filter(Boolean)])].sort((a,b)=>b-a);y.innerHTML='<option value="">Semua Tahun</option>'+years.map(v=>`<option value="${v}">${v}</option>`).join('');if([...y.options].some(o=>o.value===oldY))y.value=oldY;
  const allSites=[...new Set([...sites.map(x=>x.name),...history.map(x=>x.site).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'id'));s.innerHTML='<option value="">Semua Site</option>'+allSites.map(v=>`<option value="${attr(v)}">${esc(v)}</option>`).join('');if([...s.options].some(o=>o.value===oldS))s.value=oldS;
}
function filteredRekap(){
  const mo=$('#rekapMonth').value,yr=$('#rekapYear').value,site=$('#rekapSite').value,status=$('#rekapStatus').value,q=($('#rekapSearch').value||'').toLowerCase();return history.filter(d=>{const p=String(d.tanggal||'').split('-'),okM=!mo||Number(p[1])===Number(mo),okY=!yr||Number(p[0])===Number(yr),okS=!site||d.site===site,okStatus=!status||d.status===status,okQ=!q||JSON.stringify(d).toLowerCase().includes(q);return okM&&okY&&okS&&okStatus&&okQ}).sort((a,b)=>String(a.tanggal).localeCompare(String(b.tanggal))||String(a.pkbonNo).localeCompare(String(b.pkbonNo)));
}
function renderRekap(){
  if(!$('#rekapRows'))return;const arr=filteredRekap(),sum=arr.reduce((a,b)=>a+Number(b.total||0),0);$('#rekapCount').textContent=arr.length.toLocaleString('id-ID');$('#rekapTotal').textContent=fmt(sum);$('#rekapAverage').textContent=fmt(arr.length?sum/arr.length:0);$('#rekapRows').innerHTML=arr.length?arr.map((d,i)=>`<tr><td>${i+1}</td><td>${esc(d.pkbonNo)}</td><td>${dateID(d.tanggal)}</td><td><span class="status-badge ${String(d.status).toLowerCase()}">${esc(d.status)}</span></td><td>${esc(d.site)}</td><td>${esc(d.projectId||'')}</td><td>${esc(d.pekerjaan||'')}</td><td>${esc((d.bank?.nama||'')+(d.bank?.bank?' / '+d.bank.bank:''))}</td><td class="money">${fmt(d.total)}</td></tr>`).join(''):'<tr><td colspan="9" class="empty-cell">Tidak ada data sesuai filter.</td></tr>'
}
function xmlEsc(s=''){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function exportExcel(){
  const arr=filteredRekap();if(!arr.length)return toast('Tidak ada data untuk diekspor');const sum=arr.reduce((a,b)=>a+Number(b.total||0),0);
  const rows=[['No','Nomor PKBON','Tanggal','Status','Site','Project ID','Pekerjaan','Penerima','Bank','Total'],...arr.map((d,i)=>[i+1,d.pkbonNo,dateID(d.tanggal),d.status,d.site,d.projectId||'',d.pekerjaan||'',d.bank?.nama||'',d.bank?.bank||'',Number(d.total||0)]),['','','','','','','','','GRAND TOTAL',sum]];
  const mo=$('#rekapMonth').value,yr=$('#rekapYear').value;
  TrackersSheets.export(rows,`Rekap_PKBON_${yr||'SemuaTahun'}_${mo?String(mo).padStart(2,'0'):'SemuaBulan'}.xlsx`,'Rekap PKBON');toast('File Excel dibuat');
}

function renderDashboard(){
  const now=new Date(),ym=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`,monthDocs=history.filter(d=>String(d.tanggal||'').startsWith(ym)),outstanding=history.filter(d=>!['Terbayar','Selesai'].includes(d.status)),paid=history.filter(d=>['Terbayar','Selesai'].includes(d.status));
  $('#dashMonthTotal').textContent=fmt(monthDocs.reduce((s,d)=>s+Number(d.total||0),0));$('#dashMonthCount').textContent=`${monthDocs.length} PKBON`;$('#dashOutstandingTotal').textContent=fmt(outstanding.reduce((s,d)=>s+Number(d.total||0),0));$('#dashOutstandingCount').textContent=`${outstanding.length} dokumen`;$('#dashPaidTotal').textContent=fmt(paid.reduce((s,d)=>s+Number(d.total||0),0));$('#dashPaidCount').textContent=`${paid.length} dokumen`;$('#dashAllCount').textContent=history.length.toLocaleString('id-ID');
  $('#dashStatusPipeline').innerHTML=STATUSES.map(status=>{const docs=history.filter(d=>d.status===status),sum=docs.reduce((s,d)=>s+Number(d.total||0),0);return `<div class="pipeline-step ${docs.length?'has-items':''}"><div class="pipeline-count">${docs.length}</div><b>${status}</b><small>${fmt(sum)}</small></div>`}).join('');
  const recent=[...history].sort((a,b)=>String(b.savedAt||b.tanggal).localeCompare(String(a.savedAt||a.tanggal))).slice(0,5);$('#dashRecent').innerHTML=recent.length?recent.map(d=>`<div class="recent-row"><div><b>${esc(d.pkbonNo||'(tanpa nomor)')}</b><small>${esc(d.site||'Tanpa site')} • ${dateID(d.tanggal)}</small></div><span class="status-badge ${String(d.status).toLowerCase()}">${esc(d.status)}</span></div>`).join(''):'<p class="empty-state">Belum ada PKBON tersimpan.</p>';
}

function imageToDataURL(file,maxW=1600,maxH=1600,type='image/jpeg',quality=.86){return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onerror=reject;fr.onload=()=>{const img=new Image();img.onerror=reject;img.onload=()=>{let w=img.width,h=img.height,scale=Math.min(1,maxW/w,maxH/h);w=Math.max(1,Math.round(w*scale));h=Math.max(1,Math.round(h*scale));const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.drawImage(img,0,0,w,h);resolve(c.toDataURL(type,quality))};img.src=fr.result};fr.readAsDataURL(file)})}
async function readAttachment(input,key){const f=input.files[0];if(!f)return;if(!/^image\/(png|jpeg|webp)$/.test(f.type)||f.size>15*1024*1024)return toast('Gunakan JPG, PNG, atau WebP maksimal 15 MB.');try{const dataUrl=await imageToDataURL(f,1800,1800,'image/jpeg',.84);state[key]=dataUrl;syncPreview();uploadLampiranDrive(key,dataUrl);toast('Lampiran dimuat')}catch{toast('Gagal membaca gambar')}}
// ---- Google Drive: lampiran foto disimpan sebagai referensi, bukan base64 ----
// Keputusan Oggy: file di Drive DIBIARKAN sebagai arsip saat lampiran dihapus
// di aplikasi — modul Drive memang tidak menyediakan fungsi hapus file.
const LAMPIRAN_KEYS=['lampiranPengajuan','lampiranTransfer','lampiranBuktiBayar'];
function lampiranUrl(v){const D=window.TrackersDrive;if(D&&D.isDriveRef(v))return D.driveRefUrl(v);return v||'';}
function lampiranFullUrl(v){const D=window.TrackersDrive;if(D&&D.isDriveRef(v))return D.driveFullUrl(v);return v||'';}
function lampiranDriveId(v){const D=window.TrackersDrive;return (D&&D.isDriveRef(v))?v.driveId:'';}
function driveJenis(key){const j=String(key||'').replace(/^lampiran/,'');return j.charAt(0).toLowerCase()+j.slice(1);}
function driveDocId(){return state.currentId||(state.driveDocId=state.driveDocId||uid('pkbon'));}
// Nama file di Drive: {docId}_{jenis}_{yyyymmdd-hhmm}.jpg (flat, satu folder).
function driveFileName(key){
  const D=window.TrackersDrive;
  if(D&&D.driveBuildFilename)return D.driveBuildFilename(driveDocId(),driveJenis(key),new Date());
  return driveDocId()+'_'+driveJenis(key)+'.jpg';
}
function uploadLampiranDrive(key,dataUrl){
  const D=window.TrackersDrive;
  if(!D||!D.driveReady())return; // Drive belum dikonfigurasi -> tetap base64 lokal
  const filename=driveFileName(key);
  // Buat thumbnail mungil (~160px) untuk preview offline; yang di-upload tetap file penuh.
  D.driveMakeThumb(dataUrl,160).then(thumb=>{
    if(D.driveIsConnected()&&navigator.onLine!==false){
      D.driveUpload(dataUrl,filename).then(meta=>{
        if(state[key]===dataUrl){state[key]=D.makeRef(meta,thumb);syncPreview();}
        // kalau user sudah ganti gambar saat upload: file jadi arsip di Drive (by design)
      }).catch(()=>{
        D.driveQueueAdd(key,dataUrl,filename,thumb);
        toast('Upload Drive gagal — foto diantrekan');
      });
    }else{
      D.driveQueueAdd(key,dataUrl,filename,thumb);
    }
  });
}
// Proses antrean upload; cocokkan via dataUrl ke draft & riwayat.
function processDriveQueue(){
  const D=window.TrackersDrive;
  if(!D||!D.driveReady()||!D.driveIsConnected()||navigator.onLine===false)return;
  D.driveProcessQueue((key,ref,dataUrl)=>{
    let touched=false;
    if(state&&state[key]===dataUrl){state[key]=ref;touched=true;}
    let histTouched=false;
    history.forEach(d=>{if(d&&d[key]===dataUrl){d[key]=ref;histTouched=true;}});
    if(histTouched)saveJSON('pkbon_history',history);
    if(touched||histTouched){syncPreview();renderHistory();}
  }).then(r=>{if(r.done)toast(r.done+' foto ter-upload ke Drive');});
}
if(typeof window!=='undefined'&&window.addEventListener){
  window.addEventListener('online',()=>setTimeout(processDriveQueue,1500));
}

function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
function backupData(){const data={app:'PKBON',version:'5.0',exportedAt:new Date().toISOString(),settings,sites,banks,templates,officers,history};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});downloadBlob(blob,'PKBON_Backup_'+today()+'.json');toast('Backup berhasil dibuat')}
async function restoreData(file){
  try{
    if(file.size>40*1024*1024)throw new Error('Backup melebihi 40 MB');
    const d=JSON.parse(await file.text());
    const pk={pkbon_settings:{...DEFAULTS.settings,...(d.settings||{}),approvalIds:d.settings?.approvalIds||{}},pkbon_sites:d.sites,pkbon_banks:d.banks,pkbon_templates:d.templates||[],pkbon_officers:d.officers||[],pkbon_history:d.history};
    TrackersCore.validateSnapshot({trackly:{sites:[]},pkbon:pk});
    if(!confirm('Restore mengganti data PKBON. Pastikan Anda sudah menyimpan backup saat ini. Lanjutkan?'))return;
    TrackersCore.writeBatch(localStorage,[...cloudChangeEntries(),...Object.entries(pk).map(([k,v])=>[k,JSON.stringify(v)])]);
    location.reload();
  }catch(e){alert('Restore gagal: '+e.message);}
}

function showTab(id){
  $$('.tabpane').forEach(x=>x.classList.toggle('active',x.id===id));
  $$('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===id));
  if(id==='dashboardTab')renderDashboard();
  if(id==='settingsTab'){renderSettings();renderMasters()}
}
function openRekapModal(){
  renderRekapFilters();
  renderRekap();
  $('#rekapModal').classList.add('open');
}
function closeRekapModal(){
  $('#rekapModal').classList.remove('open');
}

function documentErrors(d){
  const errors=[];
  for(const [key,label] of [['pkbonNo','Nomor PKBON'],['tanggal','Tanggal'],['site','Site'],['projectId','Project ID'],['pekerjaan','Pekerjaan']])if(!String(d[key]||'').trim())errors.push(label+' belum diisi');
  if(d.tanggal&&!TrackersCore.date(d.tanggal))errors.push('Tanggal tidak valid');
  if(!d.bank?.nama||!d.bank?.rekening||!d.bank?.bank)errors.push('Bank/Penerima belum lengkap');
  const items=d.items||[],valid=x=>x.uraian?.trim()&&Number(x.vol)>0&&Number(x.harga)>0;
  if(!items.some(valid))errors.push('Minimal satu rincian harus memiliki uraian, volume, dan harga');
  else if(items.some(x=>(x.uraian?.trim()||Number(x.harga)>0)&&!valid(x)))errors.push('Lengkapi uraian, volume, dan harga pada semua rincian yang digunakan');
  return errors;
}
function validateDocument(){
  $$('.invalid').forEach(x=>x.classList.remove('invalid'));
  for(const id of ['pkbonNo','tanggal','siteInput','projectId','pekerjaan'])if(!$('#'+id).value)$('#'+id).classList.add('invalid');
  if(!selectedBank())$('#bankSelect').classList.add('invalid');
  return documentErrors(collect());
}

function isolatedPrintCss(){return `
@page{size:A4 portrait;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif}
#printArea{display:block;width:210mm;margin:0;padding:0;background:#fff;color:#000}
.paper{width:210mm;min-width:210mm;max-width:210mm;min-height:297mm;margin:0 auto;padding:8mm 8mm 10mm;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif;font-size:10.2pt;line-height:normal;box-shadow:none;page-break-inside:avoid}
.paper.hidden-print{display:none!important}
.page1{min-height:297mm;height:auto;max-height:none;overflow:visible;page-break-inside:auto}
.doc-table thead{display:table-header-group}.doc-table tr{break-inside:avoid}.doc-table tfoot{display:table-row-group}
.page2,.page3{page-break-before:always;break-before:page;margin-top:0}
.doc-header{display:flex;justify-content:space-between;align-items:flex-start}
.logo{width:28mm;max-height:22mm;object-fit:contain}
.titleblock{width:56%}
.titleblock h2{font-size:11.5pt;margin:4mm 0 2mm;font-weight:700}
.meta{font-size:9.6pt;border-collapse:collapse}
.meta td{padding:1px 4px}
.paper hr{border:0;border-top:2px solid #111;margin:4mm 0}
.identity{border-collapse:collapse;font-size:9.6pt}
.identity td{padding:1.2px 4px}
.identity td:first-child{width:25mm}
.identity td:nth-child(2){width:4mm}
.intro{margin:4mm 0}
.doc-table{width:100%;border-collapse:collapse;font-size:8.6pt;table-layout:fixed;background:#fff}
.doc-table th,.doc-table td{border:1px solid #111;padding:3px 5px;vertical-align:middle;background:#fff;color:#000}
.doc-table th{text-align:center;font-weight:700}
.doc-table th:nth-child(1){width:8mm}.doc-table th:nth-child(2){width:70mm}.doc-table th:nth-child(3){width:11mm}.doc-table th:nth-child(4){width:11mm}.doc-table th:nth-child(5){width:30mm}.doc-table th:nth-child(6){width:31mm}.doc-table th:nth-child(7){width:auto}
.doc-table .money{text-align:right;white-space:nowrap}.doc-table .center{text-align:center}
.doc-table tbody tr{height:5.4mm}.doc-table tfoot th,.doc-table tfoot td{font-weight:700}
.terbilang{display:grid;grid-template-columns:25mm 5mm 1fr;gap:2px;margin:3mm 0;font-style:italic;background:#fff}.terbilang strong{font-weight:700}
.bankinfo{margin:1mm 0 3mm;background:#fff}.citydate{margin:4mm 0 1mm;background:#fff}
.approval-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7mm;margin-top:2mm;break-inside:avoid}
.approval{display:flex;flex-direction:column;min-height:41mm;font-size:9pt;background:#fff}
.signature-holder{height:22mm;display:flex;align-items:flex-end;background:#fff}
.signature-holder img{height:21mm;max-width:36mm;object-fit:contain;object-position:left bottom;filter:none;opacity:1}.signature-holder img.empty{visibility:hidden}
.approval b{text-decoration:underline;margin-top:auto}.approval i{margin-top:2px}.approval span{margin-top:4px}
.attachment-title{font-weight:700;margin-bottom:3mm}.attachment-title.second{margin-top:8mm}
.attachment-box{border:1px solid #ddd;height:112mm;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#fff}
.attachment-box.full{height:255mm}.attachment-box img{max-width:100%;max-height:100%;object-fit:contain;filter:none;opacity:1}.attachment-box img.empty{display:none}
#printArea *,#printArea *::before,#printArea *::after{color:#000!important;text-shadow:none!important}
@media print{html,body,#printArea{width:210mm!important;margin:0!important;padding:0!important;background:#fff!important}.paper{margin:0 auto!important;box-shadow:none!important}}
`;}
async function performPrint(){
  rememberSite(false);
  syncPreview();

  // Resolve lampiran Drive ke gambar resolusi penuh sebelum cetak:
  // blob via Drive API kalau sedang terhubung, else URL thumbnail Drive.
  const D=window.TrackersDrive;
  const driveImgs=[...root.querySelectorAll('#printArea img[data-drive-id]')];
  if(D&&driveImgs.length){
    if(D.driveIsConnected()&&navigator.onLine!==false){
      await Promise.all(driveImgs.map(img=>{
        const id=img.getAttribute('data-drive-id');
        return D.driveFileBlobUrl(id).then(u=>{img.src=u;}).catch(()=>{img.src=D.driveThumbUrl(id,1600);});
      }));
    }else{
      driveImgs.forEach(img=>{img.src=D.driveThumbUrl(img.getAttribute('data-drive-id'),1600);});
    }
  }

  const old=document.title;
  const firstUraian=state.items.find(x=>String(x?.uraian||'').trim())?.uraian||'';
  const keterangan=$('#keteranganUmum').value.trim();
  const printTitle=buildPrintTitle($('#pkbonNo').value,keterangan,currentSite(),firstUraian);

  // Buka jendela cetak saat masih berada di event klik agar tidak dianggap popup liar.
  const pw=window.open('','_blank','width=980,height=900');
  if(!pw){
    toast('Popup cetak diblokir browser. Izinkan pop-up untuk Trackers.');
    return;
  }
  pw.document.open();
  pw.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+esc(printTitle)+'</title><style>'+isolatedPrintCss()+'</style></head><body><div id="printArea">'+root.querySelector('#printArea').innerHTML+'</div></body></html>');
  pw.document.close();

  const imgs=[...pw.document.querySelectorAll('#printArea img')].filter(img=>img.getAttribute('src'));
  await Promise.all(imgs.map(img=>{
    if(img.complete)return Promise.resolve();
    return new Promise(resolve=>{
      const done=()=>resolve();
      img.addEventListener('load',done,{once:true});
      img.addEventListener('error',done,{once:true});
      setTimeout(done,1500);
    });
  }));

  // Menunggu layout A4 terpasang sebelum print dialog dibuka.
  await new Promise(resolve=>pw.requestAnimationFrame(()=>pw.requestAnimationFrame(resolve)));
  try{
    pw.focus();
    pw.print();
  }catch(err){
    console.error('PKBON print failed',err);
    try{pw.close()}catch{}
  }
  document.title=old;
}
function printDocument(){const errors=validateDocument();if(!errors.length)return performPrint();$('#validationList').innerHTML=errors.map(x=>`<li>${esc(x)}</li>`).join('');$('#validationModal').classList.add('open')}

$$('.tab').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
$('[data-open-form]').onclick=()=>newDoc();$('[data-go-history]').onclick=()=>showTab('historyTab');
$('#openRekapModal').onclick=openRekapModal;
$('#closeRekapModal').onclick=closeRekapModal;
$('#closeRekapModalBottom').onclick=closeRekapModal;
$('#rekapModal').onclick=e=>{if(e.target.id==='rekapModal')closeRekapModal()};
$$('.settings-drop').forEach(d=>d.addEventListener('toggle',()=>{
  if(!d.open)return;
  $$('.settings-drop').forEach(other=>{if(other!==d)other.open=false});
  renderMasters();
  renderSettings();
}));

$('#btnAddRow').onclick=()=>addItem({uraian:'',sat:'Ls',vol:1,harga:0,keterangan:''});
$('#btnApplyTemplate').onclick=applyTemplate;$('#btnSaveRowTemplate').onclick=saveFirstRowAsTemplate;
$('#btnSave').onclick=saveCurrent;
$('#btnNew').onclick=()=>{if(confirm('Buat PKBON baru? Data yang belum disimpan akan hilang.'))newDoc()};
$('#btnPrint').onclick=printDocument;
$('#pkbonNo').oninput=()=>{state.pkbonAuto=false;syncPreview()};
$('#tanggal').oninput=()=>{refreshAutoNoForDate();syncPreview()};
$('#siteInput').oninput=()=>{state.workspaceSiteId='';syncPreview();};$('#siteInput').onchange=()=>{applySavedSite();rememberSite(true);syncPreview()};$('#siteInput').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();e.target.blur()}};
$('#bankSelect').onchange=()=>{state.bankSnapshot=null;syncPreview()};$('#projectId').oninput=()=>{state.workspaceSiteId='';syncPreview();};$('#projectId').onchange=()=>rememberSite(true);['pekerjaan','keteranganUmum'].forEach(id=>$('#'+id).oninput=syncPreview);
$('#lampiranPengajuan').onchange=e=>readAttachment(e.target,'lampiranPengajuan');$('#lampiranTransfer').onchange=e=>readAttachment(e.target,'lampiranTransfer');$('#lampiranBuktiBayar').onchange=e=>readAttachment(e.target,'lampiranBuktiBayar');
$$('[data-remove-attachment]').forEach(b=>b.onclick=()=>{const key=b.dataset.removeAttachment;state[key]='';const input=$('#'+key);if(input)input.value='';syncPreview();toast('Lampiran dihapus — file di Drive tetap tersimpan sebagai arsip')});
$('#historySearch').oninput=renderHistory;$('#historyStatusFilter').onchange=renderHistory;
$('#addBank').onclick=()=>{const x={nama:$('#mBankNama').value.trim(),rekening:$('#mBankRek').value.trim(),bank:$('#mBank').value.trim()};if(!x.nama)return toast('Nama penerima wajib diisi');banks.push(x);saveJSON('pkbon_banks',banks);['mBankNama','mBankRek','mBank'].forEach(id=>$('#'+id).value='');renderMasters();toast('Bank ditambahkan')};
$('#addTemplate').onclick=()=>{const name=$('#mTemplateName').value.trim(),uraian=$('#mTemplateUraian').value.trim(),sat=$('#mTemplateSat').value.trim()||'Ls';if(!name||!uraian)return toast('Nama dan uraian template wajib diisi');templates.push({id:uid('tpl'),name,uraian,sat,keterangan:''});saveJSON('pkbon_templates',templates);['mTemplateName','mTemplateUraian'].forEach(id=>$('#'+id).value='');$('#mTemplateSat').value='Ls';renderMasters();toast('Template ditambahkan')};
$('#addOfficer').onclick=async()=>{const name=$('#mOfficerName').value.trim(),role=$('#mOfficerRole').value.trim(),f=$('#mOfficerSig').files[0];if(!name||!role)return toast('Nama dan jabatan pejabat wajib diisi');let signature='';if(f)try{signature=await imageToDataURL(f,900,400,'image/png',.92)}catch{return toast('Gagal membaca tanda tangan')}officers.push({id:uid('off'),name,role,signature});saveJSON('pkbon_officers',officers);$('#mOfficerName').value='';$('#mOfficerRole').value='';$('#mOfficerSig').value='';renderMasters();renderSettings();syncPreview();toast('Pejabat ditambahkan')};
$('#saveSettings').onclick=saveSettings;
['rekapMonth','rekapYear','rekapSite','rekapStatus'].forEach(id=>$('#'+id).onchange=renderRekap);$('#rekapSearch').oninput=renderRekap;$('#btnExportExcel').onclick=exportExcel;
$('#btnBackup').onclick=backupData;$('#restoreFile').onchange=e=>{const f=e.target.files[0];if(f)restoreData(f);e.target.value=''};
$('#cancelPrint').onclick=()=>$('#validationModal').classList.remove('open');$('#forcePrint').onclick=()=>{$('#validationModal').classList.remove('open');performPrint()};$('#validationModal').onclick=e=>{if(e.target.id==='validationModal')e.currentTarget.classList.remove('open')};

renderMasters();renderSettings();renderHistory();renderRekapFilters();renderRekap();newDoc();renderDashboard();showTab('dashboardTab');
setTimeout(processDriveQueue,2000); // coba kirim antrean foto Drive yang tertunda
if(typeof window!=='undefined')window.trackersProcessDriveQueue=processDriveQueue; // dipanggil Pengaturan setelah login Google


/* ===== TRACKLY INTEGRATION ===== */
function syncTracklySites(incomingRaw){
  try{
    const incoming=(Array.isArray(incomingRaw)?incomingRaw:[])
      .map(s=>({
        name:String(s?.siteName||s?.name||'').trim(),
        projectId:String(s?.projectId||'').trim(),workspaceSiteId:s?.workspaceSiteId||'',siteId:s?.siteId||'',workType:s?.workType||''
      }))
      .filter(s=>s.name);

    if(!incoming.length)return;

    const merged=normalizeSites(Array.isArray(sites)?sites:[]);
    incoming.forEach(src=>{
      const hit=merged.find(x=>src.workspaceSiteId&&x.workspaceSiteId===src.workspaceSiteId)||merged.find(x=>!x.workspaceSiteId&&x.name.toLowerCase()===src.name.toLowerCase()&&x.projectId.toLowerCase()===src.projectId.toLowerCase());
      if(hit){
        hit.siteId=src.siteId;hit.workType=src.workType;hit.name=src.name;if(src.projectId)hit.projectId=src.projectId;if(src.workspaceSiteId)hit.workspaceSiteId=src.workspaceSiteId;
      }else{
        merged.push({...src})
      }
    });
    sites=normalizeSites(merged);
    saveJSON('pkbon_sites',sites,true);
    fillSelects();
    renderMasters()
  }catch(err){
    console.error('Trackly site sync failed',err)
  }
}

function applyTracklyTheme(t={}){
  const r=document.documentElement.style;
  const bg=t.bg||t.tone1||'#141513';
  const panel=t.panel||t.tone1Soft||'#20211f';
  const card=t.card||t.tone2Soft||'#292a27';
  const text=t.text||t.tone2||'#f3f4ed';
  const muted=t.muted||'#a5a89c';
  const line=t.line||'#353731';
  const accent=t.accent||'#b7ff52';
  const hover=t.hover||'#31332e';
  const danger=t.danger||'#ffaaa0';
  r.setProperty('--trackly-bg',bg);
  r.setProperty('--trackly-panel',panel);
  r.setProperty('--trackly-card',card);
  r.setProperty('--trackly-text',text);
  r.setProperty('--trackly-muted',muted);
  r.setProperty('--trackly-line',line);
  r.setProperty('--trackly-accent',accent);
  r.setProperty('--trackly-hover',hover);
  r.setProperty('--trackly-danger',danger);
  document.documentElement.dataset.tracklyMode=t.mode||'dark';
}

function handleTracklyCommand(d={}){
  if(d.type==='TRACKLY_LINK_SITE'){
    if(typeof opsCanEdit==='function'&&!opsCanEdit())return;
    const next=history.map(doc=>!doc.workspaceSiteId&&TrackersCore.belongs(doc,d.site,d.sites)?{...doc,workspaceSiteId:d.site.id}:doc);
    if(next.some((doc,i)=>doc!==history[i])){saveJSON('pkbon_history',next);history=next;notifyTracklyHistory('PKBON_HISTORY');}
  }
  if(d.type==='TRACKLY_SYNC_SITES')syncTracklySites(d.sites||[]);
  if(d.type==='TRACKLY_THEME')applyTracklyTheme(d.theme||{});
  if(d.type==='TRACKLY_NEW_PKBON'){
    try{
      newDoc();
      const site=String(d.siteName||'').trim();
      const project=String(d.projectId||'').trim();
      if(site)$('#siteInput').value=site;
      if(project)$('#projectId').value=project;
      state.workspaceSiteId=d.workspaceSiteId||'';
      rememberSite(false); syncPreview(); showTab('formTab');
      toast('PKBON baru untuk '+(site||'site'));
    }catch(err){console.error(err)}
  }
  if(d.type==='TRACKLY_OPEN_PKBON'){
    try{const doc=history.find(x=>String(x.id)===String(d.id));if(doc)loadDoc(doc);else toast('PKBON tidak ditemukan')}catch(err){console.error(err)}
  }
  if(d.type==='TRACKLY_REQUEST_HISTORY')notifyTracklyHistory('PKBON_HISTORY');
}
window.addEventListener('trackly:pkbon-command',e=>handleTracklyCommand(e?.detail||{}));
setTimeout(()=>{
  try{window.dispatchEvent(new CustomEvent('trackly:pkbon-event',{detail:{type:'PKBON_READY',history:Array.isArray(history)?clone(history):[]}}))}catch(_){}
},0);



/* API internal untuk Asisten AI (assets/js/ai-assistant.js).
   Diekspos agar asisten bisa membuat draft PKBON tanpa mengutak-atik DOM langsung. */
window.TrackersPkbonAPI={
  newDoc,syncPreview,renderRows,saveCurrent,generatePkbonNo,buildPkbonNo,collect,nextSequence,
  showFormTab(){showTab('formTab')},toast,today,
  getSites(){return sites.map(s=>({name:s.name,projectId:s.projectId||'',workspaceSiteId:s.workspaceSiteId||''}))},
  getBanks(){return banks.map(b=>({nama:b.nama,rekening:b.rekening,bank:b.bank}))},
  getSelectedBank(){const b=selectedBank();return b?{nama:b.nama,rekening:b.rekening,bank:b.bank,index:banks.indexOf(b)}:null},
  getHistory(){return history},
  /* Isi form dari objek draft {site,workspaceSiteId,projectId,pekerjaan,keteranganUmum,
     items:[{uraian,sat,vol,harga,keterangan}],bankIndex,bank:{nama,rekening,bank},pkbonNo,tanggal}.
     Mengembalikan hasil collect(). */
  fillDraft(d){
    newDoc();
    if(d.site){$('#siteInput').value=d.site;state.workspaceSiteId=d.workspaceSiteId||''}
    if(d.projectId!=null)$('#projectId').value=d.projectId;
    if(d.pekerjaan!=null)$('#pekerjaan').value=d.pekerjaan;
    if(d.keteranganUmum!=null)$('#keteranganUmum').value=d.keteranganUmum;
    if(Array.isArray(d.items)&&d.items.length)state.items=d.items.map(it=>({uraian:String(it.uraian||''),sat:String(it.sat||'Ls'),vol:Number(it.vol)||0,harga:Number(it.harga)||0,keterangan:String(it.keterangan||'')}));
    if(d.bankIndex!=null&&d.bankIndex!=='')$('#bankSelect').value=String(d.bankIndex);
    else if(d.bank)state.bankSnapshot={nama:d.bank.nama||'',rekening:d.bank.rekening||'',bank:d.bank.bank||''};
    if(d.pkbonNo){$('#pkbonNo').value=d.pkbonNo;state.pkbonAuto=false}
    if(d.tanggal)$('#tanggal').value=d.tanggal;
    renderRows();rememberSite(false);syncPreview();showTab('formTab');
    return collect();
  }
};

/* Native PKBON module: no iframe height bridge required. */

})();
