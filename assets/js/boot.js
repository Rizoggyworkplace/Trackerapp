
/* v50 - header search */
(function(){
  const input=document.getElementById('globalAppSearch');
  if(!input) return;

  function runGlobalSearch(){
    const q=(input.value||'').trim();
    for(const id of ['regionalFilter','tenantFilter','sowFilter','statusFilter']){const el=document.getElementById(id);if(el)el.value='';}
    const archive=document.getElementById('projectArchiveFilter');if(archive)archive.value=q?'all':'active';
    const siteSearch=document.getElementById('siteSearch');
    if(siteSearch){
      siteSearch.value=q;
      siteSearch.dispatchEvent(new Event('input',{bubbles:true}));
    }

    if(q && typeof route==='function'){
      try{ route('sites'); }catch(_){}
    }
  }

  input.addEventListener('keydown',e=>{
    if(e.key==='Enter'){
      e.preventDefault();
      runGlobalSearch();
    }
  });
})();

/* Trackers Workspace PWA install */
(function(){
  let deferredInstallPrompt = null;
  const installRow = document.getElementById('installAppSettingRow');
  const installSubtitle = document.getElementById('installAppSubtitle');

  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const setInstallState = () => {
    if (!installSubtitle) return;
    if (isStandalone()) {
      installSubtitle.textContent = 'Sudah terinstal di perangkat';
      return;
    }
    if (deferredInstallPrompt) {
      installSubtitle.textContent = 'Siap diinstal di Android / perangkat ini';
      return;
    }
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      installSubtitle.textContent = 'Buka dari HTTPS / GitHub Pages untuk menginstal';
      return;
    }
    installSubtitle.textContent = 'Install Trackers Workspace di perangkat ini';
  };

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    setInstallState();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    setInstallState();
    if (typeof toast === 'function') toast('Trackers Workspace berhasil diinstal');
  });

  if (installRow) {
    installRow.addEventListener('click', async () => {
      if (isStandalone()) {
        if (typeof toast === 'function') toast('Trackers Workspace sudah terinstal');
        return;
      }
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        try { await deferredInstallPrompt.userChoice; } catch (_) {}
        deferredInstallPrompt = null;
        setInstallState();
        return;
      }
      const msg = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1'
        ? 'Jika tombol install belum muncul, buka menu Chrome lalu pilih Install app / Tambahkan ke layar utama.'
        : 'Untuk instal di Android, buka Trackers Workspace dari HTTPS seperti GitHub Pages.';
      if (typeof toast === 'function') toast(msg); else alert(msg);
    });
  }

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', {updateViaCache:'none'}).then(reg => {
        try { reg.update(); } catch (_) {}
        const offerUpdate=()=>{
          if(!reg.waiting)return;
          const notice=document.getElementById('storageWarning');if(!notice||!notice.hidden)return;
          notice.hidden=false;notice.textContent='Versi baru tersedia. Simpan form yang sedang diisi, lalu perbarui aplikasi.';
          const button=document.createElement('button');button.textContent='Perbarui';button.onclick=()=>{navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});reg.waiting.postMessage({type:'SKIP_WAITING'});};notice.appendChild(button);
        };
        offerUpdate();reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed')offerUpdate();});});
      }).catch(err => console.warn('Trackers Workspace service worker gagal didaftarkan', err));
    });
  }

  setInstallState();
})();
