(function(){
  const previousPatch=window.BANDCENTER_PATCH_SOURCE;

  const helpers=`
function tournamentResultDate(t){return normalizeCareerDate(t?.finishedDate||t?.completedAt||t?.archivedAt||t?.lastUpdatedAt||t?.date||t?.createdAt||"");}
function tournamentCareerDate(t){return tournamentResultDate(t);}
function tournamentResultStamp(t){return t?.finishedDate||t?.completedAt||t?.archivedAt||t?.lastUpdatedAt||t?.date||t?.createdAt||"";}
function tournamentMatchRows(t){
  const rows=[];
  const add=(rounds,scope)=>{(rounds||[]).forEach((round,ri)=>(round.matches||[]).forEach((match,mi)=>rows.push({scope,roundName:round.name||("Round "+(ri+1)),ri,mi,match})));};
  if(t.format==="divisions-v1"){DIVISIONS.forEach(d=>add(t.divisions?.[d]?.rounds||[],d));add(t.finals?.rounds||[],"Final Four");}
  else add(t.rounds||[],"Tournament");
  return rows;
}
function tournamentPerformanceRows(state,t){
  const ids=[...tournamentParticipants(t)];
  const matchRows=tournamentMatchRows(t);
  const final=t.format==="divisions-v1"?t.finals?.rounds?.at(-1)?.matches?.[0]:t.rounds?.at(-1)?.matches?.[0];
  const finalFourMatches=t.format==="divisions-v1"?t.finals?.rounds?.[0]?.matches||[]:t.rounds?.at(-2)?.matches||[];
  return ids.map(id=>{
    const student=studentByIdAny(state,id);
    let wins=0,loss=null;
    matchRows.forEach(row=>{
      const m=row.match,w=m.winner||m.winnerId,p1=m.p1||m.p1Id,p2=m.p2||m.p2Id;
      if(w===id&&p1&&p2)wins++;
      if((p1===id||p2===id)&&w&&w!==id)loss={...row,eliminatedBy:w};
    });
    const champion=tournamentChampionId(t)===id;
    const finalist=!!final&&[(final.p1||final.p1Id),(final.p2||final.p2Id)].includes(id);
    const finalFour=finalFourMatches.some(m=>[(m.p1||m.p1Id),(m.p2||m.p2Id)].includes(id));
    const division=t.format==="divisions-v1"?actualTournamentDivision(t,id):null;
    const divisionChampion=!!division&&t.divisions?.[division]?.championId===id;
    const score=(champion?1000:0)+(finalist?500:0)+(finalFour?250:0)+(divisionChampion?125:0)+(wins*20);
    return{
      id,student,name:student?.name||"Legacy Player",instrument:student?.instrument||"Legacy",
      wins,champion,finalist,finalFour,divisionChampion,division,
      eliminatedById:loss?.eliminatedBy||null,
      eliminatedByName:loss?.eliminatedBy?personName(state,loss.eliminatedBy):null,
      eliminatedRound:loss?.roundName||"",
      eliminatedScope:loss?.scope||"",
      score
    };
  }).sort((a,b)=>b.score-a.score||b.wins-a.wins||a.name.localeCompare(b.name));
}
function recentTournamentStories(state,t){
  const rows=tournamentPerformanceRows(state,t),stories=[],stamp=tournamentResultStamp(t),champ=rows.find(x=>x.champion),finalist=rows.find(x=>x.finalist&&!x.champion);
  if(champ)stories.push({text:"TOURNAMENT RECAP: "+champ.name+" won "+t.name+" • "+champ.wins+" MATCH WINS",stamp});
  if(finalist)stories.push({text:"FINALIST: "+finalist.name+" reached the championship in "+t.name+" • "+finalist.wins+" MATCH WINS",stamp});
  const ff=rows.filter(x=>x.finalFour&&!x.champion&&!x.finalist);
  ff.forEach(x=>stories.push({text:"FINAL FOUR RUN: "+x.name+" reached the BandCenter Final Four in "+t.name+" • "+x.wins+" MATCH WINS",stamp}));
  rows.filter(x=>!x.champion&&!x.finalist&&!x.finalFour&&x.wins>0).forEach(x=>{
    stories.push({text:"DEEP RUN: "+x.name+" • "+x.wins+" MATCH WIN"+(x.wins===1?"":"S")+(x.eliminatedByName?" • run ended by "+x.eliminatedByName:"")+(x.eliminatedRound?" in "+x.eliminatedRound:""),stamp});
  });
  const groups={};
  rows.forEach(x=>{if(!x.student||x.instrument==="Legacy")return;(groups[x.instrument]||(groups[x.instrument]=[])).push(x);});
  Object.entries(groups).forEach(([instrument,list])=>{
    const strong=list.filter(x=>x.wins>0||x.finalFour||x.finalist||x.champion).sort((a,b)=>b.score-a.score);
    if(strong.length>=2){
      const top=strong.slice(0,2);
      stories.push({text:instrument.toUpperCase()+" SPOTLIGHT: "+top.map(x=>x.name+" • "+x.wins+" W").join(" vs ")+" • "+t.name,stamp});
    }
  });
  const names=rows.map(x=>x.name);
  for(let i=0;i<names.length;i+=8)stories.push({text:"TOURNAMENT FIELD: "+names.slice(i,i+8).join(" • ")+" • competed in "+t.name,stamp});
  return stories;
}
`;

  const tournamentDateFns=`
  function patchTournamentDate(tid,field,value){
    const normalized=normalizeCareerDate(value);
    setState(q=>({...q,tournaments:q.tournaments.map(t=>t.id===tid?{...t,[field]:normalized||null}:t),meta:{...q.meta,lastBracketAction:{ensemble,text:(q.tournaments.find(t=>t.id===tid)?.name||"Tournament")+" "+(field==="date"?"start":"finish")+" date set to "+(normalized||"not set"),at:new Date().toISOString()}}}));
  }
`;

  window.BANDCENTER_PATCH_SOURCE=function(source){
    let out=previousPatch?previousPatch(source):source;

    out=out.replace(
      'function tournamentCareerDate(t){return normalizeCareerDate(t?.date||t?.completedAt||t?.lastUpdatedAt||t?.createdAt||"");}',
      helpers.trim()
    );

    out=out.replace(
      'function rebuild(tid){',
      tournamentDateFns.trim()+"\n  function rebuild(tid){"
    );

    out=out.replace(
      '<div className="card tournament-tools"><div className="card-body"><b>{t.name}</b> • {t.participants?.length||tournamentParticipants(t).size} players <Button className="sm"',
      '<div className="card tournament-tools"><div className="card-body"><div className="tournament-date-strip"><b>{t.name}</b><span>{t.participants?.length||tournamentParticipants(t).size} players</span><label>Started <Input type="date" value={normalizeCareerDate(t.date||"")} onChange={e=>patchTournamentDate(t.id,"date",e.target.value)}/></label><label>Finished <Input type="date" value={normalizeCareerDate(t.finishedDate||t.completedAt||"")} onChange={e=>patchTournamentDate(t.id,"finishedDate",e.target.value)}/></label></div> <Button className="sm"'
    );

    out=out.replace(
      'if(next.championId&&next.championId!==before){next.completedAt=next.lastUpdatedAt;',
      'if(next.championId&&next.championId!==before){next.completedAt=next.lastUpdatedAt;next.finishedDate=next.finishedDate||normalizeCareerDate(next.completedAt);'
    );

    out=out.replace(
      'const tournaments=(state.tournaments||[]).filter(t=>t.ensemble===ensemble).sort((a,b)=>String(tournamentSortStamp(b)).localeCompare(String(tournamentSortStamp(a))));\n  tournaments.forEach(t=>{const champ=tournamentChampionName(state,t),stamp=tournamentSortStamp(t);if(champ){const rec=hall.find(r=>r.studentId===tournamentChampionId(t));const text=(t.archived||t.legacy?"FROM THE ARCHIVES: ":"TOURNAMENT RECAP: ")+champ+" won "+t.name+(rec?" • CAREER "+rec.totalTitles+" TITLES • "+rec.defenses+" DEFENSES":"");(t.archived||t.legacy?archive:recent).push({text,stamp});}else if(t.archived||t.legacy)add(archive,"HISTORY FILE: "+t.name+(t.date?" • "+t.date:"")+" • bracket preserved",stamp);});',
      'const tournaments=(state.tournaments||[]).filter(t=>t.ensemble===ensemble).sort((a,b)=>String(tournamentResultStamp(b)).localeCompare(String(tournamentResultStamp(a))));\n  tournaments.forEach((t,index)=>{const champ=tournamentChampionName(state,t),stamp=tournamentResultStamp(t);if(index===0&&champ&&!t.archived&&!t.legacy)recent.push(...recentTournamentStories(state,t));else if(champ){const rec=hall.find(r=>r.studentId===tournamentChampionId(t));const text=(t.archived||t.legacy?"FROM THE ARCHIVES: ":"TOURNAMENT RECAP: ")+champ+" won "+t.name+(rec?" • CAREER "+rec.totalTitles+" TITLES • "+rec.defenses+" DEFENSES":"");(t.archived||t.legacy?archive:recent).push({text,stamp});}else if(t.archived||t.legacy)add(archive,"HISTORY FILE: "+t.name+(t.date?" • "+t.date:"")+" • bracket preserved",stamp);});'
    );

    if(!out.includes("function tournamentPerformanceRows(state,t)"))throw new Error("BandCenter v21 tournament recap helpers did not apply.");
    if(!out.includes("Finished <Input type=\"date\""))throw new Error("BandCenter v21 tournament finish-date editor did not apply.");
    if(!out.includes("TOURNAMENT FIELD: "))throw new Error("BandCenter v21 tournament field recap did not apply.");

    return out;
  };
})();