/* Small dependency-free XLSX/CSV transport. Legacy binary XLS uses an optional library. */
(function(root){
  'use strict';
  const enc=new TextEncoder(),dec=new TextDecoder();
  const xml=s=>String(s??'').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const col=n=>{let out='';for(n++;n>0;n=Math.floor((n-1)/26))out=String.fromCharCode(65+(n-1)%26)+out;return out;};
  const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
  const crc=bytes=>{let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;};
  const concat=arr=>{const out=new Uint8Array(arr.reduce((n,a)=>n+a.length,0));let o=0;for(const a of arr){out.set(a,o);o+=a.length;}return out;};
  function zip(files){
    let offset=0;const local=[],central=[];
    for(const [path,value]of Object.entries(files)){
      const name=enc.encode(path),body=enc.encode(value),checksum=crc(body);
      const h=new Uint8Array(30+name.length),v=new DataView(h.buffer);
      v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,checksum,true);v.setUint32(18,body.length,true);v.setUint32(22,body.length,true);v.setUint16(26,name.length,true);h.set(name,30);
      const c=new Uint8Array(46+name.length),d=new DataView(c.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint32(16,checksum,true);d.setUint32(20,body.length,true);d.setUint32(24,body.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);c.set(name,46);
      local.push(h,body);central.push(c);offset+=h.length+body.length;
    }
    const cent=concat(central),end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,central.length,true);v.setUint16(10,central.length,true);v.setUint32(12,cent.length,true);v.setUint32(16,offset,true);
    return concat([...local,cent,end]);
  }
  function workbook(rows,name='Data'){
    const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const sheet=`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" state="frozen"/></sheetView></sheetViews><cols>${(rows[0]||[]).map((_,i)=>`<col min="${i+1}" max="${i+1}" width="22" customWidth="1"/>`).join('')}</cols><sheetData>${rows.map((r,i)=>`<row r="${i+1}">${r.map((val,j)=>{const ref=col(j)+(i+1);return typeof val==='number'&&Number.isFinite(val)?`<c r="${ref}"><v>${val}</v></c>`:`<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(val)}</t></is></c>`;}).join('')}</row>`).join('')}</sheetData>${rows.length&&rows[0].length?`<autoFilter ref="A1:${col(rows[0].length-1)}${rows.length}"/>`:''}</worksheet>`;
    return zip({
      '[Content_Types].xml':'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
      '_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      'xl/workbook.xml':`<?xml version="1.0"?><workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(name.slice(0,31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      'xl/_rels/workbook.xml.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
      'xl/worksheets/sheet1.xml':sheet
    });
  }
  async function unzip(buffer){
    const bytes=new Uint8Array(buffer),v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(v.getUint32(i,true)===0x06054b50){end=i;break;}
    if(end<0)throw new Error('XLSX rusak atau terenkripsi.');
    const count=v.getUint16(end+10,true);let at=v.getUint32(end+16,true),expanded=0;const files={};
    if(count>2000)throw new Error('Workbook terlalu besar.');
    for(let i=0;i<count;i++){
      if(at+46>bytes.length||v.getUint32(at,true)!==0x02014b50)throw new Error('Struktur XLSX tidak valid.');
      const flags=v.getUint16(at+8,true),method=v.getUint16(at+10,true),len=v.getUint32(at+20,true),size=v.getUint32(at+24,true),n=v.getUint16(at+28,true),extra=v.getUint16(at+30,true),comment=v.getUint16(at+32,true),local=v.getUint32(at+42,true);
      const checksum=v.getUint32(at+16,true),path=dec.decode(bytes.subarray(at+46,at+46+n));at+=46+n+extra+comment;expanded+=size;
      if(flags&1)throw new Error('Workbook berpassword tidak didukung.');
      if(expanded>64*1024*1024)throw new Error('Workbook terlalu besar setelah diekstrak.');
      if(!/^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(path))continue;
      if(local+30>bytes.length)throw new Error('Data XLSX terpotong.');
      const start=local+30+v.getUint16(local+26,true)+v.getUint16(local+28,true);
      if(start+len>bytes.length)throw new Error('Data XLSX terpotong.');
      const compressed=bytes.subarray(start,start+len);let result;
      if(method===0)result=compressed;
      else if(method===8){
        if(typeof DecompressionStream==='undefined')throw new Error('Browser belum mendukung XLSX offline. Gunakan CSV atau perbarui browser.');
        const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        const reader=stream.getReader(),chunks=[];let received=0;
        while(true){const {value,done}=await reader.read();if(done)break;received+=value.length;if(received>size||received>64*1024*1024){await reader.cancel();throw new Error('Ukuran XLSX tidak valid.');}chunks.push(value);}
        result=concat(chunks);
      } else throw new Error('Kompresi XLSX tidak didukung.');
      if(result.length!==size)throw new Error('Data XLSX tidak lengkap.');
      if(crc(result)!==checksum)throw new Error('Isi XLSX rusak (checksum).');
      files[path]=dec.decode(result);
    }
    return files;
  }
  const parseXml=s=>{const d=new DOMParser().parseFromString(s||'','application/xml');if(d.getElementsByTagName('parsererror').length)throw new Error('XML workbook tidak valid.');return d;};
  const nodes=(d,n)=>Array.from(d.getElementsByTagName(n));
  async function readXlsx(buffer){
    const files=await unzip(buffer),book=parseXml(files['xl/workbook.xml']);
    const sheets=nodes(book,'sheet'),sheet=sheets.find(s=>s.getAttribute('name')==='FORMAT INPUT SITE')||sheets[0];
    if(!sheet)throw new Error('Workbook tidak memiliki sheet.');
    const id=sheet.getAttribute('r:id'),rels=parseXml(files['xl/_rels/workbook.xml.rels']);
    const target=nodes(rels,'Relationship').find(r=>r.getAttribute('Id')===id)?.getAttribute('Target');
    const path=target?.startsWith('/')?target.slice(1):'xl/'+target;
    if(!files[path])throw new Error('Sheet tidak ditemukan.');
    const strings=files['xl/sharedStrings.xml']?nodes(parseXml(files['xl/sharedStrings.xml']),'si').map(s=>nodes(s,'t').map(t=>t.textContent).join('')):[];
    const rows=nodes(parseXml(files[path]),'row').map(r=>{
      const out=[];for(const cell of nodes(r,'c')){const letter=(cell.getAttribute('r')||'A').match(/^[A-Z]+/i)?.[0]||'A';let index=0;for(const c of letter.toUpperCase())index=index*26+c.charCodeAt(0)-64;const type=cell.getAttribute('t'),value=nodes(cell,'v')[0]?.textContent||'';
        out[index-1]=type==='s'?(strings[Number(value)]||''):type==='inlineStr'?nodes(cell,'t').map(t=>t.textContent).join(''):type==='n'||!type?(value===''?'':Number(value)):value;
      }return out;
    }).filter(r=>r.some(v=>String(v??'').trim()));
    const headers=Array.from(rows.shift()||[],h=>String(h??'').trim()),nonempty=headers.filter(Boolean);
    if(new Set(nonempty).size!==nonempty.length)throw new Error('Judul kolom XLSX harus unik.');
    const date1904=['1','true'].includes(nodes(book,'workbookPr')[0]?.getAttribute('date1904'));
    return rows.map(r=>Object.fromEntries(headers.flatMap((h,i)=>h?[[h,date1904&&h.toUpperCase()==='TANGGAL SPMK'&&typeof r[i]==='number'?r[i]+1462:r[i]??'']]:[])));
  }
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  const api={workbook,readXlsx,unzip,download,export(rows,filename,sheet='Data'){download(new Blob([workbook(rows,sheet)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),filename);}};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.TrackersSheets=api;
})(typeof window==='object'?window:this);
