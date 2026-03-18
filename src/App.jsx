import { useState, useMemo, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// ─── THEMES ───────────────────────────────────────────────────────────────────
const DARK = {
  bg:"#000000", bgAlt:"#0a0a0a", surface:"#0f0f0f", card:"#141414",
  cardHover:"#1a1a1a", border:"#242424", borderLight:"#1c1c1c",
  text:"#f2f2f2", textSub:"#999999", textMuted:"#555555",
  accent:"#0a84ff", green:"#32d74b", red:"#ff453a", yellow:"#ffd60a", orange:"#ff9f0a",
  shadow:"0 24px 80px rgba(0,0,0,0.8)", shadowSm:"0 4px 24px rgba(0,0,0,0.4)", shadowXs:"0 1px 8px rgba(0,0,0,0.3)",
};
const LIGHT = {
  bg:"#f2f2f7", bgAlt:"#ffffff", surface:"#ffffff", card:"#ffffff",
  cardHover:"#f8f8fa", border:"#e0e0e5", borderLight:"#ebebf0",
  text:"#1a1a1a", textSub:"#666666", textMuted:"#aaaaaa",
  accent:"#0071e3", green:"#28cd41", red:"#ff3b30", yellow:"#ff9500", orange:"#ff6b00",
  shadow:"0 24px 80px rgba(0,0,0,0.08)", shadowSm:"0 4px 24px rgba(0,0,0,0.06)", shadowXs:"0 1px 8px rgba(0,0,0,0.04)",
};

// ─── CONSTANTS ─────────────────────────────────────────────────────────────────
const MARKETS  = ["DE40","UK100","US100","US30","GBP-USD","EUR-USD"];
const SESSIONS = ["Morning 10-12","Day 12-16","Evening 17-21"];
const SETUPS   = ["OG","TG","TCG","3G","3CG","SLG+OG","SLG+TG","SLG+TCG","SLG+3G","SLG+3CG","MG"];
const LIQUIDITY= ["HOD","LOD","Locala","Majora","Minora"];
const NEWS_OPT = ["Safe","FOMC","Bank Holiday","Speech","CPI","NFP","GDP","Unemp. Rate","PMI","PCE","PPI"];
const TRENDS   = ["Together","Against","No Trend"];
const MSS_OPT  = ["Normal","Agresive"];
const RESULTS  = ["Win","Lose","BE"];
const AFTER_BE = ["Win","Lose","No BE"];
const DAYS     = ["Monday","Tuesday","Wednesday","Thursday","Friday"];
const ACC_TYPES= ["Phase 1","Phase 2","Live"];
const FIRMS    = ["5%ers","FP","Other"];
const GRADES   = ["A","B","C","D"];
const DEF_CONF = ["Trend Alignment","S/R Level","FVG","BOS/CHoCH","HTF Bias","Volume Spike","News Catalyst"];
const CHECKLIST= ["HTF bias confirmed","Session aligns","Liquidity taken","Setup visible","Risk defined","News checked"];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const load = k => { try { return JSON.parse(localStorage.getItem(k)||"null"); } catch { return null; } };
const save = (k,v) => localStorage.setItem(k, JSON.stringify(v));
const pct  = (n,d) => d===0 ? "0%" : (n/d*100).toFixed(1)+"%";
const eur  = v => (Number(v)>=0?"+":"")+"€"+Math.abs(Number(v)).toFixed(0);
const emptyTrade = { id:null, account:"", market:"DE40", order:"BUY", month:"", session:"Day 12-16", open:"", close:"", news:"Safe", liquidity:"Locala", trend:"Together", mss:"Normal", setup:"OG", dayOfWeek:"Monday", result:"Win", afterBE:"No BE", rr:"", risk:"1", income:"", notes:"", screenshot:"", confluences:[], grade:"A", checklist:[] };
const APP_PASSWORD = "edgetrack2024";

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const radius = { xs:6, sm:10, md:14, lg:18, xl:22, full:999 };
const font = { xs:10, sm:12, md:13, base:14, lg:16, xl:18, xxl:22, xxxl:28, display:36 };

// ─── BASE COMPONENTS ──────────────────────────────────────────────────────────
const Pill = ({ label, color, size="sm" }) => (
  <span style={{
    background: color+"15", color, border: `1px solid ${color}25`,
    padding: size==="xs" ? "2px 7px" : "3px 10px",
    borderRadius: radius.full, fontSize: size==="xs" ? 10 : 11,
    fontWeight: 600, whiteSpace:"nowrap", letterSpacing: 0.2,
  }}>{label}</span>
);

const Divider = ({ t }) => <div style={{ height:1, background:t.border, margin:"2px 0" }} />;

function WinBar({ wins, total, t, height=4 }) {
  const w = total ? wins/total*100 : 0;
  const col = w>=50 ? t.green : w>=35 ? t.yellow : t.red;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
      <div style={{ flex:1, height, background:t.border, borderRadius:radius.full, overflow:"hidden" }}>
        <div style={{ width:w+"%", height:"100%", background:col, borderRadius:radius.full, transition:"width .6s cubic-bezier(.4,0,.2,1)" }} />
      </div>
      <span style={{ color:col, fontSize:font.sm, fontWeight:700, minWidth:42, textAlign:"right", fontVariantNumeric:"tabular-nums" }}>{pct(wins,total)}</span>
    </div>
  );
}

