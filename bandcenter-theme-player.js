(function(){
  const AUDIO_ID="bandcenter-hall-theme-audio";
  const HUB_ID="bandcenter-audio-hub";
  const THEME_SRC="bandcenter-hall-theme.mp3";
  const trackedMedia=new Set();
  let allMuted=false;

  function track(media){
    if(media&&typeof media.play==="function")trackedMedia.add(media);
    return media;
  }

  function installMediaTracking(){
    const proto=window.HTMLMediaElement&&window.HTMLMediaElement.prototype;
    if(!proto||proto.__bandcenterAudioTracked)return;
    const nativePlay=proto.play;
    proto.play=function(){
      track(this);
      this.muted=allMuted;
      return nativePlay.apply(this,arguments);
    };
    Object.defineProperty(proto,"__bandcenterAudioTracked",{value:true});
  }

  function everyMedia(){
    document.querySelectorAll("audio,video").forEach(track);
    return [...trackedMedia];
  }

  function ensureTheme(){
    let audio=document.getElementById(AUDIO_ID);
    if(!audio){
      audio=document.createElement("audio");
      audio.id=AUDIO_ID;
      audio.src=THEME_SRC;
      audio.loop=true;
      audio.preload="auto";
      audio.volume=.42;
      audio.muted=allMuted;
      audio.setAttribute("playsinline","");
      document.body.appendChild(audio);
    }
    return track(audio);
  }

  function setStatus(text){
    const status=document.querySelector("#"+HUB_ID+" [data-audio-status]");
    if(status)status.textContent=text;
  }

  function updateControls(){
    const mute=document.querySelector("#"+HUB_ID+" [data-audio-mute]");
    const icon=document.querySelector("#"+HUB_ID+" [data-audio-icon]");
    const theme=ensureTheme();
    if(mute)mute.textContent=allMuted?"Unmute All":"Mute All";
    if(icon){
      icon.textContent=allMuted?"🔇":theme.paused?"♫":"🔊";
      icon.setAttribute("aria-label",allMuted?"Audio controls, all sounds muted":theme.paused?"Audio controls, theme paused":"Audio controls, theme playing");
    }
  }

  async function playTheme(){
    const audio=ensureTheme();
    audio.muted=allMuted;
    try{
      await audio.play();
      setStatus(allMuted?"Theme playing silently":"Hall theme playing");
    }catch(err){
      setStatus("Open controls and press Play Theme");
    }
    updateControls();
  }

  function pauseAll(){
    everyMedia().forEach(media=>{try{media.pause()}catch{}});
    setStatus("All sounds paused");
    updateControls();
  }

  function stopTheme(){
    const audio=ensureTheme();
    try{audio.pause();audio.currentTime=0}catch{}
    setStatus("Hall theme stopped");
    updateControls();
  }

  function stopAll(){
    everyMedia().forEach(media=>{
      try{media.pause();media.currentTime=0}catch{}
    });
    setStatus("All sounds stopped");
    updateControls();
  }

  function toggleMuteAll(){
    allMuted=!allMuted;
    everyMedia().forEach(media=>{media.muted=allMuted});
    const theme=ensureTheme();
    setStatus(allMuted?"All sounds muted":theme.paused?"Sound restored • theme paused":"Sound restored • theme playing");
    updateControls();
  }

  function buildHub(){
    if(document.getElementById(HUB_ID))return;
    const hub=document.createElement("aside");
    hub.id=HUB_ID;
    hub.className="bandcenter-audio-hub";
    hub.setAttribute("aria-label","BandCenter audio controls");
    hub.innerHTML=`
      <button type="button" class="audio-hub-tab" data-audio-icon aria-expanded="false" aria-controls="bandcenter-audio-panel">♫</button>
      <div class="audio-hub-panel" id="bandcenter-audio-panel">
        <div class="audio-hub-heading">
          <span class="audio-equalizer" aria-hidden="true"><i></i><i></i><i></i></span>
          <div><b>BandCenter Audio</b><small data-audio-status>Hall theme ready</small></div>
        </div>
        <div class="audio-hub-controls">
          <button type="button" data-theme-play>Play Theme</button>
          <button type="button" data-audio-pause>Pause All</button>
          <button type="button" data-theme-stop>Stop Theme</button>
          <button type="button" data-audio-mute>Mute All</button>
          <button type="button" class="audio-stop-all" data-audio-stop-all>Stop All Sounds</button>
        </div>
        <p>The Hall theme loops. Game and tournament sounds may play over it.</p>
      </div>`;
    const tab=hub.querySelector("[data-audio-icon]");
    tab.addEventListener("click",()=>{
      const open=hub.classList.toggle("audio-hub-open");
      tab.setAttribute("aria-expanded",String(open));
    });
    hub.addEventListener("mouseleave",()=>{
      if(document.activeElement&&!hub.contains(document.activeElement)){
        hub.classList.remove("audio-hub-open");
        tab.setAttribute("aria-expanded","false");
      }
    });
    hub.querySelector("[data-theme-play]").addEventListener("click",playTheme);
    hub.querySelector("[data-audio-pause]").addEventListener("click",pauseAll);
    hub.querySelector("[data-theme-stop]").addEventListener("click",stopTheme);
    hub.querySelector("[data-audio-mute]").addEventListener("click",toggleMuteAll);
    hub.querySelector("[data-audio-stop-all]").addEventListener("click",stopAll);
    document.body.appendChild(hub);
  }

  function watchHallClicks(){
    document.addEventListener("click",event=>{
      const button=event.target.closest("button");
      if(!button)return;
      if(button.textContent.trim()==="Hall of Fame")playTheme();
    },true);
  }

  function bindThemeEvents(){
    const theme=ensureTheme();
    theme.addEventListener("play",()=>{setStatus(allMuted?"Theme playing silently":"Hall theme playing");updateControls()});
    theme.addEventListener("pause",()=>updateControls());
    theme.addEventListener("error",()=>setStatus("Hall theme file could not load"));
  }

  function init(){
    installMediaTracking();
    buildHub();
    bindThemeEvents();
    watchHallClicks();
    updateControls();
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
  else init();
})();