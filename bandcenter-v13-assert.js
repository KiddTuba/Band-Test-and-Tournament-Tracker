(function(){
  const previousPatch=window.BANDCENTER_PATCH_SOURCE;
  window.BANDCENTER_PATCH_SOURCE=function(source){
    const out=previousPatch?previousPatch(source):source;
    const required=[
      "function competitiveProfile(state,studentId,ensemble)",
      "function donationProfile(state,studentId,ensemble)",
      "All-Time Competitive Profiles",
      "Tournament Appearances",
      "Tournament Wins",
      "15K Legacy Bonus Earned",
      "tickerSeconds",
      "legacyBonusAwarded",
      "amountDonated"
    ];
    const missing=required.filter(token=>!out.includes(token));
    if(missing.length)throw new Error("BandCenter v13 transform missing: "+missing.join(", "));
    return out;
  };
})();