function Card({ children, style={}, t, hoverable }) {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={()=>hoverable&&setHov(true)} onMouseLeave={()=>hoverable&&setHov(false)}
      style={{ background:hov?t.cardHover:t.card, border:`1px solid ${t.border}`, borderRadius:radius.xl, boxShadow:t.shadowXs, transition:"all .2s cubic-bezier(.4,0,.2,1)", transform:hov?"translateY(-2px)":"none", ...style }}>
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle, action, t }) {
  return (
    <div style={{ padding:"20px 24px 16px", borderBottom:`1px solid ${t.borderLight}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
      <div>
        <div style={{ color:t.text, fontSize:font.lg, fontWeight:700, letterSpacing:-.3 }}>{title}</div>
        {subtitle && <div style={{ color:t.textMuted, fontSize:font.sm, marginTop:2 }}>{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

function KPI({ label, value, sub, color, t, large }) {
  return (
    <Card t={t} hoverable style={{ flex:1, minWidth:140, padding:"22px 24px" }}>
      <div style={{ color:t.textMuted, fontSize:font.xs, fontWeight:600, letterSpacing:1.2, textTransform:"uppercase", marginBottom:10 }}>{label}</div>
      <div style={{ color:color||t.text, fontSize:large?font.xxxl:font.xxl, fontWeight:800, letterSpacing:-1.2, lineHeight:1, fontVariantNumeric:"tabular-nums" }}>{value}</div>
      {sub && <div style={{ color:t.textMuted, fontSize:font.sm, marginTop:8, fontWeight:500 }}>{sub}</div>}
    </Card>
  );
}

function StatRow({ name, wins, total, income, t }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"120px 1fr auto auto", gap:12, alignItems:"center", padding:"9px 0", borderBottom:`1px solid ${t.borderLight}` }}>
      <span style={{ color:t.text, fontSize:font.md, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{name}</span>
      <WinBar wins={wins} total={total} t={t} />
      <span style={{ color:t.textMuted, fontSize:font.sm, fontVariantNumeric:"tabular-nums", minWidth:28, textAlign:"center" }}>{total}</span>
      <span style={{ color:income>=0?t.green:t.red, fontSize:font.sm, fontWeight:700, fontVariantNumeric:"tabular-nums", minWidth:64, textAlign:"right", whiteSpace:"nowrap" }}>{eur(income)}</span>
    </div>
  );
}

function FF({ label, children, t }) {
  return (
    <div>
      <label style={{ color:t.textMuted, fontSize:font.xs, fontWeight:600, letterSpacing:.8, textTransform:"uppercase", display:"block", marginBottom:7 }}>{label}</label>
      {children}
    </div>
  );
}

function SectionLabel({ children, t }) {
  return <div style={{ color:t.textMuted, fontSize:font.xs, fontWeight:600, letterSpacing:1.5, textTransform:"uppercase", marginBottom:16 }}>{children}</div>;
}

function Badge({ children, color, t }) {
  return <span style={{ background:color+"15", color, border:`1px solid ${color}25`, padding:"4px 10px", borderRadius:radius.sm, fontSize:font.xs, fontWeight:700, letterSpacing:.5 }}>{children}</span>;
}

// ─── HEATMAP ──────────────────────────────────────────────────────────────────
function Heatmap({ trades, t, dark }) {
  const [vm, setVm] = useState(() => { const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`; });
  const [y,m] = vm.split("-").map(Number);
  const firstDay = new Date(y,m-1,1).getDay();
  const daysInMonth = new Date(y,m,0).getDate();
  const offset = firstDay===0?6:firstDay-1;
  const dayMap = useMemo(()=>{ const map={}; trades.forEach(tr=>{ if(!tr.open) return; const d=tr.open.slice(0,10); if(!map[d])map[d]={income:0,trades:0,wins:0}; map[d].income+=parseFloat(tr.income||0); map[d].trades++; if(tr.result==="Win")map[d].wins++; }); return map; },[trades]);
  const cells=[]; for(let i=0;i<offset;i++)cells.push(null); for(let d=1;d<=daysInMonth;d++){ const key=`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`; cells.push({d,key,data:dayMap[key]||null}); }
  const prev=()=>{const dt=new Date(y,m-2,1);setVm(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`);};
  const next=()=>{const dt=new Date(y,m,1);setVm(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`);};
  const mNames=["January","February","March","April","May","June","July","August","September","October","November","December"];
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <button onClick={prev} style={{ background:"none", border:`1px solid ${t.border}`, color:t.textSub, borderRadius:radius.sm, padding:"5px 12px", cursor:"pointer", fontSize:font.base }}>‹</button>
        <span style={{ color:t.text, fontWeight:700, fontSize:font.base, letterSpacing:-.3 }}>{mNames[m-1]} {y}</span>
        <button onClick={next} style={{ background:"none", border:`1px solid ${t.border}`, color:t.textSub, borderRadius:radius.sm, padding:"5px 12px", cursor:"pointer", fontSize:font.base }}>›</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3, marginBottom:6 }}>
        {["Mo","Tu","We","Th","Fr","Sa","Su"].map(d=><div key={d} style={{ textAlign:"center", color:t.textMuted, fontSize:9, fontWeight:700, letterSpacing:.8, padding:"3px 0" }}>{d}</div>)}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 }}>
        {cells.map((cell,i)=>{
          if(!cell) return <div key={i}/>;
          const{d,data}=cell;
          const bg=data?(data.income>0?t.green:data.income<0?t.red:t.yellow):"transparent";
          const today=new Date().toISOString().slice(0,10);
          const isToday=cell.key===today;
          return (
            <div key={i} title={data?`${data.trades} trades · ${eur(data.income)}`:"No trades"}
              style={{ aspectRatio:"1", borderRadius:radius.sm, background:data?bg+"22":(dark?"#141414":"#f2f2f7"), border:`1px solid ${isToday?t.accent:data?bg+"44":t.borderLight}`, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", cursor:data?"pointer":"default", transition:"all .15s" }}>
              <span style={{ color:data?t.text:t.textMuted, fontSize:10, fontWeight:data?700:400 }}>{d}</span>
              {data&&<span style={{ color:data.income>=0?t.green:t.red, fontSize:8, fontWeight:800, marginTop:1 }}>{eur(data.income)}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── POSITION CALCULATOR ──────────────────────────────────────────────────────
function PositionCalc({ t, dark }) {
  const [balance,setBalance]=useState("10000");
  const [riskPct,setRiskPct]=useState("1");
  const [entry,setEntry]=useState("");
  const [sl,setSl]=useState("");
  const [instType,setInstType]=useState("indices");
  const inp2 = { background:dark?"#1c1c1e":"#f2f2f7", border:`1px solid ${t.border}`, color:t.text, padding:"11px 14px", borderRadius:radius.md, fontSize:font.base, fontFamily:"-apple-system,sans-serif", width:"100%", outline:"none", transition:"border .15s,box-shadow .15s" };
  const calc=useMemo(()=>{ const bal=parseFloat(balance)||0,risk=parseFloat(riskPct)||0,ent=parseFloat(entry)||0,stop=parseFloat(sl)||0; if(!bal||!risk||!ent||!stop||ent===stop)return null; const riskAmt=bal*risk/100,pips=Math.abs(ent-stop),lotSize=instType==="forex"?riskAmt/(pips*10):riskAmt/pips; return{riskAmt:riskAmt.toFixed(2),pips:pips.toFixed(2),lotSize:lotSize.toFixed(2),rr2:(ent+(ent-stop)*2).toFixed(2),rr3:(ent+(ent-stop)*3).toFixed(2)}; },[balance,riskPct,entry,sl,instType]);
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
        <FF label="Account Balance ($)" t={t}><input style={inp2} value={balance} onChange={e=>setBalance(e.target.value)} placeholder="10000"/></FF>
        <FF label="Risk %" t={t}><input style={inp2} value={riskPct} onChange={e=>setRiskPct(e.target.value)} placeholder="1"/></FF>
        <FF label="Entry Price" t={t}><input style={inp2} value={entry} onChange={e=>setEntry(e.target.value)} placeholder="21500"/></FF>
        <FF label="Stop Loss" t={t}><input style={inp2} value={sl} onChange={e=>setSl(e.target.value)} placeholder="21450"/></FF>
      </div>
      <FF label="Instrument" t={t}>
        <div style={{ display:"flex", gap:8, marginBottom:16 }}>
          {["indices","forex"].map(type=>(
            <button key={type} onClick={()=>setInstType(type)} style={{ flex:1, background:instType===type?t.accent+"18":"transparent", border:`1px solid ${instType===type?t.accent+"55":t.border}`, color:instType===type?t.accent:t.textMuted, borderRadius:radius.md, padding:"10px", fontSize:font.md, fontWeight:instType===type?700:400, cursor:"pointer", textTransform:"capitalize", transition:"all .15s" }}>{type}</button>
          ))}
        </div>
      </FF>
      {calc?(
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
          {[["Risk Amount","€"+calc.riskAmt,t.red],["Points/Pips",calc.pips,t.textSub],["Lot / Units",calc.lotSize,t.accent],["TP 2R",calc.rr2,t.green],["TP 3R",calc.rr3,t.green]].map(([l,v,c])=>(
            <div key={l} style={{ background:dark?"#1c1c1e":"#f2f2f7", borderRadius:radius.md, padding:"14px 16px" }}>
              <div style={{ color:t.textMuted, fontSize:font.xs, fontWeight:600, letterSpacing:.8, marginBottom:6 }}>{l}</div>
              <div style={{ color:c, fontSize:font.xl, fontWeight:800, fontVariantNumeric:"tabular-nums" }}>{v}</div>
            </div>
          ))}
        </div>
      ):<div style={{ textAlign:"center", color:t.textMuted, fontSize:font.md, padding:"24px 0" }}>Completează câmpurile pentru calcul</div>}
    </div>
  );
}

// ─── COMBO STATS ──────────────────────────────────────────────────────────────
function ComboStats({ trades, t }) {
  const [f1,setF1]=useState("setup");
  const [f2,setF2]=useState("session");
  const FIELDS={setup:"Setup",session:"Session",market:"Market",trend:"Trend",liquidity:"Liquidity",news:"News",mss:"MSS",dayOfWeek:"Day",order:"Order"};
  const combos=useMemo(()=>{ const map={}; trades.forEach(tr=>{ const k=`${tr[f1]} + ${tr[f2]}`; if(!map[k])map[k]={wins:0,total:0,income:0}; map[k].total++; if(tr.result==="Win")map[k].wins++; map[k].income+=parseFloat(tr.income||0); }); return Object.entries(map).map(([k,v])=>({name:k,...v,wr:v.wins/v.total})).filter(x=>x.total>=3).sort((a,b)=>b.wr-a.wr).slice(0,12); },[trades,f1,f2]);
  const selStyle={background:"none",border:"none",color:t.accent,fontSize:font.md,fontWeight:700,cursor:"pointer",outline:"none",fontFamily:"-apple-system,sans-serif",padding:"2px 4px"};
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:16, flexWrap:"wrap", padding:"10px 14px", background:t.bgAlt, borderRadius:radius.md, border:`1px solid ${t.borderLight}` }}>
        <span style={{ color:t.textMuted, fontSize:font.sm }}>Win rate per</span>
        <select style={selStyle} value={f1} onChange={e=>setF1(e.target.value)}>{Object.entries(FIELDS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
        <span style={{ color:t.textMuted, fontSize:font.sm }}>combined with</span>
        <select style={selStyle} value={f2} onChange={e=>setF2(e.target.value)}>{Object.entries(FIELDS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
        <span style={{ color:t.textMuted, fontSize:font.xs, marginLeft:4 }}>(min 3 trades)</span>
      </div>
      {combos.length===0?<div style={{ color:t.textMuted, fontSize:font.md, textAlign:"center", padding:"24px 0" }}>Insufficient data for this combination</div>:
        combos.map((c,i)=>(
          <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 160px auto auto", gap:12, alignItems:"center", padding:"9px 0", borderBottom:`1px solid ${t.borderLight}` }}>
            <span style={{ color:t.text, fontSize:font.md, fontWeight:500 }}>{c.name}</span>
            <WinBar wins={c.wins} total={c.total} t={t} />
            <span style={{ color:t.textMuted, fontSize:font.sm, minWidth:28, textAlign:"center" }}>{c.total}</span>
            <span style={{ color:c.income>=0?t.green:t.red, fontSize:font.sm, fontWeight:700, minWidth:60, textAlign:"right", whiteSpace:"nowrap" }}>{eur(c.income)}</span>
          </div>
        ))
      }
    </div>
  );
}

// ─── STREAK ───────────────────────────────────────────────────────────────────
function StreakInfo({ trades, t }) {
  const data=useMemo(()=>{ const sorted=[...trades].filter(x=>x.result).sort((a,b)=>new Date(a.open)-new Date(b.open)); if(!sorted.length)return null; let curType=sorted[sorted.length-1]?.result,cur=0,maxW=0,maxL=0,tmpW=0,tmpL=0; sorted.forEach(tr=>{ if(tr.result==="Win"){tmpW++;tmpL=0;}else if(tr.result==="Lose"){tmpL++;tmpW=0;}else{tmpW=0;tmpL=0;} maxW=Math.max(maxW,tmpW);maxL=Math.max(maxL,tmpL); }); for(let i=sorted.length-1;i>=0;i--){if(sorted[i].result===curType)cur++;else break;} return{cur,curType,maxW,maxL}; },[trades]);
  if(!data)return <div style={{ color:t.textMuted, fontSize:font.md }}>No data</div>;
  const sc=data.curType==="Win"?t.green:data.curType==="Lose"?t.red:t.yellow;
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
      {[[`${data.cur} ${data.curType}s`,"Current Streak",sc],[`${data.maxW} Wins`,"Best Win Streak",t.green],[`${data.maxL} Losses`,"Worst Lose Streak",t.red]].map(([val,lbl,col])=>(
        <div key={lbl} style={{ background:col+"10", border:`1px solid ${col}20`, borderRadius:radius.lg, padding:"18px 20px", textAlign:"center" }}>
          <div style={{ color:t.textMuted, fontSize:font.xs, fontWeight:600, letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>{lbl}</div>
          <div style={{ color:col, fontSize:font.xxxl, fontWeight:800, letterSpacing:-.5 }}>{val}</div>
        </div>
      ))}
    </div>
  );
}

// ─── GRADE STATS ──────────────────────────────────────────────────────────────
function GradeStats({ trades, t }) {
  const gc={A:t.green,B:t.accent,C:t.yellow,D:t.red};
  const data=useMemo(()=>GRADES.map(g=>{ const gt=trades.filter(x=>x.grade===g); return{grade:g,total:gt.length,wins:gt.filter(x=>x.result==="Win").length,income:gt.reduce((a,b)=>a+parseFloat(b.income||0),0)}; }).filter(x=>x.total>0),[trades]);
  if(!data.length)return <div style={{ color:t.textMuted, fontSize:font.md }}>No graded trades yet</div>;
  return data.map(g=>(
    <div key={g.grade} style={{ display:"grid", gridTemplateColumns:"32px 1fr auto auto", gap:12, alignItems:"center", padding:"9px 0", borderBottom:`1px solid ${t.borderLight}` }}>
      <div style={{ width:32, height:32, borderRadius:radius.sm, background:gc[g.grade]+"18", border:`1px solid ${gc[g.grade]}30`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:font.base, color:gc[g.grade] }}>{g.grade}</div>
      <WinBar wins={g.wins} total={g.total} t={t} />
      <span style={{ color:t.textMuted, fontSize:font.sm, minWidth:28, textAlign:"center" }}>{g.total}</span>
      <span style={{ color:g.income>=0?t.green:t.red, fontSize:font.sm, fontWeight:700, minWidth:64, textAlign:"right", whiteSpace:"nowrap" }}>{eur(g.income)}</span>
    </div>
  ));
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [authed,setAuthed]=useState(()=>sessionStorage.getItem("et_auth")==="1");
  const [pwInput,setPwInput]=useState("");
  const [pwError,setPwError]=useState(false);
  function handleLogin(){ if(pwInput===APP_PASSWORD){sessionStorage.setItem("et_auth","1");setAuthed(true);}else{setPwError(true);setTimeout(()=>setPwError(false),2000);} }

  const [dark,setDark]=useState(true);
  const T = dark ? DARK : LIGHT;
  const [trades,setTrades]=useState(()=>load("tj2_trades")||[]);
  const [accounts,setAccounts]=useState(()=>load("tj2_accounts")||[]);
  const [custConf,setCustConf]=useState(()=>load("tj2_conf")||[]);
  const [newConf,setNewConf]=useState("");
  const [tab,setTab]=useState("dashboard");
  const [form,setForm]=useState({...emptyTrade});
  const [editId,setEditId]=useState(null);
  const [notif,setNotif]=useState(null);
  const [syncing,setSyncing]=useState(false);
  const [online,setOnline]=useState(true);
  const syncTimer=useRef(null);
  const [fAccount,setFAccount]=useState("All");
  const [fMonth,setFMonth]=useState("All");
  const [fSetup,setFSetup]=useState("All");
  const [fSession,setFSession]=useState("All");
  const [fTrend,setFTrend]=useState("All");
  const [fMarket,setFMarket]=useState("All");
  const [fResult,setFResult]=useState("All");
  const [search,setSearch]=useState("");
  const [logAccount,setLogAccount]=useState("All");
  const [logMonth,setLogMonth]=useState("All");
  const [showAccModal,setShowAccModal]=useState(false);
  const [accForm,setAccForm]=useState({name:"",type:"Phase 1",firm:"5%ers",balance:""});

  useEffect(()=>{ async function loadCloud(){ try{ setSyncing(true); const[{data:tData},{data:aData},{data:cData}]=await Promise.all([supabase.from("trades").select("*").order("id"),supabase.from("accounts").select("*").order("id"),supabase.from("config").select("*").eq("key","custConf")]); if(tData&&tData.length>0){const ts=tData.map(r=>r.data);setTrades(ts);save("tj2_trades",ts);} if(aData&&aData.length>0){const as=aData.map(r=>r.data);setAccounts(as);save("tj2_accounts",as);} if(cData&&cData.length>0){const cc=cData[0].value;setCustConf(cc);save("tj2_conf",cc);} setOnline(true);}catch{setOnline(false);}finally{setSyncing(false);} } loadCloud(); },[]);

  async function syncCloud(t,a,c){ try{ setSyncing(true); if(t!==undefined){await supabase.from("trades").delete().neq("id",0);if(t.length>0)await supabase.from("trades").insert(t.map(x=>({id:x.id,data:x})));} if(a!==undefined){await supabase.from("accounts").delete().neq("id",0);if(a.length>0)await supabase.from("accounts").insert(a.map(x=>({id:x.id,data:x})));} if(c!==undefined)await supabase.from("config").upsert({key:"custConf",value:c}); setOnline(true);}catch{setOnline(false);}finally{setSyncing(false);} }

  useEffect(()=>{ save("tj2_trades",trades); clearTimeout(syncTimer.current); syncTimer.current=setTimeout(()=>syncCloud(trades,undefined,undefined),1500); },[trades]);
  useEffect(()=>{ save("tj2_accounts",accounts); clearTimeout(syncTimer.current); syncTimer.current=setTimeout(()=>syncCloud(undefined,accounts,undefined),1500); },[accounts]);
  useEffect(()=>{ save("tj2_conf",custConf); clearTimeout(syncTimer.current); syncTimer.current=setTimeout(()=>syncCloud(undefined,undefined,custConf),1500); },[custConf]);
  useEffect(()=>{ if(form.open){const d=new Date(form.open);const names=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];const day=names[d.getDay()];if(DAYS.includes(day))setForm(f=>({...f,dayOfWeek:day}));} },[form.open]);

  const notify=(msg,color)=>{setNotif({msg,color});setTimeout(()=>setNotif(null),2800);};
  const allMonths=[...new Set(trades.map(t=>t.month).filter(Boolean))];
  const allConf=[...DEF_CONF,...custConf];

  const filtered=useMemo(()=>trades.filter(tr=>{ if(fAccount!=="All"&&tr.account!==fAccount)return false; if(fMonth!=="All"&&tr.month!==fMonth)return false; if(fSetup!=="All"&&tr.setup!==fSetup)return false; if(fSession!=="All"&&tr.session!==fSession)return false; if(fTrend!=="All"&&tr.trend!==fTrend)return false; if(fMarket!=="All"&&tr.market!==fMarket)return false; if(fResult!=="All"&&tr.result!==fResult)return false; return true; }),[trades,fAccount,fMonth,fSetup,fSession,fTrend,fMarket,fResult]);

  const logFiltered=useMemo(()=>{ let ts=trades; if(logAccount!=="All")ts=ts.filter(t=>t.account===logAccount); if(logMonth!=="All")ts=ts.filter(t=>t.month===logMonth); if(search){const q=search.toLowerCase();ts=ts.filter(t=>[t.market,t.setup,t.session,t.result,t.notes,t.account,t.grade].join(" ").toLowerCase().includes(q));} return ts; },[trades,logAccount,logMonth,search]);

  const stats=useMemo(()=>{ const ts=filtered;if(!ts.length)return null; const wins=ts.filter(x=>x.result==="Win").length,losses=ts.filter(x=>x.result==="Lose").length,bes=ts.filter(x=>x.result==="BE").length; const net=ts.reduce((a,b)=>a+parseFloat(b.income||0),0); const avgRR=(ts.reduce((a,b)=>a+parseFloat(b.rr||0),0)/ts.length).toFixed(2); const gW=ts.filter(x=>parseFloat(x.income)>0).reduce((a,b)=>a+parseFloat(b.income||0),0),gL=Math.abs(ts.filter(x=>parseFloat(x.income)<0).reduce((a,b)=>a+parseFloat(b.income||0),0)); const pf=gL===0?"∞":(gW/gL).toFixed(2); let eq=0; const equity=[...ts].sort((a,b)=>new Date(a.open)-new Date(b.open)).map((x,i)=>{eq+=parseFloat(x.income||0);return{n:i+1,eq:parseFloat(eq.toFixed(2))};}); let peak=0,maxDD=0;equity.forEach(e=>{if(e.eq>peak)peak=e.eq;const dd=peak-e.eq;if(dd>maxDD)maxDD=dd;}); const grp=(key,opts)=>opts.map(name=>{const g=ts.filter(x=>x[key]===name);return{name,total:g.length,wins:g.filter(x=>x.result==="Win").length,income:g.reduce((a,b)=>a+parseFloat(b.income||0),0)};}).filter(x=>x.total>0); const monthMap={};ts.forEach(x=>{if(!x.month)return;if(!monthMap[x.month])monthMap[x.month]={trades:0,wins:0,rr:0,income:0};monthMap[x.month].trades++;if(x.result==="Win")monthMap[x.month].wins++;monthMap[x.month].rr+=parseFloat(x.rr||0);monthMap[x.month].income+=parseFloat(x.income||0);}); const monthly=Object.entries(monthMap).map(([k,v])=>({month:k,trades:v.trades,wins:v.wins,total:v.trades,rr:(v.rr/v.trades).toFixed(2),income:v.income})); return{total:ts.length,wins,losses,bes,net,avgRR,pf,equity,maxDD:maxDD.toFixed(2),sessions:grp("session",SESSIONS),orders:grp("order",["BUY","SELL"]),markets:grp("market",MARKETS),liquidity:grp("liquidity",LIQUIDITY),setups:grp("setup",SETUPS),news:grp("news",NEWS_OPT),trend:grp("trend",TRENDS),mss:grp("mss",MSS_OPT),days:grp("dayOfWeek",DAYS),monthly}; },[filtered]);

  function handleSave(){ if(!form.market||!form.open){notify("Completează Market și Open",T.red);return;} const trade={...form,id:editId||Date.now()}; if(editId)setTrades(p=>p.map(tr=>tr.id===editId?trade:tr));else setTrades(p=>[...p,trade]); setForm({...emptyTrade});setEditId(null);setTab("trades"); notify(editId?"Trade actualizat":"Trade adăugat",T.green); }
  function handleImport(e){ const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=ev=>{try{const d=JSON.parse(ev.target.result);if(d.trades)setTrades(d.trades);if(d.accounts)setAccounts(d.accounts);notify(`${d.trades?.length||0} trades importate`,T.green);}catch{notify("Fișier invalid",T.red);}};r.readAsText(file); }
  function handleExport(){ const blob=new Blob([JSON.stringify({trades,accounts},null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="edgetrack_backup.json";a.click();notify("Export complet",T.green); }
  const resetFilters=()=>{setFAccount("All");setFMonth("All");setFSetup("All");setFSession("All");setFTrend("All");setFMarket("All");setFResult("All");};
  const activeFilters=[fAccount,fMonth,fSetup,fSession,fTrend,fMarket,fResult].filter(x=>x!=="All").length;

  const gc={A:T.green,B:T.accent,C:T.yellow,D:T.red};

  const inp={background:dark?"#1c1c1e":"#f2f2f7",border:`1px solid ${T.border}`,color:T.text,padding:"11px 14px",borderRadius:radius.md,fontSize:font.base,fontFamily:"-apple-system,sans-serif",width:"100%",outline:"none",transition:"border .15s,box-shadow .15s"};

  const TABS=[{id:"dashboard",label:"Dashboard"},{id:"add",label:editId?"Edit Trade":"Add Trade"},{id:"trades",label:"Trade Log"},{id:"tools",label:"Tools"},{id:"accounts",label:"Accounts"}];

  // ── LOGIN SCREEN ────────────────────────────────────────────────────────────
  if(!authed) return (
    <div style={{ minHeight:"100vh", background:"#000", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"-apple-system,sans-serif" }}>
      <div style={{ background:"#111", border:"1px solid #222", borderRadius:28, padding:"52px 44px", width:380, textAlign:"center", boxShadow:"0 32px 80px rgba(0,0,0,0.8)" }}>
        <div style={{ width:56,height:56,borderRadius:16,background:"#f2f2f2",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px" }}>
          <span style={{ color:"#000",fontSize:26,fontWeight:800 }}>E</span>
        </div>
        <div style={{ color:"#f2f2f2",fontSize:24,fontWeight:800,letterSpacing:-.8,marginBottom:6 }}>EdgeTrack</div>
        <div style={{ color:"#555",fontSize:14,marginBottom:36 }}>Personal Trading Journal</div>
        <input type="password" placeholder="Enter password" value={pwInput} onChange={e=>setPwInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()}
          style={{ width:"100%",background:"#1a1a1a",border:`1.5px solid ${pwError?"#ff453a":"#2a2a2a"}`,color:"#f2f2f2",padding:"14px 18px",borderRadius:14,fontSize:16,outline:"none",marginBottom:12,fontFamily:"-apple-system,sans-serif",textAlign:"center",letterSpacing:3,transition:"border .2s" }} />
        {pwError&&<div style={{ color:"#ff453a",fontSize:13,marginBottom:12,fontWeight:500 }}>Incorrect password</div>}
        <button onClick={handleLogin} style={{ width:"100%",background:"#0a84ff",color:"#fff",border:"none",borderRadius:14,padding:"14px",fontSize:15,fontWeight:700,cursor:"pointer",letterSpacing:-.2 }}>Sign In</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:T.bg, color:T.text, fontFamily:"-apple-system,'SF Pro Display',BlinkMacSystemFont,sans-serif", transition:"background .3s,color .3s" }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px;}
        input:focus,select:focus,textarea:focus{border-color:${T.accent}!important;box-shadow:0 0 0 3px ${T.accent}18!important;}
        select option{background:${dark?"#1c1c1e":"#fff"};color:${T.text};}
        .trow:hover td{background:${T.cardHover}!important;}
        ::placeholder{color:${T.textMuted};}
        button,label{font-family:-apple-system,sans-serif;}
        .nav-btn{background:none;border:none;cursor:pointer;padding:8px 18px;border-radius:9px;font-size:13px;font-weight:500;transition:all .15s;white-space:nowrap;}
        .nav-btn:hover{background:${dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.05)"};}
        .nav-btn.active{background:${dark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.08)"};font-weight:700;}
        .filter-sel{background:${dark?"#141414":"#f2f2f7"};border:1px solid ${T.border};color:${T.textSub};padding:7px 12px;border-radius:9px;font-size:12px;font-family:-apple-system,sans-serif;outline:none;cursor:pointer;transition:all .15s;}
        .filter-sel:hover{border-color:${T.textMuted};}
        .filter-sel.active{background:${T.accent}12;border-color:${T.accent}44;color:${T.accent};}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
        .fade-in{animation:fadeIn .25s ease forwards;}
      `}</style>

      {/* NOTIFICATION */}
      {notif&&(
        <div style={{ position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",background:notif.color,color:"#fff",padding:"11px 28px",borderRadius:radius.full,fontSize:13,fontWeight:700,zIndex:9999,boxShadow:"0 8px 32px rgba(0,0,0,0.3)",pointerEvents:"none",whiteSpace:"nowrap",letterSpacing:.2 }}>
          {notif.msg}
        </div>
      )}

      {/* NAVBAR */}
      <nav style={{ background:dark?"rgba(0,0,0,0.88)":"rgba(242,242,247,0.92)", backdropFilter:"saturate(180%) blur(20px)", WebkitBackdropFilter:"saturate(180%) blur(20px)", borderBottom:`1px solid ${T.border}`, padding:"0 24px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100, height:54 }}>
        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
          <div style={{ width:30,height:30,borderRadius:9,background:T.text,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
            <span style={{ color:T.bg,fontSize:15,fontWeight:800,letterSpacing:-.5 }}>E</span>
          </div>
          <span style={{ fontWeight:800,fontSize:16,letterSpacing:-.6,color:T.text }}>EdgeTrack</span>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:2, alignItems:"center" }}>
          {TABS.map(tb=>(
            <button key={tb.id} className={`nav-btn${tab===tb.id?" active":""}`}
              onClick={()=>{ setTab(tb.id); if(tb.id!=="add"){setEditId(null);setForm({...emptyTrade});} }}
              style={{ color:tab===tb.id?T.text:T.textSub }}>
              {tb.label}
            </button>
          ))}
        </div>

        {/* Right controls */}
        <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          {/* Sync indicator */}
          <div style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 10px", background:T.surface, borderRadius:radius.full, border:`1px solid ${T.border}` }}>
            <div style={{ width:6,height:6,borderRadius:99,background:syncing?T.yellow:online?T.green:T.red,transition:"background .3s" }} />
            <span style={{ color:T.textMuted,fontSize:10,fontWeight:600,letterSpacing:.5 }}>{syncing?"SYNCING":online?"SYNCED":"OFFLINE"}</span>
          </div>
          {/* Theme toggle */}
          <button onClick={()=>setDark(!dark)} style={{ width:38,height:22,borderRadius:11,border:"none",cursor:"pointer",background:dark?"#0a84ff":"#e0e0e5",position:"relative",transition:"background .2s",flexShrink:0 }}>
            <div style={{ width:16,height:16,borderRadius:8,background:"#fff",position:"absolute",top:3,left:dark?19:3,transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,0.25)" }} />
          </button>
          <div style={{ width:1,height:16,background:T.border }} />
          <button onClick={handleExport} style={{ background:"none",border:`1px solid ${T.border}`,color:T.textSub,padding:"6px 14px",borderRadius:radius.sm,fontSize:11,fontWeight:600,cursor:"pointer",letterSpacing:.3,transition:"all .15s" }}>Export</button>
          <label style={{ background:T.accent,color:"#fff",padding:"7px 14px",borderRadius:radius.sm,fontSize:11,fontWeight:700,cursor:"pointer",letterSpacing:.3 }}>
            Import<input type="file" accept=".json" style={{ display:"none" }} onChange={handleImport}/>
          </label>
        </div>
      </nav>

      <div style={{ padding:"32px 32px", minHeight:"calc(100vh - 54px)" }}>

        {/* ══ DASHBOARD ══════════════════════════════════════════════════════ */}
        {tab==="dashboard"&&(
          <div className="fade-in">
            {/* Header */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24, flexWrap:"wrap", gap:16 }}>
              <div>
                <h1 style={{ fontSize:font.display,fontWeight:800,letterSpacing:-1.5,color:T.text,lineHeight:1.1 }}>Dashboard</h1>
                <p style={{ color:T.textMuted,fontSize:font.base,marginTop:5,fontWeight:400 }}>
                  {filtered.length} trades{activeFilters>0?` · ${activeFilters} filter${activeFilters>1?"s":""} active`:""}
                </p>
              </div>
              {/* Filters */}
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
                {[["Account",fAccount,setFAccount,["All",...accounts.map(a=>a.name)]],["Month",fMonth,setFMonth,["All",...allMonths]],["Market",fMarket,setFMarket,["All",...MARKETS]],["Session",fSession,setFSession,["All",...SESSIONS]],["Setup",fSetup,setFSetup,["All",...SETUPS]],["Trend",fTrend,setFTrend,["All",...TRENDS]],["Result",fResult,setFResult,["All",...RESULTS]]].map(([label,val,setter,opts])=>(
                  <select key={label} value={val} onChange={e=>setter(e.target.value)} className={`filter-sel${val!=="All"?" active":""}`}>
                    <option value="All">{label}</option>
                    {opts.filter(o=>o!=="All").map(o=><option key={o}>{o}</option>)}
                  </select>
                ))}
                {activeFilters>0&&<button onClick={resetFilters} style={{ background:T.red+"15",border:`1px solid ${T.red}25`,color:T.red,borderRadius:radius.sm,padding:"7px 14px",fontSize:11,fontWeight:700,cursor:"pointer",letterSpacing:.3 }}>✕ Reset</button>}
              </div>
            </div>

            {!stats?(
              <div style={{ textAlign:"center", padding:"120px 0" }}>
                <div style={{ fontSize:64, marginBottom:20 }}>📈</div>
                <div style={{ fontSize:24,fontWeight:800,letterSpacing:-.8,marginBottom:8 }}>No trades yet</div>
                <div style={{ color:T.textMuted,fontSize:font.base,marginBottom:32 }}>Add your first trade to see your statistics</div>
                <button onClick={()=>setTab("add")} style={{ background:T.accent,color:"#fff",border:"none",borderRadius:radius.lg,padding:"14px 32px",fontSize:font.base,fontWeight:700,cursor:"pointer" }}>Add First Trade</button>
              </div>
            ):(<>
              {/* KPIs */}
              <div style={{ display:"flex", gap:12, marginBottom:16, flexWrap:"wrap" }}>
                <KPI label="Net Income" value={eur(stats.net)} color={stats.net>=0?T.green:T.red} t={T} large />
                <KPI label="Win Rate" value={pct(stats.wins,stats.total)} sub={`${stats.wins}W · ${stats.losses}L · ${stats.bes}BE`} t={T} />
                <KPI label="Profit Factor" value={stats.pf} color={T.accent} t={T} />
                <KPI label="Avg R:R" value={stats.avgRR+"R"} color={T.yellow} t={T} />
                <KPI label="Max Drawdown" value={"€"+stats.maxDD} color={T.red} t={T} />
                <KPI label="Trades" value={stats.total} t={T} />
              </div>

              {/* Streak */}
              <div style={{ marginBottom:16 }}>
                <Card t={T} style={{ padding:"22px 24px" }}>
                  <CardHeader title="Streak" t={T} />
                  <div style={{ padding:"16px 0 0" }}><StreakInfo trades={filtered} t={T} /></div>
                </Card>
              </div>

              {/* Equity + Heatmap */}
              <div style={{ display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:16, marginBottom:16 }}>
                <Card t={T}>
                  <CardHeader title="Equity Curve" subtitle={`${stats.total} trades`} t={T} action={<span style={{ color:stats.net>=0?T.green:T.red, fontSize:font.xxl, fontWeight:800, letterSpacing:-1, fontVariantNumeric:"tabular-nums" }}>{eur(stats.net)}</span>} />
                  <div style={{ padding:"16px 24px 20px" }}>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={stats.equity}>
                        <XAxis dataKey="n" stroke="transparent" tick={{ fill:T.textMuted, fontSize:10 }} />
                        <YAxis stroke="transparent" tick={{ fill:T.textMuted, fontSize:10 }} />
                        <Tooltip contentStyle={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, color:T.text, fontSize:12, boxShadow:T.shadowSm }} />
                        <Line type="monotone" dataKey="eq" stroke={stats.net>=0?T.green:T.red} strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card t={T}>
                  <CardHeader title="Calendar" t={T} />
                  <div style={{ padding:"16px 20px 20px" }}><Heatmap trades={filtered} t={T} dark={dark} /></div>
                </Card>
              </div>

              {/* Monthly */}
              <Card t={T} style={{ marginBottom:16 }}>
                <CardHeader title="Monthly Performance" t={T} />
                <div style={{ padding:"0 24px", overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:font.md }}>
                    <thead><tr>{["Month","Trades","Win Rate","Avg RR","Income"].map(h=><th key={h} style={{ color:T.textMuted, fontSize:font.xs, fontWeight:600, letterSpacing:.8, padding:"12px 10px 10px", textAlign:"left", borderBottom:`1px solid ${T.borderLight}`, textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
                    <tbody>{stats.monthly.map((m,i)=>(
                      <tr key={i}>
                        <td style={{ padding:"10px 10px", color:T.text, fontWeight:700, borderBottom:`1px solid ${T.borderLight}` }}>{m.month}</td>
                        <td style={{ padding:"10px 10px", color:T.textSub, borderBottom:`1px solid ${T.borderLight}`, fontVariantNumeric:"tabular-nums" }}>{m.trades}</td>
                        <td style={{ padding:"10px 10px", minWidth:160, borderBottom:`1px solid ${T.borderLight}` }}><WinBar wins={m.wins} total={m.total} t={T} /></td>
                        <td style={{ padding:"10px 10px", color:parseFloat(m.rr)>=0?T.green:T.red, fontWeight:700, borderBottom:`1px solid ${T.borderLight}`, fontVariantNumeric:"tabular-nums" }}>{m.rr}R</td>
                        <td style={{ padding:"10px 10px", color:m.income>=0?T.green:T.red, fontWeight:700, borderBottom:`1px solid ${T.borderLight}`, fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap" }}>{eur(m.income)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                <div style={{ height:20 }} />
              </Card>

              {/* Combo + Grade */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
                <Card t={T}>
                  <CardHeader title="Combination Analysis" subtitle="Win rate by factor pairs" t={T} />
                  <div style={{ padding:"16px 20px 20px" }}><ComboStats trades={filtered} t={T} /></div>
                </Card>
                <Card t={T}>
                  <CardHeader title="Execution Grade" subtitle="Trade quality analysis" t={T} />
                  <div style={{ padding:"16px 20px 20px" }}><GradeStats trades={filtered} t={T} /></div>
                </Card>
              </div>

              {/* Stats Grid */}
              {[
                [{title:"Sessions",data:stats.sessions},{title:"Order",data:stats.orders}],
                [{title:"Markets",data:stats.markets},{title:"Liquidity",data:stats.liquidity}],
                [{title:"Setups",data:stats.setups},{title:"News",data:stats.news}],
                [{title:"Trend",data:stats.trend},{title:"MSS",data:stats.mss},{title:"Days of Week",data:stats.days}],
              ].map((row,ri)=>(
                <div key={ri} style={{ display:"grid", gridTemplateColumns:`repeat(${row.length},1fr)`, gap:16, marginBottom:16 }}>
                  {row.map(({title,data})=>(
                    <Card key={title} t={T}>
                      <CardHeader title={title} t={T} />
                      <div style={{ padding:"10px 20px 16px" }}>
                        {!data.length?<div style={{ color:T.textMuted,fontSize:font.md,padding:"8px 0" }}>No data</div>:data.map((r,i)=><StatRow key={i} {...r} t={T} />)}
                      </div>
                    </Card>
                  ))}
                </div>
              ))}
            </>)}
          </div>
        )}

        {/* ══ ADD TRADE ══════════════════════════════════════════════════════ */}
        {tab==="add"&&(
          <div className="fade-in" style={{ maxWidth:880 }}>
            <h1 style={{ fontSize:font.display, fontWeight:800, letterSpacing:-1.5, marginBottom:28, color:T.text }}>{editId?"Edit Trade":"New Trade"}</h1>

            {/* Checklist */}
            <Card t={T} style={{ padding:24, marginBottom:14 }}>
              <SectionLabel t={T}>Pre-Trade Checklist</SectionLabel>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {CHECKLIST.map(item=>{
                  const checked=(form.checklist||[]).includes(item);
                  return (
                    <button key={item} onClick={()=>setForm(f=>({...f,checklist:checked?f.checklist.filter(x=>x!==item):[...(f.checklist||[]),item]}))}
                      style={{ display:"flex",alignItems:"center",gap:10,background:checked?T.green+"10":"transparent",border:`1px solid ${checked?T.green+"30":T.border}`,borderRadius:radius.md,padding:"11px 14px",cursor:"pointer",textAlign:"left",transition:"all .15s" }}>
                      <div style={{ width:18,height:18,borderRadius:5,border:`2px solid ${checked?T.green:T.textMuted}`,background:checked?T.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s" }}>
                        {checked&&<span style={{ color:"#fff",fontSize:10,fontWeight:900,lineHeight:1 }}>✓</span>}
                      </div>
                      <span style={{ color:checked?T.green:T.textSub,fontSize:font.md,fontWeight:checked?600:400,transition:"color .15s" }}>{item}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop:12,display:"flex",alignItems:"center",gap:8 }}>
                <div style={{ flex:1,height:3,background:T.border,borderRadius:99,overflow:"hidden" }}>
                  <div style={{ width:`${(form.checklist||[]).length/CHECKLIST.length*100}%`,height:"100%",background:(form.checklist||[]).length===CHECKLIST.length?T.green:T.yellow,borderRadius:99,transition:"width .4s" }} />
                </div>
                <span style={{ color:(form.checklist||[]).length===CHECKLIST.length?T.green:T.yellow, fontSize:font.sm, fontWeight:700 }}>{(form.checklist||[]).length}/{CHECKLIST.length}</span>
              </div>
            </Card>

            {/* Form sections */}
            {[
              {title:"Trade Info",grid:"1fr 1fr 1fr",fields:[["Account","account","select",accounts.map(a=>a.name)],["Market","market","select",MARKETS],["Order","order","select",["BUY","SELL"]]]},
              {title:"Timing",grid:"1fr 1fr 1fr",fields:[["Month","month","text",null,"Mar 26"],["Open","open","datetime-local"],["Close","close","datetime-local"]]},
              {title:"Context",grid:"1fr 1fr 1fr 1fr",fields:[["Session","session","select",SESSIONS],["News","news","select",NEWS_OPT],["Liquidity","liquidity","select",LIQUIDITY],["Day of Week","dayOfWeek","select",DAYS]]},
              {title:"Analysis",grid:"1fr 1fr 1fr",fields:[["Trend","trend","select",TRENDS],["MSS","mss","select",MSS_OPT],["Setup","setup","select",SETUPS]]},
            ].map(({title,grid,fields})=>(
              <Card key={title} t={T} style={{ padding:24, marginBottom:14 }}>
                <SectionLabel t={T}>{title}</SectionLabel>
                <div style={{ display:"grid", gridTemplateColumns:grid, gap:14 }}>
                  {fields.map(([label,key,type,options,placeholder])=>(
                    <FF key={key} label={label} t={T}>
                      {type==="select"?(
                        <select style={inp} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}>
                          {key==="account"&&<option value="">— Select account —</option>}
                          {(options||[]).map(o=><option key={o}>{o}</option>)}
                        </select>
                      ):(
                        <input type={type} style={inp} placeholder={placeholder||""} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} />
                      )}
                    </FF>
                  ))}
                </div>
              </Card>
            ))}

            {/* Result + Grade */}
            <Card t={T} style={{ padding:24, marginBottom:14 }}>
              <SectionLabel t={T}>Result & Execution Grade</SectionLabel>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr", gap:14, marginBottom:20 }}>
                <FF label="Result" t={T}><select style={inp} value={form.result} onChange={e=>setForm(f=>({...f,result:e.target.value}))}>{RESULTS.map(r=><option key={r}>{r}</option>)}</select></FF>
                <FF label="After BE" t={T}><select style={inp} value={form.afterBE} onChange={e=>setForm(f=>({...f,afterBE:e.target.value}))}>{AFTER_BE.map(a=><option key={a}>{a}</option>)}</select></FF>
                <FF label="RR" t={T}><input style={inp} placeholder="2 sau -1" value={form.rr} onChange={e=>setForm(f=>({...f,rr:e.target.value}))} /></FF>
                <FF label="Risk %" t={T}><input style={inp} placeholder="1" value={form.risk} onChange={e=>setForm(f=>({...f,risk:e.target.value}))} /></FF>
                <FF label="Income (€)" t={T}><input style={inp} placeholder="+200" value={form.income} onChange={e=>setForm(f=>({...f,income:e.target.value}))} /></FF>
              </div>
              <div style={{ display:"flex", gap:10 }}>
                {GRADES.map(g=>(
                  <button key={g} onClick={()=>setForm(f=>({...f,grade:g}))}
                    style={{ flex:1, background:form.grade===g?gc[g]+"18":"transparent", border:`2px solid ${form.grade===g?gc[g]:T.border}`, color:form.grade===g?gc[g]:T.textMuted, borderRadius:radius.md, padding:"13px 0", fontSize:font.xl, fontWeight:800, cursor:"pointer", transition:"all .15s" }}>
                    {g}
                  </button>
                ))}
              </div>
              <div style={{ color:T.textMuted, fontSize:font.sm, marginTop:10, fontStyle:"italic" }}>
                {{"A":"Perfect execution — all rules followed","B":"Good — minor deviations from plan","C":"Mediocre — forced the trade","D":"Poor — rules ignored"}[form.grade]}
              </div>
            </Card>

            {/* Confluences */}
            <Card t={T} style={{ padding:24, marginBottom:14 }}>
              <SectionLabel t={T}>Confluences</SectionLabel>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:16 }}>
                {allConf.map(c=>{
                  const sel=(form.confluences||[]).includes(c);
                  return (
                    <button key={c} onClick={()=>setForm(f=>({...f,confluences:sel?f.confluences.filter(x=>x!==c):[...(f.confluences||[]),c]}))}
                      style={{ background:sel?T.accent+"18":"transparent", border:`1px solid ${sel?T.accent+"55":T.border}`, color:sel?T.accent:T.textSub, padding:"8px 16px", borderRadius:radius.full, fontSize:font.sm, fontWeight:sel?700:400, cursor:"pointer", transition:"all .15s" }}>
                      {c}
                    </button>
                  );
                })}
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <input style={{ ...inp, flex:1 }} placeholder="Add custom confluence..." value={newConf} onChange={e=>setNewConf(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&newConf.trim()){setCustConf(p=>[...p,newConf.trim()]);setNewConf("");}}} />
                <button onClick={()=>{if(newConf.trim()){setCustConf(p=>[...p,newConf.trim()]);setNewConf("");}}} style={{ background:T.accent,color:"#fff",border:"none",borderRadius:radius.md,padding:"0 20px",fontSize:font.md,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap" }}>Add</button>
              </div>
            </Card>

            {/* Screenshot */}
            <Card t={T} style={{ padding:24, marginBottom:14 }}>
              <SectionLabel t={T}>Chart Screenshot</SectionLabel>
              {form.screenshot?(
                <div>
                  <img src={form.screenshot} alt="chart" style={{ maxWidth:"100%", maxHeight:280, borderRadius:radius.lg, border:`1px solid ${T.border}`, marginBottom:12, display:"block" }} />
                  <button onClick={()=>setForm(f=>({...f,screenshot:""}))} style={{ background:T.red+"15",border:`1px solid ${T.red}25`,color:T.red,borderRadius:radius.sm,padding:"8px 18px",fontSize:font.md,fontWeight:600,cursor:"pointer" }}>Remove Screenshot</button>
                </div>
              ):(
                <label style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",border:`1.5px dashed ${T.border}`,borderRadius:radius.lg,padding:"36px 20px",cursor:"pointer",gap:10,transition:"border .15s" }}>
                  <span style={{ fontSize:36 }}>📸</span>
                  <span style={{ color:T.textSub,fontSize:font.base,fontWeight:500 }}>Click to attach screenshot</span>
                  <span style={{ color:T.textMuted,fontSize:font.sm }}>PNG, JPG, WebP supported</span>
                  <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=ev=>setForm(f=>({...f,screenshot:ev.target.result}));r.readAsDataURL(file);}} />
                </label>
              )}
            </Card>

            {/* Notes */}
            <Card t={T} style={{ padding:24, marginBottom:24 }}>
              <SectionLabel t={T}>Notes</SectionLabel>
              <textarea style={{ ...inp, resize:"vertical", lineHeight:1.6 }} rows={4} placeholder="Observations, psychology, what could be improved..." value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} />
            </Card>

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={handleSave} style={{ background:T.accent,color:"#fff",border:"none",borderRadius:radius.md,padding:"13px 32px",fontSize:font.base,fontWeight:700,cursor:"pointer",letterSpacing:-.2 }}>{editId?"Save Changes":"Add Trade"}</button>
              <button onClick={()=>{setForm({...emptyTrade});setEditId(null);}} style={{ background:dark?"#1c1c1e":"#e8e8ed",color:T.text,border:"none",borderRadius:radius.md,padding:"13px 20px",fontSize:font.base,cursor:"pointer" }}>Reset</button>
            </div>
          </div>
        )}

        {/* ══ TRADE LOG ══════════════════════════════════════════════════════ */}
        {tab==="trades"&&(
          <div className="fade-in">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
              <div>
                <h1 style={{ fontSize:font.display, fontWeight:800, letterSpacing:-1.5, color:T.text }}>Trade Log</h1>
                <p style={{ color:T.textMuted, fontSize:font.base, marginTop:5 }}>{logFiltered.length} trades</p>
              </div>
              <button onClick={()=>{setTab("add");setEditId(null);setForm({...emptyTrade});}} style={{ background:T.accent,color:"#fff",border:"none",borderRadius:radius.md,padding:"11px 24px",fontSize:font.base,fontWeight:700,cursor:"pointer" }}>+ Add Trade</button>
            </div>
            <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
              <input style={{ ...inp, maxWidth:300 }} placeholder="Search market, setup, notes..." value={search} onChange={e=>setSearch(e.target.value)} />
              <select className="filter-sel" value={logAccount} onChange={e=>setLogAccount(e.target.value)}>
                <option value="All">All Accounts</option>{accounts.map(a=><option key={a.id} value={a.name}>{a.name}</option>)}
              </select>
              <select className="filter-sel" value={logMonth} onChange={e=>setLogMonth(e.target.value)}>
                <option value="All">All Months</option>{allMonths.map(m=><option key={m}>{m}</option>)}
              </select>
            </div>
            <Card t={T} style={{ overflow:"hidden" }}>
              {logFiltered.length===0?(
                <div style={{ textAlign:"center", padding:"60px 0", color:T.textMuted, fontSize:font.base }}>No trades found</div>
              ):(
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:font.sm }}>
                    <thead>
                      <tr style={{ background:dark?"#0f0f0f":"#f8f8fa" }}>
                        {["#","Account","Market","Order","Session","Open","News","Liq","Trend","MSS","Setup","Result","After BE","RR","Risk","Income","Grade",""].map(h=>(
                          <th key={h} style={{ color:T.textMuted, fontSize:9, fontWeight:700, letterSpacing:1, padding:"12px 12px", textAlign:"left", whiteSpace:"nowrap", textTransform:"uppercase", borderBottom:`1px solid ${T.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {logFiltered.slice().reverse().map((tr,i)=>{
                        const rc=tr.result==="Win"?T.green:tr.result==="Lose"?T.red:T.yellow;
                        const gradeCol=gc[tr.grade||"A"];
                        const td=(extra={})=>({padding:"10px 12px",borderBottom:`1px solid ${T.borderLight}`,verticalAlign:"middle",...extra});
                        return (
                          <tr key={tr.id} className="trow">
                            <td style={td({color:T.textMuted,fontVariantNumeric:"tabular-nums"})}>{logFiltered.length-i}</td>
                            <td style={td({color:T.textSub,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"})}>{tr.account}</td>
                            <td style={td({color:T.text,fontWeight:700})}>{tr.market}</td>
                            <td style={td()}><Pill label={tr.order} color={tr.order==="BUY"?T.green:T.red} size="xs"/></td>
                            <td style={td({color:T.textMuted,whiteSpace:"nowrap"})}>{tr.session?.split(" ")[0]}</td>
                            <td style={td({color:T.textMuted,whiteSpace:"nowrap",fontVariantNumeric:"tabular-nums"})}>{tr.open?.replace("T"," ")}</td>
                            <td style={td()}><Pill label={tr.news} color={tr.news==="Safe"?T.green:T.yellow} size="xs"/></td>
                            <td style={td({color:T.textSub})}>{tr.liquidity}</td>
                            <td style={td()}><Pill label={tr.trend} color={tr.trend==="Together"?T.green:tr.trend==="Against"?T.red:T.textMuted} size="xs"/></td>
                            <td style={td({color:T.textSub})}>{tr.mss}</td>
                            <td style={td()}><Pill label={tr.setup} color={T.accent} size="xs"/></td>
                            <td style={td()}><Pill label={tr.result} color={rc} size="xs"/></td>
                            <td style={td({color:T.textMuted})}>{tr.afterBE}</td>
                            <td style={td({color:parseFloat(tr.rr)>=0?T.green:T.red,fontWeight:700,fontVariantNumeric:"tabular-nums"})}>{tr.rr}R</td>
                            <td style={td({color:T.textMuted})}>{tr.risk}%</td>
                            <td style={td({color:parseFloat(tr.income)>=0?T.green:T.red,fontWeight:700,fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"})}>{tr.income?eur(parseFloat(tr.income)):"—"}</td>
                            <td style={td()}>
                              {tr.grade&&<span style={{ background:gradeCol+"18",color:gradeCol,border:`1px solid ${gradeCol}25`,borderRadius:6,padding:"3px 9px",fontSize:11,fontWeight:800 }}>{tr.grade}</span>}
                            </td>
                            <td style={td({whiteSpace:"nowrap"})}>
                              {tr.screenshot&&<button title="View screenshot" onClick={()=>window.open(tr.screenshot)} style={{ background:"none",border:"none",cursor:"pointer",marginRight:6,fontSize:14,opacity:.7 }}>🖼</button>}
                              <button onClick={()=>{setForm({...tr});setEditId(tr.id);setTab("add");}} style={{ background:dark?"#1c1c1e":"#e8e8ed",border:"none",color:T.textSub,borderRadius:6,padding:"5px 11px",fontSize:11,fontWeight:600,cursor:"pointer",marginRight:5,transition:"all .15s" }}>Edit</button>
                              <button onClick={()=>{if(confirm("Delete this trade?")){setTrades(p=>p.filter(x=>x.id!==tr.id));notify("Trade deleted",T.red);}}} style={{ background:T.red+"12",border:`1px solid ${T.red}20`,color:T.red,borderRadius:6,padding:"5px 11px",fontSize:11,fontWeight:600,cursor:"pointer",transition:"all .15s" }}>×</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ══ TOOLS ══════════════════════════════════════════════════════════ */}
        {tab==="tools"&&(
          <div className="fade-in">
            <h1 style={{ fontSize:font.display, fontWeight:800, letterSpacing:-1.5, marginBottom:28, color:T.text }}>Tools</h1>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, alignItems:"start" }}>
              <Card t={T}>
                <CardHeader title="Position Size Calculator" subtitle="Risk-based lot size calculator" t={T} />
                <div style={{ padding:"20px 24px" }}><PositionCalc t={T} dark={dark}/></div>
              </Card>
              <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
                <Card t={T}>
                  <CardHeader title="Combination Analysis" subtitle="Win rate by factor pairs" t={T} />
                  <div style={{ padding:"16px 20px 20px" }}><ComboStats trades={trades} t={T}/></div>
                </Card>
                <Card t={T}>
                  <CardHeader title="Streak Tracker" t={T} />
                  <div style={{ padding:"16px 20px 20px" }}><StreakInfo trades={trades} t={T}/></div>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ══ ACCOUNTS ═══════════════════════════════════════════════════════ */}
        {tab==="accounts"&&(
          <div className="fade-in">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:28 }}>
              <div>
                <h1 style={{ fontSize:font.display, fontWeight:800, letterSpacing:-1.5, color:T.text }}>Accounts</h1>
                <p style={{ color:T.textMuted, fontSize:font.base, marginTop:5 }}>{accounts.length} accounts</p>
              </div>
              <button onClick={()=>setShowAccModal(true)} style={{ background:T.accent,color:"#fff",border:"none",borderRadius:radius.md,padding:"11px 24px",fontSize:font.base,fontWeight:700,cursor:"pointer" }}>+ Add Account</button>
            </div>

            {showAccModal&&(
              <Card t={T} style={{ padding:28, maxWidth:500, marginBottom:24, boxShadow:T.shadow }}>
                <div style={{ fontWeight:800, fontSize:font.xl, color:T.text, marginBottom:22, letterSpacing:-.4 }}>New Account</div>
                <div style={{ display:"grid", gap:16 }}>
                  <FF label="Account Name" t={T}><input style={inp} placeholder="10K 5%ers Phase 1" value={accForm.name} onChange={e=>setAccForm(f=>({...f,name:e.target.value}))} /></FF>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
                    <FF label="Type" t={T}><select style={inp} value={accForm.type} onChange={e=>setAccForm(f=>({...f,type:e.target.value}))}>{ACC_TYPES.map(x=><option key={x}>{x}</option>)}</select></FF>
                    <FF label="Firm" t={T}><select style={inp} value={accForm.firm} onChange={e=>setAccForm(f=>({...f,firm:e.target.value}))}>{FIRMS.map(x=><option key={x}>{x}</option>)}</select></FF>
                    <FF label="Balance $" t={T}><input style={inp} placeholder="10000" value={accForm.balance} onChange={e=>setAccForm(f=>({...f,balance:e.target.value}))} /></FF>
                  </div>
                  <div style={{ display:"flex", gap:10, marginTop:4 }}>
                    <button onClick={()=>{if(!accForm.name)return;setAccounts(p=>[...p,{...accForm,id:Date.now()}]);setAccForm({name:"",type:"Phase 1",firm:"5%ers",balance:""});setShowAccModal(false);notify("Account added",T.green);}} style={{ background:T.accent,color:"#fff",border:"none",borderRadius:radius.md,padding:"12px 28px",fontSize:font.base,fontWeight:700,cursor:"pointer" }}>Save</button>
                    <button onClick={()=>setShowAccModal(false)} style={{ background:dark?"#1c1c1e":"#e8e8ed",color:T.text,border:"none",borderRadius:radius.md,padding:"12px 20px",fontSize:font.base,cursor:"pointer" }}>Cancel</button>
                  </div>
                </div>
              </Card>
            )}

            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:16 }}>
              {accounts.map(a=>{
                const at=trades.filter(tr=>tr.account===a.name);
                const aw=at.filter(tr=>tr.result==="Win").length;
                const ai=at.reduce((s,tr)=>s+parseFloat(tr.income||0),0);
                const tc=a.type==="Live"?T.red:a.type==="Phase 2"?T.yellow:T.green;
                return (
                  <Card key={a.id} t={T} hoverable>
                    <div style={{ padding:22 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:18 }}>
                        <div>
                          <div style={{ fontWeight:800, fontSize:font.lg, color:T.text, letterSpacing:-.3, marginBottom:4 }}>{a.name}</div>
                          <div style={{ color:T.textMuted, fontSize:font.sm }}>Initial balance: ${parseFloat(a.balance||0).toLocaleString()}</div>
                        </div>
                        <div style={{ display:"flex", gap:6 }}>
                          <Pill label={a.type} color={tc} size="xs"/>
                          <Pill label={a.firm} color={T.accent} size="xs"/>
                        </div>
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:16 }}>
                        {[["Trades",at.length,T.text],["Win Rate",pct(aw,at.length),T.accent],["Income",eur(ai),ai>=0?T.green:T.red]].map(([l,v,c])=>(
                          <div key={l} style={{ background:dark?"#1a1a1a":"#f5f5f7", borderRadius:radius.md, padding:"12px 14px" }}>
                            <div style={{ color:T.textMuted, fontSize:9, fontWeight:700, letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>{l}</div>
                            <div style={{ color:c, fontSize:font.xl, fontWeight:800, fontVariantNumeric:"tabular-nums" }}>{v}</div>
                          </div>
                        ))}
                      </div>
                      {at.length>0&&<WinBar wins={aw} total={at.length} t={T} />}
                      <button onClick={()=>{if(confirm("Remove this account?"))setAccounts(p=>p.filter(x=>x.id!==a.id));}} style={{ marginTop:16, background:"none", border:`1px solid ${T.border}`, color:T.textMuted, borderRadius:radius.sm, padding:"8px 0", fontSize:font.sm, cursor:"pointer", width:"100%", transition:"all .15s" }}>
                        Remove Account
                      </button>
                    </div>
                  </Card>
                );
              })}
              {accounts.length===0&&<div style={{ color:T.textMuted, fontSize:font.base, padding:"40px 0" }}>No accounts yet. Add your first account above.</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
