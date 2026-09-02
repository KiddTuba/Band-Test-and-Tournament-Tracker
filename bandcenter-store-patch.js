(function(){
  const STORE_ITEMS=[
    {id:"pass",name:"Free Pass of a Round",cost:500,note:"Cannot be used for Final Four or Championship"},
    {id:"bump",name:"Bump Score to a 10",cost:200,note:"Use on one Playing Challenge score"},
    {id:"chill",name:"Free Day (Xbox or Uno)",cost:400,note:"One approved relaxation class period"},
    {id:"swap",name:"Swap Instrument for the Day",cost:190,note:"Must be approved by Mr. A"},
    {id:"boost",name:"Boost a Friend",cost:300,note:"Give an approved challenge bonus to another student"},
    {id:"multiseed",name:"Be Seeded More Than Once",cost:200,note:"Allows multiple bracket entries when approved"},
    {id:"movebracket",name:"Move Bracket Position",cost:200,note:"Commissioner-approved bracket position change"},
    {id:"party",name:"Pizza, Chips, & Soda Party",cost:2500,note:"Notify Mr. A in advance; food arrangements must be approved"}
  ];

  function componentSource(){return `
function BandStore({state,setState}){
  const ensemble=state.settings.activeEnsemble;
  const players=state.students.filter(s=>s.active!==false&&s.ensemble===ensemble).sort((a,b)=>a.name.localeCompare(b.name));
  const[selectedId,setSelectedId]=useState(players[0]?.id||"");
  const[message,setMessage]=useState("");
  useEffect(()=>{if(!players.some(s=>s.id===selectedId))setSelectedId(players[0]?.id||"");},[ensemble,state.students.length]);
  const student=state.students.find(s=>s.id===selectedId);
  const balance=Number(student?.bandBucks||0);
  const transactions=(state.storeTransactions||[]).filter(tx=>tx.studentId===selectedId).sort((a,b)=>(b.purchasedAt||"").localeCompare(a.purchasedAt||""));
  function flash(msg){setMessage(msg);setTimeout(()=>setMessage(""),3200)}
  function buy(item){
    if(!student)return alert("Choose a student first.");
    if(balance<item.cost)return alert(\`\${student.name} needs \${item.cost-balance} more Band Bucks for \${item.name}.\`);
    if(!confirm(\`Purchase \${item.name} for \${student.name} for \${item.cost} Band Bucks?\\n\\nCurrent balance: \${balance}\\nNew balance: \${balance-item.cost}\`))return;
    const tx={id:uid(),studentId:student.id,studentName:student.name,ensemble:student.ensemble,itemId:item.id,itemName:item.name,cost:item.cost,purchasedAt:new Date().toISOString(),refundedAt:null};
    setState(q=>({...q,students:q.students.map(s=>s.id===student.id?{...s,bandBucks:Math.max(0,Number(s.bandBucks||0)-item.cost)}:s),storeTransactions:[...(q.storeTransactions||[]),tx],meta:{...q.meta,lastStorePurchase:tx}}));
    flash(\`\${student.name} purchased \${item.name} for \${item.cost} Band Bucks.\`);
  }
  function refund(tx){
    if(tx.refundedAt)return;
    if(!confirm(\`Refund \${tx.itemName} to \${student?.name||tx.studentName} and return \${tx.cost} Band Bucks?\`))return;
    const refundedAt=new Date().toISOString();
    setState(q=>({...q,students:q.students.map(s=>s.id===tx.studentId?{...s,bandBucks:Number(s.bandBucks||0)+Number(tx.cost||0)}:s),storeTransactions:(q.storeTransactions||[]).map(x=>x.id===tx.id?{...x,refundedAt}:x),meta:{...q.meta,lastStoreRefund:{transactionId:tx.id,refundedAt}}}));
    flash(\`Refunded \${tx.itemName}. \${tx.cost} Band Bucks returned.\`);
  }
  return <div className="band-store-shell">
    <div className="card store-hero"><div className="card-head"><div><div className="card-title">BandCenter Band Store</div><div className="realname">Commissioner checkout • purchases deduct Band Bucks immediately</div></div></div>
      <div className="card-body store-checkout-row"><div><label>Student</label><Select value={selectedId} onChange={e=>setSelectedId(e.target.value)}><option value="">Choose a student</option>{players.map(s=><option value={s.id} key={s.id}>{s.name} • {s.moniker} • {Number(s.bandBucks||0)} BB</option>)}</Select></div><div className="store-balance"><span>Available Balance</span><b>{student?balance:0}</b><small>BAND BUCKS</small></div></div>
      {message&&<div className="store-message">{message}</div>}
    </div>
    <div className="store-grid">{STORE_ITEMS.map(item=>{const canBuy=!!student&&balance>=item.cost;return <div className={\`store-item \${canBuy?"affordable":"locked"}\`} key={item.id}><div className="store-price">{item.cost} BB</div><h3>{item.name}</h3><p>{item.note}</p><Button className={canBuy?"gold":""} disabled={!student||!canBuy} onClick={()=>buy(item)}>{!student?"Choose Student":canBuy?"Purchase":\`Need \${item.cost-balance} More\`}</Button></div>})}</div>
    <div className="card store-history"><div className="card-head"><div><div className="card-title">Purchase History</div><div className="realname">{student?\`Transactions for \${student.name}\`:"Choose a student to view transactions"}</div></div></div>
      <div className="table-wrap"><table className="table"><thead><tr><th>Date</th><th>Item</th><th>Cost</th><th>Status</th><th>Action</th></tr></thead><tbody>{transactions.map(tx=><tr key={tx.id}><td>{new Date(tx.purchasedAt).toLocaleString()}</td><td><b>{tx.itemName}</b></td><td>{tx.cost} BB</td><td>{tx.refundedAt?<span className="chip">Refunded</span>:<span className="chip">Purchased</span>}</td><td>{!tx.refundedAt&&<Button className="sm" onClick={()=>refund(tx)}>Refund</Button>}</td></tr>)}{student&&!transactions.length&&<tr><td colSpan="5" className="empty-state">No store purchases yet.</td></tr>}{!student&&<tr><td colSpan="5" className="empty-state">Choose a student above.</td></tr>}</tbody></table></div>
    </div>
  </div>;
}
`}

  window.BANDCENTER_PATCH_SOURCE=function(source){
    let out=source;
    if(!out.includes("const STORE_ITEMS="))out=out.replace("const ADJ=",`const STORE_ITEMS=${JSON.stringify(STORE_ITEMS)};\nconst ADJ=`);
    out=out.replace("students:[],challenges:[],tournaments:[],rules:","students:[],challenges:[],tournaments:[],storeTransactions:[],rules:");
    out=out.replace("s.students=(s.students||[]).map",'s.storeTransactions=Array.isArray(s.storeTransactions)?s.storeTransactions:[];\n    s.students=(s.students||[]).map');
    if(!out.includes("function BandStore({state,setState})"))out=out.replace("function Settings({state,setState}){",componentSource()+"\nfunction Settings({state,setState}){");
    out=out.replace('adminTabs=["Roster","Challenges","Tournament Studio","Settings"]','adminTabs=["Roster","Challenges","Tournament Studio","Band Store","Settings"]');
    out=out.replace('{tab==="Tournament Studio"&&<TournamentStudio state={state} setState={setState} audio={audio} toast={toast}/>} {tab==="Settings"', '{tab==="Tournament Studio"&&<TournamentStudio state={state} setState={setState} audio={audio} toast={toast}/>} {tab==="Band Store"&&<BandStore state={state} setState={setState}/>} {tab==="Settings"');
    return out;
  };
})();
