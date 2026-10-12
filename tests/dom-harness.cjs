/* A deliberately limited DOM simulator for JS integration tests. It does NOT render CSS
   or replace browser testing. No requests, credentials, or production data are used. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const decode=s=>String(s).replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(_,c)=>c[0]==='#'?String.fromCodePoint(c[1].toLowerCase()==='x'?parseInt(c.slice(2),16):+c.slice(1)):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '})[c.toLowerCase()]);
function selectors(s){return s.split(/,(?![^\[]*\])/).map(s=>s.trim());}
function matchSimple(e,s){
  for(const m of [...s.matchAll(/:not\(([^)]+)\)/g)])if(matchSimple(e,m[1]))return false;
  s=s.replace(/:not\([^)]+\)/g,'');
  for(const m of [...s.matchAll(/\[([^\]=\s]+)(?:\s*=\s*["']?([^\]"']*)["']?)?\]/g)]){
    if(!e.hasAttribute(m[1]))return false;if(m[2]!==undefined&&e.getAttribute(m[1])!==m[2])return false;
  }
  s=s.replace(/\[[^\]]*\]/g,'');
  const tag=s.match(/^[\w:-]+/);if(tag&&e.tagName!==tag[0].toUpperCase())return false;
  for(const m of s.matchAll(/#([\w-]+)/g))if(e.id!==m[1])return false;
  for(const m of s.matchAll(/\.([\w-]+)/g))if(!e.classList.contains(m[1]))return false;
  return true;
}
function matches(e,selector){
  return selectors(selector).some(sel=>{
    const parts=sel.split(/\s+(?![^\[]*\])(?![^()]*\))/);let node=e;
    if(!matchSimple(node,parts.pop()))return false;
    while(parts.length){const part=parts.pop();node=node.parentElement;while(node&&!matchSimple(node,part))node=node.parentElement;if(!node)return false;}return true;
  });
}
class Element{
  constructor(tag,doc){this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.attributes={};this.children=[];this.parentElement=null;this._text='';this._value=undefined;this.listeners={};this.style={setProperty(k,v){this[k]=v},removeProperty(k){delete this[k]}};this.dataset=new Proxy({},{get:(_,p)=>this.getAttribute('data-'+String(p).replace(/[A-Z]/g,c=>'-'+c.toLowerCase())),set:(_,p,v)=>{this.setAttribute('data-'+String(p).replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),v);return true;}});
    this.classList={contains:c=>this.className.split(/\s+/).includes(c),add:(...cs)=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...cs])].join(' ')},remove:(...cs)=>{this.className=this.className.split(/\s+/).filter(c=>!cs.includes(c)).join(' ')},toggle:(c,force)=>{const add=force===undefined?!this.classList.contains(c):force;this.classList[add?'add':'remove'](c);return add;}};
    return new Proxy(this,{get:(o,k,r)=>{if(o.tagName==='FORM'&&typeof k==='string'&&!['children','querySelector','querySelectorAll','elements','reset','attributes','tagName'].includes(k)){const named=o.querySelector(`[name="${k}"]`);if(named)return named;}return Reflect.get(o,k,r);}});
  }
  get id(){return this.attributes.id||''}set id(v){this.attributes.id=String(v)}get name(){return this.attributes.name||''}set name(v){this.attributes.name=String(v)}
  get className(){return this.attributes.class||''}set className(v){this.attributes.class=String(v)}
  get textContent(){return this._text+this.children.map(c=>c.textContent).join('')}set textContent(v){this.children=[];this._text=String(v??'')}
  get innerText(){return this.textContent}get innerHTML(){return this._html??this.textContent}set innerHTML(v){this._html=String(v);this.children=[];this._text='';parse(String(v),this,this.ownerDocument);}
  get options(){return this.querySelectorAll('option')}
  get elements(){const arr=this.querySelectorAll('input,select,textarea,button');arr.namedItem=n=>arr.find(x=>x.name===n||x.id===n)||null;return arr;}
  get value(){if(this.tagName==='SELECT'){const opts=this.options;if(this._value!==undefined)return opts.some(x=>x.value===this._value)?this._value:'';return (opts.find(o=>o.hasAttribute('selected'))||opts[0])?.value||'';}if(this._value!==undefined)return this._value;return this.attributes.value??(this.tagName==='OPTION'||this.tagName==='TEXTAREA'?this.textContent:'');}
  set value(v){this._value=String(v??'')}
  get checked(){return this._checked??this.hasAttribute('checked')}set checked(v){this._checked=!!v}
  get disabled(){return this.hasAttribute('disabled')}set disabled(v){v?this.setAttribute('disabled',''):this.removeAttribute('disabled')}
  get hidden(){return this.hasAttribute('hidden')}set hidden(v){v?this.setAttribute('hidden',''):this.removeAttribute('hidden')}
  get required(){return this.hasAttribute('required')}set required(v){v?this.setAttribute('required',''):this.removeAttribute('required')}
  get src(){return this.getAttribute('src')||''}set src(v){this.setAttribute('src',v)}
  get type(){return this.getAttribute('type')||(this.tagName==='BUTTON'?'submit':'text')}set type(v){this.setAttribute('type',v)}
  setAttribute(k,v){this.attributes[k]=String(v)}getAttribute(k){return this.attributes[k]??null}removeAttribute(k){delete this.attributes[k]}hasAttribute(k){return k in this.attributes}
  appendChild(child){if(child.parentElement)child.remove();this.children.push(child);child.parentElement=this;return child}append(...nodes){nodes.forEach(n=>this.appendChild(n))}remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(c=>c!==this);this.parentElement=null;}
  querySelectorAll(sel){const result=[];function walk(node){for(const c of node.children){if(matches(c,sel))result.push(c);walk(c);}}walk(this);return result}querySelector(sel){return this.querySelectorAll(sel)[0]||null}
  getElementsByTagName(tag){return this.querySelectorAll(tag)}closest(sel){let e=this;while(e){if(matches(e,sel))return e;e=e.parentElement;}return null}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn)}removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(f=>f!==fn)}
  dispatchEvent(e){e.target??=this;e.currentTarget=this;e.preventDefault??=()=>{e.defaultPrevented=true};e.stopPropagation??=()=>{};e.stopImmediatePropagation??=()=>{e.stopped=true};for(const fn of this.listeners[e.type]||[])fn(e);if(!e.stopped)this['on'+e.type]?.(e);return !e.defaultPrevented;}
  click(){if(this.disabled)return;this.dispatchEvent({type:'click'});if(this.tagName==='BUTTON'&&this.type==='submit')this.closest('form')?.dispatchEvent({type:'submit'});}
  focus(){if(this.ownerDocument)this.ownerDocument.activeElement=this}blur(){}select(){}scrollIntoView(){}getClientRects(){return [{}]}
  reset(){for(const e of this.elements){e._value=undefined;e._checked=undefined;}}
}
function parse(html,root,doc){
 const stack=[root],voids=new Set(['INPUT','IMG','META','LINK','BR','HR','AREA','BASE','COL','EMBED','PARAM','SOURCE','TRACK','WBR']);
 for(const token of html.match(/<!--[\s\S]*?-->|<![^>]*>|<[^>]+>|[^<]+/g)||[]){
  if(token.startsWith('<!--')||token.startsWith('<!'))continue;
  if(token.startsWith('</')){const tag=token.slice(2).match(/^[^\s>]+/)?.[0].toUpperCase();for(let i=stack.length-1;i>0;i--)if(stack[i].tagName===tag){stack.length=i;break;}continue;}
  if(token[0]==='<'){
    const m=token.match(/^<([^\s/>]+)/);if(!m)continue;const el=new Element(m[1],doc),rest=token.slice(m[0].length).replace(/\/?\s*>$/,'');
    for(const a of rest.matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+)))?/g))el.setAttribute(a[1],decode(a[2]??a[3]??a[4]??''));
    stack[stack.length-1].appendChild(el);if(!voids.has(el.tagName)&&!token.endsWith('/>'))stack.push(el);
  }else stack[stack.length-1]._text+=decode(token);
 }
}
class Storage{
 constructor(initial={}){this.map=new Map(Object.entries(initial));this.failKey=null;}getItem(k){return this.map.get(k)??null}setItem(k,v){if(this.failKey===k)throw new Error('QuotaExceededError');this.map.set(String(k),String(v))}removeItem(k){this.map.delete(k)}get length(){return this.map.size}key(i){return [...this.map.keys()][i]??null}clear(){this.map.clear()}
}
function makeHarness(initial={},opts={}){
 const rootPath=path.resolve(__dirname,'..'),document=new Element('document',null);document.ownerDocument=document;
 document.createElement=tag=>new Element(tag,document);document.getElementById=id=>document.querySelector('#'+id);document.execCommand=()=>true;
 parse(fs.readFileSync(path.join(rootPath,'index.html'),'utf8'),document,document);document.body=document.querySelector('body');document.head=document.querySelector('head');document.documentElement=document.querySelector('html');document.activeElement=document.body;
 const timers=new Map();let tid=0;const events={},alerts=[],downloads=[];
 const session=opts.session||null;const requests=[];let cloudRow=opts.cloudRow??null;
 const client={auth:{getSession:async()=>({data:{session}}),onAuthStateChange(fn){client.auth.listener=fn;return {data:{subscription:{unsubscribe(){}}}};},signOut:async()=>({error:null}),signInWithPassword:async()=>({data:{session}}),resetPasswordForEmail:async()=>({error:null}),updateUser:async()=>({error:null})},
  from(table){const q={select(){return q},eq(){return q},maybeSingle:async()=>opts.readError?{error:{message:'network unavailable'}}:{data:table==='profiles'?{user_id:session?.user.id,email:'test@example.invalid',role:opts.role||'owner',workspace_owner_id:opts.workspaceOwner||null,access_enabled:opts.access!==false}:cloudRow}};return q;},
  async rpc(name,args){requests.push({name,args});if(opts.rpcError)return {error:{message:opts.rpcError}};if(name==='trackers_save_state'){if((cloudRow?.updated_at||null)!==args.expected_updated_at)return {data:{ok:false,updated_at:cloudRow?.updated_at}};cloudRow={snapshot:args.new_snapshot,updated_at:'2026-09-20T15:00:'+String(requests.length).padStart(2,'0')+'.000Z'};return {data:{ok:true,updated_at:cloudRow.updated_at}};}return {data:[]};}
 };
 const context={console,document,getComputedStyle:el=>({getPropertyValue:k=>el.style[k]||''}),localStorage:new Storage(initial),TextEncoder,TextDecoder,DataView,Uint8Array,Blob,Response,DecompressionStream,URL,Intl,Date,JSON,Promise,Array,Object,Number,String,Math,Map,Set,RegExp,Error,Boolean,parseInt,isNaN,structuredClone,
  setTimeout(fn,ms=0){const id=++tid;timers.set(id,{fn,ms});return id},clearTimeout(id){timers.delete(id)},setInterval(){return ++tid},clearInterval(){},
  addEventListener(type,fn){(events[type]??=[]).push(fn)},dispatchEvent(e){(events[e.type]||[]).forEach(fn=>fn(e))},
  CustomEvent:class{constructor(type,o={}){this.type=type;this.detail=o.detail;}},Event:class{constructor(type,o={}){this.type=type;Object.assign(this,o);}},
  confirm(){return true},alert(s){alerts.push(s)},prompt(){return 'Test template'},location:{protocol:'http:',hostname:'localhost',origin:'http://localhost:8080',pathname:'/',href:'http://localhost:8080/',reload(){context.reloaded=true;}},
  navigator:{onLine:true,clipboard:{writeText:async t=>{context.clipboard=t}},},isSecureContext:true,
  matchMedia(){return {matches:false,addEventListener(){}}},open(){return null},supabase:{createClient(){return client}},
  DOMParser:class{parseFromString(s){const d=new Element('document',null);d.ownerDocument=d;parse(s,d,d);return d;}}
 };
 context.window=context;vm.createContext(context);
 const run=code=>vm.runInContext(code,context);
 for(const file of ['storage-guard','icons','core','operations-core','sheets','config','cloud','pkbon','app','workspace','operations','boot'])vm.runInContext(fs.readFileSync(path.join(rootPath,'assets/js/'+file+'.js'),'utf8'),context,{filename:file+'.js'});
 const flush=async()=>{for(let loop=0;loop<12;loop++){await Promise.resolve();const pending=[...timers].filter(([,v])=>v.ms<100);if(!pending.length){await Promise.resolve();continue;}for(const [id,v]of pending){timers.delete(id);await v.fn();}}};
 return {context,document,run,flush,alerts,requests,client,setCloudRow:r=>{cloudRow=r},getCloudRow:()=>cloudRow,el:id=>document.getElementById(id),fire:(id,type='click')=>document.getElementById(id).dispatchEvent({type}),Storage};
}
module.exports={makeHarness,Storage};
