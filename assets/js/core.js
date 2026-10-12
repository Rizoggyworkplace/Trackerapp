/* Pure data helpers shared by the workspace and its regression tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TrackersCore = api;
})(typeof window === 'object' ? window : this, function () {
  'use strict';
  const text = v => String(v ?? '').trim();
  const norm = v => text(v).toLocaleLowerCase('id-ID');
  const stages = ['BOQ', 'PO', 'BAUT', 'BAPWP', 'BAST', 'GR'];
  function date(value) {
    if (value instanceof Date) {
      if (!Number.isFinite(value.getTime())) return '';
      return [value.getFullYear(), String(value.getMonth()+1).padStart(2,'0'), String(value.getDate()).padStart(2,'0')].join('-');
    }
    let s = text(value), m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T.*)?$/);
    if (!m) { const d = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/); if (d) m = [s,d[3],d[2],d[1]]; }
    if (!m) return '';
    const [y,mo,d] = m.slice(1).map(Number), check = new Date(Date.UTC(y,mo-1,d));
    if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo-1 || check.getUTCDate() !== d) return '';
    return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  function money(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
    const s = text(value).replace(/^Rp\s*/i,'').replace(/\s/g,'');
    if (!s || /^-/.test(s)) return 0;
    // Indonesian grouped input (1.250.000 / 1.250,50), or an ungrouped decimal.
    const n = s.includes(',') ? Number(s.replace(/\./g,'').replace(',','.')) : /^\d{1,3}(\.\d{3})+$/.test(s) ? Number(s.replace(/\./g,'')) : Number(s);
    return Number.isFinite(n) ? Math.max(0,Math.round(n)) : 0;
  }
  // Live rupiah fields always use dots as thousands separators, even while a group is incomplete.
  // Keep this separate from money(), which also reads numeric/decimal saved data.
  function moneyInput(field) {
    const raw=String(field.value||''),caret=field.selectionStart;
    const before=caret==null?null:(raw.slice(0,caret).match(/\d/g)||[]).length;
    const amount=money(raw.replace(/\./g,''));
    field.value=amount?amount.toLocaleString('id-ID'):'';
    if(before!==null&&typeof field.setSelectionRange==='function'){
      let position=0,seen=0;
      while(position<field.value.length&&seen<before){if(/\d/.test(field.value[position]))seen++;position++;}
      field.setSelectionRange(position,position);
    }
    return amount;
  }
  function csvParse(raw) {
    const src = String(raw).replace(/^\uFEFF/,''), first = src.split(/\r?\n/)[0];
    const sep = (first.match(/;/g)||[]).length > (first.match(/,/g)||[]).length ? ';' : ',';
    let row=[],cell='',quoted=false; const rows=[];
    for(let i=0;i<src.length;i++) {
      const c=src[i];
      if(c==='"') { if(quoted&&src[i+1]==='"'){cell+='"';i++;} else quoted=!quoted; }
      else if(c===sep&&!quoted){row.push(cell);cell='';}
      else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&src[i+1]==='\n')i++;row.push(cell);if(row.some(text))rows.push(row);row=[];cell='';}
      else cell+=c;
    }
    if(quoted)throw new Error('Tanda kutip CSV belum ditutup.');
    row.push(cell);if(row.some(text))rows.push(row);
    if(!rows.length)return [];
    const headers=rows.shift().map(text);
    if(new Set(headers).size!==headers.length)throw new Error('Judul kolom CSV harus unik.');
    return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));
  }
  function csvWrite(rows) {
    return '\uFEFF'+rows.map(row=>row.map(v=>{
      let s=String(v??'');
      if(typeof v!=='number'&&/^[\t\r =+@-]/.test(s))s="'"+s;
      return '"'+s.replace(/"/g,'""')+'"';
    }).join(',')).join('\r\n');
  }
  function bastProgress(r) {
    const list=[
      {name:'BOQ',done:!!text(r.boqLink),state:text(r.boqLink)?'Done':'Belum lengkap'},
      {name:'PO',done:!!(text(r.poLink)&&text(r.poNumber)&&date(r.poDate)),state:'Belum lengkap'},
      ...['BAUT','BAPWP','BAST'].map(name=>{const k=name.toLowerCase(),done=r[k+'Process']==='Done'&&!!text(r[k+'Input']);return {name,done,state:r[k+'Process']==='Done'&&!done?'Belum lengkap':r[k+'Process']||'Need Approval PM'};})
    ];
    if(list[1].done)list[1].state='Done';
    const done=list.filter(x=>x.done).length;
    return {stages:list,done,pct:Math.round(done/list.length*100),archived:done===list.length};
  }
  function toggleBast(rows,index) {
    if(index<0||index>=rows.length)return rows;
    if(rows[index].done)rows.slice(index).forEach(x=>x.done=false);
    else if(index===0||rows.slice(0,index).every(x=>x.done))rows[index].done=true;
    return rows;
  }
  function belongs(doc,site,allSites=[]) {
    if(!site)return false;
    if(doc.workspaceSiteId)return doc.workspaceSiteId===site.id;
    if(norm(doc.projectId)&&norm(site.projectId)){
      const matches=s=>norm(doc.projectId)===norm(s.projectId)&&(!norm(doc.site)||norm(doc.site)===norm(s.siteName));
      return matches(site)&&(!allSites.length||allSites.filter(matches).length===1);
    }
    return !!norm(doc.site)&&norm(doc.site)===norm(site.siteName)&&allSites.filter(s=>norm(s.siteName)===norm(site.siteName)).length===1;
  }
  function total(items) { return (Array.isArray(items)?items:[]).reduce((sum,x)=>sum+Math.max(0,Number(x.vol)||0)*money(x.harga),0); }
  function validateSnapshot(value) {
    const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
    const records=(v,label)=>{if(v!==undefined&&(!Array.isArray(v)||v.some(x=>!object(x))))throw new Error('Data '+label+' tidak valid.');};
    const fields=(v,label)=>{for(const [k,x]of Object.entries(v)){if(x!==null&&typeof x==='object')throw new Error('Nilai '+label+'.'+k+' tidak valid.');}};
    if(!object(value)||!object(value.trackly)||!Array.isArray(value.trackly.sites))throw new Error('Format backup workspace tidak valid.');
    const s=value.trackly;
    for(const key of ['sites','clients','tenants','rules','activities','pinned','bastProcesses','notes'])if(s[key]!==undefined&&!Array.isArray(s[key]))throw new Error('Data '+key+' tidak valid.');
    for(const key of ['clients','rules','activities','bastProcesses','notes'])records(s[key],key);
    for(const key of ['tenants','pinned'])if(s[key]?.some(x=>typeof x!=='string'))throw new Error('Data '+key+' tidak valid.');
    const unique=new Set();
    for(const site of s.sites){
      if(!object(site)||typeof site.id!=='string'||!text(site.id)||typeof site.siteName!=='string'||!text(site.siteName))throw new Error('Data site tidak lengkap.');
      if(unique.has(site.id))throw new Error('ID site duplikat.');unique.add(site.id);
      for(const key of ['tasks','oneflux','bast']){records(site[key],key);site[key]?.forEach(x=>fields(x,key));}
      if(site.pln!==undefined&&!object(site.pln))throw new Error('Data PLN tidak valid.');
      if(site.finance!==undefined){if(!object(site.finance))throw new Error('Data Finance tidak valid.');records(site.finance.rows,'finance');for(const row of site.finance.rows||[])records(row.payments,'payments');}
    }
    if(value.pkbon!==undefined&&!object(value.pkbon))throw new Error('Data PKBON tidak valid.');
    for(const [key,val] of Object.entries(value.pkbon||{})){
      if(!['pkbon_history','pkbon_settings','pkbon_sites','pkbon_banks','pkbon_templates','pkbon_officers'].includes(key))throw new Error('Kunci backup tidak dikenal: '+key);
      if(key==='pkbon_settings'){if(!object(val)||val.approvalIds!==undefined&&!object(val.approvalIds))throw new Error('Pengaturan PKBON tidak valid.');}
      else if(key==='pkbon_sites'){if(!Array.isArray(val)||val.some(x=>typeof x!=='string'&&!object(x)))throw new Error('Data site PKBON tidak valid.');}
      else records(val,key);
      if(key==='pkbon_history')for(const doc of val){records(doc.items,'rincian PKBON');if(doc.documentOfficers!==undefined&&doc.documentOfficers!==null&&(!Array.isArray(doc.documentOfficers)||doc.documentOfficers.some(x=>x!==null&&!object(x))))throw new Error('Pejabat PKBON tidak valid.');}
    }
    return value;
  }
  function writeBatch(storage,entries) {
    const old=new Map(entries.map(([k])=>[k,storage.getItem(k)])),written=[];
    try{for(const [k,v] of entries){if(v===null)storage.removeItem(k);else storage.setItem(k,v);written.push(k);}}
    catch(error){
      // Free changed entries first so restoration cannot exceed the original quota.
      for(const k of written){try{storage.removeItem(k);}catch{}}
      for(const k of written){try{if(old.get(k)!==null)storage.setItem(k,old.get(k));}catch{}}
      throw error;
    }
  }

  // Dependency-free LZ compression for stored state. Operates on UTF-16 code
  // units so any string round-trips exactly. Dictionary is frozen at 4096
  // entries (12-bit codes) so encoder and decoder always agree.
  const B64_CHARS='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function b64encode(bytes){
    let out='',i=0;
    for(;i+2<bytes.length;i+=3){const n=(bytes[i]<<16)|(bytes[i+1]<<8)|bytes[i+2];out+=B64_CHARS[(n>>18)&63]+B64_CHARS[(n>>12)&63]+B64_CHARS[(n>>6)&63]+B64_CHARS[n&63];}
    const rem=bytes.length-i;
    if(rem===1){const n=bytes[i]<<16;out+=B64_CHARS[(n>>18)&63]+B64_CHARS[(n>>12)&63]+'==';}
    else if(rem===2){const n=(bytes[i]<<16)|(bytes[i+1]<<8);out+=B64_CHARS[(n>>18)&63]+B64_CHARS[(n>>12)&63]+B64_CHARS[(n>>6)&63]+'=';}
    return out;
  }
  function b64decode(str){
    const table=new Array(128).fill(-1);
    for(let i=0;i<64;i++)table[B64_CHARS.charCodeAt(i)]=i;
    const bytes=[];let acc=0,bits=0;
    for(const ch of str){
      if(ch==='=')break;
      const code=ch.charCodeAt(0),v=code<128?table[code]:-1;
      if(v<0)throw new Error('Data terkompresi tidak valid.');
      acc=(acc<<6)|v;bits+=6;
      if(bits>=8){bits-=8;bytes.push((acc>>bits)&255);acc&=(1<<bits)-1;}
    }
    return bytes;
  }
  function compress(uncompressed){
    const input=String(uncompressed??'');
    if(!input)return '';
    // Codes 0-255 are raw UTF-16 units. 4095 is reserved as an escape for a
    // lone unit >=256 (e.g. emoji, CJK): escape + two raw bytes. Multi-char
    // phrases live in the dictionary (256-4094).
    const dict=new Map();let nextCode=256;
    const codes=[];let phrase=input[0];
    const emit=ph=>{
      if(ph.length===1){
        const u=ph.charCodeAt(0);
        if(u<256){codes.push(u);return;}
        codes.push(4095,(u>>8)&255,u&255);return;
      }
      const known=dict.get(ph);
      if(known!==undefined){codes.push(known);return;}
      throw new Error('Data tidak dapat dikompresi.');
    };
    for(let i=1;i<input.length;i++){
      const combined=phrase+input[i];
      if(dict.has(combined))phrase=combined;
      else{
        emit(phrase);
        if(nextCode<4095)dict.set(combined,nextCode++);
        phrase=input[i];
      }
    }
    emit(phrase);
    const bytes=[];let acc=0,bits=0;
    for(const c of codes){acc=(acc<<12)|c;bits+=12;while(bits>=8){bits-=8;bytes.push((acc>>bits)&255);}}
    if(bits>0)bytes.push((acc<<(8-bits))&255);
    return b64encode(bytes);
  }
  function decompress(compressed){
    const bytes=b64decode(String(compressed??''));
    if(!bytes.length)return '';
    const codes=[];let acc=0,bits=0;
    for(const b of bytes){acc=(acc<<8)|b;bits+=8;while(bits>=12){bits-=12;codes.push((acc>>bits)&4095);acc&=(1<<bits)-1;}}
    if(!codes.length)throw new Error('Data terkompresi tidak valid.');
    const dict=new Array(4095);
    for(let i=0;i<256;i++)dict[i]=String.fromCharCode(i);
    let nextCode=256,prev=null,out='';
    for(let i=0;i<codes.length;i++){
      const c=codes[i];let entry;
      if(c===4095){
        const hi=codes[++i],lo=codes[++i];
        if(hi===undefined||lo===undefined||hi>255||lo>255)throw new Error('Data terkompresi tidak valid.');
        entry=String.fromCharCode((hi<<8)|lo);
      }
      else if(c<256)entry=String.fromCharCode(c);
      else if(dict[c]!==undefined)entry=dict[c];
      else if(c===nextCode&&prev!==null)entry=prev+prev[0];
      else throw new Error('Data terkompresi tidak valid.');
      out+=entry;
      if(prev!==null&&nextCode<4095)dict[nextCode++]=prev+entry[0];
      prev=entry;
    }
    return out;
  }
  // Storage envelope: {"_v":1,"_c":"..."}. decodeStored accepts both the
  // envelope and legacy plain JSON, and throws on anything else so callers
  // can reuse their existing corrupt-data handling.
  function encodeStored(value){return JSON.stringify({_v:1,_c:compress(JSON.stringify(value))});}
  function decodeStored(raw){
    const parsed=JSON.parse(raw);
    if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)&&parsed._v===1&&typeof parsed._c==='string')
      return JSON.parse(decompress(parsed._c));
    return parsed;
  }
  function encodeEnvelope(str){return {_v:1,_c:compress(String(str))};}
  function decodeEnvelope(env){
    if(!env||typeof env!=='object'||Array.isArray(env)||env._v!==1||typeof env._c!=='string')
      throw new Error('Data terkompresi tidak valid.');
    return decompress(env._c);
  }
  // Accepts both snapshot formats: v60 plain {trackly,pkbon} and v61
  // compressed {trackly_c,pkbon_c}. Returns {trackly,pkbon} in plain form.
  function normalizeSnapshot(snapshot){
    const fail=()=>{throw new Error('Format backup workspace tidak valid.');};
    if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))fail();
    if(snapshot.trackly!==undefined)return {trackly:snapshot.trackly,pkbon:snapshot.pkbon===undefined?{}:snapshot.pkbon};
    if(snapshot.trackly_c===undefined)fail();
    let trackly,pkbon;
    try{trackly=JSON.parse(decodeEnvelope(snapshot.trackly_c));}catch{fail();}
    try{pkbon=snapshot.pkbon_c===undefined?{}:JSON.parse(decodeEnvelope(snapshot.pkbon_c));}catch{fail();}
    return {trackly,pkbon};
  }
  return {date,money,moneyInput,csvParse,csvWrite,bastProgress,toggleBast,belongs,total,validateSnapshot,writeBatch,stages,compress,decompress,encodeStored,decodeStored,encodeEnvelope,decodeEnvelope,normalizeSnapshot};;
});
