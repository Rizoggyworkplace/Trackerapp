/* Asisten AI Trackers — perintah bahasa Indonesia menjadi draft PKBON (full Gemini).
   Alur: chat -> edge function ai-parse (Supabase, Gemini) -> validasi anti-halusinasi
   -> draft -> konfirmasi -> simpan. Tidak pernah auto-save.
   Nomor urut PKBON diambil dari Google Sheet operasional.
   Catatan: file ini bisa di-require dari Node untuk unit test
   (bagian UI hanya aktif bila document tersedia). */
(function(){
'use strict';

/* ================= 1. Util ================= */
const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
const escHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ROMAWI = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];


/* ================= 4. Nomor PKBON dari Google Sheet ================= */
const SHEET_ID = '1qU0Yvskf9cfDvV__yIrVZln1VHmMcPe_h1Iw5x9xZ0o';
const SHEET_TAB = 'Sheet2';
let seqCache = null;

/* Nomor urut = (nilai terbesar di kolom PKBON) + 1.
   cth: 00934-3/X/2026 -> 935. Format: pad5 + '-3/' + bulan romawi + '/' + tahun. */
function seqDariNomorPkbon(v){
  const m = String(v == null ? '' : v).match(/^(\d+)-\d+\//);
  return m ? parseInt(m[1], 10) : 0;
}
/* Baca kolom C (PKBON) via Sheets API v4 — dipakai penomoran & tulis-balik.
   v4 mengembalikan values sampai baris terakhir yang terisi (celah kosong di
   tengah tetap muncul sebagai []), jadi baris tulis selalu tepat di ujung bawah.
   JANGAN pakai gviz di sini: gviz berhenti di sel kosong pertama sehingga baris
   tulis bisa jatuh di tengah data, bahkan menimpa baris yang sudah terisi. */
async function bacaKolomC(getToken, fetchImpl){
  const f = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  if(!f) throw new Error('fetch tidak tersedia');
  const token = await (getToken || (async () => {
    if(typeof TrackersDrive === 'undefined') throw new Error('Modul Drive belum dimuat.');
    return TrackersDrive.driveEnsureToken();
  }))();
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + SHEET_ID +
    '/values/' + encodeURIComponent(SHEET_TAB + '!C1:C3000');
  const res = await f(url, {headers: {'Authorization': 'Bearer ' + token}});
  if(!res.ok) throw new Error('baca sheet gagal: HTTP ' + res.status);
  const j = await res.json();
  return (j.values || []).map(r => (r && r[0] != null) ? String(r[0]) : '');
}
async function getNextSeqFromSheet(getToken, fetchImpl){
  const col = await bacaKolomC(getToken, fetchImpl);
  let max = 0;
  for(const v of col){ const n = seqDariNomorPkbon(v); if(n > max) max = n; }
  if(!max) throw new Error('tidak ada nomor PKBON di sheet');
  seqCache = max + 1;
  return seqCache;
}

/* Baris tulis = tepat setelah baris terakhir yang terisi di kolom C..I (1-based).
   PERATURAN tulis-balik (minta Oggy, 2026-10-15):
   1. Selalu di ujung paling bawah — tidak pernah mengisi celah kosong di tengah,
      tidak pernah menimpa baris yang sudah terisi.
   2. "Terisi" dinilai dari seluruh kolom data C..I (bukan cuma C), supaya baris
      yang diisi manual tanpa nomor PKBON (kolom C kosong) tetap dihitung.
   3. Pengaman: tidak pernah menulis di/atas BARIS_MINIMAL (baris terakhir data
      saat aturan dibuat: 981). Kalau hitungan jatuh di bawahnya, pakai
      BARIS_MINIMAL + 1. */
const BARIS_MINIMAL = 981;

/* Baca grid C1:I3000: tiap elemen = array 7 sel (C..I) per baris. */
async function bacaGridCI(getToken, fetchImpl){
  const f = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  if(!f) throw new Error('fetch tidak tersedia');
  const token = await getToken();
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + SHEET_ID +
    '/values/' + encodeURIComponent(SHEET_TAB + '!C1:I3000');
  const res = await f(url, {headers: {'Authorization': 'Bearer ' + token}});
  if(!res.ok) throw new Error('baca sheet gagal: HTTP ' + res.status);
  const j = await res.json();
  return (j.values || []).map(r => (Array.isArray(r) ? r : []).slice(0, 7));
}

function barisKosong(row){
  return !(row || []).some(v => String(v == null ? '' : v).trim() !== '');
}

/* grid: array baris, tiap baris array 7 sel C..I. */
function cariBarisTulis(grid){
  let last = -1;
  (grid || []).forEach((row, i) => { if(!barisKosong(row)) last = i; });
  const hitung = last + 2; // index 0-based -> nomor baris 1-based berikutnya
  return Math.max(hitung, BARIS_MINIMAL + 1);
}

/* Nilai kolom C..I: PKBON, REGIONAL, SITE NAME, TGL. SURAT, PERIHAL, NOMINAL, PIC. */
function barisSheet(doc, pic){
  const tgl = doc.tanggal ? new Date(doc.tanggal + 'T00:00:00') : new Date();
  const tglStr = tgl.getDate() + '/' + (tgl.getMonth() + 1) + '/' + tgl.getFullYear();
  const items = (doc && doc.items) || [];
  const perihal = items.length && items[0].uraian ? items[0].uraian : '';
  const nominal = items.reduce((a, it) => a + (Number(it.vol) || 0) * (Number(it.harga) || 0), 0);
  return [doc.pkbonNo || '', '', doc.site || '', tglStr, perihal,
    'Rp ' + Number(nominal || 0).toLocaleString('id-ID'), pic || ''];
}

/* Tulis 1 baris ke sheet operasional. deps opsional (untuk test): {getToken, fetchImpl}. */
async function tulisKeSheet(doc, pic, deps){
  deps = deps || {};
  const getToken = deps.getToken || (async () => {
    if(typeof TrackersDrive === 'undefined') throw new Error('Modul Drive belum dimuat.');
    return TrackersDrive.driveEnsureToken();
  });
  const f = deps.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  if(!f) throw new Error('fetch tidak tersedia');
  const token = await getToken();
  const grid = await bacaGridCI(async () => token, f);
  const colC = grid.map(r => (r && r[0] != null) ? String(r[0]) : '');
  if(colC.some(v => String(v).trim() === String(doc.pkbonNo).trim()))
    throw new Error('Nomor ' + doc.pkbonNo + ' sudah ada di sheet — tidak ditulis ulang.');
  let baris = cariBarisTulis(grid);
  // Sabuk + suspender: kalau baris target ternyata ada sel C..I yang terisi,
  // geser ke bawah sampai ketemu baris yang C..I-nya kosong semua.
  const indexByBaris = b => (grid[b - 1] || []);
  let aman = 0;
  while(!barisKosong(indexByBaris(baris)) && aman < 5000){ baris++; aman++; }
  const range = SHEET_TAB + '!C' + baris + ':I' + baris;
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + SHEET_ID +
    '/values/' + encodeURIComponent(range) + '?valueInputOption=USER_ENTERED';
  const res = await f(url, {
    method: 'PUT',
    headers: {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'},
    body: JSON.stringify({values: [barisSheet(doc, pic)]}),
  });
  if(!res.ok){
    let msg = 'Sheets API ' + res.status;
    try{ const j = await res.json(); if(j && j.error && j.error.message) msg += ': ' + j.error.message; }catch(e){}
    if(res.status === 401 || res.status === 403)
      msg += ' — hubungkan ulang Google di Pengaturan (izin baru: akses spreadsheet).';
    throw new Error(msg);
  }
  return baris;
}

function getCachedSeq(){ return seqCache; }
function clearSeqCache(){ seqCache = null; }

/* Format sama persis dengan buildPkbonNo di pkbon.js: 00979-3/X/2026 */
function formatPkbonNo(seq, isoDate){
  const d = isoDate ? new Date(isoDate + 'T00:00:00') : new Date();
  return String(seq).padStart(5, '0') + '-3/' + ROMAWI[d.getMonth()] + '/' + d.getFullYear();
}

/* Validasi hasil LLM terhadap data ASLI (anti-halusinasi).
   Kembalikan objek siap-buatDraft, atau null bila tidak valid (hasil ditolak, jangan dipakai). */
function ambilPekerjaan(d){
  const p = String((d && d.pekerjaan) || '').trim();
  if(p) return p;
  // fallback: turunkan dari uraian (buang awalan "pembayaran/pelunasan")
  const u = String((d && d.uraian) || '').trim();
  const bersih = u.replace(/^(pembayaran|pelunasan|bayar|untuk)\s+/i, '').trim();
  return bersih || u;
}
function validasiHasilLLM(hasil, ctx){
  if(!hasil || hasil.intent !== 'buat_pkbon' || !hasil.draft) return null;
  const d = hasil.draft;
  // site: harus cocok persis dengan daftar (case-insensitive)
  let siteObj = null;
  if(d.site){
    const norm = s => String(s || '').trim().toLowerCase();
    siteObj = (ctx.sites || []).find(s => norm(s.name) === norm(d.site)) || null;
    if(!siteObj) return null; // site ngarang -> tolak
  } else return null;
  // nominal: harus angka > 0
  const nominal = Number(d.nominal);
  if(!(nominal > 0)) return null;
  // bank: cocokkan ke daftar, atau bank baru yang eksplisit
  let bankMatch = null, bankBaru = null;
  if(d.bank){
    const norm = s => String(s || '').trim().toLowerCase();
    bankMatch = (ctx.banks || []).find(b =>
      (d.bank.rekening && String(b.rekening) === String(d.bank.rekening)) ||
      (d.bank.nama && norm(b.nama) === norm(d.bank.nama))) || null;
    if(!bankMatch && d.bank.isBaru){
      bankBaru = {nama: d.bank.nama || '', rekening: d.bank.rekening || '', bank: d.bank.bank || ''};
      if(!bankBaru.nama && !bankBaru.rekening) bankBaru = null;
    }
    if(!bankMatch && !bankBaru) return null; // bank ngarang -> tolak
  } else return null;
  return {
    site: siteObj.name,
    siteObj,
    projectId: d.projectId || siteObj.projectId || '',
    pekerjaan: ambilPekerjaan(d),
    uraian: d.uraian || '',
    nominal,
    bankMatch,
    bankBaru,
  };
}


/* ================= 6. Ekspor ================= */
const TrackersAI = {
  getNextSeqFromSheet, getCachedSeq, clearSeqCache, formatPkbonNo, seqDariNomorPkbon,
  bacaKolomC, bacaGridCI, cariBarisTulis, barisKosong, barisSheet, tulisKeSheet,
  BARIS_MINIMAL,
  SHEET_ID, SHEET_TAB, norm, validasiHasilLLM,
};

if(typeof window !== 'undefined'){
  window.TrackersAI = TrackersAI;
  if(typeof document !== 'undefined'){
    if(document.readyState !== 'loading') initUI();
    else document.addEventListener('DOMContentLoaded', initUI);
  }
}
if(typeof module !== 'undefined' && module.exports) module.exports = TrackersAI;

/* ================= 7. UI Chat (browser saja) ================= */
function initUI(){
  if(typeof document === 'undefined') return;
  if(document.getElementById('tkai-fab')) return;
  const css = `
  .tkai-fab{position:fixed;right:16px;bottom:84px;z-index:9990;width:56px;height:56px;border-radius:50%;
    background:var(--accent,#16a34a);color:#fff;border:none;font-size:26px;cursor:pointer;
    box-shadow:0 4px 14px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center}
  .tkai-panel{position:fixed;right:16px;bottom:150px;z-index:9991;width:380px;max-width:calc(100vw - 32px);
    height:540px;max-height:calc(100vh - 180px);display:flex;flex-direction:column;border-radius:16px;
    background:var(--panel,#1e293b);border:1px solid var(--line,#334155);box-shadow:0 12px 40px rgba(0,0,0,.45);overflow:hidden}
  .tkai-head{display:flex;align-items:center;gap:8px;padding:12px 14px;background:var(--card,#0f172a);
    border-bottom:1px solid var(--line,#334155);color:var(--text,#f1f5f9)}
  .tkai-head b{font-size:15px}.tkai-head span{font-size:11px;color:var(--muted,#94a3b8)}
  .tkai-head button{margin-left:auto;background:none;border:none;color:var(--muted,#94a3b8);font-size:18px;cursor:pointer}
  .tkai-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px}
  .tkai-msg{max-width:88%;padding:9px 12px;border-radius:12px;font-size:13.5px;line-height:1.45;white-space:pre-wrap;word-break:break-word}
  .tkai-msg.ai{background:var(--card,#0f172a);color:var(--text,#f1f5f9);align-self:flex-start;border:1px solid var(--line,#334155)}
  .tkai-msg.user{background:var(--accent,#16a34a);color:#fff;align-self:flex-end}
  .tkai-msg.sys{background:transparent;color:var(--muted,#94a3b8);align-self:center;font-size:12px}
  .tkai-card{background:var(--bg,#020617);border:1px solid var(--line,#334155);border-radius:10px;padding:10px 12px;margin-top:8px;font-size:13px;color:var(--text,#f1f5f9)}
  .tkai-card .row{display:flex;justify-content:space-between;gap:8px;padding:2px 0}
  .tkai-card .row b{font-weight:600}
  .tkai-actions{display:flex;gap:8px;margin-top:10px}
  .tkai-actions button{flex:1;padding:9px;border-radius:10px;border:none;font-size:13.5px;font-weight:600;cursor:pointer}
  .tkai-btn-ok{background:var(--accent,#16a34a);color:#fff}
  .tkai-btn-no{background:transparent;color:var(--muted,#94a3b8);border:1px solid var(--line,#334155)!important}
  .tkai-chips{display:flex;gap:6px;flex-wrap:wrap;padding:0 12px 8px}
  .tkai-chips button{background:var(--card,#0f172a);border:1px solid var(--line,#334155);color:var(--text,#f1f5f9);
    border-radius:20px;padding:6px 12px;font-size:12.5px;cursor:pointer}
  .tkai-input{display:flex;gap:8px;padding:10px 12px;border-top:1px solid var(--line,#334155)}
  .tkai-input input{flex:1;background:var(--bg,#020617);border:1px solid var(--line,#334155);border-radius:10px;
    padding:10px 12px;color:var(--text,#f1f5f9);font-size:13.5px}
  .tkai-input button{background:var(--accent,#16a34a);color:#fff;border:none;border-radius:10px;padding:0 16px;font-size:16px;cursor:pointer}
  .tkai-typing{color:var(--muted,#94a3b8);font-size:12.5px;font-style:italic}`;
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  const fab = document.createElement('button');
  fab.id = 'tkai-fab'; fab.className = 'tkai-fab'; fab.title = 'Asisten PKBON'; fab.textContent = '🤖';
  const panel = document.createElement('div');
  panel.id = 'tkai-panel'; panel.className = 'tkai-panel'; panel.hidden = true;
  panel.innerHTML =
    '<div class="tkai-head"><b>🤖 Asisten PKBON</b><span>perintah → draft otomatis</span><button id="tkai-close" type="button">✕</button></div>' +
    '<div class="tkai-msgs" id="tkai-msgs"></div>' +
    '<div class="tkai-chips" id="tkai-chips"></div>' +
    '<form class="tkai-input" id="tkai-form"><input id="tkai-text" autocomplete="off" placeholder="cth: buatkan PKBON untuk jasa PLN 700rb…"><button type="submit">➤</button></form>';
  document.body.appendChild(fab);
  document.body.appendChild(panel);

  const msgs = panel.querySelector('#tkai-msgs');
  const chipsBox = panel.querySelector('#tkai-chips');
  let opened = false;

  function addMsg(kind, html, skipMemory){
    const d = document.createElement('div');
    d.className = 'tkai-msg ' + kind;
    d.innerHTML = html;
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
    if(!skipMemory && (kind === 'user' || kind === 'ai')) catatRiwayat(kind, html);
    return d;
  }
  function setChips(list){
    chipsBox.innerHTML = '';
    (list || []).forEach(c => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = c.label;
      b.onclick = () => c.onClick ? c.onClick() : handleUser(c.text);
      chipsBox.appendChild(b);
    });
  }

  fab.onclick = () => {
    panel.hidden = !panel.hidden;
    if(!panel.hidden && !opened){
      opened = true;
      addMsg('ai', 'Halo! Gue bisa bikinin <b>draft PKBON</b> dari perintah biasa. Contoh:<br><br>' +
        '• <i>buatkan PKBON untuk pelunasan jasa PLN 700rb, transfer ke Baidhowi</i><br>' +
        '• <i>bayarkan multiguna site Sendangreto Rp 3.309.543 ke pak Joko</i><br><br>' +
        'Nomor PKBON gue ambil otomatis dari sheet operasional, dan sheet-nya ikut keisi pas lu simpan. Coba ketik perintah 👇', true);
    }
    if(!panel.hidden) panel.querySelector('#tkai-text').focus();
  };
  panel.querySelector('#tkai-close').onclick = () => { panel.hidden = true; };
  panel.querySelector('#tkai-form').onsubmit = e => {
    e.preventDefault();
    const inp = panel.querySelector('#tkai-text');
    const v = inp.value.trim();
    if(!v) return;
    inp.value = '';
    handleUser(v);
  };

  /* ---------- state percakapan ---------- */
  let pending = null; // {type:'confirm', draft}
  const riwayat = []; // memori percakapan untuk LLM: [{role:'user'|'ai', text}]
  function catatRiwayat(role, text){
    const bersih = String(text == null ? '' : text).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if(!bersih) return;
    riwayat.push({role, text: bersih.slice(0, 500)});
    while(riwayat.length > 12) riwayat.shift();
  }
  let busy = false;

  function pkbonReady(){
    return new Promise((resolve, reject) => {
      if(window.TrackersPkbonAPI) return resolve();
      let done = false;
      const ok = () => { if(!done){ done = true; window.removeEventListener('trackly:pkbon-event', onEv); resolve(); } };
      const onEv = e => { if(e && e.detail && e.detail.type === 'PKBON_READY') ok(); };
      window.addEventListener('trackly:pkbon-event', onEv);
      try{ if(typeof ensurePkbonModule === 'function') ensurePkbonModule(); }catch(_){}
      setTimeout(() => {
        if(window.TrackersPkbonAPI) ok();
        else if(!done){ done = true; window.removeEventListener('trackly:pkbon-event', onEv); reject(new Error('timeout')); }
      }, 10000);
    });
  }

  function maskRek(r){
    r = String(r || '');
    return r.length > 4 ? '••••' + r.slice(-4) : r;
  }
  function fmtRp(n){ return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); }

  async function getCtx(){
    await pkbonReady();
    if(typeof route === 'function'){ try{ route('pkbon'); }catch(_){} }
    const api = window.TrackersPkbonAPI;
    return {api, sites: api.getSites(), banks: api.getBanks()};
  }

  async function nextSeq(){
    try{
      const s = await getNextSeqFromSheet();
      return {seq: s, sumber: 'sheet'};
    }catch(e){
      try{
        const api = window.TrackersPkbonAPI;
        if(api && typeof api.nextSequence === 'function') return {seq: api.nextSequence(), sumber: 'lokal'};
      }catch(_){}
      return {seq: null, sumber: null};
    }
  }

  function kartuDraft(d){
    const b = d.bankTampil;
    return '<div class="tkai-card">' +
      '<div class="row"><span>Nomor</span><b>' + escHtml(d.pkbonNo) + '</b></div>' +
      '<div class="row"><span>Tanggal</span><b>' + escHtml(d.tanggalTampil) + '</b></div>' +
      '<div class="row"><span>Site</span><b>' + escHtml(d.site) + '</b></div>' +
      '<div class="row"><span>Uraian</span><b>' + escHtml(d.uraian) + '</b></div>' +
      '<div class="row"><span>Nominal</span><b>' + escHtml(fmtRp(d.nominal)) + '</b></div>' +
      '<div class="row"><span>Penerima</span><b>' + escHtml(b.nama) + ' — ' + escHtml(b.bank) + ' ' + escHtml(maskRek(b.rekening)) + '</b></div>' +
      (d.sumber === 'sheet' ? '<div class="row"><span>Nomor dari</span><b>sheet operasional ✓</b></div>' : '') +
      '</div>';
  }

  function tampilKonfirmasi(d){
    const m = addMsg('ai', 'Siap, draft PKBON udah gue siapin. Cek dulu ya:' + kartuDraft(d) +
      '<div class="tkai-actions"><button type="button" class="tkai-btn-ok" data-aksi="simpan">✅ Simpan</button>' +
      '<button type="button" class="tkai-btn-no" data-aksi="batal">Batal</button></div>');
    m.querySelector('[data-aksi="simpan"]').onclick = () => simpanDraft();
    m.querySelector('[data-aksi="batal"]').onclick = () => {
      pending = null; setChips([]);
      addMsg('sys', 'Draft dibatalkan. Form tetap terisi — bisa lu edit manual.');
    };
    setChips([]);
  }

  async function simpanDraft(){
    if(!pending || pending.type !== 'confirm') return;
    const d = pending.draft;
    pending = null; setChips([]);
    addMsg('sys', 'Menyimpan…');
    try{
      const api = window.TrackersPkbonAPI;
      api.saveCurrent();
      const found = (api.getHistory() || []).find(x => x && x.pkbonNo === d.pkbonNo);
      if(found){
        addMsg('ai', '✅ <b>Berhasil disimpan!</b><br>PKBON <b>' + escHtml(d.pkbonNo) + '</b> — ' + escHtml(fmtRp(d.nominal)) + ' untuk ' + escHtml(d.site) + '.<br>Tinggal dilengkapi lampiran kalau ada, terus cetak/unduh PDF seperti biasa.');
        // tulis-balik ke sheet operasional (tidak menggagalkan simpan bila error)
        let pic = '';
        try{
          const prof = (typeof TrackersDrive !== 'undefined' && TrackersDrive.driveProfile) ? TrackersDrive.driveProfile() : null;
          pic = (prof && prof.name) || '';
        }catch(e){}
        tulisKeSheet(found, pic).then(
          baris => addMsg('ai', '📊 Sheet operasional ikut keisi otomatis (baris ' + baris + ').'),
          err => {
            addMsg('ai', '⚠️ PKBON kesimpan, tapi sheet belum keisi: ' + escHtml(err.message));
            setChips([{label: '🔁 Coba isi sheet lagi', onClick: () => {
              setChips([]);
              tulisKeSheet(found, pic).then(
                b => addMsg('ai', '📊 Sheet keisi (baris ' + b + ').'),
                e2 => addMsg('ai', 'Masih gagal: ' + escHtml(e2.message)));
            }}]);
          }
        );
      }
      else addMsg('ai', 'Hmm, penyimpanannya kayaknya gagal (mungkin ada field wajib yang kosong). Coba cek form-nya langsung ya.');
    }catch(e){
      addMsg('ai', 'Gagal menyimpan: ' + escHtml(e.message));
    }
  }

  async function buatDraft(d){
    const ctx = await getCtx();
    const api = ctx.api;
    const tanggal = api.today();
    const n = await nextSeq();
    if(!n.seq){
      addMsg('ai', 'Gue nggak bisa ambil nomor urut (sheet nggak kebaca & data lokal kosong). Cek koneksi internet dulu ya.');
      return;
    }
    const pkbonNo = formatPkbonNo(n.seq, tanggal);
    const bankIdx = d.bankMatch ? ctx.banks.findIndex(b => b.nama === d.bankMatch.nama && b.rekening === d.bankMatch.rekening) : -1;
    const doc = api.fillDraft({
      site: d.site,
      workspaceSiteId: d.siteObj ? (d.siteObj.workspaceSiteId || '') : '',
      projectId: d.projectId,
      pekerjaan: d.pekerjaan,
      items: [{uraian: d.uraian, sat: 'Ls', vol: 1, harga: d.nominal, keterangan: ''}],
      bankIndex: bankIdx >= 0 ? bankIdx : undefined,
      bank: bankIdx < 0 && d.bankBaru ? d.bankBaru : undefined,
      pkbonNo, tanggal,
    });
    const bankTampil = bankIdx >= 0 ? ctx.banks[bankIdx] : (d.bankBaru || d.bankMatch || {nama:'-', bank:'', rekening:''});
    const dt = new Date(tanggal + 'T00:00:00');
    pending = {type: 'confirm', draft: {
      pkbonNo, tanggal, tanggalTampil: dt.toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'}),
      site: d.site, uraian: d.uraian, nominal: d.nominal, bankTampil, sumber: n.sumber, docId: doc && doc.id,
    }};
    tampilKonfirmasi(pending.draft);
  }

  /* ---------- Gemini via edge function ai-parse ---------- */
  function bangunKonteksLLM(ctx){
    const api = ctx.api;
    let history = [];
    try{
      history = (api.getHistory() || []).slice(0, 5).map(h => ({
        pkbonNo: h.pkbonNo || '',
        uraian: (h.items && h.items[0] && h.items[0].uraian) || '',
        site: h.site || '',
        nominal: h.total || 0,
        bankNama: (h.bank && h.bank.nama) || '',
      }));
    }catch(_){}
    let formState = null;
    try{
      formState = {
        site: (document.querySelector('#siteInput') || {}).value || '',
        pekerjaan: (document.querySelector('#pekerjaan') || {}).value || '',
        keterangan: (document.querySelector('#keteranganUmum') || {}).value || '',
      };
    }catch(_){}
    return {
      sites: (ctx.sites || []).map(s => ({name: s.name, projectId: s.projectId || ''})),
      banks: (ctx.banks || []).map(b => ({nama: b.nama, rekening: b.rekening, bank: b.bank})),
      history,
      formState,
      conversation: riwayat.slice(-6),
    };
  }

  async function panggilLLM(teksAsli, ctx, sudahRetry){
    try{
      const cc = (typeof cloudClient !== 'undefined') ? cloudClient : null;
      if(!cc) return {error: 'cloudClient null (klien Supabase belum siap / belum login)'};
      const {data, error} = await cc.functions.invoke('ai-parse', {
        body: {text: teksAsli, context: bangunKonteksLLM(ctx)},
      });
      if(error){
        const namaErr = String((error && error.name) || '') + ' ' + String((error && error.message) || '');
        // Gangguan jaringan sesaat (fetch gagal) -> coba sekali lagi otomatis
        if(!sudahRetry && /fetch|network|failed to send/i.test(namaErr)){
          await new Promise(r => setTimeout(r, 2000));
          return panggilLLM(teksAsli, ctx, true);
        }
        let detail = (error && error.message) || String(error);
        try{
          const res = error && error.context;
          if(res && typeof res.text === 'function'){
            const txt = await res.clone().text();
            try{ const j = JSON.parse(txt); if(j && j.error) detail = j.error; }catch(_){}
            if(res.status) detail += ' (HTTP ' + res.status + ')';
          }
        }catch(_){}
        try{ console.error('[ai-parse] invoke error:', error); }catch(_){}
        return {error: detail};
      }
      if(!data || !data.ok || !data.result) return {error: 'respons function tidak ok'};
      return data.result; // {intent, draft, butuh, tanya}
    }catch(e){
      return {error: 'exception: ' + ((e && e.message) || e)};
    }
  }

  async function handleUser(teks){
    addMsg('user', escHtml(teks));
    if(busy) return;
    // jawaban atas konfirmasi draft
    if(pending && pending.type === 'confirm'){
      if(/^(ya|iya|simpan|ok|oke|lanjut|gas)$/i.test(teks.trim())){ simpanDraft(); return; }
      if(/^(batal|gak|nggak|tidak)$/i.test(teks.trim())){
        pending = null; setChips([]);
        addMsg('sys', 'Draft dibatalkan. Form tetap terisi — bisa lu edit manual.');
        return;
      }
      pending = null; // jawaban lain -> anggap perintah baru
    }
    busy = true;
    const typing = addMsg('sys', 'mikiiir… 🤔');
    try{
      const ctx = await getCtx();
      const hasil = await panggilLLM(teks, ctx);
      typing.remove();
      if(!hasil || hasil.error){
        addMsg('ai', 'AI-nya error: <b>' + escHtml((hasil && hasil.error) || 'tidak diketahui') + '</b><br><br>' +
          'Screenshot pesan ini kirim ke gue ya biar ketahuan penyebabnya. 🙏');
        return;
      }
      if(hasil.intent !== 'buat_pkbon' || !hasil.draft){
        addMsg('ai', hasil.tanya ? escHtml(hasil.tanya) :
          'Hmm, gue belum ngerti. Gue bisa bikinin <b>draft PKBON</b> dari perintah kayak:<br><br>' +
          '<i>buatkan PKBON untuk pelunasan jasa PLN 700rb transfer ke Baidhowi</i>');
        return;
      }
      const mapped = validasiHasilLLM(hasil, ctx);
      if(!mapped){
        addMsg('ai', hasil.tanya ? escHtml(hasil.tanya) :
          'Gue nggak yakin sama datanya \u2014 site/bank/nominal nggak cocok sama data yang ada. Coba perjelas ya.');
        return;
      }
      await buatDraft(mapped);
    }catch(e){
      typing.remove();
      addMsg('ai', 'Waduh, ada error: ' + escHtml(e.message || e));
    }finally{
      busy = false;
    }
  }


  window.TrackersAI.handleUser = handleUser;
}

})();
