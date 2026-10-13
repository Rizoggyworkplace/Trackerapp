const test=require('node:test'),assert=require('node:assert/strict');

// Mock browser globals sebelum modul dimuat.
const store={};
global.window={};
global.localStorage={
  getItem:k=>(k in store?store[k]:null),
  setItem:(k,v)=>{store[k]=String(v);},
  removeItem:k=>{delete store[k];}
};

const D=require('../assets/js/drive.js');

test('isDriveRef: deteksi objek referensi, tolak base64 & sampah',()=>{
  assert.equal(D.isDriveRef({v:1,driveId:'abc'}),true);
  assert.equal(D.isDriveRef('data:image/jpeg;base64,xxx'),false);
  assert.equal(D.isDriveRef(''),false);
  assert.equal(D.isDriveRef(null),false);
  assert.equal(D.isDriveRef(undefined),false);
  assert.equal(D.isDriveRef({driveId:'abc'}),false);
  assert.equal(D.isDriveRef({v:1}),false);
  assert.equal(D.isDriveRef({v:2,driveId:'abc'}),false);
});

test('driveRefUrl: prioritaskan thumb embedded, fallback URL thumbnail',()=>{
  const ref={v:1,driveId:'abc123',thumb:'data:image/jpeg;base64,thumb'};
  assert.equal(D.driveRefUrl(ref),'data:image/jpeg;base64,thumb');
  const ref2={v:1,driveId:'abc123',thumb:''};
  const u=D.driveRefUrl(ref2);
  assert.ok(u.includes('abc123')&&u.includes('thumbnail'));
  // backward compat: string base64 lama diteruskan apa adanya
  assert.equal(D.driveRefUrl('data:image/jpeg;base64,old'),'data:image/jpeg;base64,old');
  assert.equal(D.driveRefUrl(''),'');
  assert.equal(D.driveRefUrl(null),'');
});

test('driveThumbUrl: bangun URL thumbnail Drive',()=>{
  const u=D.driveThumbUrl('abc123',500);
  assert.ok(u.startsWith('https://drive.google.com/thumbnail?id='));
  assert.ok(u.includes('abc123')&&u.includes('w500'));
});

test('makeRef: bentuk objek referensi yang disimpan',()=>{
  const ref=D.makeRef({id:'id1',name:'f.jpg',mimeType:'image/jpeg',createdTime:'2026-10-13T00:00:00.000Z'},'data:thumb');
  assert.deepEqual(ref,{v:1,driveId:'id1',name:'f.jpg',mime:'image/jpeg',thumb:'data:thumb',uploadedAt:'2026-10-13T00:00:00.000Z'});
});

test('antrean: tambah/hitung/hapus + dedupe',()=>{
  assert.equal(D.driveQueueCount(),0);
  D.driveQueueAdd('k1','data:url1','f1.jpg');
  D.driveQueueAdd('k2','data:url2','f2.jpg');
  assert.equal(D.driveQueueCount(),2);
  D.driveQueueAdd('k1','data:url1','f1.jpg'); // entri sama -> timpa, bukan dobel
  assert.equal(D.driveQueueCount(),2);
  D.driveQueueRemove('k1','data:url1');
  assert.equal(D.driveQueueCount(),1);
  D.driveQueueRemove('k2','data:url2');
  assert.equal(D.driveQueueCount(),0);
});

test('driveReady: butuh clientId + folderId di config',()=>{
  assert.equal(D.driveReady(),false);
  global.window.TRACKLY_CONFIG={googleClientId:'cid',driveFolderId:'fid'};
  assert.equal(D.driveReady(),true);
  global.window.TRACKLY_CONFIG={googleClientId:'cid'};
  assert.equal(D.driveReady(),false);
  global.window.TRACKLY_CONFIG={};
  assert.equal(D.driveReady(),false);
});

test('referensi selamat dari clone JSON (dipakai app via JSON.parse/stringify)',()=>{
  const ref={v:1,driveId:'x',name:'n',mime:'image/jpeg',thumb:'t',uploadedAt:'u'};
  const back=JSON.parse(JSON.stringify(ref));
  assert.deepEqual(back,ref);
  assert.equal(D.isDriveRef(back),true);
});
