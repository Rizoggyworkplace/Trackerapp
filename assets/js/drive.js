/* Trackers Workspace — Google Drive module (lampiran foto PKBON).
 *
 * Auth via Google Identity Services (OAuth 2.0 token flow, scope drive.file —
 * minimal: hanya file yang dibuat aplikasi ini yang bisa diakses).
 * Tiap anggota tim login Google sekali via "Hubungkan Google Drive" di
 * Pengaturan; token disimpan di browser (localStorage) dan diperbarui diam-diam
 * oleh GIS selama sesi masih valid.
 *
 * Foto di-upload ke folder Drive milik Oggy (ID di-hardcode di config.js);
 * di data aplikasi hanya disimpan objek referensi:
 *   {v:1, driveId, name, mime, thumb, uploadedAt}
 * dengan thumb = thumbnail mungil ~160px (base64) untuk preview offline.
 * Lampiran lama (string base64) tetap didukung — backward compatible.
 * Tanda tangan pejabat TIDAK lewat sini (tetap base64).
 *
 * File yang dihapus di aplikasi SENGAJA tidak dihapus di Drive (arsip).
 * Modul ini tidak menyediakan fungsi hapus file — by design.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TrackersDrive = api;
})(typeof window === 'object' ? window : this, function () {
'use strict';

var SCOPE='https://www.googleapis.com/auth/drive.file';
var TOKEN_KEY='pkbonDriveToken';
var PROFILE_KEY='pkbonDriveProfile';
var QUEUE_KEY='pkbonDrivePending';
var GIS_URL='https://accounts.google.com/gsi/client';

function cfg(){
  var w=(typeof window!=='undefined')?window:{};
  var c=w.TRACKLY_CONFIG||{};
  return {clientId:c.googleClientId||'', folderId:c.driveFolderId||''};
}
function noClientId(){
  return new Error('Google Client ID belum diisi di config.js. Oggy perlu membuatnya sekali di Google Cloud Console (OAuth Client ID tipe Web) lalu menempelkannya ke config.');
}

var gisLoaded=false, gisLoading=null;
var tokenClient=null;
var accessToken='', tokenExp=0;

function loadGis(){
  if(gisLoaded)return Promise.resolve();
  if(gisLoading)return gisLoading;
  gisLoading=new Promise(function(resolve,reject){
    var s=document.createElement('script');
    s.src=GIS_URL; s.async=true; s.defer=true;
    s.onload=function(){gisLoaded=true;resolve();};
    s.onerror=function(){gisLoading=null;reject(new Error('Gagal memuat Google Identity Services. Periksa koneksi internet.'));};
    document.head.appendChild(s);
  });
  return gisLoading;
}

function saveToken(t,exp){
  accessToken=t; tokenExp=exp;
  try{localStorage.setItem(TOKEN_KEY,JSON.stringify({token:t,exp:exp}));}catch(e){}
}
function clearToken(){
  accessToken=''; tokenExp=0;
  try{localStorage.removeItem(TOKEN_KEY);}catch(e){}
}
// Pulihkan token tersimpan (kalau belum kedaluwarsa).
try{
  var sv=JSON.parse(localStorage.getItem(TOKEN_KEY)||'null');
  if(sv&&sv.token&&sv.exp>Date.now()+60000){accessToken=sv.token;tokenExp=sv.exp;}
}catch(e){}

function driveIsConnected(){return !!accessToken&&Date.now()<tokenExp-60000;}
function driveReady(){var c=cfg();return !!c.clientId&&!!c.folderId;}

function initClient(callback,errorCb){
  var c=cfg();
  tokenClient=google.accounts.oauth2.initTokenClient({
    client_id:c.clientId, scope:SCOPE,
    callback:callback, error_callback:errorCb||function(){}
  });
}

// Profil Google yang login (nama + email) — diambil sekali via Drive API
// (endpoint about, jalan dengan scope drive.file), lalu di-cache.
function getProfileCache(){
  try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'null');}catch(e){return null;}
}
function setProfileCache(p){
  try{if(p)localStorage.setItem(PROFILE_KEY,JSON.stringify(p));else localStorage.removeItem(PROFILE_KEY);}catch(e){}
}
function driveProfile(){return getProfileCache();}
function driveFetchProfile(){
  var cached=getProfileCache();
  if(!driveIsConnected())return Promise.resolve(cached);
  return fetch('https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)',{
    headers:{'Authorization':'Bearer '+accessToken}
  }).then(function(res){
    if(!res.ok)throw new Error('HTTP '+res.status);
    return res.json();
  }).then(function(j){
    var p=j&&j.user?{name:j.user.displayName||'',email:j.user.emailAddress||''}:null;
    if(p)setProfileCache(p);
    return p||cached;
  }).catch(function(){return cached;});
}

function driveSignIn(){
  var c=cfg();
  if(!c.clientId)return Promise.reject(noClientId());
  return loadGis().then(function(){
    return new Promise(function(resolve,reject){
      try{
        initClient(function(resp){
          if(resp&&resp.access_token){
            saveToken(resp.access_token,Date.now()+(resp.expires_in||3600)*1000);
            driveFetchProfile().then(function(){resolve(true);},function(){resolve(true);});
          }else reject(new Error('Login Google Drive dibatalkan.'));
        },function(){reject(new Error('Login Google Drive gagal.'));});
        tokenClient.requestAccessToken({prompt:'consent'});
      }catch(e){reject(e);}
    });
  });
}

function driveSignOut(){clearToken();setProfileCache(null);tokenClient=null;}

// Coba perbarui token diam-diam (tanpa popup). Gagal -> user harus login ulang.
function driveEnsureToken(){
  if(driveIsConnected())return Promise.resolve(accessToken);
  var c=cfg();
  if(!c.clientId)return Promise.reject(noClientId());
  return loadGis().then(function(){
    return new Promise(function(resolve,reject){
      function fail(){reject(new Error('Sesi Google Drive kedaluwarsa. Hubungkan ulang di Pengaturan.'));}
      try{
        initClient(function(resp){
          if(resp&&resp.access_token){
            saveToken(resp.access_token,Date.now()+(resp.expires_in||3600)*1000);
            resolve(accessToken);
          }else fail();
        },fail);
        tokenClient.requestAccessToken({prompt:''});
      }catch(e){fail();}
    });
  });
}

function dataUrlToBlob(dataUrl){
  var parts=dataUrl.split(','), head=parts[0]||'';
  var m=head.match(/data:(.*?);/);
  var mime=m?m[1]:'image/jpeg';
  var bin=atob(parts[1]||'');
  var arr=new Uint8Array(bin.length);
  for(var i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);
  return new Blob([arr],{type:mime});
}

function apiError(res){
  return res.json().catch(function(){return null;}).then(function(j){
    var msg='Drive API gagal ('+res.status+')';
    if(j&&j.error&&j.error.message)msg+=': '+j.error.message;
    if(res.status===401||res.status===403){clearToken();msg+=' — coba hubungkan ulang Google Drive di Pengaturan.';}
    return new Error(msg);
  });
}

// Upload dataURL (JPEG hasil resize) ke folder Drive. -> {id,name,mimeType,createdTime}
function driveUpload(dataUrl,filename){
  var c=cfg();
  if(!c.folderId)return Promise.reject(new Error('Folder Drive belum dikonfigurasi.'));
  return driveEnsureToken().then(function(token){
    var blob=dataUrlToBlob(dataUrl);
    var meta={name:filename,mimeType:blob.type||'image/jpeg',parents:[c.folderId]};
    var form=new FormData();
    form.append('metadata',new Blob([JSON.stringify(meta)],{type:'application/json'}));
    form.append('file',blob,filename);
    return fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,createdTime',{
      method:'POST',headers:{'Authorization':'Bearer '+token},body:form
    }).then(function(res){
      if(!res.ok)return apiError(res).then(function(e){throw e;});
      return res.json();
    });
  });
}

// URL thumbnail resmi Drive (tanpa API key; mengikuti sharing folder).
function driveThumbUrl(fileId,size){
  return 'https://drive.google.com/thumbnail?id='+encodeURIComponent(fileId)+'&sz=w'+(size||1000);
}
// URL tampilan penuh untuk sebuah referensi (dipakai saat cetak/preview besar).
function driveFullUrl(ref){
  if(!ref)return '';
  if(typeof ref==='string')return ref; // lampiran lama (base64)
  if(ref.driveId)return driveThumbUrl(ref.driveId,1600);
  return '';
}
// Ambil isi file via Drive API pakai token GIS -> blob URL (fallback terakhir).
function driveFileBlobUrl(fileId){
  return driveEnsureToken().then(function(token){
    return fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(fileId)+'?alt=media',{
      headers:{'Authorization':'Bearer '+token}
    }).then(function(res){
      if(!res.ok)return apiError(res).then(function(e){throw e;});
      return res.blob();
    }).then(function(b){return URL.createObjectURL(b);});
  });
}
// List isi folder lampiran (diagnostik/cek). -> [{id,name,mimeType,createdTime}]
function driveListFiles(){
  return driveEnsureToken().then(function(token){
    var c=cfg();
    var q=encodeURIComponent("'"+c.folderId+"' in parents and trashed=false");
    return fetch('https://www.googleapis.com/drive/v3/files?q='+q+'&fields=files(id,name,mimeType,createdTime)&pageSize=100&orderBy=createdTime desc',{
      headers:{'Authorization':'Bearer '+token}
    }).then(function(res){
      if(!res.ok)return apiError(res).then(function(e){throw e;});
      return res.json();
    }).then(function(j){return (j&&j.files)||[];});
  });
}

// ---- Thumbnail mungil (~160px) untuk preview offline ----
// Berjalan di browser (canvas). Di luar browser (tes) -> kembalikan dataUrl as-is.
function driveMakeThumb(dataUrl,maxDim){
  maxDim=maxDim||160;
  return new Promise(function(resolve){
    try{
      var img=new Image();
      img.onload=function(){
        try{
          var scale=Math.min(1,maxDim/Math.max(img.width||1,img.height||1));
          var w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale));
          var c=document.createElement('canvas');c.width=w;c.height=h;
          c.getContext('2d').drawImage(img,0,0,w,h);
          resolve(c.toDataURL('image/jpeg',0.72));
        }catch(e){resolve(dataUrl);}
      };
      img.onerror=function(){resolve(dataUrl);};
      img.src=dataUrl;
    }catch(e){resolve(dataUrl);}
  });
}

// ---- Nama file: {docId}_{jenis}_{yyyymmdd-hhmm}.jpg ----
function driveBuildFilename(docId,jenis,date){
  function clean(s){return String(s||'').replace(/[^\w-]+/g,'_').replace(/^_+|_+$/g,'')||'x';}
  var d=date instanceof Date?date:new Date(date||Date.now());
  function p(n){return String(n).padStart(2,'0');}
  var ts=d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'-'+p(d.getHours())+p(d.getMinutes());
  return clean(docId)+'_'+clean(jenis)+'_'+ts+'.jpg';
}

// ---- Format referensi ----
function isDriveRef(v){return !!(v&&typeof v==='object'&&v.v===1&&v.driveId);}
function driveRefUrl(ref){
  if(!ref)return '';
  if(typeof ref==='string')return ref; // lampiran lama (base64)
  return ref.thumb||driveThumbUrl(ref.driveId,1000);
}
function makeRef(meta,thumbDataUrl){
  return {v:1,driveId:meta.id,name:meta.name,mime:meta.mimeType||'image/jpeg',
    thumb:thumbDataUrl||'',uploadedAt:meta.createdTime||new Date().toISOString()};
}

// ---- Antrean offline (localStorage `pkbonDrivePending`) ----
function getQueue(){try{var q=JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]');return Array.isArray(q)?q:[];}catch(e){return [];}}
function setQueue(q){try{localStorage.setItem(QUEUE_KEY,JSON.stringify(q));}catch(e){}}
function driveQueueAdd(key,dataUrl,filename,thumb){
  var q=getQueue();
  var entry={key:key,dataUrl:dataUrl,filename:filename,thumb:thumb||'',ts:Date.now()};
  var i=q.findIndex(function(e){return e.key===key&&e.dataUrl===dataUrl;});
  if(i>=0)q[i]=entry;else q.push(entry);
  setQueue(q);
  return q.length;
}
function driveQueueRemove(key,dataUrl){
  setQueue(getQueue().filter(function(e){return !(e.key===key&&e.dataUrl===dataUrl);}));
}
function driveQueueCount(){return getQueue().length;}
// Upload semua antrean; onUploaded(key,ref,dataUrl) dipanggil tiap berhasil.
function driveProcessQueue(onUploaded){
  var q=getQueue();
  if(!q.length)return Promise.resolve({done:0,failed:0});
  var done=0,failed=0;
  var chain=Promise.resolve();
  q.slice().forEach(function(e){
    chain=chain.then(function(){
      return driveUpload(e.dataUrl,e.filename).then(function(meta){
        var ref=makeRef(meta,e.thumb||e.dataUrl);
        driveQueueRemove(e.key,e.dataUrl);
        done++;
        if(onUploaded)return onUploaded(e.key,ref,e.dataUrl);
      }).catch(function(){failed++;});
    });
  });
  return chain.then(function(){return {done:done,failed:failed};});
}

return {
  driveSignIn:driveSignIn, driveSignOut:driveSignOut,
  driveIsConnected:driveIsConnected, driveReady:driveReady,
  driveEnsureToken:driveEnsureToken, driveUpload:driveUpload,
  driveThumbUrl:driveThumbUrl, driveFullUrl:driveFullUrl,
  driveFileBlobUrl:driveFileBlobUrl, driveListFiles:driveListFiles,
  driveProfile:driveProfile, driveFetchProfile:driveFetchProfile,
  driveMakeThumb:driveMakeThumb, driveBuildFilename:driveBuildFilename,
  isDriveRef:isDriveRef,
  driveRefUrl:driveRefUrl, makeRef:makeRef,
  driveQueueAdd:driveQueueAdd, driveQueueRemove:driveQueueRemove,
  driveQueueCount:driveQueueCount, driveProcessQueue:driveProcessQueue,
  _queueList:getQueue, _queueKey:QUEUE_KEY
};
});
