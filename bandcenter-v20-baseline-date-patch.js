(function(){
  const previousPatch=window.BANDCENTER_PATCH_SOURCE;
  const DEFAULT_BASELINE_THROUGH="2026-09-07";

  const helpers=`
const CAREER_DEFAULT_BASELINE_THROUGH="2026-09-07";
function tournamentSortStamp(t){return t?.completedAt||t?.lastUpdatedAt||t?.date||t?.createdAt||"";}
function rawCareerTournamentStats(state,studentId,ensemble,predicate){
  let appearances=0,tournamentWins=0,finalFours=0,finals=0,titles=0;
  for(const t of state.tournaments||[]){
    if(t.ensemble!==ensemble||!studentId)continue;
    if(predicate&&!predicate(t))continue;
    const parts=tournamentParticipants(t);if(!parts.has(studentId))continue;
    appearances++;
    allTournamentRounds(t).forEach(r=>(r.matches||[]).forEach(m=>{const w=m.winner||m.winnerId,p1=m.p1||m.p1Id,p2=m.p2||m.p2Id;if(w===studentId&&p1&&p2)tournamentWins++;}));
    if(t.format==="divisions-v1"){
      const semis=t.finals?.rounds?.[0]?.matches||[];if(semis.some(m=>m.p1===studentId||m.p2===studentId))finalFours++;
      const final=t.finals?.rounds?.at(-1)?.matches?.[0];if(final&&(final.p1===studentId||final.p2===studentId))finals++;
    }else{
      const rounds=t.rounds||[],semi=rounds.at(-2),final=rounds.at(-1)?.matches?.[0];
      if(semi?.matches?.some(m=>(m.p1||m.p1Id)===studentId||(m.p2||m.p2Id)===studentId))finalFours++;
      if(final&&((final.p1||final.p1Id)===studentId||(final.p2||final.p2Id)===studentId))finals++;
    }
    if(tournamentChampionId(t)===studentId)titles++;
  }
  return{appearances,tournamentWins,finalFours,finals,titles};
}
function normalizeCareerDate(value){
  if(!value)return"";
  const raw=String(value).trim();
  const iso=raw.match(/^(\\d{4})-(\\d{1,2})-(\\d{1,2})/);
  if(iso)return iso[1]+"-"+String(iso[2]).padStart(2,"0")+"-"+String(iso[3]).padStart(2,"0");
  const us=raw.match(/^(\\d{1,2})[\\/-](\\d{1,2})[\\/-](\\d{4})/);
  if(us)return us[3]+"-"+String(us[1]).padStart(2,"0")+"-"+String(us[2]).padStart(2,"0");
  const d=new Date(raw);
  if(!Number.isNaN(d.getTime()))return d.toISOString().slice(0,10);
  return raw;
}
function tournamentCareerDate(t){return normalizeCareerDate(t?.date||t?.completedAt||t?.lastUpdatedAt||t?.createdAt||"");}
function baselineThroughDate(student,ensemble){
  const configured=student?.careerBaselines?.[ensemble]?.throughDate;
  return normalizeCareerDate(configured||CAREER_DEFAULT_BASELINE_THROUGH);
}
function tournamentAfterBaseline(t,student,ensemble){
  const eventDate=tournamentCareerDate(t),cutoff=baselineThroughDate(student,ensemble);
  if(!eventDate)return false;
  return eventDate>cutoff;
}
function postBaselineTournamentStats(state,student,ensemble){
  return rawCareerTournamentStats(state,student?.id,ensemble,t=>tournamentAfterBaseline(t,student,ensemble));
}
function careerBaselineTotal(state,student,ensemble,field,rawValue){
  const base=careerExactValue(student,ensemble,field);if(base===null)return rawValue;
  const post=postBaselineTournamentStats(state,student,ensemble);
  const delta=field==="titles"||field==="defenses"?post.titles:Number(post[field]||0);
  return Math.max(0,Number(base||0)+delta);
}
function competitiveProfile(state,studentId,ensemble){
  const raw=rawCareerTournamentStats(state,studentId,ensemble),student=studentByIdAny(state,studentId);
  return{
    appearances:careerBaselineTotal(state,student,ensemble,"appearances",raw.appearances),
    tournamentWins:careerBaselineTotal(state,student,ensemble,"tournamentWins",raw.tournamentWins),
    finalFours:careerBaselineTotal(state,student,ensemble,"finalFours",raw.finalFours),
    finals:careerBaselineTotal(state,student,ensemble,"finals",raw.finals),
    derived:{appearances:raw.appearances,tournamentWins:raw.tournamentWins,finalFours:raw.finalFours,finals:raw.finals,titles:raw.titles}
  };
}
function hallRecords(state,ensemble){
  const map=new Map();
  const ensure=(name,studentId)=>{const key=studentId?"id:"+studentId:"name:"+String(name||"Unknown").trim().toLowerCase();if(!map.has(key))map.set(key,{key,name:String(name||"Unknown"),studentId:studentId||null,earnedTitles:0,titles:[],student:null});return map.get(key);};
  (state.tournaments||[]).filter(t=>t.ensemble===ensemble).forEach(t=>{const id=tournamentChampionId(t),name=tournamentChampionName(state,t);if(!name)return;const rec=ensure(name,id);rec.earnedTitles++;rec.titles.push({tournamentName:t.name||"Tournament",date:t.date||"",source:t.legacy?"Legacy Tournament":"BandCenter Tournament",stamp:tournamentSortStamp(t)});});
  (state.hallManualEntries||[]).filter(e=>e.ensemble===ensemble).forEach(e=>{if(!e.championName)return;const rec=ensure(e.championName,e.studentId||null);rec.earnedTitles++;rec.titles.push({tournamentName:e.tournamentName||"Historical Championship",date:e.date||"",source:"Historical Record",manualId:e.id,stamp:e.createdAt||e.date||""});});
  (state.students||[]).forEach(s=>{const exactTitles=hallExactValue(s,ensemble,"titles"),exactDefenses=hallExactValue(s,ensemble,"defenses");if(exactTitles===null&&exactDefenses===null)return;const rec=ensure(s.name,s.id);rec.student=s;rec.exactTitles=exactTitles;rec.exactDefenses=exactDefenses;});
  const out=[...map.values()].map(r=>{
    const s=r.student||r.studentId&&studentByIdAny(state,r.studentId);
    const exactTitles=r.exactTitles!==undefined?r.exactTitles:hallExactValue(s,ensemble,"titles"),exactDefenses=r.exactDefenses!==undefined?r.exactDefenses:hallExactValue(s,ensemble,"defenses");
    const post=s?postBaselineTournamentStats(state,s,ensemble):{titles:0};
    const totalTitles=exactTitles!==null?Math.max(0,Number(exactTitles||0)+Number(post.titles||0)):r.earnedTitles;
    let defenses;
    if(exactDefenses!==null&&s){
      const baseTitles=exactTitles!==null?Number(exactTitles||0):0;
      const alreadyChampion=baseTitles>0||Number(exactDefenses||0)>0;
      const defenseDelta=alreadyChampion?Number(post.titles||0):Math.max(0,Number(post.titles||0)-1);
      defenses=Math.max(0,Number(exactDefenses||0)+defenseDelta);
    }else defenses=Math.max(0,totalTitles-1);
    return{...r,student:s||null,totalTitles,defenses,isAuthoritative:exactTitles!==null||exactDefenses!==null,titles:r.titles.sort((a,b)=>(b.stamp||b.date||"").localeCompare(a.stamp||a.date||""))};
  });
  return out.filter(r=>r.totalTitles>0||r.defenses>0).sort((a,b)=>b.totalTitles-a.totalTitles||b.defenses-a.defenses||a.name.localeCompare(b.name));
}
`;

  const manager=`
function HallManager({state,setState}){
  const ensemble=state.settings.activeEnsemble,players=(state.students||[]).slice().sort((a,b)=>a.name.localeCompare(b.name));const[form,setForm]=useState({studentId:"",legacyName:"",tournamentName:"",date:today()});const manual=(state.hallManualEntries||[]).filter(e=>e.ensemble===ensemble).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  function addHistorical(){const student=players.find(s=>s.id===form.studentId),championName=student?.name||form.legacyName.trim();if(!championName||!form.tournamentName.trim())return alert("Enter a champion and tournament name.");const entry={id:uid(),studentId:student?.id||null,championName,ensemble,tournamentName:form.tournamentName.trim(),date:form.date||"",createdAt:new Date().toISOString()};setState(q=>({...q,hallManualEntries:[...(q.hallManualEntries||[]),entry]}));setForm({studentId:"",legacyName:"",tournamentName:"",date:today()});}
  function patchExact(id,field,value){setState(q=>{const at=new Date().toISOString(),player=q.students.find(x=>x.id===id);return{...q,students:q.students.map(s=>{if(s.id!==id)return s;const current={...(s.hallAdjustments?.[ensemble]||{})},allBaselines={...(s.careerBaselines||{})},baseline={...(allBaselines[ensemble]||{})};if(value==="")delete current[field];else current[field]=Math.max(0,Number(value)||0);allBaselines[ensemble]={...baseline,throughDate:baseline.throughDate||CAREER_DEFAULT_BASELINE_THROUGH};return{...s,hallAdjustments:{...(s.hallAdjustments||{}),[ensemble]:current},careerBaselines:allBaselines};}),meta:{...q.meta,lastHistoryEdit:{ensemble,text:(player?.name||"Player")+" "+field+" baseline "+(value===""?"returned to recorded history":"set to "+Math.max(0,Number(value)||0)),at}}};});}
  function patchThroughDate(id,value){setState(q=>{const at=new Date().toISOString(),player=q.students.find(x=>x.id===id);return{...q,students:q.students.map(s=>{if(s.id!==id)return s;const all={...(s.careerBaselines||{})},baseline={...(all[ensemble]||{})};all[ensemble]={...baseline,throughDate:normalizeCareerDate(value)||CAREER_DEFAULT_BASELINE_THROUGH};return{...s,careerBaselines:all};}),meta:{...q.meta,lastHistoryEdit:{ensemble,text:(player?.name||"Player")+" career baseline now runs through "+(normalizeCareerDate(value)||CAREER_DEFAULT_BASELINE_THROUGH),at}}};});}
  function clearExact(id){setState(q=>({...q,students:q.students.map(s=>{if(s.id!==id)return s;const all={...(s.hallAdjustments||{})},baselines={...(s.careerBaselines||{})};delete all[ensemble];delete baselines[ensemble];return{...s,hallAdjustments:all,careerBaselines:baselines};})}));}
  function patchRanking(id,value){setState(q=>({...q,students:q.students.map(s=>s.id===id?{...s,rankingAdjustments:{...(s.rankingAdjustments||{}),[ensemble]:Number(value)||0}}:s)}));}
  const fields=[['titles','Titles'],['defenses','Defenses'],['appearances','Apps'],['tournamentWins','Tournament Wins'],['finalFours','Final 4'],['finals','Finals']];
  return <div className="grid"><div className="card"><div className="card-head"><div><div className="card-title">All-Time History</div><div className="realname">Add missing championship events for current students or alumni.</div></div></div><div className="card-body history-entry-grid"><div><label>Known player</label><Select value={form.studentId} onChange={e=>setForm({...form,studentId:e.target.value,legacyName:""})}><option value="">Choose player or use alumni name</option>{players.map(s=><option key={s.id} value={s.id}>{s.name} • {s.instrument} • {s.retired?"Alumni / Retired":s.ensemble}</option>)}</Select></div><div><label>Alumni / historical name</label><Input value={form.legacyName} disabled={!!form.studentId} onChange={e=>setForm({...form,legacyName:e.target.value})} placeholder="Name not in current roster"/></div><div><label>Tournament / title</label><Input value={form.tournamentName} onChange={e=>setForm({...form,tournamentName:e.target.value})} placeholder="Spring Band Madness"/></div><div><label>Date</label><Input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></div><div style={{alignSelf:"end"}}><Button className="gold" onClick={addHistorical}>Add Championship Record</Button></div></div></div><div className="card"><div className="card-head"><div><div className="card-title">Career Baselines + Live Results</div><div className="realname">The numbers you enter are the official career record THROUGH the date shown. Every tournament after that date is added automatically.</div></div></div><div className="table-wrap"><table className="table"><thead><tr><th>Player</th><th>Baseline Through</th><th>Season +/-</th>{fields.map(f=><th key={f[0]}>{f[1]}</th>)}<th>Giving</th><th>Mode</th></tr></thead><tbody>{players.map(s=>{const comp=competitiveProfile(state,s.id,ensemble),gift=donationProfile(state,s.id,ensemble),hall=hallRecords(state,ensemble).find(r=>r.studentId===s.id),through=baselineThroughDate(s,ensemble),post=postBaselineTournamentStats(state,s,ensemble),current={titles:hall?.totalTitles||0,defenses:hall?.defenses||0,appearances:comp.appearances,tournamentWins:comp.tournamentWins,finalFours:comp.finalFours,finals:comp.finals};return <tr key={s.id}><td><b>{s.name}</b>{s.retired&&<span className="alumni-chip">Alumni</span>}<div className="realname">{s.moniker||""}</div></td><td><Input className="history-total-input" type="date" value={through} onChange={e=>patchThroughDate(s.id,e.target.value)}/><div className="derived-number">{post.appearances} newer tournament{post.appearances===1?"":"s"}</div></td><td><Input className="history-total-input" type="number" value={Number(s.rankingAdjustments?.[ensemble]||0)} onChange={e=>patchRanking(s.id,e.target.value)}/></td>{fields.map(([key])=>{const exact=careerExactValue(s,ensemble,key),delta=key==="titles"?post.titles:key==="defenses"?(Number(exact||0)>0||Number(careerExactValue(s,ensemble,"titles")||0)>0?post.titles:Math.max(0,post.titles-1)):Number(post[key]||0);return <td key={key}><Input className="history-total-input" type="number" min="0" value={exact===null?"":exact} placeholder={String(current[key]||0)} onChange={e=>patchExact(s.id,key,e.target.value)}/><div className="derived-number">now: {current[key]||0}{exact!==null&&delta>0?" • +"+delta+" after "+through:""}</div></td>})}<td><b>{gift.amountDonated.toLocaleString()} BB</b><div className="profile-note">{gift.timesDonated} gifts • {gift.mentorships} mentorships</div></td><td><Button className="sm" onClick={()=>clearExact(s.id)}>Use Recorded History</Button></td></tr>})}</tbody></table></div><div className="card-body"><div className="realname">Existing edited totals default to a baseline through September 7, 2026. Change the date whenever a historical total is known through a different point in time.</div></div></div><div className="card"><div className="card-head"><div><div className="card-title">Historical Championship Records</div><div className="realname">Named events describe the résumé beneath the totals. They do not double-count a career baseline.</div></div></div><div className="table-wrap"><table className="table"><thead><tr><th>Champion</th><th>Championship</th><th>Date</th><th>Action</th></tr></thead><tbody>{manual.map(e=><tr key={e.id}><td><b>{e.championName}</b></td><td>{e.tournamentName}</td><td>{e.date||"—"}</td><td><Button className="sm red" onClick={()=>confirm("Remove this historical record?")&&setState(q=>({...q,hallManualEntries:(q.hallManualEntries||[]).filter(x=>x.id!==e.id)}))}>Remove</Button></td></tr>)}{!manual.length&&<tr><td colSpan="4" className="empty-state">No manual historical records yet.</td></tr>}</tbody></table></div></div></div>;
}
`;

  window.BANDCENTER_PATCH_SOURCE=function(source){
    let out=previousPatch?previousPatch(source):source;
    out=out.replace(/const CAREER_BASELINE_LEGACY_CUTOFF="2026-09-08";[\s\S]*?function donationProfile/,helpers.trim()+"\nfunction donationProfile");
    out=out.replace(/function HallManager\(\{state,setState\}\)\{[\s\S]*?function Settings/,manager.trim()+"\nfunction Settings");
    if(!out.includes("CAREER_DEFAULT_BASELINE_THROUGH"))throw new Error("BandCenter v20 baseline-through patch did not apply.");
    if(!out.includes("Baseline Through"))throw new Error("BandCenter v20 History Manager date control did not apply.");
    return out;
  };
})();