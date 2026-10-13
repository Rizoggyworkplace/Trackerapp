/* Trackers Workspace — Google Drive module (lampiran foto PKBON).
 * Auth via Google Identity Services (OAuth 2.0, scope drive.file).
 * Foto di-upload ke folder Drive milik Oggy; di data aplikasi hanya
 * disimpan objek referensi {v:1, driveId, name, mime, thumb, uploadedAt}.
 * Lampiran lama (base64) tetap didukung — backward compatible.
 * Tanda tangan pejabat TIDAK lewat sini (tetap base64).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TrackersDrive = api;
})(typeof window === 'object' ? window : this, function () {
'use strict';

var SCOPE='https://www.googleapis.com/auth/drive.file';
var TOKEN_KEY='trackly_drive_token_v1';
var QUEUE_KEY='trackly_drive_queue_v1';
var GIS_URL='https://accounts.google.com/gsi/client';

function cfg(){
  var c=window.TRACKLY_CONFIG||{};
  return {clientId:c.googleClientId||'', folderId:c.driveFolderId||''};
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

function driveSignIn(){
  var c=cfg();
  if(!c.clientId)return Promise.reject(new Error('Client ID Google belum dikonfigurasi.'));
  return loadGis().then(function(){
    return new Promise(function(resolve,reject){
      try{
        initClient(function(resp){
          if(resp&&resp.access_token){
            saveToken(resp.access_token,Date.now()+(resp.expires_in||3600)*1000);
            resolve(true);
          }else reject(new Error('Login Google Drive dibatalkan.'));
        },function(){reject(new Error('Login Google Drive gagal.'));});
        tokenClient.requestAccessToken({prompt:'consent'});
      }catch(e){reject(e);}
    });
  });
}

function driveSignOut(){clearToken();tokenClient=null;}

// Coba perbarui token diam-diam (tanpa popup). Gagal -> user harus login ulang.
function driveEnsureToken(){
  if(driveIsConnected())return Promise.resolve(accessToken);
  var c=cfg();
  if(!c.clientId)return Promise.reject(new Error('Client ID Google belum dikonfigurasi.'));
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
    var msg='Upload ke Drive gagal ('+res.status+')';
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

// ---- Antrean offline (localStorage) ----
function getQueue(){try{return JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]');}catch(e){return [];}}
function setQueue(q){try{localStorage.setItem(QUEUE_KEY,JSON.stringify(q));}catch(e){}}
function driveQueueAdd(key,dataUrl,filename){
  var q=getQueue();
  var entry={key:key,dataUrl:dataUrl,filename:filename,ts:Date.now()};
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
        var ref=makeRef(meta,e.dataUrl);
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
  driveThumbUrl:driveThumbUrl, isDriveRef:isDriveRef,
  driveRefUrl:driveRefUrl, makeRef:makeRef,
  driveQueueAdd:driveQueueAdd, driveQueueRemove:driveQueueRemove,
  driveQueueCount:driveQueueCount, driveProcessQueue:driveProcessQueue,
  _queueList:getQueue
};
});
