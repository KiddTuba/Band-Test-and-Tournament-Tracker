(function(){
  const previousPatch=window.BANDCENTER_PATCH_SOURCE;
  window.BANDCENTER_PATCH_SOURCE=function(source){
    let out=previousPatch?previousPatch(source):source;
    out=out.replace('(state.students||[]).filter(s=>s.ensemble===ensemble).forEach(s=>{const adj=hallAdjustment(s,ensemble);','(state.students||[]).forEach(s=>{const adj=hallAdjustment(s,ensemble);');
    out=out.replace('const ensemble=state.settings.activeEnsemble;const players=state.students.filter(s=>s.ensemble===ensemble).sort((a,b)=>a.name.localeCompare(b.name));\n  const[form,setForm]=useState({studentId:"",legacyName:"",tournamentName:"",date:today()});','const ensemble=state.settings.activeEnsemble;const players=state.students.slice().sort((a,b)=>a.name.localeCompare(b.name));\n  const[form,setForm]=useState({studentId:"",legacyName:"",tournamentName:"",date:today()});');
    out=out.replace('{players.map(s=><option key={s.id} value={s.id}>{s.name} • {s.instrument}</option>)}','{players.map(s=><option key={s.id} value={s.id}>{s.name} • {s.instrument} • {s.ensemble===ensemble?"Current ensemble":"Historical / other ensemble"}</option>)}');
    out=out.replace('<td>{st.challengePoints+st.tournamentPoints} pts</td><td><Input className="correction-input" type="number" value={Number(s.rankingAdjustments?.[ensemble]||0)} onChange={e=>patchStudent(s.id,"ranking",e.target.value)}/></td>','<td>{s.ensemble===ensemble?(st.challengePoints+st.tournamentPoints)+" pts":"Historical profile"}</td><td><Input className="correction-input" type="number" disabled={s.ensemble!==ensemble} value={Number(s.rankingAdjustments?.[ensemble]||0)} onChange={e=>patchStudent(s.id,"ranking",e.target.value)}/></td>');
    return out;
  };
})();