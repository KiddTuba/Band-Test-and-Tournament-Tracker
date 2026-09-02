(function(){
  const previousPatch=window.BANDCENTER_PATCH_SOURCE;

  window.BANDCENTER_PATCH_SOURCE=function(source){
    let out=previousPatch?previousPatch(source):source;

    // Archived tournaments are historical, not deleted. Keep their stats and achievements.
    out=out.replace('    if(t.archived)continue;\n    const parts=tournamentParticipants(t);','    const parts=tournamentParticipants(t);');

    // Tournament Studio keeps separate live and archived collections.
    out=out.replace(
      'const list=state.tournaments.filter(t=>!t.archived&&t.ensemble===ensemble);const players=',
      'const list=state.tournaments.filter(t=>!t.archived&&t.ensemble===ensemble);const archivedList=state.tournaments.filter(t=>t.archived&&t.ensemble===ensemble).sort((a,b)=>(b.date||"").localeCompare(a.date||""));const players='
    );

    // Add tournament lifecycle actions.
    out=out.replace(
      '  function openSlot(tid,scope,ri,mi,slot,currentId){setSlotEdit({tid,scope,ri,mi,slot,chosenId:currentId||""});}',
      `  function archiveTournament(tid){
    const tour=state.tournaments.find(t=>t.id===tid);if(!tour)return;
    if(!confirm("Archive "+tour.name+"?\\n\\nIt will disappear from live Brackets and the active tournament desk, but all results, wins, championships, and history will be preserved."))return;
    setState(q=>({...q,tournaments:q.tournaments.map(t=>t.id===tid?{...t,archived:true,archivedAt:new Date().toISOString()}:t),meta:{...q.meta,lastBracketAction:{ensemble,text:tour.name+" moved to the tournament archive",at:new Date().toISOString()}}}));
    toast(tour.name+" archived. History preserved.");
  }
  function restoreTournament(tid){
    const tour=state.tournaments.find(t=>t.id===tid);if(!tour)return;
    setState(q=>({...q,tournaments:q.tournaments.map(t=>t.id===tid?{...t,archived:false,archivedAt:null}:t),meta:{...q.meta,lastBracketAction:{ensemble,text:tour.name+" restored to live tournaments",at:new Date().toISOString()}}}));
    toast(tour.name+" restored.");
  }
  function deleteTournament(tid){
    const tour=state.tournaments.find(t=>t.id===tid);if(!tour)return;
    const ok=confirm("PERMANENTLY DELETE "+tour.name+"?\\n\\nThis removes the bracket, results, wins, championship credit, and tournament history from BandCenter. This cannot be undone except by restoring a backup.");
    if(!ok)return;
    const verify=confirm("Final confirmation: delete "+tour.name+" forever?");
    if(!verify)return;
    setState(q=>({...q,tournaments:q.tournaments.filter(t=>t.id!==tid),meta:{...q.meta,lastBracketAction:{ensemble,text:tour.name+" permanently deleted by Commissioner",at:new Date().toISOString()}}}));
    toast(tour.name+" deleted.");
  }
  function openSlot(tid,scope,ri,mi,slot,currentId){setSlotEdit({tid,scope,ri,mi,slot,chosenId:currentId||""});}`
    );

    // Add Archive and Delete to every live tournament toolbar.
    out=out.replace(
      '<Button className="sm red" onClick={()=>resetField(t.id)}>Replace Field + Reset</Button></div></div><Tournament state={state} t={t} editable onWin={win} onEditSlot={openSlot}/></div>)}',
      '<Button className="sm red" onClick={()=>resetField(t.id)}>Replace Field + Reset</Button> <Button className="sm" onClick={()=>archiveTournament(t.id)}>Archive</Button> <Button className="sm red" onClick={()=>deleteTournament(t.id)}>Delete</Button></div></div><Tournament state={state} t={t} editable onWin={win} onEditSlot={openSlot}/></div>)}'
    );

    // Archived tournament manager. Restore or permanently delete from here.
    out=out.replace(
      '    {slotEdit&&<div className="modal-back"',
      `    {archivedList.length>0&&<div className="card archived-tournaments"><div className="card-head"><div><div className="card-title">Tournament Archive</div><div className="realname">Historical brackets are hidden from live views but still count toward player history and achievements.</div></div></div><div className="table-wrap"><table className="table"><thead><tr><th>Tournament</th><th>Date</th><th>Champion</th><th>Players</th><th>Actions</th></tr></thead><tbody>{archivedList.map(t=>{const champ=t.championId&&state.students.find(s=>s.id===t.championId);return <tr key={t.id}><td><b>{t.name}</b></td><td>{t.date||"—"}</td><td>{champ?champ.name:"—"}</td><td>{t.participants?.length||tournamentParticipants(t).size}</td><td><Button className="sm primary" onClick={()=>restoreTournament(t.id)}>Restore</Button> <Button className="sm red" onClick={()=>deleteTournament(t.id)}>Delete Forever</Button></td></tr>})}</tbody></table></div></div>}
    {slotEdit&&<div className="modal-back"`
    );

    return out;
  };
})();
