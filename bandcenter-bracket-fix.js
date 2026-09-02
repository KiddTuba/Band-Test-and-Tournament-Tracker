(function(){
  const previousPatch=window.BANDCENTER_PATCH_SOURCE;
  const helpers=`
function rankIdsForDivision(state,ensemble,division,selectedIds){const map=new Map(allStats(state,ensemble).map(x=>[x.student.id,x]));return selectedIds.filter(id=>divisionFor(state.students.find(s=>s.id===id)?.instrument)===division).sort((a,b)=>(map.get(b)?.points||0)-(map.get(a)?.points||0)||(map.get(b)?.best||0)-(map.get(a)?.best||0)||(state.students.find(s=>s.id===a)?.name||"").localeCompare(state.students.find(s=>s.id===b)?.name||""));}
function createDivisionTournament(state,ensemble,name,selectedIds){
  const divisions={};DIVISIONS.forEach(d=>{const ids=rankIdsForDivision(state,ensemble,d,selectedIds);const rounds=makeRounds(ids);divisions[d]={participantIds:ids,rounds,championId:divisionChampion({rounds})};});
  const finals=buildFinals(divisions,null);
  return{id:uid(),format:"divisions-v1",name,date:today(),ensemble,participants:[...selectedIds],divisions,finals,championId:finals.championId,archived:false};
}
`;
  window.BANDCENTER_PATCH_SOURCE=function(source){
    let out=previousPatch?previousPatch(source):source;
    if(!out.includes("function rankIdsForDivision("))out=out.replace("function TournamentStudio({state,setState,audio,toast}){",helpers+"\nfunction TournamentStudio({state,setState,audio,toast}){");
    out=out.replace('const tickerKey=items.join("|");','const tickerKey=items.join("|")+"|"+JSON.stringify([state.challenges,state.tournaments,state.storeTransactions,state.students.map(s=>[s.id,s.bandBucks,s.active,s.ensemble])]);');
    return out;
  };
})();