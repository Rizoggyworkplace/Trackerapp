
(function(){
  try{const k="__trackly_storage_test__";window.localStorage.setItem(k,"1");window.localStorage.removeItem(k);}
  catch(_){
    window.TRACKERS_VOLATILE_STORAGE=true;
    const mem=new Map();
    const storage={
      get length(){return mem.size},
      key(i){return Array.from(mem.keys())[i]??null},
      getItem(k){k=String(k);return mem.has(k)?mem.get(k):null},
      setItem(k,v){mem.set(String(k),String(v))},
      removeItem(k){mem.delete(String(k))},
      clear(){mem.clear()}
    };
    try{Object.defineProperty(window,"localStorage",{value:storage,configurable:true});}
    catch(e){console.warn("Trackly: localStorage unavailable; session data may not persist.",e)}
  }
})();
