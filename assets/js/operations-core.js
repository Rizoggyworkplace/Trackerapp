/* Pure reminder and audit calculations. Dates are local calendar dates. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TrackersOps=api;})(typeof window==='object'?window:this,function(){
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function days(from,to){return Math.round((Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86400000);}
 function due(date,today){if(!date)return null;const d=days(today,date);if(!Number.isFinite(d)||d>3)return null;return {priority:d<0?0:d===0?1:2,label:d<0?'Terlambat '+(-d)+' hari':d===0?'Jatuh tempo hari ini':'Jatuh tempo '+d+' hari lagi'};}
 function reminders(sites,documents,today,metrics,belongs){const out=[];
  for(const s of sites.filter(s=>!s.archived)){
   for(const t of s.tasks||[]){const d=due(t.dueDate,today);if(t.status!=='Completed'&&d)out.push({id:'task:'+s.id+':'+t.id,type:'task',siteId:s.id,siteName:s.siteName,title:t.title,date:t.dueDate,...d});}
   const m=metrics(s),d=due(s.finance?.dueDate,today);
   if(m.receivable>0&&(d||!s.finance?.dueDate))out.push({id:'pay:'+s.id,type:'payment',siteId:s.id,siteName:s.siteName,title:'Tagihan client belum lunas',amount:m.receivable,date:s.finance?.dueDate||'',...(d||{priority:4,label:'Tentukan jatuh tempo'})});
   const bastMissing=(s.bast||[]).filter(x=>!x.done);if(bastMissing.length)out.push({id:'bast:'+s.id,type:'document',sub:'bast',siteId:s.id,siteName:s.siteName,title:bastMissing.length+' tahap BAST belum selesai',priority:4,label:'Tindak lanjuti dokumen'});
   const missing=(s.oneflux||[]).filter(x=>x.required&&x.status!=='OK');
   if(missing.length)out.push({id:'doc:'+s.id,type:'document',siteId:s.id,siteName:s.siteName,title:missing.length+' dokumen Oneflux belum lengkap',priority:4,label:'Perlu dilengkapi'});
  }
  for(const doc of documents.filter(d=>d&&['Diajukan','Disetujui'].includes(d.status))){const s=sites.find(s=>belongs(doc,s,sites));if(s?.archived)continue;out.push({id:'pkbon:'+doc.id,type:'pkbon',siteId:s?.id||'',siteName:s?.siteName||doc.site||'Tanpa site',docId:doc.id,title:doc.pkbonNo||'PKBON',amount:Number(doc.total)||0,priority:3,label:doc.status==='Disetujui'?'Menunggu pembayaran':'Menunggu persetujuan'});}
  return out.sort((a,b)=>a.priority-b.priority||(a.date||'').localeCompare(b.date||'')||a.title.localeCompare(b.title));
 }
 function diffEntities(before,after){const changes=[];
  for(const key of ['sites','notes','bastProcesses','clients','rules']){const old=new Map((before?.trackly?.[key]||[]).map(x=>[String(x.id),x])),next=new Map((after?.trackly?.[key]||[]).map(x=>[String(x.id),x]));
   for(const id of new Set([...old.keys(),...next.keys()])){const a=old.get(id),b=next.get(id);if(equal(a,b))continue;const fields=[...new Set([...Object.keys(a||{}),...Object.keys(b||{})])].filter(k=>!equal(a?.[k],b?.[k])).map(field=>({field,before:a?.[field]??null,after:b?.[field]??null}));changes.push({entity:key,entityId:id,siteId:key==='sites'?id:b?.siteId||a?.siteId||'',name:b?.siteName||a?.siteName||b?.title||a?.title||b?.name||id,action:!a?'Tambah':!b?'Hapus':'Ubah',fields});}
  }
  for(const key of ['pkbon_history','pkbon_settings','pkbon_sites','pkbon_banks','pkbon_templates','pkbon_officers']){const a=before?.pkbon?.[key],b=after?.pkbon?.[key];if(equal(a,b))continue;
   if(key==='pkbon_history'){const old=new Map((a||[]).map(x=>[String(x.id),x])),next=new Map((b||[]).map(x=>[String(x.id),x]));for(const id of new Set([...old.keys(),...next.keys()])){const x=old.get(id),y=next.get(id);if(!equal(x,y))changes.push({entity:key,entityId:id,siteId:y?.workspaceSiteId||x?.workspaceSiteId||'',name:y?.pkbonNo||x?.pkbonNo||id,action:!x?'Tambah':!y?'Hapus':'Ubah',fields:[...new Set([...Object.keys(x||{}),...Object.keys(y||{})])].filter(k=>!equal(x?.[k],y?.[k])).map(field=>({field,before:x?.[field]??null,after:y?.[field]??null}))});}}
   else changes.push({entity:key,entityId:key,name:key,action:'Ubah',fields:[{field:key,before:a??null,after:b??null}]});
  }
  for(const key of ['tenants'])if(!equal(before?.trackly?.[key],after?.trackly?.[key]))changes.push({entity:key,entityId:key,name:key,action:'Ubah',fields:[{field:key,before:before?.trackly?.[key]??null,after:after?.trackly?.[key]??null}]});
  return changes;
 }
 return {days,due,reminders,diffEntities};
});
