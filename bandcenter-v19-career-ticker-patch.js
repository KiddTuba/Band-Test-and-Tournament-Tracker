(function(){
  const previousPatch=window.BANDCENTER_PATCH_SOURCE;
  const LEGACY_BASELINE_CUTOFF="2026-09-08";

  const helpers=`
const CAREER_BASELINE_LEGACY_CUTOFF="2026-09-08";
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
function baselineRecordedSnapshot(state,student,ensemble,field){
  const record=student?.careerBaselines?.[ensemble]?.recordedAtEdit||{};
  if(Object.prototype.hasOwnProperty.call(record,field)){
    const n=Number(record[field]);if(Number.isFinite(n))return Math.max(0,n);
  }
  const legacy=rawCareerTournamentStats(state,student?.id,ensemble,t=>{
    const stamp=t?.date||String(tournamentSortStamp(t)).slice(0,10);return !stamp||stamp<CAREER_BASELINE_LEGACY_CUTOFF;
  });
  return field==="titles"||field==="defenses"?legacy.titles:Number(legacy[field]||0);
}
function baselineLiveDelta(state,student,ensemble,field){
  const raw=rawCareerTournamentStats(state,student?.id,ensemble);
  const current=field==="titles"||field==="defenses"?raw.titles:Number(raw[field]||0);
  return Math.max(0,current-baselineRecordedSnapshot(state,student,ensemble,field));
}
function careerBaselineTotal(state,student,ensemble,field,rawValue){
  const base=careerExactValue(student,ensemble,field);if(base===null)return rawValue;
  return Math.max(0,Number(base||0)+baselineLiveDelta(state,student,ensemble,field));
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
    const s=r.student||r.studentId&&studentByIdAny(state,r.studentId),raw=rawCareerTournamentStats(state,r.studentId,ensemble);
    const exactTitles=r.exactTitles!==undefined?r.exactTitles:hallExactValue(s,ensemble,"titles"),exactDefenses=r.exactDefenses!==undefined?r.exactDefenses:hallExactValue(s,ensemble,"defenses");
    const titleDelta=exactTitles!==null&&s?baselineLiveDelta(state,s,ensemble,"titles"):0;
    const totalTitles=exactTitles!==null?Math.max(0,exactTitles+titleDelta):r.earnedTitles;
    let defenses;
    if(exactDefenses!==null&&s){
      const postTitles=baselineLiveDelta(state,s,ensemble,"defenses"),baseTitleValue=exactTitles!==null?exactTitles:baselineRecordedSnapshot(state,s,ensemble,"defenses"),baseAlreadyChampion=Number(baseTitleValue||0)>0||Number(exactDefenses||0)>0;
      const defenseDelta=Math.max(0,postTitles-(baseAlreadyChampion?0:1));
      defenses=Math.max(0,exactDefenses+defenseDelta);
    }else defenses=Math.max(0,totalTitles-1);
    return{...r,student:s||null,rawTournamentTitles:raw.titles,totalTitles,defenses,isAuthoritative:exactTitles!==null||exactDefenses!==null,titles:r.titles.sort((a,b)=>(b.stamp||b.date||"").localeCompare(a.stamp||a.date||""))};
  });
  return out.filter(r=>r.totalTitles>0||r.defenses>0).sort((a,b)=>b.totalTitles-a.totalTitles||b.defenses-a.defenses||a.name.localeCompare(b.name));
}
`;

  const managerSource=`
function HallManager({state,setState}){
  const ensemble=state.settings.activeEnsemble,players=(state.students||[]).slice().sort((a,b)=>a.name.localeCompare(b.name));const[form,setForm]=useState({studentId:"",legacyName:"",tournamentName:"",date:today()});const manual=(state.hallManualEntries||[]).filter(e=>e.ensemble===ensemble).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  function addHistorical(){const student=players.find(s=>s.id===form.studentId),championName=student?.name||form.legacyName.trim();if(!championName||!form.tournamentName.trim())return alert("Enter a champion and tournament name.");const entry={id:uid(),studentId:student?.id||null,championName,ensemble,tournamentName:form.tournamentName.trim(),date:form.date||"",createdAt:new Date().toISOString()};setState(q=>({...q,hallManualEntries:[...(q.hallManualEntries||[]),entry]}));setForm({studentId:"",legacyName:"",tournamentName:"",date:today()});}
  function patchExact(id,field,value){setState(q=>{const snapshot=rawCareerTournamentStats(q,id,ensemble);return{...q,students:q.students.map(s=>{if(s.id!==id)return s;const current={...(s.hallAdjustments?.[ensemble]||{})},allBaselines={...(s.careerBaselines||{})},baseline={...(allBaselines[ensemble]||{})},recordedAtEdit={...(baseline.recordedAtEdit||{})},editedAt={...(baseline.editedAt||{})};if(value===""){delete current[field];delete recordedAtEdit[field];delete editedAt[field];}else{current[field]=Math.max(0,Number(value)||0);recordedAtEdit[field]=field==="titles"||field==="defenses"?snapshot.titles:Number(snapshot[field]||0);editedAt[field]=new Date().toISOString();}allBaselines[ensemble]={...baseline,recordedAtEdit,editedAt};return{...s,hallAdjustments:{...(s.hallAdjustments||{}),[ensemble]:current},careerBaselines:allBaselines};})};});}
  function clearExact(id){setState(q=>({...q,students:q.students.map(s=>{if(s.id!==id)return s;const all={...(s.hallAdjustments||{})},baselines={...(s.careerBaselines||{})};delete all[ensemble];delete baselines[ensemble];return{...s,hallAdjustments:all,careerBaselines:baselines};})}));}
  function patchRanking(id,value){setState(q=>({...q,students:q.students.map(s=>s.id===id?{...s,rankingAdjustments:{...(s.rankingAdjustments||{}),[ensemble]:Number(value)||0}}:s)}));}
  const fields=[['titles','Titles'],['defenses','Defenses'],['appearances','Apps'],['tournamentWins','Tournament Wins'],['finalFours','Final 4'],['finals','Finals']];
  return <div className="grid"><div className="card"><div className="card-head"><div><div className="card-title">All-Time History</div><div className="realname">Add missing championship events for current students or alumni.</div></div></div><div className="card-body history-entry-grid"><div><label>Known player</label><Select value={form.studentId} onChange={e=>setForm({...form,studentId:e.target.value,legacyName:""})}><option value="">Choose player or use alumni name</option>{players.map(s=><option key={s.id} value={s.id}>{s.name} • {s.instrument} • {s.retired?"Alumni / Retired":s.ensemble}</option>)}</Select></div><div><label>Alumni / historical name</label><Input value={form.legacyName} disabled={!!form.studentId} onChange={e=>setForm({...form,legacyName:e.target.value})} placeholder="Name not in current roster"/></div><div><label>Tournament / title</label><Input value={form.tournamentName} onChange={e=>setForm({...form,tournamentName:e.target.value})} placeholder="Spring Band Madness"/></div><div><label>Date</label><Input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></div><div style={{alignSelf:"end"}}><Button className="gold" onClick={addHistorical}>Add Championship Record</Button></div></div></div><div className="card"><div className="card-head"><div><div className="card-title">Career Baselines + Live Results</div><div className="realname">Enter the historical total you know. BandCenter remembers what was already recorded at that moment, then adds only tournament results that happen afterward.</div></div></div><div className="table-wrap"><table className="table"><thead><tr><th>Player</th><th>Season +/-</th>{fields.map(f=><th key={f[0]}>{f[1]}</th>)}<th>Giving</th><th>Mode</th></tr></thead><tbody>{players.map(s=>{const comp=competitiveProfile(state,s.id,ensemble),gift=donationProfile(state,s.id,ensemble),hall=hallRecords(state,ensemble).find(r=>r.studentId===s.id),current={titles:hall?.totalTitles||0,defenses:hall?.defenses||0,appearances:comp.appearances,tournamentWins:comp.tournamentWins,finalFours:comp.finalFours,finals:comp.finals};return <tr key={s.id}><td><b>{s.name}</b>{s.retired&&<span className="alumni-chip">Alumni</span>}<div className="realname">{s.moniker||""}</div></td><td><Input className="history-total-input" type="number" value={Number(s.rankingAdjustments?.[ensemble]||0)} onChange={e=>patchRanking(s.id,e.target.value)}/></td>{fields.map(([key])=>{const exact=careerExactValue(s,ensemble,key),delta=exact===null?0:Math.max(0,Number(current[key]||0)-Number(exact||0));return <td key={key}><Input className="history-total-input" type="number" min="0" value={exact===null?"":exact} placeholder={String(current[key]||0)} onChange={e=>patchExact(s.id,key,e.target.value)}/><div className="derived-number">now: {current[key]||0}{exact!==null&&delta>0?" • +"+delta+" since baseline":""}</div></td>})}<td><b>{gift.amountDonated.toLocaleString()} BB</b><div className="profile-note">{gift.timesDonated} gifts • {gift.mentorships} mentorships</div></td><td><Button className="sm" onClick={()=>clearExact(s.id)}>Use Recorded History</Button></td></tr>})}</tbody></table></div><div className="card-body"><div className="realname">Existing baselines from before this update are treated as history through September 7, 2026, so tournament results from September 8 forward are added automatically.</div></div></div><div className="card"><div className="card-head"><div><div className="card-title">Historical Championship Records</div><div className="realname">Named events describe the résumé beneath the totals. They do not double-count an official baseline.</div></div></div><div className="table-wrap"><table className="table"><thead><tr><th>Champion</th><th>Championship</th><th>Date</th><th>Action</th></tr></thead><tbody>{manual.map(e=><tr key={e.id}><td><b>{e.championName}</b></td><td>{e.tournamentName}</td><td>{e.date||"—"}</td><td><Button className="sm red" onClick={()=>confirm("Remove this historical record?")&&setState(q=>({...q,hallManualEntries:(q.hallManualEntries||[]).filter(x=>x.id!==e.id)}))}>Remove</Button></td></tr>)}{!manual.length&&<tr><td colSpan="4" className="empty-state">No manual historical records yet.</td></tr>}</tbody></table></div></div></div>;
}
`;

  const tickerSource=`
function tickerItems(state,ensemble){
  const board=allStats(state,ensemble),hall=hallRecords(state,ensemble),profiles=allCareerProfiles(state,ensemble),recent=[],current=[],milestones=[],archive=[];
  const add=(bucket,text,stamp)=>bucket.push({text,stamp:stamp||""});
  const bracket=state.meta?.lastBracketAction;if(bracket?.ensemble===ensemble&&bracket.text)add(recent,"LATEST: "+bracket.text,bracket.at);
  const latestChallenge=(state.challenges||[]).filter(c=>c.ensemble===ensemble).sort((a,b)=>(b.updatedAt||b.date||"").localeCompare(a.updatedAt||a.date||""))[0];const scoreStory=latestScoreStory(state,ensemble);if(latestChallenge&&scoreStory)add(recent,"LATEST CHALLENGE: "+scoreStory,latestChallenge.updatedAt||latestChallenge.date);
  (state.storeTransactions||[]).filter(x=>x.ensemble===ensemble).slice(-8).forEach(x=>add(recent,(x.refundedAt?"STORE REFUND: ":"BAND STORE: ")+x.studentName+(x.refundedAt?" refunded ":" bought ")+x.itemName+(x.cost?" • "+x.cost+" BB":""),x.refundedAt||x.purchasedAt));
  (state.communityActions||[]).filter(a=>a.ensemble===ensemble).slice(-12).forEach(a=>{if(a.type==="donation")add(recent,"LEGACY GIFT: "+a.donorName+" gave "+Number(a.amount||0).toLocaleString()+" BB to "+a.recipientName,a.at);else if(a.type==="legacyBonus")add(recent,"LEGACY BONUS: "+a.studentName+" crossed 15,000 BB donated and earned 10,000 BB",a.at);});
  (state.mentorships||[]).filter(m=>m.ensemble===ensemble).slice(-8).forEach(m=>add(recent,"MENTORSHIP: "+m.mentorName+" + "+m.menteeName+" • BUILDING THE NEXT GENERATION",m.createdAt||m.at));
  const tournaments=(state.tournaments||[]).filter(t=>t.ensemble===ensemble).sort((a,b)=>String(tournamentSortStamp(b)).localeCompare(String(tournamentSortStamp(a))));
  tournaments.forEach(t=>{const champ=tournamentChampionName(state,t),stamp=tournamentSortStamp(t);if(champ){const rec=hall.find(r=>r.studentId===tournamentChampionId(t));const text=(t.archived||t.legacy?"FROM THE ARCHIVES: ":"TOURNAMENT RECAP: ")+champ+" won "+t.name+(rec?" • CAREER "+rec.totalTitles+" TITLES • "+rec.defenses+" DEFENSES":"");(t.archived||t.legacy?archive:recent).push({text,stamp});}else if(t.archived||t.legacy)add(archive,"HISTORY FILE: "+t.name+(t.date?" • "+t.date:"")+" • bracket preserved",stamp);});
  recent.sort((a,b)=>String(b.stamp).localeCompare(String(a.stamp)));
  const goat=hall[0];if(goat)current.push({text:"GOAT: "+goat.name+" • "+goat.totalTitles+" TITLES • "+goat.defenses+" DEFENSES"});
  board.slice(0,10).forEach((x,i)=>current.push({text:"POWER RANKINGS #"+(i+1)+": "+x.student.name+" • "+x.points+" PTS"}));
  const high=[...board].sort((a,b)=>b.best-a.best)[0],wins=[...board].sort((a,b)=>b.wins-a.wins)[0];if(high?.best)current.push({text:"TOP PLAYING SCORE: "+high.student.name+" • "+high.best.toFixed(1)});if(wins?.wins)current.push({text:"CURRENT BRACKET WIN LEADER: "+wins.student.name+" • "+wins.wins+" WINS"});
  const wealth=(state.students||[]).filter(s=>s.active!==false&&!s.retired&&s.ensemble===ensemble).sort((a,b)=>Number(b.bandBucks||0)-Number(a.bandBucks||0));wealth.slice(0,10).forEach((s,i)=>current.push({text:"BAND BUCKS TOP 10 #"+(i+1)+": "+s.name+" • "+Number(s.bandBucks||0).toLocaleString()+" BB"}));
  hall.forEach((r,i)=>{if(i>0)milestones.push({text:"ALL-TIME CHAMPIONS #"+(i+1)+": "+r.name+" • "+r.totalTitles+" TITLES • "+r.defenses+" DEFENSES"})});
  board.filter(x=>x.points>=100).forEach(x=>milestones.push({text:"100 CLUB: "+x.student.name+" • "+x.points+" SEASON PTS"}));
  wealth.filter(s=>Number(s.bandBucks||0)>=1000).forEach(s=>{const level=Math.floor(Number(s.bandBucks||0)/1000)*1000;milestones.push({text:level.toLocaleString()+" BAND BUCK CLUB: "+s.name+" • "+Number(s.bandBucks||0).toLocaleString()+" BB"})});
  profiles.filter(p=>p.appearances).forEach(p=>milestones.push({text:"CAREER FILE: "+p.student.name+" • "+p.appearances+" TOURNAMENTS • "+p.tournamentWins+" WINS • "+p.finalFours+" FINAL FOURS • "+p.finals+" FINALS • "+p.titles+" TITLES"}));
  profiles.filter(p=>p.timesDonated).forEach(p=>milestones.push({text:"GIVING RECORD: "+p.student.name+" • "+p.timesDonated+" GIFTS • "+p.amountDonated.toLocaleString()+" BB DONATED"}));
  profiles.filter(p=>p.amountDonated>=15000).forEach(p=>milestones.push({text:"LEGACY BENEFACTOR: "+p.student.name+" • "+p.amountDonated.toLocaleString()+" BB GIVEN • 10,000 BB LEGACY BONUS EARNED"}));
  archive.sort((a,b)=>String(b.stamp).localeCompare(String(a.stamp)));
  return[...recent,...current,...milestones,...archive].map(x=>x.text);
}
`;

  window.BANDCENTER_PATCH_SOURCE=function(source){
    let out=previousPatch?previousPatch(source):source;
    out=out.replace(/function competitiveProfile\\(state,studentId,ensemble\\)\\{[\\s\\S]*?function donationProfile/,helpers.trim()+"\\nfunction donationProfile");
    out=out.replace(/function hallRecords\\(state,ensemble\\)\\{[\\s\\S]*?function latestHallChampion/,"function latestHallChampion");
    out=out.replace(/function HallManager\\(\\{state,setState\\}\\)\\{[\\s\\S]*?function Settings/,managerSource.trim()+"\\nfunction Settings");
    out=out.replace(/function tickerItems\\(state,ensemble\\)\\{[\\s\\S]*?function Header/,tickerSource.trim()+"\\nfunction Header");
    out=out.replace('const next=updateTournamentWinner(t,scope,ri,mi,w);if(next.championId){','const next=updateTournamentWinner(t,scope,ri,mi,w);next.lastUpdatedAt=new Date().toISOString();if(next.championId){');
    out=out.replace('if(next.championId&&next.championId!==before){const s=q.students.find(x=>x.id===next.championId);','if(next.championId&&next.championId!==before){next.completedAt=next.lastUpdatedAt;const s=q.students.find(x=>x.id===next.championId);');
    if(!out.includes("CAREER_BASELINE_LEGACY_CUTOFF"))throw new Error("BandCenter v19 career baseline patch did not apply.");
    if(!out.includes("Career Baselines + Live Results"))throw new Error("BandCenter v19 History Manager patch did not apply.");
    return out;
  };
})();