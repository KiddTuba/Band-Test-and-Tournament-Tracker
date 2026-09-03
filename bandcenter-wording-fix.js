(function(){
  const previousPatch=window.BANDCENTER_PATCH_SOURCE;
  window.BANDCENTER_PATCH_SOURCE=function(source){
    let out=previousPatch?previousPatch(source):source;
    out=out.replace('Real student names are now intentionally visible throughout BandCenter, per Commissioner preference.','Real student names are intentionally visible throughout BandCenter.');
    out=out.replaceAll('Commissioner-approved bracket position change','Randomized bracket position change');
    out=out.replaceAll('when approved','when available');
    out=out.replaceAll('Commissioner checkout','Band Store checkout');
    out=out.replaceAll('Commissioner Controls','Management');
    return out;
  };
})();