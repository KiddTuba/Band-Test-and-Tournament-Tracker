(function(){
  const previousPatch=window.BANDCENTER_PATCH_SOURCE;
  window.BANDCENTER_PATCH_SOURCE=function(source){
    const out=previousPatch?previousPatch(source):source;
    const required=[
      "function hallRecords(state,ensemble)",
      "function tickerItems(state,ensemble)",
      "function BandStore({state,setState})",
      "function TournamentStudio({state,setState,audio,toast})",
      "function swapOpeningSeeds(t,scope,source,target)",
      "function randomExtraSeed(state,t,student)",
      "function randomBracketMove(state,t,student)",
      "function HallOfFame({state})",
      "History Manager",
      "Whippet Legacy Fund",
      "GOAT:"
    ];
    const missing=required.filter(token=>!out.includes(token));
    if(missing.length)throw new Error("BandCenter v12 transform missing: "+missing.join(", "));
    return out;
  };
})();