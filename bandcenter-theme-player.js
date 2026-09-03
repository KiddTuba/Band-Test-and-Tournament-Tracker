(function(){
  const AUDIO_ID="bandcenter-hall-theme-audio";
  const DOCK_ID="bandcenter-theme-dock";
  const THEME_SRC="bandcenter-hall-theme.mp3";

  function ensureAudio(){
    let audio=document.getElementById(AUDIO_ID);
    if(!audio){
      audio=document.createElement("audio");
      audio.id=AUDIO_ID;
      audio.src=THEME_SRC;
      audio.loop=true;
      audio.preload="auto";
      audio.volume=.42;
      audio.setAttribute("playsinline","");
      document.body.appendChild(audio);
    }
    return audio;
  }

  function setStatus(text){
    const status=document.querySelector("#"+DOCK_ID+" [data-theme-status]");
    if(status)status.textContent=text;
  }

  function updateButtons(audio){
    const mute=document.querySelector("#"+DOCK_ID+" [data-theme-mute]");
    if(mute)mute.textContent=audio.muted?"Unmute":"Mute";
  }

  async function playTheme(){
    const audio=ensureAudio();
    try{
      await audio.play();
      setStatus("Playing Hall of Fame Theme");
    }catch(err){
      setStatus("Press Play to start theme");
    }
    updateButtons(audio);
  }

  function pauseTheme(){
    const audio=ensureAudio();
    audio.pause();
    setStatus("Paused");
  }

  function stopTheme(){
    const audio=ensureAudio();
    audio.pause();
    audio.currentTime=0;
    setStatus("Stopped");
  }

  function toggleMute(){
    const audio=ensureAudio();
    audio.muted=!audio.muted;
    setStatus(audio.muted?"Theme muted":audio.paused?"Theme unmuted":"Playing Hall of Fame Theme");
    updateButtons(audio);
  }

  function buildDock(){
    if(document.getElementById(DOCK_ID))return;
    const dock=document.createElement("div");
    dock.id=DOCK_ID;
    dock.className="bandcenter-theme-dock";
    dock.innerHTML=`
      <div class="theme-dock-copy">
        <b>Hall of Fame Theme</b>
        <span data-theme-status>Stopped</span>
      </div>
      <div class="theme-dock-controls">
        <button type="button" data-theme-play>Play</button>
        <button type="button" data-theme-pause>Pause</button>
        <button type="button" data-theme-stop>Stop</button>
        <button type="button" data-theme-mute>Mute</button>
      </div>`;
    dock.querySelector("[data-theme-play]").addEventListener("click",playTheme);
    dock.querySelector("[data-theme-pause]").addEventListener("click",pauseTheme);
    dock.querySelector("[data-theme-stop]").addEventListener("click",stopTheme);
    dock.querySelector("[data-theme-mute]").addEventListener("click",toggleMute);
    document.body.appendChild(dock);
  }

  function watchHallClicks(){
    document.addEventListener("click",event=>{
      const button=event.target.closest("button");
      if(!button)return;
      if(button.textContent.trim()==="Hall of Fame")playTheme();
    });
  }

  function init(){
    buildDock();
    ensureAudio();
    watchHallClicks();
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
  else init();
})();