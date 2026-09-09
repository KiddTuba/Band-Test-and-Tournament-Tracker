(function(){
  const previousPatch=window.BANDCENTER_PATCH_SOURCE;

  const overrideSource=`
function tournamentOverrideSlots(t,state){
  const slots=[];
  const addRounds=(rounds,scope)=>{
    (rounds||[]).forEach((round,ri)=>(round.matches||[]).forEach((match,mi)=>{
      if(match.winner)return;
      [["p1",0],["p2",1]].forEach(([field,slot])=>{
        const id=match[field]||null;
        const student=id&&state.students.find(s=>s.id===id);
        slots.push({
          key:scope+"|"+ri+"|"+mi+"|"+slot,
          scope,ri,mi,slot,id,
          label:scope+" • "+(round.name||("Round "+(ri+1)))+" • Match "+(mi+1)+" • "+(slot===0?"Top":"Bottom")+" • "+(student?.name||"OPEN")
        });
      });
    }));
  };
  if(t.format==="divisions-v1"){
    DIVISIONS.forEach(d=>addRounds(t.divisions?.[d]?.rounds||[],d));
    addRounds(t.finals?.rounds||[],"Final Four");
  }
  return slots;
}
function TournamentOverrideCard({state,setState,t,toast}){
  const[slotKey,setSlotKey]=useState("");
  const[studentId,setStudentId]=useState("");
  const slots=tournamentOverrideSlots(t,state);
  const players=state.students
    .filter(s=>s.active!==false&&!s.retired&&s.ensemble===t.ensemble)
    .slice()
    .sort((a,b)=>a.name.localeCompare(b.name));
  const selected=slots.find(x=>x.key===slotKey)||null;
  const outgoing=selected?.id&&state.students.find(s=>s.id===selected.id);
  const incoming=studentId&&state.students.find(s=>s.id===studentId);

  useEffect(()=>{
    if(slotKey&&!slots.some(x=>x.key===slotKey))setSlotKey("");
  },[t,slotKey]);

  function applyOverride(){
    if(!selected)return alert("Choose an unplayed bracket spot first.");
    const action=studentId
      ? (outgoing?(outgoing.name+" will be replaced by "+(incoming?.name||"the selected student")):((incoming?.name||"The selected student")+" will be added to this open spot"))
      : ((outgoing?.name||"This player")+" will be removed from this bracket spot");
    if(!confirm(action+". Completed results will stay intact. Continue?"))return;
    const nextId=studentId||null;
    setState(q=>({
      ...q,
      tournaments:q.tournaments.map(tour=>tour.id===t.id
        ? setTournamentSlot(tour,selected.scope,selected.ri,selected.mi,selected.slot,nextId,"extra")
        : tour),
      meta:{...q.meta,lastBracketAction:{
        ensemble:t.ensemble,
        text:studentId
          ? ((incoming?.name||"Player")+(outgoing?" substituted for "+outgoing.name:" added to an open tournament spot")+" in "+t.name)
          : ((outgoing?.name||"Player")+" removed from an unplayed spot in "+t.name),
        at:new Date().toISOString()
      }}
    }));
    toast(studentId
      ? ((incoming?.name||"Player")+(outgoing?" substituted for "+outgoing.name:" added to the bracket"))
      : ((outgoing?.name||"Player")+" removed from the bracket"));
    setSlotKey("");
    setStudentId("");
  }

  return <div className="card tournament-override-card">
    <div className="card-head"><div>
      <div className="card-title">Tournament Override</div>
      <div className="realname">Emergency substitution or removal for an unplayed bracket spot. Completed results are locked.</div>
    </div></div>
    <div className="card-body">
      <div className="field-row">
        <div style={{minWidth:280}}>
          <label>Bracket spot</label>
          <Select value={slotKey} onChange={e=>{setSlotKey(e.target.value);setStudentId("");}}>
            <option value="">Choose an unplayed spot</option>
            {slots.map(slot=><option value={slot.key} key={slot.key}>{slot.label}</option>)}
          </Select>
        </div>
        <div style={{minWidth:230}}>
          <label>Replacement</label>
          <Select value={studentId} onChange={e=>setStudentId(e.target.value)} disabled={!slotKey}>
            <option value="">Remove / leave spot empty</option>
            {players.map(s=><option value={s.id} key={s.id}>{s.name} • {s.moniker} • {s.instrument}</option>)}
          </Select>
        </div>
        <div style={{alignSelf:"end"}}>
          <Button className={studentId?"primary":"red"} disabled={!slotKey} onClick={applyOverride}>
            {studentId?(outgoing?"Replace Player":"Add Player"):"Remove Player"}
          </Button>
        </div>
      </div>
      <div className="realname" style={{marginTop:10}}>
        This does not reseed the tournament. It changes only the selected unplayed spot, including Final Four or Championship spots when necessary.
      </div>
    </div>
  </div>;
}
`;

  window.BANDCENTER_PATCH_SOURCE=function(source){
    let out=previousPatch?previousPatch(source):source;

    if(!out.includes("function TournamentOverrideCard({state,setState,t,toast})")){
      out=out.replace(
        "function TournamentStudio({state,setState,audio,toast}){",
        overrideSource.trim()+"\nfunction TournamentStudio({state,setState,audio,toast}){"
      );
    }

    out=out.replace(
      '<RoundBracket state={state} t={t} rounds={t.finals?.rounds||[]} scope="Final Four" editable={false} onWin={onWin}/>',
      '<RoundBracket state={state} t={t} rounds={t.finals?.rounds||[]} scope="Final Four" editable={editable} onWin={onWin}/>'
    );

    out=out.replace(
      '<Tournament state={state} t={t} editable onWin={win} onDragStart={dragStart} onDragDrop={dragDrop}/></div>)}',
      '<TournamentOverrideCard state={state} setState={setState} t={t} toast={toast}/><Tournament state={state} t={t} editable onWin={win} onDragStart={dragStart} onDragDrop={dragDrop}/></div>)}'
    );

    if(!out.includes("Tournament Override"))throw new Error("BandCenter v18 override panel patch did not apply.");
    if(out.includes('scope="Final Four" editable={false}'))throw new Error("BandCenter v18 Final Four winner-control patch did not apply.");

    return out;
  };
})();