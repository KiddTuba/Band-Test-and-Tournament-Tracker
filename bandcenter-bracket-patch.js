(function(){
  const previousPatch=window.BANDCENTER_PATCH_SOURCE;

  const replacementFunctions=`
function makeRounds(ids){
  if(!ids.length)return[];
  if(ids.length===1)return[{name:"Division Final",matches:[{id:uid(),p1:ids[0],p2:null,winner:null,bye:true,manualP1:false,manualP2:false}]}];
  const size=nextPow2(ids.length),positions=seedPositions(size),slots=positions.map(seed=>ids[seed-1]||null),rounds=[];let count=size/2;
  for(let r=0;count>=1;r++){
    const totalRounds=Math.log2(size);
    const matches=Array.from({length:count},(_,i)=>({id:uid(),p1:r===0?slots[i*2]:null,p2:r===0?slots[i*2+1]:null,winner:null,bye:false,manualP1:false,manualP2:false}));
    const name=r===totalRounds-1?"Division Final":r===totalRounds-2?"Division Semifinal":"Division Round "+(r+1);
    rounds.push({name,matches});count/=2;
  }
  return rounds;
}
function propagate(rounds){
  const out=rounds.map(r=>({...r,matches:r.matches.map(m=>({...m}))}));
  for(let r=0;r<out.length-1;r++){
    out[r].matches.forEach((m,i)=>{
      const next=out[r+1].matches[Math.floor(i/2)];
      const slot=i%2===0?"p1":"p2";
      const manualKey=slot==="p1"?"manualP1":"manualP2";
      if(!next[manualKey])next[slot]=m.winner||null;
      if(next.winner&&next.winner!==next.p1&&next.winner!==next.p2)next.winner=null;
    });
  }
  return out;
}
function autoAdvance(rounds){return propagate(rounds);}
function divisionChampion(div){return div?.rounds?.at(-1)?.matches?.[0]?.winner||null;}
function buildFinals(divisions,prior){
  const feeds=[divisions?.Woodwinds?.championId||null,divisions?.["High Brass"]?.championId||null,divisions?.["Low Brass"]?.championId||null,divisions?.Percussion?.championId||null];
  const old=prior?.rounds||[];
  const oldSemi0=old[0]?.matches?.[0]||{},oldSemi1=old[0]?.matches?.[1]||{},oldFinal=old[1]?.matches?.[0]||{};
  const semis=[
    {id:oldSemi0.id||uid(),p1:oldSemi0.manualP1?oldSemi0.p1:feeds[0],p2:oldSemi0.manualP2?oldSemi0.p2:feeds[1],winner:oldSemi0.winner||null,manualP1:!!oldSemi0.manualP1,manualP2:!!oldSemi0.manualP2},
    {id:oldSemi1.id||uid(),p1:oldSemi1.manualP1?oldSemi1.p1:feeds[2],p2:oldSemi1.manualP2?oldSemi1.p2:feeds[3],winner:oldSemi1.winner||null,manualP1:!!oldSemi1.manualP1,manualP2:!!oldSemi1.manualP2}
  ];
  semis.forEach(m=>{if(m.winner!==m.p1&&m.winner!==m.p2)m.winner=null;});
  let rounds=[{name:"BandCenter Final Four",matches:semis},{name:"BandCenter Championship",matches:[{id:oldFinal.id||uid(),p1:oldFinal.manualP1?oldFinal.p1:null,p2:oldFinal.manualP2?oldFinal.p2:null,winner:oldFinal.winner||null,manualP1:!!oldFinal.manualP1,manualP2:!!oldFinal.manualP2}]}];
  rounds=propagate(rounds);
  return{rounds,championId:rounds.at(-1)?.matches?.[0]?.winner||null};
}
function collectTournamentParticipantIds(t){
  const ids=new Set();
  if(t.format==="divisions-v1"){
    DIVISIONS.forEach(d=>(t.divisions?.[d]?.rounds||[]).forEach(r=>(r.matches||[]).forEach(m=>{if(m.p1)ids.add(m.p1);if(m.p2)ids.add(m.p2)})));
    (t.finals?.rounds||[]).forEach(r=>(r.matches||[]).forEach(m=>{if(m.manualP1&&m.p1)ids.add(m.p1);if(m.manualP2&&m.p2)ids.add(m.p2)}));
  }else (t.rounds||[]).forEach(r=>(r.matches||[]).forEach(m=>{if(m.p1)ids.add(m.p1);if(m.p2)ids.add(m.p2)}));
  return [...ids];
}
function stripOpeningSeed(t,studentId,except){
  if(!studentId||t.format!=="divisions-v1")return t;
  const divisions={};
  DIVISIONS.forEach(d=>{
    let rounds=(t.divisions?.[d]?.rounds||[]).map(r=>({...r,matches:r.matches.map(m=>({...m}))}));
    if(rounds[0])rounds[0].matches.forEach((m,mi)=>{
      ["p1","p2"].forEach((slot,si)=>{
        if(m[slot]===studentId&&!(except&&except.scope===d&&except.ri===0&&except.mi===mi&&except.slot===si)){
          m[slot]=null;m[slot==="p1"?"manualP1":"manualP2"]=false;
          if(m.winner===studentId)m.winner=null;
        }
      });
    });
    rounds=propagate(rounds);
    const participantIds=rounds[0]?[...new Set(rounds[0].matches.flatMap(m=>[m.p1,m.p2]).filter(Boolean))]:[];
    divisions[d]={...t.divisions?.[d],participantIds,rounds,championId:divisionChampion({rounds})};
  });
  const finals=buildFinals(divisions,t.finals);
  return{...t,divisions,finals,championId:finals.championId};
}
function setTournamentSlot(t,scope,ri,mi,slotIndex,studentId,mode){
  if(t.format!=="divisions-v1")return t;
  let next={...t,divisions:{...t.divisions},finals:t.finals};
  const field=slotIndex===0?"p1":"p2",manualKey=slotIndex===0?"manualP1":"manualP2";
  if(mode==="move"&&studentId)next=stripOpeningSeed(next,studentId,{scope,ri,mi,slot:slotIndex});
  if(DIVISIONS.includes(scope)){
    let rounds=(next.divisions?.[scope]?.rounds||[]).map(r=>({...r,matches:r.matches.map(m=>({...m}))}));
    const match=rounds[ri]?.matches?.[mi];if(!match)return next;
    match[field]=studentId||null;match[manualKey]=ri>0;
    if(match.winner&&match.winner!==match.p1&&match.winner!==match.p2)match.winner=null;
    rounds=propagate(rounds);
    const participantIds=rounds[0]?[...new Set(rounds[0].matches.flatMap(m=>[m.p1,m.p2]).filter(Boolean))]:[];
    const divisions={...next.divisions,[scope]:{...next.divisions?.[scope],participantIds,rounds,championId:divisionChampion({rounds})}};
    const finals=buildFinals(divisions,next.finals);
    next={...next,divisions,finals,championId:finals.championId};
  }else{
    let rounds=(next.finals?.rounds||[]).map(r=>({...r,matches:r.matches.map(m=>({...m}))}));
    const match=rounds[ri]?.matches?.[mi];if(!match)return next;
    match[field]=studentId||null;match[manualKey]=true;
    if(match.winner&&match.winner!==match.p1&&match.winner!==match.p2)match.winner=null;
    rounds=propagate(rounds);
    next={...next,finals:{rounds,championId:rounds.at(-1)?.matches?.[0]?.winner||null},championId:rounds.at(-1)?.matches?.[0]?.winner||null};
  }
  next.participants=collectTournamentParticipantIds(next);
  return next;
}
function updateTournamentWinner(t,scope,ri,mi,w){
  if(t.format!=="divisions-v1")return t;
  let divisions={...t.divisions},finals=t.finals;
  if(DIVISIONS.includes(scope)){
    let rounds=(divisions[scope]?.rounds||[]).map(r=>({...r,matches:r.matches.map(m=>({...m}))}));
    rounds[ri].matches[mi].winner=w;rounds=propagate(rounds);
    divisions={...divisions,[scope]:{...divisions[scope],rounds,championId:divisionChampion({rounds})}};
    finals=buildFinals(divisions,finals);
  }else{
    let rounds=(finals?.rounds||[]).map(r=>({...r,matches:r.matches.map(m=>({...m}))}));
    rounds[ri].matches[mi].winner=w;rounds=propagate(rounds);
    finals={rounds,championId:rounds.at(-1)?.matches?.[0]?.winner||null};
  }
  const next={...t,divisions,finals,championId:finals.championId};
  next.participants=collectTournamentParticipantIds(next);
  return next;
}
`;

  const tournamentStudioSource=`
function TournamentStudio({state,setState,audio,toast}){
  const ensemble=state.settings.activeEnsemble;const[name,setName]=useState("Band Madness");const[query,setQuery]=useState("");const[selectedIds,setSelectedIds]=useState([]);const[slotEdit,setSlotEdit]=useState(null);
  const list=state.tournaments.filter(t=>!t.archived&&t.ensemble===ensemble);const players=state.students.filter(s=>s.active!==false&&s.ensemble===ensemble).sort((a,b)=>divisionFor(a.instrument).localeCompare(divisionFor(b.instrument))||a.name.localeCompare(b.name));
  useEffect(()=>{setSelectedIds(players.map(s=>s.id));},[ensemble,state.students.length]);
  const filtered=players.filter(s=>!query.trim()||(s.name+" "+s.moniker+" "+s.instrument).toLowerCase().includes(query.trim().toLowerCase()));
  const toggle=id=>setSelectedIds(ids=>ids.includes(id)?ids.filter(x=>x!==id):[...ids,id]);
  const selectDivision=d=>setSelectedIds(ids=>[...new Set([...ids,...players.filter(s=>divisionFor(s.instrument)===d).map(s=>s.id)])]);
  const clearDivision=d=>setSelectedIds(ids=>ids.filter(id=>divisionFor(players.find(s=>s.id===id)?.instrument)!==d));
  function create(){if(!selectedIds.length)return alert("Select at least one student for the tournament.");const t=createDivisionTournament(state,ensemble,name.trim()||"Band Madness",selectedIds);setState(q=>({...q,tournaments:[...q.tournaments,t],meta:{...q.meta,lastBracketAction:{ensemble,text:t.name+" field revealed with "+selectedIds.length+" players",at:new Date().toISOString()}}}));audio.play("start");toast(t.name+": "+selectedIds.length+" players selected across four divisions");}
  function win(tid,scope,ri,mi,w){if(!w)return;setState(q=>{const student=q.students.find(x=>x.id===w);const tour=q.tournaments.find(x=>x.id===tid);const nextTournaments=q.tournaments.map(t=>{if(t.id!==tid)return t;const before=t.championId;const next=updateTournamentWinner(t,scope,ri,mi,w);if(next.championId&&next.championId!==before){const s=q.students.find(x=>x.id===next.championId);setTimeout(()=>{audio.play("victory");toast((s?.name||"Champion")+" WINS "+t.name.toUpperCase()+"!")},50)}return next;});return{...q,tournaments:nextTournaments,meta:{...q.meta,lastBracketAction:{ensemble,text:(student?.name||"Player")+" advanced with a W in "+(tour?.name||"the tournament"),at:new Date().toISOString()}}};});}
  function resetField(tid){if(!confirm("Replace this tournament field with the currently checked students? This resets all results in that tournament."))return;setState(q=>({...q,tournaments:q.tournaments.map(t=>t.id===tid?createDivisionTournament(q,ensemble,t.name,selectedIds):t),meta:{...q.meta,lastBracketAction:{ensemble,text:"Tournament field reset by Commissioner",at:new Date().toISOString()}}}));}
  function openSlot(tid,scope,ri,mi,slot,currentId){setSlotEdit({tid,scope,ri,mi,slot,chosenId:currentId||""});}
  function applySlot(mode,forcedId){if(!slotEdit)return;const chosen=forcedId!==undefined?forcedId:(slotEdit.chosenId||null);setState(q=>{const tour=q.tournaments.find(t=>t.id===slotEdit.tid);const student=chosen&&q.students.find(s=>s.id===chosen);const text=chosen?(student?.name||"Player")+(mode==="extra"?" added as an extra seed":" moved")+" in "+(tour?.name||"the tournament"):"Bracket slot cleared in "+(tour?.name||"the tournament");return{...q,tournaments:q.tournaments.map(t=>t.id===slotEdit.tid?setTournamentSlot(t,slotEdit.scope,slotEdit.ri,slotEdit.mi,slotEdit.slot,chosen,mode):t),meta:{...q.meta,lastBracketAction:{ensemble,text,at:new Date().toISOString()}}};});setSlotEdit(null);}
  return <>
    <div className="card"><div className="card-head"><div><div className="card-title">Tournament Selection Studio</div><div className="realname">Choose who enters, then click any bracket slot later to move or add a seed. Only the W button advances a player.</div></div></div>
      <div className="card-body"><div className="field-row"><div><label>Tournament name</label><Input value={name} onChange={e=>setName(e.target.value)}/></div><div><label>Find a student</label><Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, moniker, instrument"/></div><div style={{alignSelf:"end"}}><Button onClick={()=>setSelectedIds(players.map(s=>s.id))}>Select All</Button> <Button onClick={()=>setSelectedIds([])}>Clear</Button></div><div style={{alignSelf:"end"}}><Button className="red" onClick={create}>📺 Reveal Division Brackets</Button></div></div>
      <div className="division-picker-grid">{DIVISIONS.map(d=>{const group=filtered.filter(s=>divisionFor(s.instrument)===d);const chosen=players.filter(s=>divisionFor(s.instrument)===d&&selectedIds.includes(s.id)).length;return <div className="division-picker" key={d}><div className="division-picker-head"><div><b>{d}</b><div className="realname">{chosen} selected</div></div><div><Button className="sm" onClick={()=>selectDivision(d)}>All</Button> <Button className="sm" onClick={()=>clearDivision(d)}>Clear</Button></div></div>{group.map(s=><label className="check-player" key={s.id}><input type="checkbox" checked={selectedIds.includes(s.id)} onChange={()=>toggle(s.id)}/><span><b>{s.name}</b><small>{s.moniker} • {s.instrument}</small></span></label>)}{!group.length&&<div className="realname">No matching players</div>}</div>})}</div>
      <div className="commissioner-note" style={{marginTop:14}}><b>Bracket editing:</b> click any slot to place a student there. “Move Here” removes their other opening seed. “Add Extra Seed” keeps their existing spot too. A student advances only when you click the green <b>W</b>.</div></div>
    </div>
    {list.map(t=><div key={t.id}><div className="card tournament-tools"><div className="card-body"><b>{t.name}</b> • {t.participants?.length||tournamentParticipants(t).size} players <Button className="sm" onClick={()=>{setSelectedIds([...(t.participants||tournamentParticipants(t))]);window.scrollTo({top:0,behavior:"smooth"})}}>Load Field Into Picker</Button> <Button className="sm red" onClick={()=>resetField(t.id)}>Replace Field + Reset</Button></div></div><Tournament state={state} t={t} editable onWin={win} onEditSlot={openSlot}/></div>)}
    {slotEdit&&<div className="modal-back" onClick={()=>setSlotEdit(null)}><div className="modal bracket-slot-modal" onClick={e=>e.stopPropagation()}><div className="card-head"><div><div className="card-title">Edit Bracket Slot</div><div className="realname">{slotEdit.scope} • Round {slotEdit.ri+1} • Match {slotEdit.mi+1}</div></div></div><div className="card-body grid"><div><label>Student</label><Select value={slotEdit.chosenId} onChange={e=>setSlotEdit({...slotEdit,chosenId:e.target.value})}><option value="">Empty / TBD</option>{DIVISIONS.map(d=><optgroup label={d} key={d}>{players.filter(s=>divisionFor(s.instrument)===d).map(s=><option value={s.id} key={s.id}>{s.name} • {s.moniker} • {s.instrument}</option>)}</optgroup>)}</Select></div><div className="slot-mode-grid"><Button className="primary" disabled={!slotEdit.chosenId} onClick={()=>applySlot("move")}>Move Here</Button><Button className="gold" disabled={!slotEdit.chosenId} onClick={()=>applySlot("extra")}>Add Extra Seed</Button><Button className="red" onClick={()=>applySlot("extra",null)}>Clear Slot</Button><Button onClick={()=>setSlotEdit(null)}>Cancel</Button></div><div className="commissioner-note"><b>Move Here:</b> ideal for “Move Bracket Position.” <b>Add Extra Seed:</b> ideal for “Be Seeded More Than Once.” Later-round manual placements are locked in and will not be overwritten by automatic winner feeds.</div></div></div></div>}
  </>;
}
`;

  const competitorSource=`
function Competitor({state,t,id,winner,editable,onWin,onEdit}){
  const s=state.students.find(x=>x.id===id);const rank=id?allStats(state,t.ensemble).findIndex(x=>x.student.id===id)+1:"";
  return <div className={("competitor "+(winner===id&&id?"winner ":"")+(!id?"empty ":"")+(editable?"editable-slot":"")).trim()} onClick={()=>editable&&onEdit&&onEdit()}><span className="seed">{rank||""}</span><span className="competitor-copy"><b>{s?s.name:(editable?"Click to add player":"TBD")}</b>{s&&<small>{s.moniker} • {s.instrument}</small>}</span>{editable&&id&&<button type="button" className="winner-button" title="Advance this player" onClick={e=>{e.stopPropagation();onWin&&onWin()}}>W</button>}{winner===id&&id?<b className="winner-check">✓</b>:null}</div>;
}
function RoundBracket({state,t,rounds,scope,editable,onWin,onEditSlot}){if(!rounds?.length)return <div className="empty-state">No players in this division.</div>;return <div className="bracket compact-bracket">{rounds.map((r,ri)=><div className="round" key={scope+"-"+ri}><div className="round-title">{r.name}</div>{r.matches.map((m,mi)=><div className="match" key={m.id}><Competitor state={state} t={t} id={m.p1} winner={m.winner} editable={editable} onWin={()=>onWin(t.id,scope,ri,mi,m.p1)} onEdit={()=>onEditSlot&&onEditSlot(t.id,scope,ri,mi,0,m.p1)}/><Competitor state={state} t={t} id={m.p2} winner={m.winner} editable={editable} onWin={()=>onWin(t.id,scope,ri,mi,m.p2)} onEdit={()=>onEditSlot&&onEditSlot(t.id,scope,ri,mi,1,m.p2)}/></div>)}</div>)}</div>}
`;

  const tournamentSource=`
function Tournament({state,t,editable,onWin,onEditSlot}){
  if(t.format!=="divisions-v1")return <LegacyTournament state={state} t={t} editable={editable} onWin={onWin}/>;
  const champ=t.championId&&state.students.find(s=>s.id===t.championId);
  return <div className="tournament-shell"><div className="card"><div className="card-head"><div><div className="card-title">{t.name}</div><div className="realname">{t.date} • Four-Division Championship • {t.participants?.length||0} players</div></div></div>{champ&&<div className="card-body"><div className="champion-banner"><div className="broadcast-label">Reigning Champion</div><h2>{champ.name}</h2><b>{champ.moniker} • {champ.instrument}</b></div></div>}</div>
  <div className="division-brackets">{DIVISIONS.map(d=>{const div=t.divisions?.[d];const dc=div?.championId&&state.students.find(s=>s.id===div.championId);return <div className="division-card" key={d}><div className="division-banner"><span>{d}</span><b>{div?.participantIds?.length||0} players</b></div>{dc&&<div className="division-champ">Division Champion: <b>{dc.name}</b> <span>{dc.moniker}</span></div>}<RoundBracket state={state} t={t} rounds={div?.rounds||[]} scope={d} editable={editable} onWin={onWin} onEditSlot={onEditSlot}/></div>})}</div>
  <div className="card final-four-card"><div className="card-head"><div><div className="card-title">BandCenter Final Four</div><div className="realname">Woodwind Champion vs High Brass Champion • Low Brass Champion vs Percussion Champion</div></div></div><RoundBracket state={state} t={t} rounds={t.finals?.rounds||[]} scope="Final Four" editable={editable} onWin={onWin} onEditSlot={onEditSlot}/></div></div>;
}
`;

  window.BANDCENTER_PATCH_SOURCE=function(source){
    let out=previousPatch?previousPatch(source):source;
    out=out.replace(/function makeRounds\(ids\)\{[\s\S]*?function updateTournamentWinner\(t,scope,ri,mi,w\)\{[\s\S]*?\n\}/,replacementFunctions.trim());
    out=out.replace(/function TournamentStudio\(\{state,setState,audio,toast\}\)\{[\s\S]*?\n\}\nfunction Competitor/,tournamentStudioSource.trim()+"\nfunction Competitor");
    out=out.replace(/function Competitor\(\{state,t,id,winner,editable,onClick\}\)\{[\s\S]*?\nfunction LegacyTournament/,competitorSource.trim()+"\nfunction LegacyTournament");
    out=out.replace(/function Tournament\(\{state,t,editable,onWin\}\)\{[\s\S]*?\n\}\nfunction Brackets/,tournamentSource.trim()+"\nfunction Brackets");
    out=out.replace('const ensemble=state.settings.activeEnsemble;const items=tickerItems(state,ensemble);const doubled=[...items,...items];','const ensemble=state.settings.activeEnsemble;const items=tickerItems(state,ensemble);const doubled=[...items,...items];const tickerKey=items.join("|");');
    out=out.replace('<div className="ticker-track">{doubled.map((item,i)=><span key={`${item}-${i}`}>{item}</span>)}</div>','<div className="ticker-track" key={tickerKey}>{doubled.map((item,i)=><span key={`${item}-${i}`}>{item}</span>)}</div>');
    out=out.replace('const recent=latestScoreStory(state,ensemble);if(recent)items.push(`LATEST: ${recent}`);','const recent=latestScoreStory(state,ensemble);if(recent)items.push(`LATEST: ${recent}`);const bracketNews=state.meta?.lastBracketAction;if(bracketNews?.ensemble===ensemble&&bracketNews.text)items.push(`BRACKET DESK: ${bracketNews.text}`);const storeNews=state.meta?.lastStorePurchase;if(storeNews?.ensemble===ensemble)items.push(`BAND STORE: ${storeNews.studentName} bought ${storeNews.itemName} for ${storeNews.cost} BB`);');
    return out;
  };
})();