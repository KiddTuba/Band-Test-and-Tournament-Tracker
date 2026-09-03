(function(){
  const AUDIO_ID="bandcenter-hall-theme-audio";
  const HUB_ID="bandcenter-audio-hub";
  const THEME_SRC="bandcenter-hall-theme.mp3";
  const effectCache=new Map();
  const activeEffects=new Set();
  let themeMuted=false;
  let effectsMuted=false;
  let lastChampionToast="";

  const EFFECTS=[
    {id:"espn-open",label:"ESPN Open",src:"the-espn-sound.mp3",use:"Tournament reveal / broadcast open"},
    {id:"nba",label:"NBA on ESPN",src:"nba_on_espn.mp3",use:"Bracket and Final Four atmosphere"},
    {id:"deep",label:"He Could Go All The Way",src:"he-could-go-all-the.mp3",use:"Big score or dramatic advancement"},
    {id:"espn-theme",label:"ESPN Theme",src:"espntheme.mp3",use:"Tournament background feature"},
    {id:"champions",label:"We Are the Champions",chunks:["audio-v16-compact/champions-0.b64","audio-v16-compact/champions-1.b64","audio-v16-compact/champions-2.b64","audio-v16-compact/champions-3.b64"],use:"Tournament champion"},
    {id:"applause",label:"Crowd Applause",chunks:["audio-v16-compact/applause-0.b64","audio-v16-compact/applause-1.b64","audio-v16-compact/applause-2.b64"],use:"Awards, perfect scores, and celebrations"}
  ];

  function ensureTheme(){
    let audio=document.getElementById(AUDIO_ID);
    if(!audio){
      audio=document.createElement("audio");
      audio.id=AUDIO_ID;audio.src=THEME_SRC;audio.loop=true;audio.preload="auto";audio.volume=.42;audio.muted=themeMuted;audio.setAttribute("playsinline","");document.body.appendChild(audio);
    }
    return audio;
  }
  async function sourceFor(effect){
    if(effect.src)return effect.src;
    if(effectCache.has(effect.id))return effectCache.get(effect.id);
    const parts=await Promise.all(effect.chunks.map(async path=>{const r=await fetch(path,{cache:"force-cache"});if(!r.ok)throw new Error("Could not load "+path);return(await r.text()).trim();}));
    const uri="data:audio/mpeg;base64,"+parts.join("");effectCache.set(effect.id,uri);return uri;
  }
  async function playEffect(id){
    const effect=EFFECTS.find(x=>x.id===id);if(!effect)return;
    try{
      const audio=new Audio(await sourceFor(effect));audio.preload="auto";audio.volume=.82;audio.muted=effectsMuted;audio.setAttribute("playsinline","");activeEffects.add(audio);
      const clean=()=>activeEffects.delete(audio);audio.addEventListener("ended",clean,{once:true});audio.addEventListener("error",clean,{once:true});await audio.play();setStatus(effect.label+" playing");
    }catch(err){setStatus("Could not play "+effect.label);}
  }
  async function playTheme(){const audio=ensureTheme();audio.muted=themeMuted;try{await audio.play();setStatus(themeMuted?"Hall theme playing silently":"Hall theme playing");}catch{setStatus("Press Play Theme to begin");}updateControls();}
  function pauseTheme(){ensureTheme().pause();setStatus("Hall theme paused");updateControls();}
  function stopTheme(){const a=ensureTheme();a.pause();a.currentTime=0;setStatus("Hall theme stopped");updateControls();}
  function toggleThemeMute(){themeMuted=!themeMuted;ensureTheme().muted=themeMuted;setStatus(themeMuted?"Hall theme muted":"Hall theme unmuted");updateControls();}
  function stopEffects(){activeEffects.forEach(a=>{try{a.pause();a.currentTime=0}catch{}});activeEffects.clear();setStatus("Tournament sounds stopped");}
  function toggleEffectsMute(){effectsMuted=!effectsMuted;activeEffects.forEach(a=>a.muted=effectsMuted);setStatus(effectsMuted?"Tournament sounds muted":"Tournament sounds unmuted");updateControls();}
  function stopAll(){stopEffects();stopTheme();setStatus("All audio stopped");}
  function setStatus(text){const el=document.querySelector("#"+HUB_ID+" [data-audio-status]");if(el)el.textContent=text;}
  function updateControls(){const hub=document.getElementById(HUB_ID),theme=ensureTheme();if(!hub)return;const icon=hub.querySelector("[data-audio-icon]");const tm=hub.querySelector("[data-theme-mute]");const em=hub.querySelector("[data-effects-mute]");if(tm)tm.textContent=themeMuted?"Unmute Theme":"Mute Theme";if(em)em.textContent=effectsMuted?"Unmute Effects":"Mute Effects";if(icon){icon.textContent=themeMuted?"🔇":theme.paused?"♫":"🔊";icon.setAttribute("aria-label","BandCenter audio controls");}}

  function buildHub(){
    if(document.getElementById(HUB_ID))return;
    const hub=document.createElement("aside");hub.id=HUB_ID;hub.className="bandcenter-audio-hub";hub.setAttribute("aria-label","BandCenter audio controls");
    hub.innerHTML=`<button type="button" class="audio-hub-tab" data-audio-icon aria-expanded="false" aria-controls="bandcenter-audio-panel">♫</button><div class="audio-hub-panel" id="bandcenter-audio-panel"><div class="audio-hub-heading"><span class="audio-equalizer" aria-hidden="true"><i></i><i></i><i></i></span><div><b>BandCenter Audio</b><small data-audio-status>Hall theme ready</small></div></div><div class="audio-section-title">Looping Hall Theme</div><div class="audio-hub-controls theme-controls"><button type="button" data-theme-play>Play Theme</button><button type="button" data-theme-pause>Pause Theme</button><button type="button" data-theme-stop>Stop Theme</button><button type="button" data-theme-mute>Mute Theme</button></div><div class="audio-section-title">Tournament Soundboard</div><div class="audio-soundboard">${EFFECTS.map(e=>`<button type="button" data-effect="${e.id}" title="${e.use}"><b>${e.label}</b><small>${e.use}</small></button>`).join("")}</div><div class="audio-hub-controls effect-controls"><button type="button" data-effects-stop>Stop Effects</button><button type="button" data-effects-mute>Mute Effects</button><button type="button" class="audio-stop-all" data-audio-stop-all>Stop All Audio</button></div><p>The Hall theme is the only looping track. Tournament sounds play over it without pausing or restarting it.</p></div>`;
    const tab=hub.querySelector("[data-audio-icon]");tab.addEventListener("click",()=>{const open=hub.classList.toggle("audio-hub-open");tab.setAttribute("aria-expanded",String(open));});
    hub.querySelector("[data-theme-play]").addEventListener("click",playTheme);hub.querySelector("[data-theme-pause]").addEventListener("click",pauseTheme);hub.querySelector("[data-theme-stop]").addEventListener("click",stopTheme);hub.querySelector("[data-theme-mute]").addEventListener("click",toggleThemeMute);hub.querySelector("[data-effects-stop]").addEventListener("click",stopEffects);hub.querySelector("[data-effects-mute]").addEventListener("click",toggleEffectsMute);hub.querySelector("[data-audio-stop-all]").addEventListener("click",stopAll);hub.querySelectorAll("[data-effect]").forEach(b=>b.addEventListener("click",()=>playEffect(b.dataset.effect)));document.body.appendChild(hub);
  }
  function watchHallClicks(){document.addEventListener("click",e=>{const b=e.target.closest("button");if(b&&b.textContent.trim()==="Hall of Fame")playTheme();},true);}
  function watchTournamentMoments(){
    const observer=new MutationObserver(()=>{const toast=document.querySelector(".toast");const text=toast?.textContent?.trim()||"";if(!text||text===lastChampionToast)return;if(/\bWINS\b|CHAMPION/i.test(text)){lastChampionToast=text;playEffect("champions").then(()=>setTimeout(()=>playEffect("applause"),900));}});observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  }
  function init(){buildHub();ensureTheme();watchHallClicks();watchTournamentMoments();updateControls();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();