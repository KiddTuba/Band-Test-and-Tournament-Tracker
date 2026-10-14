(function(){
  const previousPatch=window.BANDCENTER_PATCH_SOURCE;
  const source=`
function tournamentDivisionLabel(d){
  return({"Woodwinds":"Division A","High Brass":"Division B","Low Brass":"Division C","Percussion":"Division D"})[d]||d;
}
function tournamentRandomIndex(max){
  if(max<=1)return 0;
  try{
    if(window.crypto&&window.crypto.getRandomValues){
      const ceiling=4294967296-(4294967296%max),buf=new Uint32Array(1);let value=0;
      do{window.crypto.getRandomValues(buf);value=buf[0];}while(value>=ceiling);
      return value%max;
    }
  }catch{}
  return Math.floor(Math.random()*max);
}
function shuffleTournamentDraw(values){
  const out=[...(values||[])];
  for(let i=out.length-1;i>0;i--){const j=tournamentRandomIndex(i+1),tmp=out[i];out[i]=out[j];out[j]=tmp;}
  return out;
}
function randomTournamentDraw(selectedIds){
  const unique=[...new Set((selectedIds||[]).filter(Boolean))],drawOrder=shuffleTournamentDraw(unique),divisionOrder=shuffleTournamentDraw(DIVISIONS),buckets={};
  DIVISIONS.forEach(d=>buckets[d]=[]);
  drawOrder.forEach((id,i)=>buckets[divisionOrder[i%divisionOrder.length]].push(id));
  DIVISIONS.forEach(d=>buckets[d]=shuffleTournamentDraw(buckets[d]));
  return{buckets,drawOrder,divisionOrder};
}
function createDivisionTournament(state,ensemble,name,selectedIds){
  const draw=randomTournamentDraw(selectedIds),divisions={};
  DIVISIONS.forEach(d=>{const ids=draw.buckets[d]||[],rounds=makeRounds(ids);divisions[d]={participantIds:ids,rounds,championId:divisionChampion({rounds})};});
  const finals=buildFinals(divisions,null);
  return{id:uid(),format:"divisions-v1",name,date:today(),ensemble,seasonKey:state.meta.seasonName,participants:[...draw.drawOrder],divisions,finals,championId:finals.championId,archived:false,seedingMode:"random-lottery",drawnAt:new Date().toISOString(),divisionOrder:draw.divisionOrder};
}
`;
  window.BANDCENTER_PATCH_SOURCE=function(input){
    let out=previousPatch?previousPatch(input):input;

    out=out.replace(/function rankIdsForDivision\(state,ensemble,division,selectedIds\)\{[\s\S]*?function createDivisionTournament\(state,ensemble,name,selectedIds\)\{[\s\S]*?\n\}/,source.trim());

    out=out.replace(
      '<div className="card-title">Tournament Selection Studio</div><div className="realname">Choose the field. BandCenter handles the seeding automatically from the current Power Rankings.</div>',
      '<div className="card-title">Tournament Lottery Studio</div><div className="realname">Choose the field. BandCenter then performs a completely random draw across all four bracket divisions. Instrument, section, prior matchup, and Power Ranking have zero influence on placement.</div>'
    );
    out=out.replace(
      '<Button className="red" onClick={create}>📺 Reveal Auto-Seeded Brackets</Button>',
      '<Button className="red" onClick={create}>🎲 Reveal Random Draw</Button>'
    );
    out=out.replace(
      'toast(t.name+" automatically seeded across four divisions")',
      'toast(t.name+": RANDOM DRAW COMPLETE • "+selectedIds.length+" players")'
    );
    out=out.replace(
      'text:t.name+" auto-seeded with "+selectedIds.length+" players"',
      'text:t.name+" random draw revealed with "+selectedIds.length+" players"'
    );
    out=out.replace(
      '<Button className="sm red" onClick={()=>rebuild(t.id)}>Rebuild Auto Seeds</Button>',
      '<Button className="sm red" onClick={()=>rebuild(t.id)}>🎲 Redraw Random Bracket</Button>'
    );
    out=out.replace(
      'if(!confirm("Rebuild this field from the currently checked players? Results in this tournament will reset and BandCenter will auto-seed it again."))return;',
      'if(!confirm("REDRAW this tournament completely at random? All current results in this tournament will reset and every selected player will be randomly reassigned to a bracket division and opening position."))return;'
    );
    out=out.replace(
      'text:"Tournament auto-seeded again"',
      'text:"Tournament RANDOMLY REDRAWN"'
    );

    out=out.replaceAll('<span>{d}</span>','<span>{tournamentDivisionLabel(d)}</span>');
    out=out.replace(
      '<div className="realname">Woodwind Champion vs High Brass Champion • Low Brass Champion vs Percussion Champion</div>',
      '<div className="realname">Division A Champion vs Division B Champion • Division C Champion vs Division D Champion</div>'
    );
    out=out.replace(
      'label:scope+" • "+(round.name||("Round "+(ri+1)))+" • Match "+(mi+1)+" • "+(slot===0?"Top":"Bottom")+" • "+(student?.name||"OPEN")',
      'label:tournamentDivisionLabel(scope)+" • "+(round.name||("Round "+(ri+1)))+" • Match "+(mi+1)+" • "+(slot===0?"Top":"Bottom")+" • "+(student?.name||"OPEN")'
    );

    out=out.replace(
      '<div className="card-title">{t.name}</div><div className="realname">{t.date} • Four-Division Championship • {t.participants?.length||0} players</div>',
      '<div className="card-title">{t.name}</div><div className="realname">{t.date} • Four-Division Championship • {t.participants?.length||0} players {t.seedingMode==="random-lottery"?"• 🎲 RANDOM DRAW":""}</div>'
    );

    out=out.replace(
      '<div className="division-picker-grid">{DIVISIONS.map(d=>{const group=filtered.filter(s=>divisionFor(s.instrument)===d),chosen=players.filter(s=>divisionFor(s.instrument)===d&&selectedIds.includes(s.id)).length;return <div className="division-picker" key={d}><div className="division-picker-head"><div><b>{d}</b><div className="realname">{chosen} selected</div></div><div><Button className="sm" onClick={()=>selectDivision(d)}>All</Button> <Button className="sm" onClick={()=>clearDivision(d)}>Clear</Button></div></div>{group.map(s=><label className="check-player" key={s.id}><input type="checkbox" checked={selectedIds.includes(s.id)} onChange={()=>toggle(s.id)}/><span><b>{s.name}</b><small>{s.moniker} • {s.instrument}</small></span></label>)}{!group.length&&<div className="realname">No matching players</div>}</div>})}</div>',
      '<div className="random-draw-pool"><div className="random-draw-pool-head"><div><b>🎲 Random Draw Pool</b><div className="realname">{selectedIds.length} selected • sections shown only as student info, never for seeding</div></div><div><Button className="sm" onClick={()=>setSelectedIds(players.map(s=>s.id))}>Select All</Button> <Button className="sm" onClick={()=>setSelectedIds([])}>Clear</Button></div></div><div className="random-player-grid">{filtered.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(s=><label className="check-player random-player" key={s.id}><input type="checkbox" checked={selectedIds.includes(s.id)} onChange={()=>toggle(s.id)}/><span><b>{s.name}</b><small>{s.instrument} • {s.moniker}</small></span></label>)}</div></div>'
    );

    out=out.replace(
      '<div className="emergency-seed-note"><b>Emergency bracket assist:</b>',
      '<div className="random-draw-note"><b>Lottery rules:</b> every selected student is shuffled into one common pool, randomly distributed as evenly as possible across Division A–D, then randomly placed inside that bracket. No ranking protection. No instrument protection. No rematch protection.</div><div className="emergency-seed-note"><b>Emergency bracket assist:</b>'
    );

    if(!out.includes('seedingMode:"random-lottery"'))throw new Error("BandCenter v23 random tournament draw did not apply.");
    if(out.includes("rankIdsForDivision(state,ensemble,d,selectedIds)"))throw new Error("BandCenter v23 section seeding is still active.");
    if(!out.includes("Tournament Lottery Studio"))throw new Error("BandCenter v23 lottery UI did not apply.");
    return out;
  };
})();