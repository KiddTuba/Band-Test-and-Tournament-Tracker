(function(){
  const previousPatch=window.BANDCENTER_PATCH_SOURCE;

  const rankingSource=`
function eventIsCurrentSeason(state,event){
  if(!event||event.legacy)return false;
  return !event.seasonKey||event.seasonKey===state.meta.seasonName;
}
function challengeHistory(state,studentId){
  return(state.challenges||[])
    .filter(c=>eventIsCurrentSeason(state,c)&&c.scores&&c.scores[studentId]!==""&&c.scores[studentId]!=null)
    .map(c=>({id:c.id,date:c.date||"",score:Number(c.scores[studentId]),name:c.name}))
    .filter(x=>Number.isFinite(x.score)&&x.score>0)
    .sort((a,b)=>a.date.localeCompare(b.date));
}
function challengePoints(state,studentId){
  const h=challengeHistory(state,studentId),r=state.rules;let total=0,best=-Infinity,streak=0,maxStreak=0,last=null,pb=0;
  h.forEach(a=>{let p=scoreBase(a.score,r);if(a.score>best){if(best>-Infinity){p+=r.personalBest;pb++;}best=a.score;}if(last!=null&&a.score-last>=1)p+=r.improveOne;if(last!=null&&a.score>last){streak++;maxStreak=Math.max(maxStreak,streak)}else streak=0;total+=p;last=a.score;});
  return{total,best:best===-Infinity?0:best,attempts:h.length,pb,maxStreak,last:last||0,history:h};
}
function tournamentParticipants(t){
  if(Array.isArray(t.participants))return new Set(t.participants);
  const set=new Set();
  const addMatch=m=>{const a=m.p1||m.p1Id,b=m.p2||m.p2Id;if(a)set.add(a);if(b)set.add(b)};
  if(t.format==="divisions-v1"){
    DIVISIONS.forEach(d=>(t.divisions?.[d]?.rounds||[]).forEach(r=>(r.matches||[]).forEach(addMatch)));
    (t.finals?.rounds||[]).forEach(r=>(r.matches||[]).forEach(addMatch));
  }else (t.rounds||[]).forEach(r=>(r.matches||[]).forEach(addMatch));
  return set;
}
function allTournamentRounds(t){
  if(t.format==="divisions-v1"){
    const rounds=[];DIVISIONS.forEach(d=>(t.divisions?.[d]?.rounds||[]).forEach(r=>rounds.push({...r,scope:d})));
    (t.finals?.rounds||[]).forEach(r=>rounds.push({...r,scope:"Final Four"}));return rounds;
  }
  return t.rounds||[];
}
function actualTournamentDivision(t,studentId){
  if(t.format!=="divisions-v1")return null;
  return DIVISIONS.find(d=>{
    const div=t.divisions?.[d];
    if((div?.participantIds||[]).includes(studentId))return true;
    return(div?.rounds||[]).some(r=>(r.matches||[]).some(m=>m.p1===studentId||m.p2===studentId));
  })||null;
}
function tournamentStats(state,studentId){
  const r=state.rules;let total=0,wins=0,titles=0,runnerUps=0,finalFours=0,eliteEights=0,entries=0;
  for(const t of state.tournaments||[]){
    if(!eventIsCurrentSeason(state,t))continue;
    const parts=tournamentParticipants(t);if(!parts.has(studentId))continue;
    entries++;total+=r.tournamentEntry;
    allTournamentRounds(t).forEach(round=>(round.matches||[]).forEach(m=>{const winner=m.winner||m.winnerId;if(winner===studentId&&(m.p1||m.p1Id)&&(m.p2||m.p2Id)){wins++;total+=r.roundWin;}}));
    const champ=t.championId||t.finals?.rounds?.at(-1)?.matches?.[0]?.winner||t.rounds?.at(-1)?.matches?.[0]?.winner||t.rounds?.at(-1)?.matches?.[0]?.winnerId||null;
    if(champ===studentId){titles++;total+=r.champion;}
    if(t.format==="divisions-v1"){
      const final=(t.finals?.rounds?.at(-1)?.matches||[])[0];
      if(final&&(final.p1===studentId||final.p2===studentId)&&champ!==studentId){runnerUps++;total+=r.runnerUp;}
      const semis=t.finals?.rounds?.[0];
      if(semis?.matches.some(m=>m.p1===studentId||m.p2===studentId)){finalFours++;total+=r.finalFour;}
      const div=actualTournamentDivision(t,studentId);const divFinal=div?t.divisions?.[div]?.rounds?.at(-1):null;
      if(divFinal?.matches.some(m=>m.p1===studentId||m.p2===studentId)){eliteEights++;total+=r.eliteEight;}
    }else{
      const rounds=t.rounds||[];const final=(rounds.at(-1)?.matches||[])[0];
      const p1=final?.p1||final?.p1Id,p2=final?.p2||final?.p2Id;
      if(final&&(p1===studentId||p2===studentId)&&champ!==studentId){runnerUps++;total+=r.runnerUp;}
      const sf=rounds.at(-2);if(sf&&sf.matches.some(m=>(m.p1||m.p1Id)===studentId||(m.p2||m.p2Id)===studentId)){finalFours++;total+=r.finalFour;}
      const qf=rounds.at(-3);if(qf&&qf.matches.some(m=>(m.p1||m.p1Id)===studentId||(m.p2||m.p2Id)===studentId)){eliteEights++;total+=r.eliteEight;}
    }
  }
  return{total,wins,titles,runnerUps,finalFours,eliteEights,entries};
}
function rankingAdjustment(student){return Number(student.rankingAdjustments?.[student.ensemble]||0)||0;}
function statsFor(state,student){
  const c=challengePoints(state,student.id),t=tournamentStats(state,student.id),adjustment=rankingAdjustment(student);
  return{...c,...t,challengePoints:c.total,tournamentPoints:t.total,adjustment,points:c.total+t.total+adjustment};
}
function allStats(state,ensemble){
  return state.students.filter(s=>s.active!==false&&s.ensemble===ensemble).map(s=>({student:s,...statsFor(state,s)})).sort((a,b)=>b.points-a.points||b.best-a.best||a.student.name.localeCompare(b.student.name));
}
`;

  const standingsSource=`
function Standings({state}){
  const ensemble=state.settings.activeEnsemble,b=allStats(state,ensemble);
  return <div className="card"><div className="card-head"><div><div className="card-title">BandCenter Power Rankings</div><div className="realname">{state.meta.seasonName} • current-season events only</div></div></div><div>{b.map((x,i)=><div className={("leader-row "+(i<3?"top3 ":"")+"rise").trim()} key={x.student.id}><div className="rank">#{i+1}</div><div><div className="player-name">{x.student.name}</div><div className="moniker-sub">{x.student.moniker} • {x.student.instrument} • {divisionFor(x.student.instrument)}</div><div className="ranking-breakdown"><span>Challenges <b>{x.challengePoints}</b></span><span>Tournament <b>{x.tournamentPoints}</b></span>{x.adjustment!==0&&<span className="commissioner-adjust">Commissioner <b>{x.adjustment>0?"+":""}{x.adjustment}</b></span>}</div><div className="realname">{x.attempts} challenge attempts • high {x.best?x.best.toFixed(1):"—"}</div></div><div className="pts">{x.points} <small>PTS</small></div></div>)}{!b.length&&<div className="empty-state">No active players in this ensemble yet.</div>}</div></div>;
}
`;

  const hallSource=`
function tournamentChampionId(t){
  return t.championId||t.finals?.rounds?.at(-1)?.matches?.[0]?.winner||t.rounds?.at(-1)?.matches?.[0]?.winner||t.rounds?.at(-1)?.matches?.[0]?.winnerId||null;
}
function tournamentChampionName(state,t){
  const id=tournamentChampionId(t);return t.championName||(id&&state.students.find(s=>s.id===id)?.name)||null;
}
function hallAdjustment(student,ensemble){
  const x=student?.hallAdjustments?.[ensemble]||{};return{titles:Number(x.titles||0)||0,defenses:Number(x.defenses||0)||0};
}
function hallRecords(state,ensemble){
  const map=new Map();
  const ensure=(name,studentId)=>{const key=studentId?"id:"+studentId:"name:"+String(name).trim().toLowerCase();if(!map.has(key))map.set(key,{key,name:String(name||"Unknown"),studentId:studentId||null,earnedTitles:0,extraTitles:0,defenseCorrection:0,titles:[]});return map.get(key);};
  (state.tournaments||[]).filter(t=>t.ensemble===ensemble).forEach(t=>{const id=tournamentChampionId(t),name=tournamentChampionName(state,t);if(!name)return;const rec=ensure(name,id);rec.earnedTitles++;rec.titles.push({tournamentName:t.name||"Tournament",date:t.date||"",source:t.legacy?"Legacy":"BandCenter"});});
  (state.hallManualEntries||[]).filter(e=>e.ensemble===ensemble).forEach(e=>{if(!e.championName)return;const rec=ensure(e.championName,e.studentId||null);rec.earnedTitles++;rec.titles.push({tournamentName:e.tournamentName||"Historical Championship",date:e.date||"",source:"Commissioner Record",manualId:e.id});});
  (state.students||[]).filter(s=>s.ensemble===ensemble).forEach(s=>{const adj=hallAdjustment(s,ensemble);if(adj.titles||adj.defenses){const rec=ensure(s.name,s.id);rec.extraTitles+=adj.titles;rec.defenseCorrection+=adj.defenses;}});
  const out=[...map.values()].map(r=>{const totalTitles=Math.max(0,r.earnedTitles+r.extraTitles),defenses=Math.max(0,totalTitles-1+r.defenseCorrection);return{...r,totalTitles,defenses,titles:r.titles.sort((a,b)=>(b.date||"").localeCompare(a.date||""))};});
  return out.filter(r=>r.totalTitles>0).sort((a,b)=>b.totalTitles-a.totalTitles||b.defenses-a.defenses||a.name.localeCompare(b.name));
}
function latestHallChampion(state,ensemble){
  const actual=(state.tournaments||[]).filter(t=>t.ensemble===ensemble&&!t.archived&&tournamentChampionName(state,t)).map(t=>({name:tournamentChampionName(state,t),date:t.date||"",tournamentName:t.name||"Tournament"}));
  const manual=(state.hallManualEntries||[]).filter(e=>e.ensemble===ensemble&&e.championName).map(e=>({name:e.championName,date:e.date||"",tournamentName:e.tournamentName||"Historical Championship"}));
  return [...actual,...manual].sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0]||null;
}
function HallOfFame({state}){
  const ensemble=state.settings.activeEnsemble,records=hallRecords(state,ensemble),reigning=latestHallChampion(state,ensemble),totalTitles=records.reduce((n,r)=>n+r.totalTitles,0);
  return <div className="hall-shell"><div className="hall-hero"><div><div className="hero-kicker">BandCenter History Department</div><h1>Hall of Fame</h1><p>Every championship matters. Active, archived, legacy, and Commissioner-entered historical titles live here permanently.</p></div><div className="hall-score"><b>{totalTitles}</b><span>Recorded Titles</span></div></div>{reigning&&<div className="card reigning-card"><div className="card-body"><div className="broadcast-label">Most Recent Champion</div><div className="headline">{reigning.name}</div><div>{reigning.tournamentName}{reigning.date?" • "+reigning.date:""}</div></div></div>}<div className="hall-grid">{records.map((r,i)=><div className="hall-card" key={r.key}><div className="hall-card-head"><span className="hall-rank">#{i+1}</span><div><div className="player-name light">{r.name}</div><div className="moniker-sub light">BandCenter Hall of Fame</div></div></div><div className="hall-card-stats"><div><b>{r.totalTitles}</b><span>Titles</span></div><div><b>{r.defenses}</b><span>Defenses</span></div></div>{r.extraTitles!==0&&<div className="hall-correction">Commissioner title correction: {r.extraTitles>0?"+":""}{r.extraTitles}</div>}<div className="title-list">{r.titles.map((t,idx)=><div className="title-row" key={(t.manualId||t.tournamentName)+"-"+idx}><span><b>{t.tournamentName}</b><small>{t.source}</small></span><time>{t.date||"Date not recorded"}</time></div>)}{!r.titles.length&&r.totalTitles>0&&<div className="title-row"><span><b>Historical title correction</b><small>Commissioner record</small></span></div>}</div></div>)}{!records.length&&<div className="card"><div className="empty-state">No championships have been recorded for this ensemble yet.</div></div>}</div></div>;
}
function HallManager({state,setState}){
  const ensemble=state.settings.activeEnsemble;const players=state.students.filter(s=>s.ensemble===ensemble).sort((a,b)=>a.name.localeCompare(b.name));
  const[form,setForm]=useState({studentId:"",legacyName:"",tournamentName:"",date:today()});
  const manual=(state.hallManualEntries||[]).filter(e=>e.ensemble===ensemble).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  function addHistorical(){const student=players.find(s=>s.id===form.studentId);const championName=(student?.name||form.legacyName.trim());if(!championName||!form.tournamentName.trim())return alert("Enter a champion and tournament name.");const entry={id:uid(),studentId:student?.id||null,championName,ensemble,tournamentName:form.tournamentName.trim(),date:form.date||"",createdAt:new Date().toISOString()};setState(q=>({...q,hallManualEntries:[...(q.hallManualEntries||[]),entry],meta:{...q.meta,lastHallAction:{ensemble,text:championName+" added to Hall history for "+entry.tournamentName,at:new Date().toISOString()}}}));setForm({studentId:"",legacyName:"",tournamentName:"",date:today()});}
  function patchStudent(id,type,value){const n=Number(value)||0;setState(q=>({...q,students:q.students.map(s=>{if(s.id!==id)return s;if(type==="ranking")return{...s,rankingAdjustments:{...(s.rankingAdjustments||{}),[ensemble]:n}};const current=s.hallAdjustments?.[ensemble]||{};return{...s,hallAdjustments:{...(s.hallAdjustments||{}),[ensemble]:{...current,[type]:n}}};})}));}
  return <div className="grid"><div className="card"><div className="card-head"><div><div className="card-title">Hall of Fame Commissioner Desk</div><div className="realname">Add missed championships, alumni history, and correction amounts without rewriting brackets.</div></div></div><div className="card-body history-entry-grid"><div><label>Current / known student</label><Select value={form.studentId} onChange={e=>setForm({...form,studentId:e.target.value,legacyName:""})}><option value="">Choose student or use alumni name</option>{players.map(s=><option key={s.id} value={s.id}>{s.name} • {s.instrument}</option>)}</Select></div><div><label>Alumni / historical name</label><Input value={form.legacyName} disabled={!!form.studentId} onChange={e=>setForm({...form,legacyName:e.target.value})} placeholder="Name not in current roster"/></div><div><label>Tournament / title</label><Input value={form.tournamentName} onChange={e=>setForm({...form,tournamentName:e.target.value})} placeholder="2025 Spring Band Madness"/></div><div><label>Date</label><Input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></div><div style={{alignSelf:"end"}}><Button className="gold" onClick={addHistorical}>Add Historical Championship</Button></div></div></div><div className="card"><div className="card-head"><div><div className="card-title">Power Ranking & Career Corrections</div><div className="realname">These are explicit Commissioner adjustments. The original challenge and bracket records stay untouched.</div></div></div><div className="table-wrap"><table className="table"><thead><tr><th>Student</th><th>Calculated Season</th><th>Power Ranking +/-</th><th>Extra Historic Titles</th><th>Defense +/-</th></tr></thead><tbody>{players.map(s=>{const st=statsFor(state,s),hall=hallAdjustment(s,ensemble);return <tr key={s.id}><td><b>{s.name}</b><div className="realname">{s.moniker}</div></td><td>{st.challengePoints+st.tournamentPoints} pts</td><td><Input className="correction-input" type="number" value={Number(s.rankingAdjustments?.[ensemble]||0)} onChange={e=>patchStudent(s.id,"ranking",e.target.value)}/></td><td><Input className="correction-input" type="number" min="0" value={hall.titles} onChange={e=>patchStudent(s.id,"titles",Math.max(0,Number(e.target.value)||0))}/></td><td><Input className="correction-input" type="number" value={hall.defenses} onChange={e=>patchStudent(s.id,"defenses",e.target.value)}/></td></tr>})}</tbody></table></div></div><div className="card"><div className="card-head"><div><div className="card-title">Manual Historical Championship Records</div><div className="realname">Named events entered here appear publicly in the Hall of Fame.</div></div></div><div className="table-wrap"><table className="table"><thead><tr><th>Champion</th><th>Championship</th><th>Date</th><th>Action</th></tr></thead><tbody>{manual.map(e=><tr key={e.id}><td><b>{e.championName}</b></td><td>{e.tournamentName}</td><td>{e.date||"—"}</td><td><Button className="sm red" onClick={()=>confirm("Remove this manual Hall record?")&&setState(q=>({...q,hallManualEntries:(q.hallManualEntries||[]).filter(x=>x.id!==e.id)}))}>Remove</Button></td></tr>)}{!manual.length&&<tr><td colSpan="4" className="empty-state">No manual historical records yet.</td></tr>}</tbody></table></div></div></div>;
}
`;

  window.BANDCENTER_PATCH_SOURCE=function(source){
    let out=previousPatch?previousPatch(source):source;

    out=out.replace("storeTransactions:[],rules:","storeTransactions:[],hallManualEntries:[],rules:");
    out=out.replace("s.storeTransactions=Array.isArray(s.storeTransactions)?s.storeTransactions:[];","s.storeTransactions=Array.isArray(s.storeTransactions)?s.storeTransactions:[];s.hallManualEntries=Array.isArray(s.hallManualEntries)?s.hallManualEntries:[];");

    out=out.replace(/function challengeHistory\(state,studentId\)\{[\s\S]*?function allStats\(state,ensemble\)\{[\s\S]*?\nfunction useAudio/,rankingSource.trim()+"\nfunction useAudio");
    out=out.replace(/function Standings\(\{state\}\)\{[\s\S]*?\nfunction badges/,standingsSource.trim()+"\nfunction badges");

    out=out.replace('{id:uid(),name:name.trim(),date:d,ensemble,scores:{},archived:false}','{id:uid(),name:name.trim(),date:d,ensemble,seasonKey:q.meta.seasonName,scores:{},archived:false}');
    out=out.replace('return{id:uid(),format:"divisions-v1",name,date:today(),ensemble,participants:[...selectedIds],divisions,finals,championId:finals.championId,archived:false};','return{id:uid(),format:"divisions-v1",name,date:today(),ensemble,seasonKey:state.meta.seasonName,participants:[...selectedIds],divisions,finals,championId:finals.championId,archived:false};');

    out=out.replace('const next=updateTournamentWinner(t,scope,ri,mi,w);if(next.championId&&next.championId!==before){const s=q.students.find(x=>x.id===next.championId);','const next=updateTournamentWinner(t,scope,ri,mi,w);if(next.championId){const savedChampion=q.students.find(x=>x.id===next.championId);next.championName=savedChampion?.name||next.championName||null;}if(next.championId&&next.championId!==before){const s=q.students.find(x=>x.id===next.championId);');

    if(!out.includes("function HallOfFame({state})"))out=out.replace("function Settings({state,setState}){",hallSource.trim()+"\nfunction Settings({state,setState}){");

    out=out.replace('const publicTabs=["Broadcast","Standings","Player Cards","Brackets"],adminTabs=["Roster","Challenges","Tournament Studio","Band Store","Settings"]','const publicTabs=["Broadcast","Standings","Player Cards","Brackets","Hall of Fame"],adminTabs=["Roster","Challenges","Tournament Studio","Band Store","Hall Manager","Settings"]');
    out=out.replace('{tab==="Brackets"&&<Brackets state={state}/>} {tab==="Roster"','{tab==="Brackets"&&<Brackets state={state}/>} {tab==="Hall of Fame"&&<HallOfFame state={state}/>} {tab==="Roster"');
    out=out.replace('{tab==="Band Store"&&<BandStore state={state} setState={setState}/>} {tab==="Settings"','{tab==="Band Store"&&<BandStore state={state} setState={setState}/>} {tab==="Hall Manager"&&<HallManager state={state} setState={setState}/>} {tab==="Settings"');

    out=out.replace('const tickerKey=items.join("|")+"|"+JSON.stringify([state.challenges,state.tournaments,state.storeTransactions,state.students.map(s=>[s.id,s.bandBucks,s.active,s.ensemble])]);','const tickerKey=items.join("|")+"|"+JSON.stringify([state.challenges,state.tournaments,state.storeTransactions,state.hallManualEntries,state.students.map(s=>[s.id,s.bandBucks,s.active,s.ensemble,s.rankingAdjustments,s.hallAdjustments])]);');
    out=out.replace('if(wins?.wins)items.push(`BRACKET WIN LEADER: ${wins.student.name} • ${wins.wins} WINS`);','if(wins?.wins)items.push(`BRACKET WIN LEADER: ${wins.student.name} • ${wins.wins} WINS`);const hallLeader=hallRecords(state,ensemble)[0];if(hallLeader)items.push(`HALL OF FAME: ${hallLeader.name} • ${hallLeader.totalTitles} TITLES`);');

    return out;
  };
})();