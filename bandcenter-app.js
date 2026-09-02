const {useEffect,useMemo,useRef,useState}=React;
const CFG=window.BANDCENTER_CONFIG||{};
const ENSEMBLES=["Elementary Ensemble","JV Band","Varsity Band"];
const DIVISIONS=["Woodwinds","High Brass","Low Brass","Percussion"];
const INSTRUMENTS=[
  "Flute","Oboe","Bassoon","Clarinet","Bass Clarinet","Alto Sax","Tenor Sax","Baritone Sax","Saxophone",
  "Trumpet","French Horn","Mellophone",
  "Trombone","Baritone","Euphonium","Tuba","Low Brass",
  "Percussion"
];
const SOUND={start:"the-espn-sound.mp3",nba:"nba_on_espn.mp3",espn:"espntheme.mp3",deep:"he-could-go-all-the.mp3",victory:"nfl-draft-chime.mp3",applause:"applause.mp3"};
const ADJ=["Blazing","Golden","Electric","Fearless","Turbo","Mighty","Ice","Wild","Rocket","Prime","Neon","Storm","Super","Sonic","Iron","Sky","Royal","Crimson","Phantom","Power","Major","Rising","Rapid","Cosmic","Thunder"];
const NOUN=["Ace","Wolf","Comet","Titan","Bolt","Hawk","Viper","Maestro","Rocket","Rhino","Falcon","Dragon","Chief","Panther","Legend","Ranger","Cyclone","Captain","Hammer","Knight","Phantom","Star","Cobra","Firebird","Whippet"];
const uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
const today=()=>new Date().toISOString().slice(0,10);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
const hash=s=>[...String(s)].reduce((a,c)=>((a<<5)-a+c.charCodeAt(0))|0,0);
function generatedMoniker(s,salt=0){const h=Math.abs(hash(`${s.id||s.name}|${s.instrument}|${salt}`));return `${ADJ[h%ADJ.length]} ${NOUN[Math.floor(h/ADJ.length)%NOUN.length]}`;}
function divisionFor(instrument){
  if(["Flute","Oboe","Bassoon","Clarinet","Bass Clarinet","Alto Sax","Tenor Sax","Baritone Sax","Saxophone"].includes(instrument))return "Woodwinds";
  if(["Trumpet","French Horn","Mellophone"].includes(instrument))return "High Brass";
  if(["Trombone","Baritone","Euphonium","Tuba","Low Brass"].includes(instrument))return "Low Brass";
  return "Percussion";
}
function playerText(s){return s?`${s.name}${s.moniker?` • ${s.moniker}`:""}`:"TBD";}
const defaultRules={attempt:10,s7:25,s8:40,s9:60,s95:80,s10:100,personalBest:20,improveOne:15,tournamentEntry:20,roundWin:25,eliteEight:50,finalFour:75,runnerUp:125,champion:200};
function emptyState(){return{version:2,meta:{seasonName:CFG.seasonName||"Beginning Band Championship Series",schoolName:CFG.schoolName||"Okeene Whippet Barking Battalion",updatedAt:Date.now()},students:[],challenges:[],tournaments:[],rules:{...defaultRules},settings:{sound:true,volume:.7,publicNameStyle:"real",activeEnsemble:"Elementary Ensemble"},legacy:{}}}
function migrate(raw){
  if(!raw||typeof raw!=="object")return emptyState();
  if(raw.version===2){
    const s={...emptyState(),...raw,meta:{...emptyState().meta,...raw.meta},rules:{...defaultRules,...raw.rules},settings:{...emptyState().settings,...raw.settings,publicNameStyle:"real"}};
    s.students=(s.students||[]).map(x=>({...x,moniker:x.moniker||generatedMoniker(x),ensemble:x.ensemble||"Elementary Ensemble",active:x.active!==false,bandBucks:Number(x.bandBucks||0)}));
    return s;
  }
  const s=emptyState();
  s.students=(raw.students||[]).map(x=>({...x,ensemble:x.ensemble||"Elementary Ensemble",moniker:x.moniker||generatedMoniker(x),active:true,bandBucks:Number(x.bandBucks||0)}));
  s.challenges=(raw.chairTests||[]).map(t=>({id:t.id||uid(),name:t.name||"Legacy Playing Challenge",date:t.date||today(),ensemble:t.ensemble||"Elementary Ensemble",scores:t.scores||{},archived:!!t.isArchived,legacy:true}));
  s.tournaments=(raw.tournaments||[]).map(t=>({...t,ensemble:t.ensemble||"Elementary Ensemble",archived:!!t.isArchived,legacy:true}));
  s.legacy={sectionPoints:raw.sectionPoints||{},chairOrders:raw.chairOrders||{}};
  return s;
}
function scoreBase(score,r){const x=Number(score);if(!Number.isFinite(x)||x<=0)return 0;let p=r.attempt;if(x>=10)p+=r.s10;else if(x>=9.5)p+=r.s95;else if(x>=9)p+=r.s9;else if(x>=8)p+=r.s8;else if(x>=7)p+=r.s7;return p;}
function challengeHistory(state,studentId){return(state.challenges||[]).filter(c=>!c.archived&&c.scores&&c.scores[studentId]!==""&&c.scores[studentId]!=null).map(c=>({id:c.id,date:c.date||"",score:Number(c.scores[studentId]),name:c.name})).filter(x=>Number.isFinite(x.score)&&x.score>0).sort((a,b)=>a.date.localeCompare(b.date));}
function challengePoints(state,studentId){const h=challengeHistory(state,studentId),r=state.rules;let total=0,best=-Infinity,streak=0,maxStreak=0,last=null,pb=0;h.forEach(a=>{let p=scoreBase(a.score,r);if(a.score>best){if(best>-Infinity){p+=r.personalBest;pb++;}best=a.score;}if(last!=null&&a.score-last>=1)p+=r.improveOne;if(last!=null&&a.score>last){streak++;maxStreak=Math.max(maxStreak,streak)}else streak=0;total+=p;last=a.score;});return{total,best:best===-Infinity?0:best,attempts:h.length,pb,maxStreak,last:last||0,history:h};}
function tournamentParticipants(t){
  if(Array.isArray(t.participants))return new Set(t.participants);
  const set=new Set();
  (t.rounds||[]).forEach(r=>(r.matches||[]).forEach(m=>{if(m.p1)set.add(m.p1);if(m.p2)set.add(m.p2)}));
  return set;
}
function allTournamentRounds(t){
  if(t.format==="divisions-v1"){
    const rounds=[];
    DIVISIONS.forEach(d=>(t.divisions?.[d]?.rounds||[]).forEach(r=>rounds.push({...r,scope:d})));
    (t.finals?.rounds||[]).forEach(r=>rounds.push({...r,scope:"Final Four"}));
    return rounds;
  }
  return t.rounds||[];
}
function tournamentStats(state,studentId){
  const r=state.rules;let total=0,wins=0,titles=0,runnerUps=0,finalFours=0,eliteEights=0,entries=0;
  for(const t of state.tournaments||[]){
    if(t.archived)continue;
    const parts=tournamentParticipants(t);if(!parts.has(studentId))continue;
    entries++;total+=r.tournamentEntry;
    allTournamentRounds(t).forEach(round=>(round.matches||[]).forEach(m=>{if(m.winner===studentId&&m.p1&&m.p2){wins++;total+=r.roundWin;}}));
    const champ=t.championId||(t.rounds?.at(-1)?.matches||[])[0]?.winner;
    if(champ===studentId){titles++;total+=r.champion;}
    if(t.format==="divisions-v1"){
      const final=(t.finals?.rounds?.at(-1)?.matches||[])[0];
      if(final&&(final.p1===studentId||final.p2===studentId)&&champ!==studentId){runnerUps++;total+=r.runnerUp;}
      const semis=t.finals?.rounds?.[0];
      if(semis?.matches.some(m=>m.p1===studentId||m.p2===studentId)){finalFours++;total+=r.finalFour;}
      const div=divisionFor(state.students.find(s=>s.id===studentId)?.instrument);
      const divFinal=t.divisions?.[div]?.rounds?.at(-1);
      if(divFinal?.matches.some(m=>m.p1===studentId||m.p2===studentId)){eliteEights++;total+=r.eliteEight;}
    }else{
      const rounds=t.rounds||[];const final=(rounds.at(-1)?.matches||[])[0];
      if(final&&(final.p1===studentId||final.p2===studentId)&&champ!==studentId){runnerUps++;total+=r.runnerUp;}
      const sf=rounds.at(-2);if(sf&&sf.matches.some(m=>m.p1===studentId||m.p2===studentId)){finalFours++;total+=r.finalFour;}
      const qf=rounds.at(-3);if(qf&&qf.matches.some(m=>m.p1===studentId||m.p2===studentId)){eliteEights++;total+=r.eliteEight;}
    }
  }
  return{total,wins,titles,runnerUps,finalFours,eliteEights,entries};
}
function statsFor(state,student){const c=challengePoints(state,student.id),t=tournamentStats(state,student.id);return{...c,...t,points:c.total+t.total};}
function allStats(state,ensemble){return state.students.filter(s=>s.active!==false&&s.ensemble===ensemble).map(s=>({student:s,...statsFor(state,s)})).sort((a,b)=>b.points-a.points||b.best-a.best||a.student.name.localeCompare(b.student.name));}
function useAudio(state){const ref=useRef({});useEffect(()=>{Object.entries(SOUND).forEach(([k,v])=>ref.current[k]=new Audio(v));},[]);return{play:k=>{if(!state.settings.sound)return;const a=ref.current[k];if(!a)return;Object.values(ref.current).forEach(x=>{try{x.pause();x.currentTime=0}catch{}});a.volume=clamp(state.settings.volume,0,1);a.play().catch(()=>{});},stop:()=>Object.values(ref.current).forEach(a=>{try{a.pause();a.currentTime=0}catch{}})}}
function useBandState(){const[state,setState]=useState(()=>{try{return migrate(JSON.parse(localStorage.getItem("bandcenter_v2")||"null"))}catch{return emptyState()}});const[cloud,setCloud]=useState("local");const loaded=useRef(false),client=useRef(null),timer=useRef(null);
  useEffect(()=>{async function init(){let current=state;try{const r=await fetch("data.json",{cache:"no-store"});if(r.ok){const legacy=migrate(await r.json());if(!current.students.length)current=legacy;}}catch{}const url=CFG.supabaseUrl,key=CFG.supabaseAnonKey;if(url&&key&&window.supabase){try{client.current=window.supabase.createClient(url,key);const{data,error}=await client.current.from("bandcenter_state").select("payload,updated_at").eq("id","okeene-bandcenter").maybeSingle();if(!error&&data?.payload&&Object.keys(data.payload).length){const remote=migrate(data.payload);if((remote.meta?.updatedAt||0)>(current.meta?.updatedAt||0))current=remote;}setCloud(error?"error":"online");}catch{setCloud("error")}}setState(current);loaded.current=true;}init();},[]);
  useEffect(()=>{if(!loaded.current)return;const next={...state,meta:{...state.meta,updatedAt:Date.now()}};localStorage.setItem("bandcenter_v2",JSON.stringify(next));if(client.current){clearTimeout(timer.current);timer.current=setTimeout(async()=>{setCloud("syncing");const{error}=await client.current.from("bandcenter_state").upsert({id:"okeene-bandcenter",payload:next,updated_at:new Date().toISOString()});setCloud(error?"error":"online")},700)}},[state]);
  return[state,setState,cloud];
}
const Button=({children,className="",...p})=><button className={`btn ${className}`} {...p}>{children}</button>;
const Input=p=><input className="input" {...p}/>;
const Select=p=><select className="select" {...p}/>;
function Logo(){return <div className="bc-mark">BC</div>}
function latestScoreStory(state,ensemble){
  const challenges=(state.challenges||[]).filter(c=>!c.archived&&c.ensemble===ensemble).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  for(const c of challenges){
    const scored=Object.entries(c.scores||{}).filter(([,v])=>v!==""&&v!=null).sort((a,b)=>Number(b[1])-Number(a[1]));
    if(scored.length){const s=state.students.find(x=>x.id===scored[0][0]);return s?`${s.name} posted ${Number(scored[0][1]).toFixed(1)} on ${c.name}`:"";}
  }
  return "";
}
function tickerItems(state,ensemble){
  const board=allStats(state,ensemble);const leader=board[0];const high=[...board].sort((a,b)=>b.best-a.best)[0];const wins=[...board].sort((a,b)=>b.wins-a.wins)[0];
  const live=[...(state.tournaments||[])].filter(t=>!t.archived&&t.ensemble===ensemble).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
  const champ=live?.championId&&state.students.find(s=>s.id===live.championId);
  const items=[state.meta.seasonName,`${board.length} ACTIVE PLAYERS`,`${state.challenges.filter(c=>!c.archived&&c.ensemble===ensemble).length} OPEN/ACTIVE CHALLENGES`];
  if(leader)items.push(`POWER RANKING #1: ${leader.student.name} (${leader.student.moniker}) • ${leader.points} PTS`);
  if(high?.best)items.push(`TOP PLAYING SCORE: ${high.student.name} • ${high.best.toFixed(1)}`);
  if(wins?.wins)items.push(`BRACKET WIN LEADER: ${wins.student.name} • ${wins.wins} WINS`);
  const recent=latestScoreStory(state,ensemble);if(recent)items.push(`LATEST: ${recent}`);
  if(live)items.push(`LIVE TOURNAMENT: ${live.name}`);
  if(live?.format==="divisions-v1")DIVISIONS.forEach(d=>{const id=live.divisions?.[d]?.championId;const s=id&&state.students.find(x=>x.id===id);if(s)items.push(`${d.toUpperCase()} CHAMPION: ${s.name}`)});
  items.push(champ?`DEFENDING CHAMPION: ${champ.name}`:"CHAMPIONSHIP CROWN: VACANT");
  items.push("PLAYING CHALLENGES ARE OPTIONAL • EVERY ATTEMPT CAN BUILD YOUR SEASON");
  return items;
}
function Header({state,cloud,isAdmin,setAdmin}){
  const ensemble=state.settings.activeEnsemble;const items=tickerItems(state,ensemble);const doubled=[...items,...items];
  return <>
    <div className="topbar"><div className="brand-row"><Logo/><div><div className="brand-title">BandCenter</div><div className="brand-sub">{state.meta.schoolName}</div></div><div className="spacer"/><div className="cloud-box"><span className={`cloud-dot ${cloud==="online"?"online":""}`}/><span className="brand-sub">{cloud==="online"?"Cloud synced":cloud==="syncing"?"Syncing":"Local mode"}</span></div><Button className="sm" onClick={()=>{if(isAdmin)setAdmin(false);else if(prompt("Commissioner passcode")===String(CFG.adminPasscode||"admin"))setAdmin(true)}}>{isAdmin?"Exit Commissioner":"Commissioner"}</Button></div></div>
    <div className="ticker"><div className="ticker-label">BANDCENTER</div><div className="ticker-marquee"><div className="ticker-track">{doubled.map((item,i)=><span key={`${item}-${i}`}>{item}</span>)}</div></div></div>
  </>;
}
function Broadcast({state,audio}){
  const ensemble=state.settings.activeEnsemble,b=allStats(state,ensemble),leader=b[0];const champs=(state.tournaments||[]).filter(t=>!t.archived&&t.ensemble===ensemble&&t.championId);const champ=champs.sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];const cs=champ&&state.students.find(s=>s.id===champ.championId);
  return <div className="grid grid-2">
    <div className="hero"><div className="hero-inner"><div className="hero-kicker">Live from the Barking Battalion</div><h1>{state.meta.seasonName}</h1><p>Voluntary Playing Challenges build points, power rankings, and tournament seeds. Four divisions battle through their own brackets before the division champions meet in the BandCenter Final Four.</p><div style={{display:"flex",gap:8,flexWrap:"wrap"}} className="no-print"><Button className="gold" onClick={()=>audio.play("espn")}>▶ Broadcast Theme</Button><Button onClick={()=>audio.play("applause")}>👏 Crowd</Button></div></div></div>
    <div className="scoreboard"><div className="score-tile"><div className="score-num">{b.length}</div><div className="score-label">Active Players</div></div><div className="score-tile"><div className="score-num">{state.challenges.filter(c=>!c.archived&&c.ensemble===ensemble).length}</div><div className="score-label">Challenges</div></div><div className="score-tile"><div className="score-num">4</div><div className="score-label">Divisions</div></div><div className="score-tile"><div className="score-num">{b.reduce((n,x)=>n+x.attempts,0)}</div><div className="score-label">Attempts</div></div></div>
    <div className="broadcast-card"><div className="broadcast-label">Top Story</div><div className="headline">{leader?`${leader.student.name} owns the top spot`:"The standings are wide open"}</div><p>{leader?`${leader.student.moniker} • ${leader.points} championship points • career high ${leader.best.toFixed(1)} • ${leader.wins} tournament wins`:"Enter the first Playing Challenge score to start the season."}</p></div>
    <div className="broadcast-card"><div className="broadcast-label">Championship Desk</div><div className="headline">{cs?`${cs.name} is the one to beat`:"The crown is waiting"}</div><p>{cs?`${cs.moniker} • ${champ.name} champion • ${champ.date}`:"Woodwinds, High Brass, Low Brass, and Percussion each send one champion to the Final Four."}</p></div>
  </div>;
}
function Standings({state}){const b=allStats(state,state.settings.activeEnsemble);return <div className="card"><div className="card-head"><div className="card-title">BandCenter Power Rankings</div></div><div>{b.map((x,i)=><div className={`leader-row ${i<3?"top3":""} rise`} key={x.student.id}><div className="rank">#{i+1}</div><div><div className="player-name">{x.student.name}</div><div className="moniker-sub">{x.student.moniker} • {x.student.instrument} • {divisionFor(x.student.instrument)}</div><div className="realname">{x.attempts} challenge attempts • high {x.best?x.best.toFixed(1):"—"}</div></div><div className="pts">{x.points} <small>PTS</small></div></div>)}{!b.length&&<div className="empty-state">No active players in this ensemble yet.</div>}</div></div>}
function badges(x){const out=[];if(x.titles)out.push("🏆 Champion");if(x.best>=10)out.push("💯 Perfect 10");if(x.maxStreak>=3)out.push("🔥 Hot Streak");if(x.runnerUps)out.push("🥈 Finalist");if(x.wins>=3)out.push("⚡ Bracket Buster");if(x.pb>=3)out.push("📈 Riser");if(x.points>=500)out.push("⭐ 500 Club");return out;}
function PlayerCards({state}){const b=allStats(state,state.settings.activeEnsemble);return <div className="grid grid-3">{b.map(x=><div className="student-card" key={x.student.id}><div className="student-card-top"><div className="instrument-tag">{x.student.instrument} • {divisionFor(x.student.instrument)}</div><div className="player-name light" style={{fontSize:25,marginTop:7}}>{x.student.name}</div><div className="moniker-sub light">{x.student.moniker}</div></div><div className="student-card-body"><div className="stat-row"><div className="mini-stat"><b>{x.points}</b><span>Points</span></div><div className="mini-stat"><b>{x.best?x.best.toFixed(1):"—"}</b><span>Career High</span></div><div className="mini-stat"><b>{x.wins}</b><span>Bracket Wins</span></div></div><div className="achievement-grid" style={{marginTop:12}}>{badges(x).map(b=><span className="badge gold" key={b}>{b}</span>)}{!badges(x).length&&<span className="badge">Season in progress</span>}</div></div></div>)}</div>}
function Roster({state,setState}){
  const ensemble=state.settings.activeEnsemble;const[form,setForm]=useState({name:"",instrument:"Flute"});const list=state.students.filter(s=>s.ensemble===ensemble).sort((a,b)=>divisionFor(a.instrument).localeCompare(divisionFor(b.instrument))||a.instrument.localeCompare(b.instrument)||a.name.localeCompare(b.name));
  const patch=(id,p)=>setState(q=>({...q,students:q.students.map(s=>s.id===id?{...s,...p}:s)}));
  return <><div className="card"><div className="card-head"><div className="card-title">Add Player</div></div><div className="card-body field-row"><div><label>Real name</label><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div><div><label>Instrument</label><Select value={form.instrument} onChange={e=>setForm({...form,instrument:e.target.value})}>{INSTRUMENTS.map(i=><option key={i}>{i}</option>)}</Select></div><div><label>Division</label><div className="division-readout">{divisionFor(form.instrument)}</div></div><div style={{alignSelf:"end"}}><Button className="primary" onClick={()=>{if(!form.name.trim())return;const s={id:uid(),name:form.name.trim(),instrument:form.instrument,ensemble,active:true,bandBucks:0};s.moniker=generatedMoniker(s);setState(q=>({...q,students:[...q.students,s]}));setForm({name:"",instrument:"Flute"})}}>Add to League</Button></div></div></div>
  <div className="card"><div className="card-head"><div className="card-title">Player Registry • {ensemble}</div></div><div className="table-wrap"><table className="table"><thead><tr><th>Player</th><th>Moniker</th><th>Instrument</th><th>Division</th><th>Currency</th><th>Status</th><th>Actions</th></tr></thead><tbody>{list.map(s=><tr key={s.id}><td><Input value={s.name} onChange={e=>patch(s.id,{name:e.target.value})}/></td><td><Input value={s.moniker} onChange={e=>patch(s.id,{moniker:e.target.value})}/></td><td><Select value={s.instrument} onChange={e=>patch(s.id,{instrument:e.target.value})}>{INSTRUMENTS.map(i=><option key={i}>{i}</option>)}</Select></td><td><span className="division-pill">{divisionFor(s.instrument)}</span></td><td><Input type="number" value={s.bandBucks||0} onChange={e=>patch(s.id,{bandBucks:Number(e.target.value)||0})}/></td><td><span className="chip">{s.active!==false?"Active":"Inactive"}</span></td><td style={{whiteSpace:"nowrap"}}><Button className="sm" onClick={()=>patch(s.id,{moniker:generatedMoniker(s,Math.random())})}>🎲 Regenerate</Button> <Button className="sm" onClick={()=>patch(s.id,{active:s.active===false})}>{s.active===false?"Activate":"Bench"}</Button> <Button className="sm red" onClick={()=>confirm(`Delete ${s.name}?`)&&setState(q=>({...q,students:q.students.filter(x=>x.id!==s.id)}))}>Delete</Button></td></tr>)}</tbody></table></div></div></>;
}
function scoreAwardPreview(state,challenge,studentId,value){const old=challenge.scores?.[studentId];const temp={...state,challenges:state.challenges.map(c=>c.id===challenge.id?{...c,scores:{...c.scores,[studentId]:value}}:c)};return challengePoints(temp,studentId).total-challengePoints({...temp,challenges:temp.challenges.map(c=>c.id===challenge.id?{...c,scores:{...c.scores,[studentId]:old}}:c)},studentId).total;}
function Challenges({state,setState,audio,toast}){
  const ensemble=state.settings.activeEnsemble;const[name,setName]=useState("");const list=state.challenges.filter(c=>!c.archived&&c.ensemble===ensemble);const students=state.students.filter(s=>s.active!==false&&s.ensemble===ensemble).sort((a,b)=>divisionFor(a.instrument).localeCompare(divisionFor(b.instrument))||a.instrument.localeCompare(b.instrument)||a.name.localeCompare(b.name));
  const setScore=(c,s,val)=>{const n=val===""?"":clamp(val,0,10);const delta=scoreAwardPreview(state,c,s.id,n);setState(q=>({...q,challenges:q.challenges.map(x=>x.id===c.id?{...x,scores:{...(x.scores||{}),[s.id]:n}}:x)}));if(n!==""){audio.play(n>=9.5?"victory":"deep");toast(`${s.name} (${s.moniker}): ${Number(n).toFixed(1)} • ${delta>=0?"+":""}${delta} season points`)}};
  return <><div className="card"><div className="card-head"><div className="card-title">Create Optional Playing Challenge</div></div><div className="card-body field-row"><div><label>Challenge name</label><Input value={name} onChange={e=>setName(e.target.value)} placeholder="Concert F Challenge"/></div><div><label>Date</label><Input id="new-date" type="date" defaultValue={today()}/></div><div style={{alignSelf:"end"}}><Button className="primary" onClick={()=>{if(!name.trim())return;const d=document.getElementById("new-date").value||today();setState(q=>({...q,challenges:[...q.challenges,{id:uid(),name:name.trim(),date:d,ensemble,scores:{},archived:false}]}));setName("")}}>Open Challenge</Button></div></div></div>
  {list.map(c=><div className="card" key={c.id}><div className="card-head"><div><div className="card-title">{c.name}</div><div className="realname">{c.date} • OPTIONAL SCORING OPPORTUNITY</div></div><div className="spacer"/><Button className="sm" onClick={()=>setState(q=>({...q,challenges:q.challenges.map(x=>x.id===c.id?{...x,archived:true}:x)}))}>Archive</Button></div><div className="table-wrap"><table className="table"><thead><tr><th>Player</th><th>Instrument</th><th>Division</th><th>Score / 10</th><th>Season Points</th><th>Career High</th></tr></thead><tbody>{students.map(s=>{const st=statsFor(state,s);return <tr key={s.id}><td><b>{s.name}</b><div className="realname">{s.moniker}</div></td><td>{s.instrument}</td><td>{divisionFor(s.instrument)}</td><td><Input className="challenge-score" type="number" min="0" max="10" step=".1" value={c.scores?.[s.id]??""} onChange={e=>setScore(c,s,e.target.value)}/></td><td><b>{st.points}</b></td><td>{st.best?st.best.toFixed(1):"—"}</td></tr>})}</tbody></table></div></div>)}</>;
}
function nextPow2(n){let p=1;while(p<n)p*=2;return Math.max(2,p);}
function seedPositions(size){let arr=[1,2];while(arr.length<size){const next=arr.length*2;arr=arr.flatMap(x=>[x,next+1-x]);}return arr;}
function makeRounds(ids){
  if(!ids.length)return[];
  if(ids.length===1)return[{name:"Division Final",matches:[{id:uid(),p1:ids[0],p2:null,winner:ids[0],bye:true}]}];
  const size=nextPow2(ids.length),positions=seedPositions(size),slots=positions.map(seed=>ids[seed-1]||null),rounds=[];let count=size/2;
  for(let r=0;count>=1;r++){const totalRounds=Math.log2(size);const matches=Array.from({length:count},(_,i)=>({id:uid(),p1:r===0?slots[i*2]:null,p2:r===0?slots[i*2+1]:null,winner:null,bye:false}));const name=r===totalRounds-1?"Division Final":r===totalRounds-2?"Division Semifinal":`Division Round ${r+1}`;rounds.push({name,matches});count/=2;}
  return autoAdvance(rounds);
}
function propagate(rounds){const out=rounds.map(r=>({...r,matches:r.matches.map(m=>({...m}))}));for(let r=0;r<out.length-1;r++){out[r].matches.forEach((m,i)=>{const next=out[r+1].matches[Math.floor(i/2)];const slot=i%2===0?"p1":"p2";next[slot]=m.winner||null;if(next.winner&&next.winner!==next.p1&&next.winner!==next.p2)next.winner=null;});}return out;}
function autoAdvance(rounds){let out=rounds.map(r=>({...r,matches:r.matches.map(m=>({...m}))}));let changed=true;while(changed){changed=false;out=propagate(out);out.forEach(r=>r.matches.forEach(m=>{if(!m.winner&&((m.p1&&!m.p2)||(!m.p1&&m.p2))){m.winner=m.p1||m.p2;m.bye=true;changed=true;}}));}return propagate(out);}
function divisionChampion(div){return div?.rounds?.at(-1)?.matches?.[0]?.winner||null;}
function buildFinals(divisions,prior){
  const slots=[divisions?.Woodwinds?.championId||null,divisions?.["High Brass"]?.championId||null,divisions?.["Low Brass"]?.championId||null,divisions?.Percussion?.championId||null];
  const old=prior?.rounds||[];
  const semis=[{id:old[0]?.matches?.[0]?.id||uid(),p1:slots[0],p2:slots[1],winner:old[0]?.matches?.[0]?.winner||null},{id:old[0]?.matches?.[1]?.id||uid(),p1:slots[2],p2:slots[3],winner:old[0]?.matches?.[1]?.winner||null}];
  semis.forEach(m=>{if(m.winner!==m.p1&&m.winner!==m.p2)m.winner=null;});
  let rounds=[{name:"BandCenter Final Four",matches:semis},{name:"BandCenter Championship",matches:[{id:old[1]?.matches?.[0]?.id||uid(),p1:null,p2:null,winner:old[1]?.matches?.[0]?.winner||null}]}];
  rounds=autoAdvance(rounds);
  return{rounds,championId:rounds.at(-1)?.matches?.[0]?.winner||null};
}
function rankIdsForDivision(state,ensemble,division,selectedIds){const map=new Map(allStats(state,ensemble).map(x=>[x.student.id,x]));return selectedIds.filter(id=>divisionFor(state.students.find(s=>s.id===id)?.instrument)===division).sort((a,b)=>(map.get(b)?.points||0)-(map.get(a)?.points||0)||(map.get(b)?.best||0)-(map.get(a)?.best||0)||(state.students.find(s=>s.id===a)?.name||"").localeCompare(state.students.find(s=>s.id===b)?.name||""));}
function createDivisionTournament(state,ensemble,name,selectedIds){
  const divisions={};DIVISIONS.forEach(d=>{const ids=rankIdsForDivision(state,ensemble,d,selectedIds);const rounds=makeRounds(ids);divisions[d]={participantIds:ids,rounds,championId:divisionChampion({rounds})};});
  const finals=buildFinals(divisions,null);
  return{id:uid(),format:"divisions-v1",name,date:today(),ensemble,participants:[...selectedIds],divisions,finals,championId:finals.championId,archived:false};
}
function updateTournamentWinner(t,scope,ri,mi,w){
  if(t.format!=="divisions-v1")return t;
  let divisions={...t.divisions},finals=t.finals;
  if(DIVISIONS.includes(scope)){
    let rounds=(divisions[scope]?.rounds||[]).map(r=>({...r,matches:r.matches.map(m=>({...m}))}));rounds[ri].matches[mi].winner=w;rounds=autoAdvance(rounds);divisions={...divisions,[scope]:{...divisions[scope],rounds,championId:divisionChampion({rounds})}};finals=buildFinals(divisions,finals);
  }else{
    let rounds=(finals?.rounds||[]).map(r=>({...r,matches:r.matches.map(m=>({...m}))}));rounds[ri].matches[mi].winner=w;rounds=autoAdvance(rounds);finals={rounds,championId:rounds.at(-1)?.matches?.[0]?.winner||null};
  }
  return{...t,divisions,finals,championId:finals.championId};
}
function TournamentStudio({state,setState,audio,toast}){
  const ensemble=state.settings.activeEnsemble;const[name,setName]=useState("Band Madness");const[query,setQuery]=useState("");const[selectedIds,setSelectedIds]=useState([]);const list=state.tournaments.filter(t=>!t.archived&&t.ensemble===ensemble);const players=state.students.filter(s=>s.active!==false&&s.ensemble===ensemble).sort((a,b)=>divisionFor(a.instrument).localeCompare(divisionFor(b.instrument))||a.name.localeCompare(b.name));
  useEffect(()=>{setSelectedIds(players.map(s=>s.id));},[ensemble,state.students.length]);
  const filtered=players.filter(s=>!query.trim()||`${s.name} ${s.moniker} ${s.instrument}`.toLowerCase().includes(query.trim().toLowerCase()));
  const toggle=id=>setSelectedIds(ids=>ids.includes(id)?ids.filter(x=>x!==id):[...ids,id]);
  const selectDivision=d=>setSelectedIds(ids=>[...new Set([...ids,...players.filter(s=>divisionFor(s.instrument)===d).map(s=>s.id)])]);
  const clearDivision=d=>setSelectedIds(ids=>ids.filter(id=>divisionFor(players.find(s=>s.id===id)?.instrument)!==d));
  function create(){if(!selectedIds.length)return alert("Select at least one student for the tournament.");const t=createDivisionTournament(state,ensemble,name.trim()||"Band Madness",selectedIds);setState(q=>({...q,tournaments:[...q.tournaments,t]}));audio.play("start");toast(`${t.name}: ${selectedIds.length} players selected across four divisions`);}
  function win(tid,scope,ri,mi,w){setState(q=>({...q,tournaments:q.tournaments.map(t=>{if(t.id!==tid)return t;const before=t.championId;const next=updateTournamentWinner(t,scope,ri,mi,w);if(next.championId&&next.championId!==before){const s=q.students.find(x=>x.id===next.championId);setTimeout(()=>{audio.play("victory");toast(`${s?.name||"Champion"} WINS ${t.name.toUpperCase()}!`)},50)}return next;})}));}
  function resetField(tid){if(!confirm("Replace this tournament field with the currently checked students? This resets all results in that tournament."))return;setState(q=>({...q,tournaments:q.tournaments.map(t=>t.id===tid?createDivisionTournament(q,ensemble,t.name,selectedIds):t)}));}
  return <>
    <div className="card"><div className="card-head"><div><div className="card-title">Tournament Selection Studio</div><div className="realname">Choose exactly who enters before revealing the four division brackets.</div></div></div>
      <div className="card-body"><div className="field-row"><div><label>Tournament name</label><Input value={name} onChange={e=>setName(e.target.value)}/></div><div><label>Find a student</label><Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, moniker, instrument"/></div><div style={{alignSelf:"end"}}><Button onClick={()=>setSelectedIds(players.map(s=>s.id))}>Select All</Button> <Button onClick={()=>setSelectedIds([])}>Clear</Button></div><div style={{alignSelf:"end"}}><Button className="red" onClick={create}>📺 Reveal Division Brackets</Button></div></div>
      <div className="division-picker-grid">{DIVISIONS.map(d=>{const group=filtered.filter(s=>divisionFor(s.instrument)===d);const chosen=players.filter(s=>divisionFor(s.instrument)===d&&selectedIds.includes(s.id)).length;return <div className="division-picker" key={d}><div className="division-picker-head"><div><b>{d}</b><div className="realname">{chosen} selected</div></div><div><Button className="sm" onClick={()=>selectDivision(d)}>All</Button> <Button className="sm" onClick={()=>clearDivision(d)}>Clear</Button></div></div>{group.map(s=><label className="check-player" key={s.id}><input type="checkbox" checked={selectedIds.includes(s.id)} onChange={()=>toggle(s.id)}/><span><b>{s.name}</b><small>{s.moniker} • {s.instrument}</small></span></label>)}{!group.length&&<div className="realname">No matching players</div>}</div>})}</div>
      <div className="commissioner-note" style={{marginTop:14}}>Structure: Woodwinds, High Brass, Low Brass, and Percussion each crown a division champion. Those four students advance automatically to the BandCenter Final Four.</div></div>
    </div>
    {list.map(t=><div key={t.id}><div className="card tournament-tools"><div className="card-body"><b>{t.name}</b> • {t.participants?.length||tournamentParticipants(t).size} players <Button className="sm" onClick={()=>{setSelectedIds([...(t.participants||tournamentParticipants(t))]);window.scrollTo({top:0,behavior:"smooth"})}}>Load Field Into Picker</Button> <Button className="sm red" onClick={()=>resetField(t.id)}>Replace Field + Reset</Button></div></div><Tournament state={state} t={t} editable onWin={win}/></div>)}
  </>;
}
function Competitor({state,t,id,winner,editable,onClick}){const s=state.students.find(x=>x.id===id);const rank=id?allStats(state,t.ensemble).findIndex(x=>x.student.id===id)+1:"";return <div className={`competitor ${winner===id&&id?"winner":""} ${!id?"empty":""}`} onClick={()=>editable&&id&&onClick()}><span className="seed">{rank||""}</span><span className="competitor-copy"><b>{s?s.name:"TBD"}</b>{s&&<small>{s.moniker} • {s.instrument}</small>}</span>{winner===id&&id?<b>✓</b>:null}</div>}
function RoundBracket({state,t,rounds,scope,editable,onWin}){if(!rounds?.length)return <div className="empty-state">No players in this division.</div>;return <div className="bracket compact-bracket">{rounds.map((r,ri)=><div className="round" key={`${scope}-${ri}`}><div className="round-title">{r.name}</div>{r.matches.map((m,mi)=><div className="match" key={m.id}><Competitor state={state} t={t} id={m.p1} winner={m.winner} editable={editable&&!m.bye} onClick={()=>onWin(t.id,scope,ri,mi,m.p1)}/><Competitor state={state} t={t} id={m.p2} winner={m.winner} editable={editable&&!m.bye} onClick={()=>onWin(t.id,scope,ri,mi,m.p2)}/></div>)}</div>)}</div>}
function LegacyTournament({state,t,editable,onWin}){const s=id=>state.students.find(x=>x.id===id);return <div className="card"><div className="card-head"><div><div className="card-title">{t.name}</div><div className="realname">Legacy tournament • {t.date}</div></div></div>{t.championId&&<div className="card-body"><div className="champion-banner"><div className="broadcast-label">Reigning Champion</div><h2>{s(t.championId)?.name||"Champion"}</h2><b>{s(t.championId)?.moniker||""}</b></div></div>}<div className="bracket">{(t.rounds||[]).map((r,ri)=><div className="round" key={ri}><div className="round-title">{r.name}</div>{r.matches.map((m,mi)=><div className="match" key={m.id}>{[m.p1,m.p2].map((id,slot)=><Competitor key={slot} state={state} t={t} id={id} winner={m.winner} editable={editable} onClick={()=>onWin&&onWin(t.id,"legacy",ri,mi,id)}/>)}</div>)}</div>)}</div></div>}
function Tournament({state,t,editable,onWin}){
  if(t.format!=="divisions-v1")return <LegacyTournament state={state} t={t} editable={editable} onWin={onWin}/>;
  const champ=t.championId&&state.students.find(s=>s.id===t.championId);
  return <div className="tournament-shell"><div className="card"><div className="card-head"><div><div className="card-title">{t.name}</div><div className="realname">{t.date} • Four-Division Championship • {t.participants?.length||0} players</div></div></div>{champ&&<div className="card-body"><div className="champion-banner"><div className="broadcast-label">Reigning Champion</div><h2>{champ.name}</h2><b>{champ.moniker} • {champ.instrument}</b></div></div>}</div>
  <div className="division-brackets">{DIVISIONS.map(d=>{const div=t.divisions?.[d];const dc=div?.championId&&state.students.find(s=>s.id===div.championId);return <div className="division-card" key={d}><div className="division-banner"><span>{d}</span><b>{div?.participantIds?.length||0} players</b></div>{dc&&<div className="division-champ">Division Champion: <b>{dc.name}</b> <span>{dc.moniker}</span></div>}<RoundBracket state={state} t={t} rounds={div?.rounds||[]} scope={d} editable={editable} onWin={onWin}/></div>})}</div>
  <div className="card final-four-card"><div className="card-head"><div><div className="card-title">BandCenter Final Four</div><div className="realname">Woodwind Champion vs High Brass Champion • Low Brass Champion vs Percussion Champion</div></div></div><RoundBracket state={state} t={t} rounds={t.finals?.rounds||[]} scope="Final Four" editable={editable} onWin={onWin}/></div></div>;
}
function Brackets({state}){const list=state.tournaments.filter(t=>!t.archived&&t.ensemble===state.settings.activeEnsemble);return <>{list.map(t=><Tournament key={t.id} state={state} t={t}/>)}{!list.length&&<div className="empty-state">No live tournament yet.</div>}</>}
function Settings({state,setState}){const r=state.rules;const fields=[["attempt","Any attempt"],["s7","7.0–7.9"],["s8","8.0–8.9"],["s9","9.0–9.49"],["s95","9.5–9.99"],["s10","Perfect 10"],["personalBest","New personal best"],["improveOne","Improve by 1+"],["tournamentEntry","Tournament entry"],["roundWin","Each round win"],["eliteEight","Reach division final / Elite Eight"],["finalFour","Win division / Final Four"],["runnerUp","Runner-up"],["champion","Champion"]];return <div className="grid grid-2"><div className="card"><div className="card-head"><div className="card-title">Season Identity</div></div><div className="card-body grid"><div><label>Season</label><Input value={state.meta.seasonName} onChange={e=>setState(q=>({...q,meta:{...q.meta,seasonName:e.target.value}}))}/></div><div><label>School / Program</label><Input value={state.meta.schoolName} onChange={e=>setState(q=>({...q,meta:{...q.meta,schoolName:e.target.value}}))}/></div><div><label>Sound volume</label><Input type="range" min="0" max="1" step=".05" value={state.settings.volume} onChange={e=>setState(q=>({...q,settings:{...q.settings,volume:Number(e.target.value)}}))}/></div></div></div><div className="card"><div className="card-head"><div className="card-title">Championship Point Rules</div></div><div className="card-body grid grid-2">{fields.map(([k,label])=><div key={k}><label>{label}</label><Input type="number" value={r[k]} onChange={e=>setState(q=>({...q,rules:{...q.rules,[k]:Number(e.target.value)||0}}))}/></div>)}</div></div><div className="card"><div className="card-head"><div className="card-title">Divisions</div></div><div className="card-body"><p><b>Woodwinds:</b> Flute, Oboe, Bassoon, Clarinet, Bass Clarinet, Alto Sax, Tenor Sax, Baritone Sax.</p><p><b>High Brass:</b> Trumpet, French Horn, Mellophone.</p><p><b>Low Brass:</b> Trombone, Baritone, Euphonium, Tuba.</p><p><b>Percussion:</b> Percussion.</p><p className="realname">Legacy generic “Saxophone” and “Low Brass” entries are preserved until you assign their specific instruments.</p></div></div><div className="card"><div className="card-head"><div className="card-title">Cloud Setup</div></div><div className="card-body"><p>BandCenter runs locally now. For multi-device syncing, create a Supabase project, run <b>supabase-schema.sql</b>, then place the Project URL and anon key in <b>bandcenter-config.js</b>.</p><p className="commissioner-note">Real student names are now intentionally visible throughout BandCenter, per Commissioner preference.</p></div></div><div className="card"><div className="card-head"><div className="card-title">Data Safety</div></div><div className="card-body"><Button onClick={()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="bandcenter-backup.json";a.click()}}>Export Backup</Button> <Button className="red" onClick={()=>confirm("Clear local BandCenter 2 data?")&&(localStorage.removeItem("bandcenter_v2"),location.reload())}>Reset Local Cache</Button></div></div></div>}
function App(){const[state,setState,cloud]=useBandState();const[admin,setAdmin]=useState(false);const[tab,setTab]=useState("Broadcast");const[toastMsg,setToast]=useState("");const audio=useAudio(state);const toast=msg=>{setToast(msg);setTimeout(()=>setToast(""),3200)};const publicTabs=["Broadcast","Standings","Player Cards","Brackets"],adminTabs=["Roster","Challenges","Tournament Studio","Settings"],tabs=admin?adminTabs:publicTabs;useEffect(()=>{if(!tabs.includes(tab))setTab(admin?"Roster":"Broadcast")},[admin]);const ensemble=state.settings.activeEnsemble;return <div className="app-shell"><Header state={state} cloud={cloud} isAdmin={admin} setAdmin={setAdmin}/><main className="container"><div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}} className="no-print"><div style={{minWidth:230}}><Select value={ensemble} onChange={e=>setState(q=>({...q,settings:{...q.settings,activeEnsemble:e.target.value}}))}>{ENSEMBLES.map(e=><option key={e}>{e}</option>)}</Select></div><div className="nav-tabs">{tabs.map(t=><button key={t} className={`nav-btn ${tab===t?"active":""}`} onClick={()=>setTab(t)}>{t}</button>)}</div></div>{tab==="Broadcast"&&<Broadcast state={state} audio={audio}/>} {tab==="Standings"&&<Standings state={state}/>} {tab==="Player Cards"&&<PlayerCards state={state}/>} {tab==="Brackets"&&<Brackets state={state}/>} {tab==="Roster"&&<Roster state={state} setState={setState}/>} {tab==="Challenges"&&<Challenges state={state} setState={setState} audio={audio} toast={toast}/>} {tab==="Tournament Studio"&&<TournamentStudio state={state} setState={setState} audio={audio} toast={toast}/>} {tab==="Settings"&&<Settings state={state} setState={setState}/>}</main>{toastMsg&&<div className="toast">{toastMsg}</div>}</div>}
ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
