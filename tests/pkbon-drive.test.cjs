const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');

// Mock browser globals sebelum modul dimuat.
const store={
  pkbonDriveToken: JSON.stringify({token:'test-token',exp:Date.now()+3600*1000}),
};
global.window={TRACKLY_CONFIG:{googleClientId:'test-client-id',driveFolderId:'test-folder-id'}};
global.localStorage={
  getItem:k=>(k in store?store[k]:null),
  setItem:(k,v)=>{store[k]=String(v);},
  removeItem:k=>{delete store[k];}
};
// Stub fetch untuk Drive API (upload, about, alt=media, list).
const fetchCalls=[];
global.fetch=async(url,opts)=>{
  fetchCalls.push({url:String(url),opts:opts||{}});
  const u=String(url);
  if(u.includes('/drive/v3/about'))
    return {ok:true,json:async()=>({user:{displayName:'Oggy',emailAddress:'oggy@example.test'}})};
  if(u.includes('/upload/drive/v3/files'))
    return {ok:true,json:async()=>({id:'file123',name:'f.jpg',mimeType:'image/jpeg',createdTime:'2026-10-13T12:00:00.000+07:00'})};
  if(u.includes('alt=media'))
    return {ok:true,blob:async()=>({size:1})};
  if(u.includes('/drive/v3/files?q='))
    return {ok:true,json:async()=>({files:[{id:'a',name:'x.jpg',mimeType:'image/jpeg',createdTime:'t'}]})};
  return {ok:false,status:404,json:async()=>({error:{message:'not found'}})};
};
global.URL.createObjectURL=()=>'blob:mock-url';

const D=require('../assets/js/drive.js');

test('driveBuildFilename: format {docId}_{jenis}_{yyyymmdd-hhmm}.jpg',()=>{
  const d=new Date(2026,9,13,10,42);
  const p=n=>String(n).padStart(2,'0');
  const ts=`${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  assert.equal(D.driveBuildFilename('pkbon9f2','buktiBayar',d),`pkbon9f2_buktiBayar_${ts}.jpg`);
  assert.equal(D.driveBuildFilename('pkbon9f2','pengajuan',d),`pkbon9f2_pengajuan_${ts}.jpg`);
  // sanitasi: tanpa karakter ilegal untuk nama file
  const dirty=D.driveBuildFilename('a/b:c','d e?f',d);
  assert.doesNotMatch(dirty,/[\/:*?"<>| ]/);
  assert.ok(dirty.endsWith('.jpg'));
});

test('antrean offline memakai key localStorage pkbonDrivePending',()=>{
  D.driveQueueAdd('lampiranBuktiBayar','data:image/jpeg;base64,IMG','f.jpg','data:thumb160');
  assert.ok('pkbonDrivePending' in store,'key antrean harus pkbonDrivePending');
  assert.equal(D._queueKey,'pkbonDrivePending');
  const q=JSON.parse(store.pkbonDrivePending);
  assert.equal(q.length,1);
  assert.equal(q[0].thumb,'data:thumb160');
  D.driveQueueRemove('lampiranBuktiBayar','data:image/jpeg;base64,IMG');
  assert.equal(D.driveQueueCount(),0);
});

test('driveMakeThumb: tanpa canvas (node) kembalikan dataUrl as-is',async()=>{
  const inUrl='data:image/jpeg;base64,IMG';
  assert.equal(await D.driveMakeThumb(inUrl,160),inUrl);
});

test('driveProcessQueue: upload antrean -> ref pakai thumb mungil, antrean kosong',async()=>{
  fetchCalls.length=0;
  D.driveQueueAdd('lampiranBuktiBayar','data:image/jpeg;base64,IMG','pkbon9f2_buktiBayar_20261013-1042.jpg','data:thumb160');
  let got=null;
  const r=await D.driveProcessQueue((key,ref)=>{got={key,ref};});
  assert.equal(r.done,1);assert.equal(r.failed,0);
  assert.equal(got.key,'lampiranBuktiBayar');
  assert.equal(got.ref.v,1);
  assert.equal(got.ref.driveId,'file123');
  assert.equal(got.ref.thumb,'data:thumb160','thumb harus yang mungil, bukan gambar penuh');
  assert.equal(D.driveQueueCount(),0);
  const up=fetchCalls.find(c=>c.url.includes('/upload/drive/v3/files'));
  assert.ok(up,'harus memanggil endpoint upload Drive');
  assert.equal(up.opts.headers.Authorization,'Bearer test-token');
});

test('driveFullUrl: URL resolusi penuh untuk cetak; string lama diteruskan',()=>{
  const u=D.driveFullUrl({v:1,driveId:'abc123',thumb:'data:t'});
  assert.ok(u.includes('abc123')&&u.includes('w1600'));
  assert.equal(D.driveFullUrl('data:image/jpeg;base64,old'),'data:image/jpeg;base64,old');
  assert.equal(D.driveFullUrl(null),'');
});

test('driveFetchProfile: nama+email ter-cache untuk status "terhubung sebagai"',async()=>{
  const p=await D.driveFetchProfile();
  assert.deepEqual(p,{name:'Oggy',email:'oggy@example.test'});
  assert.deepEqual(D.driveProfile(),{name:'Oggy',email:'oggy@example.test'});
  assert.ok('pkbonDriveProfile' in store);
});

test('driveListFiles: cek isi folder lampiran',async()=>{
  const files=await D.driveListFiles();
  assert.equal(files.length,1);
  assert.equal(files[0].id,'a');
});

test('driveSignIn: tanpa Client ID ditolak dengan pesan yang jelas',async()=>{
  const keep=global.window.TRACKLY_CONFIG;
  global.window.TRACKLY_CONFIG={googleClientId:'',driveFolderId:'fid'};
  await assert.rejects(D.driveSignIn(),/Client ID/);
  global.window.TRACKLY_CONFIG=keep;
});

test('driveUpload: tanpa folderId ditolak',async()=>{
  const keep=global.window.TRACKLY_CONFIG;
  global.window.TRACKLY_CONFIG={googleClientId:'cid',driveFolderId:''};
  await assert.rejects(D.driveUpload('data:image/jpeg;base64,IMG','f.jpg'),/Folder Drive/);
  global.window.TRACKLY_CONFIG=keep;
});

test('tidak ada fungsi hapus file Drive (arsip by design)',()=>{
  assert.equal(typeof D.driveDeleteFile,'undefined');
  assert.equal(typeof D.driveDelete,'undefined');
  const src=fs.readFileSync(path.join(__dirname,'../assets/js/drive.js'),'utf8');
  assert.doesNotMatch(src,/method:\s*['"]DELETE['"]/);
});
