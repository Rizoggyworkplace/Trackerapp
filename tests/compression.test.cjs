const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../assets/js/core.js');

test('compress/decompress round-trips empty and small strings',()=>{
 assert.equal(C.decompress(C.compress('')),'');
 assert.equal(C.decompress(C.compress('a')),'a');
 assert.equal(C.decompress(C.compress('hello world')),'hello world');
});

test('compress/decompress round-trips large repetitive JSON',()=>{
 const big=JSON.stringify({sites:Array.from({length:200},(_,i)=>({id:'s'+i,siteName:'SITE_'+i+'_KARANG_SARI_BANYUASIN',projectId:'P-00'+i,tasks:Array.from({length:10},(_,j)=>({id:'t'+j,title:'Pekerjaan dokumentasi foto before-after '+j,status:'Completed'}))}))});
 const out=C.decompress(C.compress(big));
 assert.equal(out,big);
 assert.ok(C.compress(big).length<big.length/2,'expected meaningful compression');
});

test('compress/decompress round-trips unicode and Indonesian text',()=>{
 for(const s of ['Rupiah Rp 1.250.000,50','Dokumentasi pekerjaan — selesai 100%','cooperation \u{1F600} emoji','\u4e2d\u6587\u6d4b\u8bd5','a\u{1F600}b\u4e2dc','\uD83D','\uDE00']){
  assert.equal(C.decompress(C.compress(s)),s,'failed for '+JSON.stringify(s));
 }
});

test('decompress rejects invalid input instead of crashing',()=>{
 for(const bad of ['!!!','\u0000\u0001\u0002','a'.repeat(100)]){
  assert.throws(()=>C.decompress(bad),/tidak valid/,'should throw for '+JSON.stringify(bad.slice(0,10)));
 }
});

test('encodeStored/decodeStored envelope round-trips and accepts legacy plain JSON',()=>{
 const value={sites:[{id:'s1',siteName:'KARANG_SARI_BANYUASIN \u{1F600}'}],notes:['catatan']};
 const stored=C.encodeStored(value);
 assert.deepEqual(C.decodeStored(stored),value);
 assert.deepEqual(C.decodeStored(JSON.stringify(value)),value);
 assert.throws(()=>C.decodeStored('not json'),SyntaxError);
 assert.throws(()=>C.decodeStored(C.compress('x')),'envelope without marker');
});

test('normalizeSnapshot accepts v60 plain and v61 compressed snapshots',()=>{
 const plain={version:60,trackly:{sites:[{id:'s1'}]},pkbon:{pkbon_history:[]}};
 const n1=C.normalizeSnapshot(plain);
 assert.deepEqual(n1.trackly,{sites:[{id:'s1'}]});
 assert.deepEqual(n1.pkbon,{pkbon_history:[]});
 const comp={version:61,trackly_c:C.encodeEnvelope(JSON.stringify({sites:[{id:'s2'}]})),pkbon_c:C.encodeEnvelope(JSON.stringify({a:1})),saved_at:'2026-10-12T00:00:00.000Z'};
 const n2=C.normalizeSnapshot(comp);
 assert.deepEqual(n2.trackly,{sites:[{id:'s2'}]});
 assert.deepEqual(n2.pkbon,{a:1});
 assert.throws(()=>C.normalizeSnapshot(null),/tidak valid/);
 assert.throws(()=>C.normalizeSnapshot({version:61}),/tidak valid/);
 assert.throws(()=>C.normalizeSnapshot({version:61,trackly_c:{_v:1,_c:'!!!'}}),/tidak valid/);
});
