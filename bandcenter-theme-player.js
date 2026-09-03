(function(){
  const THEME_ID="bandcenter-hall-theme-audio";
  const HUB_ID="bandcenter-audio-hub";
  const THEME_SRC="bandcenter-hall-theme.mp3";
  const EFFECTS={
    espn:{label:"ESPN Sting",src:"the-espn-sound.mp3"},
    nba:{label:"NBA on ESPN",src:"nba_on_espn.mp3"},
    espnTheme:{label:"ESPN Theme",src:"espntheme.mp3"},
    deepRun:{label:"He Could Go All the Way",src:"he-could-go-all-the.mp3"},
    champions:{label:"We Are the Champions",chunks:[
      "audio-v16-compact/champions-0.b64",
      "audio-v16-compact/champions-1.b64",
      "audio-v16-compact/champions-2.b64",
      "audio-v16-compact/champions-3.b64"
    ],lengths:[6000,6000,6000,3996]},
    applause:{label:"Applause",chunks:[
      "audio-v16-compact/applause-0.b64",
      "audio-v16-compact/applause-1.b64",
      "audio-v16-compact/applause-2.b64"
    ],lengths:[6000,6000,1984]}
  };

  const effectMedia=new Set();
  const effectUrls=new Map();
  let themeMuted=false;
  let effectsMuted=false;
  let championTimer=null;

  function setThemeStatus(text){const node=document.querySelector("#"+HUB_ID+" [data-theme-status]");if(node)node.textContent=text;}
  function setEffectStatus(text){const node=document.querySelector("#"+HUB_ID+" [data-effect-status]");if(node)node.textContent=text;}

  function ensureTheme(){
    let audio=document.getElementById(THEME_ID);
    if(!audio){audio=document.createElement("audio");audio.id=THEME_ID;audio.src=THEME_SRC;audio.loop=true;audio.preload="auto";audio.volume=.42;audio.muted=themeMuted;audio.setAttribute("playsinline","");document.body.appendChild(audio);}
    return audio;
  }
  function trackEffect(media){if(media&&media!==document.getElementById(THEME_ID))effectMedia.add(media);return media;}
  function installEffectTracking(){
    const proto=window.HTMLMediaElement&&window.HTMLMediaElement.prototype;if(!proto||proto.__bandcenterSeparatedAudio)return;
    const nativePlay=proto.play;
    proto.play=function(){if(this.id===THEME_ID)this.muted=themeMuted;else{trackEffect(this);this.muted=effectsMuted;}return nativePlay.apply(this,arguments);};
    Object.defineProperty(proto,"__bandcenterSeparatedAudio",{value:true});
  }
  function allEffects(){document.querySelectorAll("audio,video").forEach(media=>{if(media.id!==THEME_ID)trackEffect(media);});return[...effectMedia];}

  function updateControls(){
    const theme=ensureTheme(),themeMute=document.querySelector("#"+HUB_ID+" [data-theme-mute]"),effectMute=document.querySelector("#"+HUB_ID+" [data-effect-mute]"),icon=document.querySelector("#"+HUB_ID+" [data-audio-icon]");
    if(themeMute)themeMute.textContent=themeMuted?"Unmute Theme":"Mute Theme";
    if(effectMute)effectMute.textContent=effectsMuted?"Unmute Effects":"Mute Effects";
    if(icon){icon.textContent=themeMuted?"🔇":theme.paused?"♫":"🔊";icon.setAttribute("aria-label",themeMuted?"Audio booth, Hall theme muted":theme.paused?"Audio booth, Hall theme paused":"Audio booth, Hall theme playing");}
  }
  async function playTheme(){const theme=ensureTheme();theme.muted=themeMuted;try{await theme.play();setThemeStatus(themeMuted?"Looping silently":"Looping continuously");}catch{setThemeStatus("Press Play Theme to begin");}updateControls();}
  function pauseTheme(){const theme=ensureTheme();theme.pause();setThemeStatus("Paused at current position");updateControls();}
  function stopTheme(){const theme=ensureTheme();try{theme.pause();theme.currentTime=0}catch{}setThemeStatus("Stopped at beginning");updateControls();}
  function toggleThemeMute(){themeMuted=!themeMuted;const theme=ensureTheme();theme.muted=themeMuted;setThemeStatus(themeMuted?"Theme muted":theme.paused?"Theme ready":"Looping continuously");updateControls();}

  async function resolveEffectSrc(key){
    const def=EFFECTS[key];if(!def)throw new Error("Unknown BandCenter sound: "+key);if(def.src)return def.src;if(effectUrls.has(key))return effectUrls.get(key);
    const parts=await Promise.all(def.chunks.map(async(path,index)=>{const response=await fetch(path,{cache:"force-cache"});if(!response.ok)throw new Error("Could not load "+path+" (HTTP "+response.status+")");const text=(await response.text()).trim();if(text.length!==def.lengths[index])throw new Error("Audio chunk length mismatch: "+path);return text;}));
    const raw=atob(parts.join("")),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    const url=URL.createObjectURL(new Blob([bytes],{type:"audio/mpeg"}));effectUrls.set(key,url);return url;
  }
  function stopEffects(){if(championTimer){clearTimeout(championTimer);championTimer=null;}allEffects().forEach(media=>{try{media.pause();media.currentTime=0}catch{}});setEffectStatus("Effects stopped • Hall theme unchanged");}
  function toggleEffectsMute(){effectsMuted=!effectsMuted;allEffects().forEach(media=>{media.muted=effectsMuted});setEffectStatus(effectsMuted?"Tournament effects muted":"Tournament effects ready");updateControls();}
  async function playEffect(key,options={}){
    const def=EFFECTS[key];if(!def)return;if(!options.overlap)stopEffects();
    try{const audio=trackEffect(new Audio(await resolveEffectSrc(key)));audio.loop=false;audio.preload="auto";audio.volume=Number.isFinite(options.volume)?options.volume:.82;audio.muted=effectsMuted;audio.addEventListener("ended",()=>effectMedia.delete(audio),{once:true});audio.addEventListener("error",()=>setEffectStatus(def.label+" could not load"),{once:true});await audio.play();setEffectStatus((effectsMuted?"Playing silently: ":"Playing: ")+def.label);return audio;}catch(err){console.error("BandCenter effect failed",key,err);setEffectStatus(def.label+" could not play");}
  }
  function playChampionMoment(){stopEffects();playEffect("champions",{overlap:true,volume:.86});championTimer=setTimeout(()=>{championTimer=null;playEffect("applause",{overlap:true,volume:.72});},850);}

  function buildHub(){
    if(document.getElementById(HUB_ID))return;
    const hub=document.createElement("aside");hub.id=HUB_ID;hub.className="bandcenter-audio-hub";hub.setAttribute("aria-label","BandCenter audio booth");
    hub.innerHTML=`<button type="button" class="audio-hub-tab" data-audio-icon aria-expanded="false" aria-controls="bandcenter-audio-panel">♫</button><div class="audio-hub-panel" id="bandcenter-audio-panel"><div class="audio-hub-heading"><span class="audio-equalizer" aria-hidden="true"><i></i><i></i><i></i></span><div><b>BandCenter Audio Booth</b><small>Hall theme and tournament soundboard</small></div></div><section class="audio-section theme-section"><div class="audio-section-title"><b>Hall of Fame Theme</b><span data-theme-status>Ready to loop</span></div><div class="audio-control-grid theme-controls"><button type="button" data-theme-play>Play Theme</button><button type="button" data-theme-pause>Pause Theme</button><button type="button" data-theme-stop>Stop Theme</button><button type="button" data-theme-mute>Mute Theme</button></div><p>This is the only looping track. Tournament sounds play over it without interrupting it.</p></section><section class="audio-section effects-section"><div class="audio-section-title"><b>Tournament Soundboard</b><span data-effect-status>Effects ready</span></div><div class="soundboard-grid"><button type="button" data-effect="espn">ESPN Sting</button><button type="button" data-effect="nba">NBA on ESPN</button><button type="button" data-effect="espnTheme">ESPN Theme</button><button type="button" data-effect="deepRun">Go All the Way</button><button type="button" data-effect="champions">Champions</button><button type="button" data-effect="applause">Applause</button></div><div class="audio-control-grid effect-controls"><button type="button" data-effect-mute>Mute Effects</button><button type="button" class="audio-stop-effects" data-effect-stop>Stop Effects</button></div></section></div>`;
    const tab=hub.querySelector("[data-audio-icon]");tab.addEventListener("click",()=>{const open=hub.classList.toggle("audio-hub-open");tab.setAttribute("aria-expanded",String(open));});
    hub.addEventListener("mouseleave",()=>{if(document.activeElement&&!hub.contains(document.activeElement)){hub.classList.remove("audio-hub-open");tab.setAttribute("aria-expanded","false");}});
    hub.querySelector("[data-theme-play]").addEventListener("click",playTheme);hub.querySelector("[data-theme-pause]").addEventListener("click",pauseTheme);hub.querySelector("[data-theme-stop]").addEventListener("click",stopTheme);hub.querySelector("[data-theme-mute]").addEventListener("click",toggleThemeMute);hub.querySelector("[data-effect-stop]").addEventListener("click",stopEffects);hub.querySelector("[data-effect-mute]").addEventListener("click",toggleEffectsMute);hub.querySelectorAll("[data-effect]").forEach(button=>button.addEventListener("click",()=>playEffect(button.dataset.effect)));document.body.appendChild(hub);
  }
  function watchAppActions(){
    document.addEventListener("click",event=>{
      const button=event.target.closest("button");if(button&&button.textContent.trim()==="Hall of Fame")playTheme();
      const winnerButton=event.target.closest(".winner-button");if(!winnerButton)return;
      const roundTitle=winnerButton.closest(".round")?.querySelector(".round-title")?.textContent?.trim()||"";
      if(/Championship/i.test(roundTitle))setTimeout(playChampionMoment,120);else if(/Final Four|Division Final|Semifinal/i.test(roundTitle))setTimeout(()=>playEffect("deepRun"),100);
    },true);
  }
  function bindThemeEvents(){const theme=ensureTheme();theme.addEventListener("play",()=>{setThemeStatus(themeMuted?"Looping silently":"Looping continuously");updateControls()});theme.addEventListener("pause",updateControls);theme.addEventListener("error",()=>setThemeStatus("Hall theme file could not load"));}
  function init(){buildHub();bindThemeEvents();watchAppActions();updateControls();setTimeout(()=>{resolveEffectSrc("champions").catch(()=>{});resolveEffectSrc("applause").catch(()=>{});},1200);}

  installEffectTracking();
  window.BandCenterAudio={playTheme,pauseTheme,stopTheme,toggleThemeMute,playEffect,stopEffects,toggleEffectsMute,playChampionMoment};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();