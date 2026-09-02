(function(){
  const STORAGE_KEY="bandcenter_v2";
  const ELEMENTARY_VALUE="Elementary Ensemble";
  const ELEMENTARY_LABEL="Elementary Band";
  const VARSITY_VALUE="Varsity Band";
  const LEGACY_JV="JV Band";
  const STRUCTURE_VERSION=1;
  let applying=false;
  let queued=false;

  function readState(){
    try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");}
    catch{return null;}
  }

  function normalizedState(input){
    if(!input||typeof input!=="object")return input;
    const state={...input,meta:{...(input.meta||{})},settings:{...(input.settings||{})}};
    state.students=(input.students||[]).map(student=>{
      const current=student.ensemble;
      const ensemble=!current||current===LEGACY_JV?ELEMENTARY_VALUE:current;
      return ensemble===current?student:{...student,ensemble};
    });
    if(!state.settings.activeEnsemble||state.settings.activeEnsemble===LEGACY_JV)state.settings.activeEnsemble=ELEMENTARY_VALUE;
    state.meta.ensembleStructureVersion=STRUCTURE_VERSION;
    return state;
  }

  function needsNormalization(state){
    if(!state||typeof state!=="object")return false;
    if((state.meta?.ensembleStructureVersion||0)<STRUCTURE_VERSION)return true;
    if(state.settings?.activeEnsemble===LEGACY_JV)return true;
    return (state.students||[]).some(s=>!s.ensemble||s.ensemble===LEGACY_JV);
  }

  function writeLocal(state){
    state.meta={...(state.meta||{}),updatedAt:Date.now(),ensembleStructureVersion:STRUCTURE_VERSION};
    localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
  }

  async function writeCloud(state){
    const cfg=window.BANDCENTER_CONFIG||{};
    if(!cfg.supabaseUrl||!cfg.supabaseAnonKey||!window.supabase)return;
    try{
      const client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
      await client.from("bandcenter_state").upsert({
        id:"okeene-bandcenter",
        payload:state,
        updated_at:new Date().toISOString()
      });
    }catch(err){
      console.warn("BandCenter ensemble cloud sync failed",err);
    }
  }

  async function persist(state){
    writeLocal(state);
    await writeCloud(state);
  }

  function normalizeBeforeApp(){
    const state=readState();
    if(!needsNormalization(state))return;
    writeLocal(normalizedState(state));
  }

  function labelFor(value){return value===ELEMENTARY_VALUE?ELEMENTARY_LABEL:value;}

  function fixEnsembleSelector(select){
    const options=[...select.options];
    const elementary=options.find(o=>o.value===ELEMENTARY_VALUE||o.textContent.trim()===ELEMENTARY_VALUE||o.textContent.trim()===ELEMENTARY_LABEL);
    if(elementary){
      elementary.value=ELEMENTARY_VALUE;
      elementary.textContent=ELEMENTARY_LABEL;
    }
    options.filter(o=>o.value===LEGACY_JV||o.textContent.trim()===LEGACY_JV).forEach(o=>o.remove());
    const varsity=[...select.options].find(o=>o.value===VARSITY_VALUE||o.textContent.trim()===VARSITY_VALUE);
    if(varsity){varsity.value=VARSITY_VALUE;varsity.textContent=VARSITY_VALUE;}
  }

  function replaceVisibleElementaryLabels(root){
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      if(node.parentElement?.tagName==="OPTION")return;
      if(node.nodeValue&&node.nodeValue.includes(ELEMENTARY_VALUE))node.nodeValue=node.nodeValue.replaceAll(ELEMENTARY_VALUE,ELEMENTARY_LABEL);
      if(node.nodeValue&&node.nodeValue.includes(LEGACY_JV))node.nodeValue=node.nodeValue.replaceAll(LEGACY_JV,ELEMENTARY_LABEL);
    });
  }

  function findStudentForRow(row,state){
    const inputs=[...row.querySelectorAll("input")];
    const name=inputs[0]?.value?.trim();
    const moniker=inputs[1]?.value?.trim();
    if(!name)return null;
    return (state.students||[]).find(s=>s.name===name&&(!moniker||s.moniker===moniker))||(state.students||[]).find(s=>s.name===name)||null;
  }

  async function moveStudent(studentId,newEnsemble){
    const state=readState();
    if(!state)return;
    const student=(state.students||[]).find(s=>s.id===studentId);
    if(!student||student.ensemble===newEnsemble)return;
    const from=student.ensemble||ELEMENTARY_VALUE;
    student.ensemble=newEnsemble;
    state.meta={...(state.meta||{}),lastEnsembleMove:{studentId,from,to:newEnsemble,at:new Date().toISOString()}};
    await persist(state);
    location.reload();
  }

  function enhanceRosterTable(table,state){
    const headRow=table.querySelector("thead tr");
    if(!headRow)return;
    const headers=[...headRow.children].map(th=>th.textContent.trim());
    if(!headers.includes("Player")||!headers.includes("Moniker")||!headers.includes("Division"))return;

    let ensembleHeader=headRow.querySelector("th[data-bc-ensemble]");
    if(!ensembleHeader){
      ensembleHeader=document.createElement("th");
      ensembleHeader.dataset.bcEnsemble="1";
      ensembleHeader.textContent="Ensemble";
      const divisionIndex=headers.indexOf("Division");
      const after=headRow.children[divisionIndex+1]||null;
      headRow.insertBefore(ensembleHeader,after);
    }

    table.querySelectorAll("tbody tr").forEach(row=>{
      if(row.querySelector("td[data-bc-ensemble]"))return;
      const student=findStudentForRow(row,state);
      if(!student)return;
      const cell=document.createElement("td");
      cell.dataset.bcEnsemble="1";
      const select=document.createElement("select");
      select.className="select ensemble-move-select";
      select.setAttribute("aria-label",`Ensemble for ${student.name}`);
      [[ELEMENTARY_VALUE,ELEMENTARY_LABEL],[VARSITY_VALUE,VARSITY_VALUE]].forEach(([value,label])=>{
        const option=document.createElement("option");option.value=value;option.textContent=label;select.appendChild(option);
      });
      select.value=student.ensemble===VARSITY_VALUE?VARSITY_VALUE:ELEMENTARY_VALUE;
      select.addEventListener("change",()=>{
        const target=select.value;
        const pretty=labelFor(target);
        const ok=confirm(`Move ${student.name} to ${pretty}? Their scores, points, moniker, Band Bucks, achievements, and championship history will stay with them.`);
        if(!ok){select.value=student.ensemble===VARSITY_VALUE?VARSITY_VALUE:ELEMENTARY_VALUE;return;}
        select.disabled=true;
        moveStudent(student.id,target);
      });
      cell.appendChild(select);
      const divisionCell=[...row.children].find(td=>td.querySelector(".division-pill"));
      if(divisionCell&&divisionCell.nextSibling)row.insertBefore(cell,divisionCell.nextSibling);else row.appendChild(cell);
    });
  }

  function addRosterNote(){
    const cards=[...document.querySelectorAll(".card")];
    const registry=cards.find(card=>card.querySelector(".card-title")?.textContent.includes("Player Registry"));
    if(!registry||document.querySelector("[data-bc-ensemble-note]"))return;
    const note=document.createElement("div");
    note.dataset.bcEnsembleNote="1";
    note.className="commissioner-note";
    note.style.margin="0 16px 14px";
    note.innerHTML="<b>Ensemble assignment:</b> Everyone begins in Elementary Band. When a student ages up, change their Ensemble dropdown to <b>Varsity Band</b>. Their complete BandCenter career stays attached to the same profile.";
    const head=registry.querySelector(".card-head");
    if(head)head.insertAdjacentElement("afterend",note);
  }

  function applyEnhancements(){
    if(applying)return;
    applying=true;
    try{
      document.querySelectorAll("select").forEach(select=>{
        if([...select.options].some(o=>[ELEMENTARY_VALUE,ELEMENTARY_LABEL,LEGACY_JV,VARSITY_VALUE].includes(o.value)||[ELEMENTARY_VALUE,ELEMENTARY_LABEL,LEGACY_JV,VARSITY_VALUE].includes(o.textContent.trim())))fixEnsembleSelector(select);
      });
      replaceVisibleElementaryLabels(document.getElementById("root")||document.body);
      const state=readState();
      if(state)document.querySelectorAll("table").forEach(table=>enhanceRosterTable(table,state));
      addRosterNote();
    }finally{applying=false;}
  }

  function queueApply(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;applyEnhancements();});
  }

  normalizeBeforeApp();
  const observer=new MutationObserver(queueApply);
  observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  window.addEventListener("load",()=>{
    queueApply();
    setTimeout(async()=>{
      const state=readState();
      if(needsNormalization(state)){
        await persist(normalizedState(state));
        location.reload();
      }
    },1600);
  });
})();
