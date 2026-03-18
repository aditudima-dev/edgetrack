import { useState, useMemo, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// ─── THEMES ───────────────────────────────────────────────────────────────────
const DARK = {
  bg:"#000", surface:"#111", card:"#161616", border:"#2a2a2a", borderLight:"#1f1f1f",
  text:"#f5f5f7", textSub:"#a1a1a6", textMuted:"#6e6e73", surfaceHover:"#1c1c1e",
  accent:"#0a84ff", green:"#30d158", red:"#ff453a", yellow:"#ffd60a", purple:"#bf5af2",
  shadow:"0 20px 60px rgba(0,0,0,0.6)", shadowSm:"0 2px 20px rgba(0,0,0,0.3)",
};
const LIGHT = {
  bg:"#f5f5f7", surface:"#fff", card:"#fff", border:"#d2d2d7", borderLight:"#e8e8ed",
  text:"#1d1d1f", textSub:"#6e6e73", textMuted:"#aeaeb2", surfaceHover:"#f0f0f5",
  accent:"#0071e3", green:"#34c759", red:"#ff3b30", yellow:"#ff9500", purple:"#af52de",
  shadow:"0 20px 60px rgba(0,0,0,0.08)", shadowSm:"0 2px 20px rgba(0,0,0,0.06)",
};

// ─── CONSTANTS ─────────────────────────────────────────────────────────────────
const MARKETS = ["DE40","UK100","US100","US30","GBP-USD","EUR-USD"];
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
const CHECKLIST_ITEMS = ["HTF bias confirmed","Session aligns","Liquidity taken","Setup visible","Risk defined","News checked"];

// ─── HELPERS ───────────────────────────────────────────────────────────────────
const load  = k => { try { return JSON.parse(localStorage.getItem(k)||"null"); } catch { return null; } };
const save  = (k,v) => localStorage.setItem(k, JSON.stringify(v));
const pct   = (n,d) => d===0 ? "0%" : (n/d*100).toFixed(1)+"%";
const eur   = v => (Number(v)>=0?"+":"")+"€"+Math.abs(Number(v)).toFixed(0);
const emptyTrade = { id:null, account:"", market:"DE40", order:"BUY", month:"", session:"Day 12-16", open:"", close:"", news:"Safe", liquidity:"Locala", trend:"Together", mss:"Normal", setup:"OG", dayOfWeek:"Monday", result:"Win", afterBE:"No BE", rr:"", risk:"1", income:"", notes:"", screenshot:"", confluences:[], grade:"A", checklist:[] };

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────
const Pill = ({ label, color }) => (
  <span style={{ background:color+"18", color, padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:600, whiteSpace:"nowrap" }}>{label}</span>
);
const FF = ({ label, children, t }) => (
  <div>
    <label style={{ color:t.textMuted, fontSize:11, fontWeight:500, display:"block", marginBottom:6 }}>{label}</label>
    {children}
  </div>
);
const SCard = ({ title, children, t, action }) => (
  <div style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:20, overflow:"hidden", boxShadow:t.shadowSm }}>
    <div style={{ padding:"16px 20px 12px", borderBottom:`1px solid ${t.borderLight}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
      <span style={{ fontWeight:600, fontSize:15, color:t.text }}>{title}</span>
      {action}
    </div>
    <div style={{ padding:"14px 20px" }}>{children}</div>
  </div>
);
function WinBar({ wins, total, t, size=5 }) {
  const w = total ? wins/total*100 : 0;
  const col = w>=50?t.green:w>=35?t.yellow:t.red;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
      <div style={{ flex:1, height:size, background:t.border, borderRadius:99, overflow:"hidden" }}>
        <div style={{ width:w+"%", height:"100%", background:col, borderRadius:99, transition:"width .5s" }} />
      </div>
      <span style={{ color:col, fontSize:12, fontWeight:600, minWidth:44, textAlign:"right" }}>{pct(wins,total)}</span>
    </div>
  );
}
function KPI({ label, value, sub, color, t }) {
  return (
    <div style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:18, padding:"20px 22px", flex:1, minWidth:130, boxShadow:t.shadowSm }}>
      <div style={{ color:t.textMuted, fontSize:11, fontWeight:500, marginBottom:8 }}>{label}</div>
      <div style={{ color:color||t.text, fontSize:26, fontWeight:700, letterSpacing:-1, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ color:t.textMuted, fontSize:12, marginTop:6 }}>{sub}</div>}
    </div>
  );
}
function StatRow({ name, wins, total, income, t }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"120px 1fr 36px auto", gap:10, alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${t.borderLight}` }}>
      <span style={{ color:t.text, fontSize:13, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{name}</span>
      <WinBar wins={wins} total={total} t={t} />
      <span style={{ color:t.textMuted, fontSize:12, textAlign:"center" }}>{total}</span>
      <span style={{ color:income>=0?t.green:t.red, fontSize:12, fontWeight:600, textAlign:"right", whiteSpace:"nowrap" }}>{eur(income)}</span>
    </div>
  );
}

// ─── HEATMAP ──────────────────────────────────────────────────────────────────
function Heatmap({ trades, t, dark }) {
  const [viewMonth, setViewMonth] = useState(() => { const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`; });
  const [y,m] = viewMonth.split("-").map(Number);
  const firstDay = new Date(y,m-1,1).getDay();
  const daysInMonth = new Date(y,m,0).getDate();
  const offset = firstDay===0?6:firstDay-1;

  const dayMap = useMemo(() => {
    const map = {};
    trades.forEach(tr => {
      if (!tr.open) return;
      const d = tr.open.slice(0,10);
      if (!map[d]) map[d] = { income:0, trades:0, wins:0 };
      map[d].income += parseFloat(tr.income||0);
      map[d].trades++;
      if (tr.result==="Win") map[d].wins++;
    });
    return map;
  }, [trades]);

  const cells = [];
  for (let i=0; i<offset; i++) cells.push(null);
  for (let d=1; d<=daysInMonth; d++) {
    const key = `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    cells.push({ d, key, data: dayMap[key]||null });
  }

  const prev = () => { const dt=new Date(y,m-2,1); setViewMonth(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`); };
  const next = () => { const dt=new Date(y,m,1); setViewMonth(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`); };

  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <button onClick={prev} style={{ background:"none", border:`1px solid ${t.border}`, color:t.textMuted, borderRadius:8, padding:"5px 12px", cursor:"pointer" }}>‹</button>
        <span style={{ color:t.text, fontWeight:600, fontSize:15 }}>{monthNames[m-1]} {y}</span>
        <button onClick={next} style={{ background:"none", border:`1px solid ${t.border}`, color:t.textMuted, borderRadius:8, padding:"5px 12px", cursor:"pointer" }}>›</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4, marginBottom:6 }}>
        {["Mo","Tu","We","Th","Fr","Sa","Su"].map(d=>(
          <div key={d} style={{ textAlign:"center", color:t.textMuted, fontSize:10, fontWeight:600, padding:"4px 0" }}>{d}</div>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4 }}>
        {cells.map((cell,i) => {
          if (!cell) return <div key={i} />;
          const { d, data } = cell;
          const bg = data ? (data.income>0 ? t.green : data.income<0 ? t.red : t.yellow) : "transparent";
          const opacity = data ? Math.min(0.15 + Math.abs(data.income)/500*0.6, 0.85) : 0;
          const today = new Date().toISOString().slice(0,10);
          const isToday = cell.key === today;
          return (
            <div key={i} title={data?`${data.trades} trades · ${eur(data.income)}`:"No trades"}
              style={{ aspectRatio:"1", borderRadius:8, background:data?bg+"":( dark?"#1c1c1e":"#f2f2f7"), opacity:data?1:0.4, border:`1px solid ${isToday?t.accent:t.border}`, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", cursor:data?"pointer":"default", position:"relative", overflow:"hidden" }}>
              {data && <div style={{ position:"absolute", inset:0, background:bg, opacity }} />}
              <span style={{ position:"relative", color:data?t.text:t.textMuted, fontSize:11, fontWeight:data?600:400 }}>{d}</span>
              {data && <span style={{ position:"relative", color:data.income>=0?t.green:t.red, fontSize:9, fontWeight:700 }}>{eur(data.income)}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── POSITION SIZE CALCULATOR ─────────────────────────────────────────────────
function PositionCalc({ t, dark }) {
  const [balance, setBalance] = useState("10000");
  const [riskPct, setRiskPct] = useState("1");
  const [entry, setEntry] = useState("");
  const [sl, setSl] = useState("");
  const [instType, setInstType] = useState("indices");

  const calc = useMemo(() => {
    const bal = parseFloat(balance)||0;
    const risk = parseFloat(riskPct)||0;
    const ent = parseFloat(entry)||0;
    const stop = parseFloat(sl)||0;
    if (!bal||!risk||!ent||!stop||ent===stop) return null;
    const riskAmt = bal * risk / 100;
    const pips = Math.abs(ent - stop);
    const lotSize = instType==="forex" ? riskAmt/(pips*10) : riskAmt/pips;
    const rr2 = ent + (ent-stop)*2;
    const rr3 = ent + (ent-stop)*3;
    return { riskAmt: riskAmt.toFixed(2), pips: pips.toFixed(2), lotSize: lotSize.toFixed(2), rr2: rr2.toFixed(2), rr3: rr3.toFixed(2) };
  }, [balance, riskPct, entry, sl, instType]);

  const inp2 = { background:dark?"#1c1c1e":"#f2f2f7", border:`1px solid ${t.border}`, color:t.text, padding:"10px 12px", borderRadius:10, fontSize:14, fontFamily:"-apple-system,sans-serif", width:"100%", outline:"none" };

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
        <FF label="Account Balance ($)" t={t}><input style={inp2} value={balance} onChange={e=>setBalance(e.target.value)} placeholder="10000" /></FF>
        <FF label="Risk %" t={t}><input style={inp2} value={riskPct} onChange={e=>setRiskPct(e.target.value)} placeholder="1" /></FF>
        <FF label="Entry Price" t={t}><input style={inp2} value={entry} onChange={e=>setEntry(e.target.value)} placeholder="21500" /></FF>
        <FF label="Stop Loss Price" t={t}><input style={inp2} value={sl} onChange={e=>setSl(e.target.value)} placeholder="21450" /></FF>
      </div>
      <FF label="Instrument Type" t={t}>
        <div style={{ display:"flex", gap:8, marginBottom:16 }}>
          {["indices","forex"].map(type=>(
            <button key={type} onClick={()=>setInstType(type)}
              style={{ flex:1, background:instType===type?t.accent+"22":( dark?"#1c1c1e":"#f2f2f7"), border:`1px solid ${instType===type?t.accent+"66":t.border}`, color:instType===type?t.accent:t.textMuted, borderRadius:10, padding:"9px", fontSize:13, fontWeight:instType===type?600:400, cursor:"pointer", textTransform:"capitalize" }}>
              {type}
            </button>
          ))}
        </div>
      </FF>
      {calc ? (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
          {[["Risk Amount","€"+calc.riskAmt,t.red],["Points/Pips",calc.pips,t.textSub],["Lot / Units",calc.lotSize,t.accent],["TP 2R",calc.rr2,t.green],["TP 3R",calc.rr3,t.green]].map(([l,v,c])=>(
            <div key={l} style={{ background:dark?"#1c1c1e":"#f2f2f7", borderRadius:12, padding:"12px 14px" }}>
              <div style={{ color:t.textMuted, fontSize:10, fontWeight:500, marginBottom:4 }}>{l}</div>
              <div style={{ color:c, fontSize:18, fontWeight:700 }}>{v}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign:"center", color:t.textMuted, fontSize:13, padding:"20px 0" }}>Completează toate câmpurile pentru calcul</div>
      )}
    </div>
  );
}

// ─── COMBO STATS ──────────────────────────────────────────────────────────────
function ComboStats({ trades, t }) {
  const [f1, setF1] = useState("setup");
  const [f2, setF2] = useState("session");
  const FIELDS = { setup:"Setup", session:"Session", market:"Market", trend:"Trend", liquidity:"Liquidity", news:"News", mss:"MSS", dayOfWeek:"Day", order:"Order" };

  const combos = useMemo(() => {
    const map = {};
    trades.forEach(tr => {
      const k = `${tr[f1]} + ${tr[f2]}`;
      if (!map[k]) map[k] = { wins:0, total:0, income:0 };
      map[k].total++;
      if (tr.result==="Win") map[k].wins++;
      map[k].income += parseFloat(tr.income||0);
    });
    return Object.entries(map)
      .map(([k,v]) => ({ name:k, ...v, wr: v.wins/v.total }))
      .filter(x => x.total >= 3)
      .sort((a,b) => b.wr - a.wr)
      .slice(0, 15);
  }, [trades, f1, f2]);

  const selStyle = { background:"transparent", border:"none", color:t.accent, fontSize:13, fontWeight:600, cursor:"pointer", outline:"none", fontFamily:"-apple-system,sans-serif" };

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        <span style={{ color:t.textMuted, fontSize:13 }}>Win rate per</span>
        <select style={selStyle} value={f1} onChange={e=>setF1(e.target.value)}>
          {Object.entries(FIELDS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        <span style={{ color:t.textMuted, fontSize:13 }}>+</span>
        <select style={selStyle} value={f2} onChange={e=>setF2(e.target.value)}>
          {Object.entries(FIELDS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        <span style={{ color:t.textMuted, fontSize:11 }}>(min 3 trades)</span>
      </div>
      {combos.length === 0 ? (
        <div style={{ color:t.textMuted, fontSize:13, textAlign:"center", padding:"20px 0" }}>Nu sunt suficiente date pentru această combinație</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
          {combos.map((c,i) => (
            <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 160px 36px auto", gap:12, alignItems:"center", padding:"9px 0", borderBottom:`1px solid ${t.borderLight}` }}>
              <span style={{ color:t.text, fontSize:13, fontWeight:500 }}>{c.name}</span>
              <WinBar wins={c.wins} total={c.total} t={t} />
              <span style={{ color:t.textMuted, fontSize:11, minWidth:30, textAlign:"center" }}>{c.total}t</span>
              <span style={{ color:c.income>=0?t.green:t.red, fontSize:12, fontWeight:600, minWidth:60, textAlign:"right" }}>{eur(c.income)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── STREAK TRACKER ───────────────────────────────────────────────────────────
function StreakInfo({ trades, t }) {
  const data = useMemo(() => {
    const sorted = [...trades].filter(x=>x.result).sort((a,b)=>new Date(a.open)-new Date(b.open));
    if (!sorted.length) return null;
    let curStreak=1, curType=sorted[sorted.length-1]?.result, maxW=0, maxL=0;
    let tmpW=0, tmpL=0;
    sorted.forEach(tr => {
      if (tr.result==="Win") { tmpW++; tmpL=0; } else if (tr.result==="Lose") { tmpL++; tmpW=0; } else { tmpW=0; tmpL=0; }
      maxW=Math.max(maxW,tmpW); maxL=Math.max(maxL,tmpL);
    });
    // Current streak
    let cur=0;
    for (let i=sorted.length-1;i>=0;i--) {
      if (sorted[i].result===curType) cur++;
      else break;
    }
    return { cur, curType, maxW, maxL };
  }, [trades]);

  if (!data) return <div style={{ color:t.textMuted, fontSize:13 }}>No data</div>;
  const streakColor = data.curType==="Win"?t.green:data.curType==="Lose"?t.red:t.yellow;
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
      <div style={{ background:`${streakColor}18`, border:`1px solid ${streakColor}33`, borderRadius:14, padding:"16px 18px", textAlign:"center" }}>
        <div style={{ color:t.textMuted, fontSize:10, fontWeight:500, marginBottom:6 }}>CURRENT STREAK</div>
        <div style={{ color:streakColor, fontSize:32, fontWeight:800 }}>{data.cur}</div>
        <div style={{ color:streakColor, fontSize:12, fontWeight:600 }}>{data.curType}</div>
      </div>
      <div style={{ background:t.green+"12", border:`1px solid ${t.green}33`, borderRadius:14, padding:"16px 18px", textAlign:"center" }}>
        <div style={{ color:t.textMuted, fontSize:10, fontWeight:500, marginBottom:6 }}>BEST WIN STREAK</div>
        <div style={{ color:t.green, fontSize:32, fontWeight:800 }}>{data.maxW}</div>
        <div style={{ color:t.green, fontSize:12, fontWeight:600 }}>Wins</div>
      </div>
      <div style={{ background:t.red+"12", border:`1px solid ${t.red}33`, borderRadius:14, padding:"16px 18px", textAlign:"center" }}>
        <div style={{ color:t.textMuted, fontSize:10, fontWeight:500, marginBottom:6 }}>WORST LOSE STREAK</div>
        <div style={{ color:t.red, fontSize:32, fontWeight:800 }}>{data.maxL}</div>
        <div style={{ color:t.red, fontSize:12, fontWeight:600 }}>Losses</div>
      </div>
    </div>
  );
}

// ─── GRADE STATS ──────────────────────────────────────────────────────────────
function GradeStats({ trades, t }) {
  const data = useMemo(() => GRADES.map(g => {
    const gt = trades.filter(x => x.grade===g);
    return { grade:g, total:gt.length, wins:gt.filter(x=>x.result==="Win").length, income:gt.reduce((a,b)=>a+parseFloat(b.income||0),0) };
  }).filter(x=>x.total>0), [trades]);
  const colors = { A:t.green, B:t.accent, C:t.yellow, D:t.red };
  if (!data.length) return <div style={{ color:t.textMuted, fontSize:13 }}>No graded trades yet</div>;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {data.map(g => (
        <div key={g.grade} style={{ display:"grid", gridTemplateColumns:"28px 1fr 40px 68px", gap:10, alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${t.borderLight}` }}>
          <span style={{ background:colors[g.grade]+"22", color:colors[g.grade], borderRadius:6, width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:13 }}>{g.grade}</span>
          <WinBar wins={g.wins} total={g.total} t={t} />
          <span style={{ color:t.textMuted, fontSize:12, textAlign:"center" }}>{g.total}</span>
          <span style={{ color:g.income>=0?t.green:t.red, fontSize:12, fontWeight:600, textAlign:"right" }}>{eur(g.income)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
const APP_PASSWORD = "adrianstats"; // ← schimbă asta cu parola ta

export default function App() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem("et_auth") === "1");
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);

  function handleLogin() {
    if (pwInput === APP_PASSWORD) {
      sessionStorage.setItem("et_auth", "1");
      setAuthed(true);
    } else {
      setPwError(true);
      setTimeout(() => setPwError(false), 2000);
    }
  }

  if (!authed) {
    return (
      <div style={{ minHeight:"100vh", background:"#000", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"-apple-system,sans-serif" }}>
        <div style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:24, padding:"48px 40px", width:360, textAlign:"center" }}>
          <div style={{ width:52,height:52,borderRadius:14,background:"#f5f5f7",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px" }}>
            <span style={{ color:"#000",fontSize:24,fontWeight:800 }}>E</span>
          </div>
          <div style={{ color:"#f5f5f7",fontSize:22,fontWeight:700,letterSpacing:-.5,marginBottom:6 }}>EdgeTrack</div>
          <div style={{ color:"#6e6e73",fontSize:14,marginBottom:32 }}>Introdu parola pentru acces</div>
          <input
            type="password"
            placeholder="Parolă"
            value={pwInput}
            onChange={e => setPwInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            style={{ width:"100%", background:"#1c1c1e", border:`1px solid ${pwError?"#ff453a":"#2a2a2a"}`, color:"#f5f5f7", padding:"13px 16px", borderRadius:12, fontSize:15, outline:"none", marginBottom:12, fontFamily:"-apple-system,sans-serif", textAlign:"center", letterSpacing:2, transition:"border .15s" }}
          />
          {pwError && <div style={{ color:"#ff453a",fontSize:13,marginBottom:12 }}>Parolă greșită</div>}
          <button onClick={handleLogin}
            style={{ width:"100%",background:"#0a84ff",color:"#fff",border:"none",borderRadius:12,padding:"13px",fontSize:15,fontWeight:600,cursor:"pointer" }}>
            Intră
          </button>
        </div>
      </div>
    );
  }
  const [dark, setDark] = useState(true);
  const T = dark ? DARK : LIGHT;
  const [trades, setTrades]     = useState(() => load("tj2_trades")   || []);
  const [accounts, setAccounts] = useState(() => load("tj2_accounts") || []);
  const [custConf, setCustConf] = useState(() => load("tj2_conf")     || []);
  const [newConf, setNewConf]   = useState("");
  const [tab, setTab]           = useState("dashboard");
  const [form, setForm]         = useState({ ...emptyTrade });
  const [editId, setEditId]     = useState(null);
  const [notif, setNotif]       = useState(null);
  const [syncing, setSyncing]   = useState(false);
  const [online, setOnline]     = useState(true);
  const syncTimer               = useRef(null);

  // Dashboard filters
  const [fAccount, setFAccount] = useState("All");
  const [fMonth, setFMonth]     = useState("All");
  const [fSetup, setFSetup]     = useState("All");
  const [fSession, setFSession] = useState("All");
  const [fTrend, setFTrend]     = useState("All");
  const [fMarket, setFMarket]   = useState("All");
  const [fResult, setFResult]   = useState("All");

  // Trade log
  const [search, setSearch]     = useState("");
  const [logAccount, setLogAccount] = useState("All");
  const [logMonth, setLogMonth] = useState("All");

  // Account modal
  const [showAccModal, setShowAccModal] = useState(false);
  const [accForm, setAccForm] = useState({ name:"", type:"Phase 1", firm:"5%ers", balance:"" });

  // ── SUPABASE SYNC ──────────────────────────────────────────────────────────
  // Load from Supabase on startup
  useEffect(() => {
    async function loadFromCloud() {
      try {
        setSyncing(true);
        const [{ data: tData }, { data: aData }, { data: cData }] = await Promise.all([
          supabase.from("trades").select("*").order("id"),
          supabase.from("accounts").select("*").order("id"),
          supabase.from("config").select("*").eq("key","custConf"),
        ]);
        if (tData && tData.length > 0) {
          const ts = tData.map(r => r.data);
          setTrades(ts); save("tj2_trades", ts);
        }
        if (aData && aData.length > 0) {
          const as = aData.map(r => r.data);
          setAccounts(as); save("tj2_accounts", as);
        }
        if (cData && cData.length > 0) {
          const cc = cData[0].value;
          setCustConf(cc); save("tj2_conf", cc);
        }
        setOnline(true);
      } catch(e) {
        setOnline(false);
      } finally {
        setSyncing(false);
      }
    }
    loadFromCloud();
  }, []);

  // Debounced sync to Supabase whenever trades/accounts/custConf change
  async function syncToCloud(newTrades, newAccounts, newConf) {
    try {
      setSyncing(true);
      // Upsert all trades
      if (newTrades !== undefined) {
        await supabase.from("trades").delete().neq("id", 0);
        if (newTrades.length > 0) {
          await supabase.from("trades").insert(newTrades.map(t => ({ id: t.id, data: t })));
        }
      }
      if (newAccounts !== undefined) {
        await supabase.from("accounts").delete().neq("id", 0);
        if (newAccounts.length > 0) {
          await supabase.from("accounts").insert(newAccounts.map(a => ({ id: a.id, data: a })));
        }
      }
      if (newConf !== undefined) {
        await supabase.from("config").upsert({ key:"custConf", value: newConf });
      }
      setOnline(true);
    } catch(e) {
      setOnline(false);
    } finally {
      setSyncing(false);
    }
  }

  // Save locally always, sync to cloud with debounce
  useEffect(() => { save("tj2_trades", trades); clearTimeout(syncTimer.current); syncTimer.current = setTimeout(() => syncToCloud(trades, undefined, undefined), 1500); }, [trades]);
  useEffect(() => { save("tj2_accounts", accounts); clearTimeout(syncTimer.current); syncTimer.current = setTimeout(() => syncToCloud(undefined, accounts, undefined), 1500); }, [accounts]);
  useEffect(() => { save("tj2_conf", custConf); clearTimeout(syncTimer.current); syncTimer.current = setTimeout(() => syncToCloud(undefined, undefined, custConf), 1500); }, [custConf]);

  // Auto day of week
  useEffect(() => {
    if (form.open) {
      const d = new Date(form.open);
      const names = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
      const day = names[d.getDay()];
      if (DAYS.includes(day)) setForm(f => ({ ...f, dayOfWeek: day }));
    }
  }, [form.open]);

  const notify = (msg, color) => { setNotif({ msg, color }); setTimeout(() => setNotif(null), 2500); };
  const allMonths  = [...new Set(trades.map(t => t.month).filter(Boolean))];
  const allConf    = [...DEF_CONF, ...custConf];

  const filtered = useMemo(() => trades.filter(tr => {
    if (fAccount !== "All" && tr.account !== fAccount) return false;
    if (fMonth   !== "All" && tr.month   !== fMonth)   return false;
    if (fSetup   !== "All" && tr.setup   !== fSetup)   return false;
    if (fSession !== "All" && tr.session !== fSession)  return false;
    if (fTrend   !== "All" && tr.trend   !== fTrend)   return false;
    if (fMarket  !== "All" && tr.market  !== fMarket)  return false;
    if (fResult  !== "All" && tr.result  !== fResult)  return false;
    return true;
  }), [trades, fAccount, fMonth, fSetup, fSession, fTrend, fMarket, fResult]);

  const logFiltered = useMemo(() => {
    let ts = trades;
    if (logAccount !== "All") ts = ts.filter(t => t.account === logAccount);
    if (logMonth   !== "All") ts = ts.filter(t => t.month === logMonth);
    if (search) { const q = search.toLowerCase(); ts = ts.filter(t => [t.market,t.setup,t.session,t.result,t.notes,t.account,t.grade].join(" ").toLowerCase().includes(q)); }
    return ts;
  }, [trades, logAccount, logMonth, search]);

  // Stats
  const stats = useMemo(() => {
    const ts = filtered; if (!ts.length) return null;
    const wins=ts.filter(x=>x.result==="Win").length, losses=ts.filter(x=>x.result==="Lose").length, bes=ts.filter(x=>x.result==="BE").length;
    const net = ts.reduce((a,b)=>a+parseFloat(b.income||0),0);
    const avgRR = (ts.reduce((a,b)=>a+parseFloat(b.rr||0),0)/ts.length).toFixed(2);
    const gW = ts.filter(x=>parseFloat(x.income)>0).reduce((a,b)=>a+parseFloat(b.income||0),0);
    const gL = Math.abs(ts.filter(x=>parseFloat(x.income)<0).reduce((a,b)=>a+parseFloat(b.income||0),0));
    const pf = gL===0?"∞":(gW/gL).toFixed(2);
    let eq=0;
    const equity = [...ts].sort((a,b)=>new Date(a.open)-new Date(b.open)).map((x,i)=>{ eq+=parseFloat(x.income||0); return{n:i+1,eq:parseFloat(eq.toFixed(2))}; });
    let peak=0,maxDD=0; equity.forEach(e=>{ if(e.eq>peak)peak=e.eq; const dd=peak-e.eq; if(dd>maxDD)maxDD=dd; });
    const grp = (key,opts) => opts.map(name=>{ const g=ts.filter(x=>x[key]===name); return{name,total:g.length,wins:g.filter(x=>x.result==="Win").length,income:g.reduce((a,b)=>a+parseFloat(b.income||0),0)}; }).filter(x=>x.total>0);
    const monthMap={};
    ts.forEach(x=>{ if(!x.month) return; if(!monthMap[x.month])monthMap[x.month]={trades:0,wins:0,rr:0,income:0}; monthMap[x.month].trades++;if(x.result==="Win")monthMap[x.month].wins++;monthMap[x.month].rr+=parseFloat(x.rr||0);monthMap[x.month].income+=parseFloat(x.income||0); });
    const monthly=Object.entries(monthMap).map(([k,v])=>({month:k,trades:v.trades,wins:v.wins,total:v.trades,rr:(v.rr/v.trades).toFixed(2),income:v.income}));
    return { total:ts.length,wins,losses,bes,net,avgRR,pf,equity,maxDD:maxDD.toFixed(2), sessions:grp("session",SESSIONS),orders:grp("order",["BUY","SELL"]),markets:grp("market",MARKETS),liquidity:grp("liquidity",LIQUIDITY),setups:grp("setup",SETUPS),news:grp("news",NEWS_OPT),trend:grp("trend",TRENDS),mss:grp("mss",MSS_OPT),days:grp("dayOfWeek",DAYS),monthly };
  }, [filtered]);

  function handleSave() {
    if (!form.market || !form.open) { notify("Completează Market și Open", T.red); return; }
    const trade = { ...form, id: editId||Date.now() };
    if (editId) setTrades(p=>p.map(tr=>tr.id===editId?trade:tr));
    else setTrades(p=>[...p,trade]);
    setForm({ ...emptyTrade }); setEditId(null); setTab("trades");
    notify(editId?"Trade actualizat ✓":"Trade adăugat ✓", T.green);
  }

  function handleImport(e) {
    const file=e.target.files[0]; if(!file) return;
    const r=new FileReader();
    r.onload=ev=>{ try{ const d=JSON.parse(ev.target.result); if(d.trades)setTrades(d.trades); if(d.accounts)setAccounts(d.accounts); notify(`${d.trades?.length||0} trades importate ✓`,T.green); }catch{notify("Fișier invalid",T.red);} };
    r.readAsText(file);
  }
  function handleExport() {
    const blob=new Blob([JSON.stringify({trades,accounts},null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="edgetrack_backup.json";a.click();
    notify("Export complet ✓",T.green);
  }

  const resetFilters = () => { setFAccount("All");setFMonth("All");setFSetup("All");setFSession("All");setFTrend("All");setFMarket("All");setFResult("All"); };
  const activeFilters = [fAccount,fMonth,fSetup,fSession,fTrend,fMarket,fResult].filter(x=>x!=="All").length;

  const inp = { background:dark?"#1c1c1e":"#f2f2f7", border:`1px solid ${T.border}`, color:T.text, padding:"11px 14px", borderRadius:10, fontSize:14, fontFamily:"-apple-system,sans-serif", width:"100%", outline:"none", transition:"border .15s,box-shadow .15s" };

  const TABS = [
    {id:"dashboard",label:"Dashboard"},
    {id:"add",label:editId?"Edit Trade":"Add Trade"},
    {id:"trades",label:"Trade Log"},
    {id:"tools",label:"Tools"},
    {id:"accounts",label:"Accounts"},
  ];

  const gradeColor = {A:T.green,B:T.accent,C:T.yellow,D:T.red};

  return (
    <div style={{ minHeight:"100vh", background:T.bg, color:T.text, fontFamily:"-apple-system,'SF Pro Text',BlinkMacSystemFont,sans-serif", transition:"background .3s,color .3s" }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:5px;height:5px;} ::-webkit-scrollbar-track{background:transparent;} ::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px;}
        input:focus,select:focus,textarea:focus{border-color:${T.accent}!important;box-shadow:0 0 0 3px ${T.accent}22!important;}
        select option{background:${dark?"#1c1c1e":"#fff"};color:${T.text};}
        .trow:hover td{background:${T.surfaceHover}!important;}
        ::placeholder{color:${T.textMuted};}
        button,label{font-family:-apple-system,sans-serif;}
      `}</style>

      {notif&&<div style={{ position:"fixed",top:24,left:"50%",transform:"translateX(-50%)",background:notif.color,color:"#fff",padding:"12px 28px",borderRadius:100,fontSize:14,fontWeight:600,zIndex:9999,boxShadow:"0 8px 30px rgba(0,0,0,0.25)",pointerEvents:"none",whiteSpace:"nowrap" }}>{notif.msg}</div>}

      {/* NAVBAR */}
      <div style={{ background:dark?"rgba(0,0,0,0.82)":"rgba(255,255,255,0.82)", backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)", borderBottom:`1px solid ${T.border}`, padding:"0 28px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100, height:56 }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <div style={{ width:28,height:28,borderRadius:8,background:T.text,display:"flex",alignItems:"center",justifyContent:"center" }}>
            <span style={{ color:T.bg,fontSize:14,fontWeight:800 }}>E</span>
          </div>
          <span style={{ fontWeight:700,fontSize:16,letterSpacing:-.4 }}>EdgeTrack</span>
        </div>
        <div style={{ display:"flex",gap:2,background:dark?"#1c1c1e":"#e5e5ea",borderRadius:12,padding:3 }}>
          {TABS.map(tb=>(
            <button key={tb.id} onClick={()=>{ setTab(tb.id); if(tb.id!=="add"){setEditId(null);setForm({...emptyTrade});} }}
              style={{ background:tab===tb.id?(dark?"#2c2c2e":"#fff"):"transparent", color:tab===tb.id?T.text:T.textMuted, border:"none", borderRadius:9, padding:"7px 16px", fontSize:13, fontWeight:tab===tb.id?600:400, cursor:"pointer", transition:"all .15s", boxShadow:tab===tb.id?"0 1px 4px rgba(0,0,0,0.15)":"none" }}>
              {tb.label}
            </button>
          ))}
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <span style={{ fontSize:14 }}>{dark?"🌙":"☀️"}</span>
          <button onClick={()=>setDark(!dark)} style={{ width:42,height:24,borderRadius:12,border:"none",cursor:"pointer",background:dark?T.accent:T.border,position:"relative",transition:"background .2s" }}>
            <div style={{ width:18,height:18,borderRadius:9,background:"#fff",position:"absolute",top:3,left:dark?21:3,transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,0.3)" }} />
          </button>
          <div style={{ display:"flex",alignItems:"center",gap:5 }}>
            <div style={{ width:7,height:7,borderRadius:99,background:syncing?T.yellow:online?T.green:T.red,transition:"background .3s" }} />
            <span style={{ color:T.textMuted,fontSize:11 }}>{syncing?"Syncing...":online?"Synced":"Offline"}</span>
          </div>
          <div style={{ width:1,height:16,background:T.border,margin:"0 2px" }} />
          <button onClick={handleExport} style={{ background:"none",border:`1px solid ${T.border}`,color:T.textSub,padding:"6px 14px",borderRadius:8,fontSize:12,fontWeight:500,cursor:"pointer" }}>↓ Export</button>
          <label style={{ background:T.accent,color:"#fff",padding:"7px 14px",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer" }}>
            ↑ Import<input type="file" accept=".json" style={{ display:"none" }} onChange={handleImport} />
          </label>
        </div>
      </div>

      <div style={{ padding:"28px 36px" }}>

        {/* ══════════════════ DASHBOARD ══════════════════ */}
        {tab==="dashboard" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20, flexWrap:"wrap", gap:12 }}>
              <div>
                <h1 style={{ fontSize:32,fontWeight:700,letterSpacing:-1.2,marginBottom:3 }}>Dashboard</h1>
                <p style={{ color:T.textMuted,fontSize:14 }}>{filtered.length} trades{activeFilters>0?` · ${activeFilters} filter${activeFilters>1?"s":""} active`:""}</p>
              </div>
              <div style={{ display:"flex",gap:8,flexWrap:"wrap",alignItems:"center" }}>
                {[
                  ["Account",fAccount,setFAccount,["All",...accounts.map(a=>a.name)]],
                  ["Month",fMonth,setFMonth,["All",...allMonths]],
                  ["Market",fMarket,setFMarket,["All",...MARKETS]],
                  ["Session",fSession,setFSession,["All",...SESSIONS]],
                  ["Setup",fSetup,setFSetup,["All",...SETUPS]],
                  ["Trend",fTrend,setFTrend,["All",...TRENDS]],
                  ["Result",fResult,setFResult,["All",...RESULTS]],
                ].map(([label,val,setter,opts])=>(
                  <select key={label} value={val} onChange={e=>setter(e.target.value)}
                    style={{ ...inp, width:"auto", padding:"8px 12px", fontSize:12, border:`1px solid ${val!=="All"?T.accent+"66":T.border}`, background:val!=="All"?T.accent+"11":(dark?"#1c1c1e":"#f2f2f7"), color:val!=="All"?T.accent:T.textSub }}>
                    {opts.map(o=><option key={o}>{o}</option>)}
                  </select>
                ))}
                {activeFilters>0&&<button onClick={resetFilters} style={{ background:T.red+"18",border:"none",color:T.red,borderRadius:8,padding:"8px 14px",fontSize:12,fontWeight:600,cursor:"pointer" }}>✕ Reset</button>}
              </div>
            </div>

            {!stats ? (
              <div style={{ textAlign:"center",padding:"100px 0" }}>
                <div style={{ fontSize:60,marginBottom:16 }}>📈</div>
                <div style={{ fontSize:22,fontWeight:700,marginBottom:8 }}>No trades yet</div>
                <div style={{ color:T.textMuted,fontSize:15,marginBottom:28 }}>Add your first trade to see your statistics</div>
                <button onClick={()=>setTab("add")} style={{ background:T.accent,color:"#fff",border:"none",borderRadius:14,padding:"14px 32px",fontSize:16,fontWeight:600,cursor:"pointer" }}>Add First Trade</button>
              </div>
            ) : (<>
              {/* KPIs */}
              <div style={{ display:"flex",gap:12,marginBottom:18,flexWrap:"wrap" }}>
                <KPI label="Net Income" value={eur(stats.net)} color={stats.net>=0?T.green:T.red} t={T} />
                <KPI label="Win Rate" value={pct(stats.wins,stats.total)} sub={`${stats.wins}W · ${stats.losses}L · ${stats.bes}BE`} t={T} />
                <KPI label="Profit Factor" value={stats.pf} color={T.accent} t={T} />
                <KPI label="Avg R:R" value={stats.avgRR+"R"} color={T.yellow} t={T} />
                <KPI label="Max Drawdown" value={"€"+stats.maxDD} color={T.red} t={T} />
                <KPI label="Total Trades" value={stats.total} t={T} />
              </div>

              {/* Streak */}
              <div style={{ marginBottom:16 }}>
                <SCard title="Streak" t={T}>
                  <StreakInfo trades={filtered} t={T} />
                </SCard>
              </div>

              {/* Equity + Heatmap */}
              <div style={{ display:"grid",gridTemplateColumns:"1.6fr 1fr",gap:16,marginBottom:16 }}>
                <SCard title="Equity Curve" t={T} action={<span style={{ color:stats.net>=0?T.green:T.red,fontSize:20,fontWeight:700 }}>{eur(stats.net)}</span>}>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={stats.equity}>
                      <XAxis dataKey="n" stroke="transparent" tick={{ fill:T.textMuted,fontSize:11 }} />
                      <YAxis stroke="transparent" tick={{ fill:T.textMuted,fontSize:11 }} />
                      <Tooltip contentStyle={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:12,color:T.text,fontSize:12 }} />
                      <Line type="monotone" dataKey="eq" stroke={stats.net>=0?T.green:T.red} strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </SCard>
                <SCard title="Calendar Heatmap" t={T}>
                  <Heatmap trades={filtered} t={T} dark={dark} />
                </SCard>
              </div>

              {/* Monthly */}
              <SCard title="Monthly Performance" t={T}>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%",borderCollapse:"collapse",fontSize:13 }}>
                    <thead><tr>{["Month","Trades","Win Rate","Avg RR","Income"].map(h=>(
                      <th key={h} style={{ color:T.textMuted,fontSize:11,fontWeight:500,padding:"10px 10px",textAlign:"left",borderBottom:`1px solid ${T.borderLight}` }}>{h}</th>
                    ))}</tr></thead>
                    <tbody>{stats.monthly.map((m,i)=>(
                      <tr key={i}>
                        <td style={{ padding:"9px 10px",color:T.text,fontWeight:600 }}>{m.month}</td>
                        <td style={{ padding:"9px 10px",color:T.textSub }}>{m.trades}</td>
                        <td style={{ padding:"9px 10px",minWidth:160 }}><WinBar wins={m.wins} total={m.total} t={T} /></td>
                        <td style={{ padding:"9px 10px",color:parseFloat(m.rr)>=0?T.green:T.red,fontWeight:600 }}>{m.rr}R</td>
                        <td style={{ padding:"9px 10px",color:m.income>=0?T.green:T.red,fontWeight:600 }}>{eur(m.income)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </SCard>

              {/* Combo Stats */}
              <div style={{ marginTop:16 }}>
                <SCard title="Win Rate pe Combinații" t={T}>
                  <ComboStats trades={filtered} t={T} />
                </SCard>
              </div>

              {/* Grade Stats */}
              <div style={{ marginTop:16 }}>
                <SCard title="Execution Grade" t={T}>
                  <GradeStats trades={filtered} t={T} />
                </SCard>
              </div>

              {/* Stats Grid */}
              {[
                [{title:"Sessions",data:stats.sessions},{title:"Buy vs Sell",data:stats.orders}],
                [{title:"Markets",data:stats.markets},{title:"Liquidity",data:stats.liquidity}],
                [{title:"Setups",data:stats.setups},{title:"News",data:stats.news}],
                [{title:"Trend",data:stats.trend},{title:"MSS",data:stats.mss},{title:"Days of Week",data:stats.days}],
              ].map((row,ri)=>(
                <div key={ri} style={{ display:"grid",gridTemplateColumns:`repeat(${row.length},1fr)`,gap:14,marginTop:14 }}>
                  {row.map(({title,data})=>(
                    <SCard key={title} title={title} t={T}>
                      {!data.length?<div style={{ color:T.textMuted,fontSize:13 }}>No data</div>:data.map((r,i)=><StatRow key={i} {...r} t={T} />)}
                    </SCard>
                  ))}
                </div>
              ))}
            </>)}
          </div>
        )}

        {/* ══════════════════ ADD TRADE ══════════════════ */}
        {tab==="add" && (
          <div style={{ maxWidth:900 }}>
            <h1 style={{ fontSize:30,fontWeight:700,letterSpacing:-1,marginBottom:24 }}>{editId?"Edit Trade":"New Trade"}</h1>

            {/* Pre-trade Checklist */}
            <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:20,padding:24,marginBottom:14,boxShadow:T.shadowSm }}>
              <div style={{ color:T.textMuted,fontSize:11,fontWeight:600,letterSpacing:.8,textTransform:"uppercase",marginBottom:16 }}>Pre-Trade Checklist</div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
                {CHECKLIST_ITEMS.map(item=>{
                  const checked=(form.checklist||[]).includes(item);
                  return (
                    <button key={item} onClick={()=>setForm(f=>({ ...f, checklist:checked?f.checklist.filter(x=>x!==item):[...(f.checklist||[]),item] }))}
                      style={{ display:"flex",alignItems:"center",gap:10,background:checked?T.green+"12":(dark?"#1c1c1e":"#f2f2f7"),border:`1px solid ${checked?T.green+"44":T.border}`,borderRadius:10,padding:"10px 14px",cursor:"pointer",textAlign:"left",transition:"all .15s" }}>
                      <div style={{ width:18,height:18,borderRadius:5,border:`2px solid ${checked?T.green:T.border}`,background:checked?T.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s" }}>
                        {checked&&<span style={{ color:"#fff",fontSize:11,fontWeight:800 }}>✓</span>}
                      </div>
                      <span style={{ color:checked?T.green:T.textSub,fontSize:13,fontWeight:checked?600:400 }}>{item}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop:12,color:T.textMuted,fontSize:12 }}>
                {(form.checklist||[]).length}/{CHECKLIST_ITEMS.length} checks ·{" "}
                <span style={{ color:(form.checklist||[]).length===CHECKLIST_ITEMS.length?T.green:T.yellow,fontWeight:600 }}>
                  {(form.checklist||[]).length===CHECKLIST_ITEMS.length?"✓ Ready to trade":"Incomplete"}
                </span>
              </div>
            </div>

            {/* Trade Info */}
            {[
              { section:"Trade Info", grid:"1fr 1fr 1fr", fields:[["Account","account","select",accounts.map(a=>a.name)],["Market","market","select",MARKETS],["Order","order","select",["BUY","SELL"]]] },
              { section:"Timing",     grid:"1fr 1fr 1fr", fields:[["Month","month","text",null,"Mar 26"],["Open","open","datetime-local"],["Close","close","datetime-local"]] },
              { section:"Context",    grid:"1fr 1fr 1fr 1fr", fields:[["Session","session","select",SESSIONS],["News","news","select",NEWS_OPT],["Liquidity","liquidity","select",LIQUIDITY],["Day of Week","dayOfWeek","select",DAYS]] },
              { section:"Analysis",   grid:"1fr 1fr 1fr", fields:[["Trend","trend","select",TRENDS],["MSS","mss","select",MSS_OPT],["Setup","setup","select",SETUPS]] },
            ].map(({section,grid,fields})=>(
              <div key={section} style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:20,padding:24,marginBottom:14,boxShadow:T.shadowSm }}>
                <div style={{ color:T.textMuted,fontSize:11,fontWeight:600,letterSpacing:.8,textTransform:"uppercase",marginBottom:18 }}>{section}</div>
                <div style={{ display:"grid",gridTemplateColumns:grid,gap:14 }}>
                  {fields.map(([label,key,type,options,placeholder])=>(
                    <FF key={key} label={label} t={T}>
                      {type==="select"?(
                        <select style={inp} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}>
                          {key==="account"&&<option value="">— Select —</option>}
                          {(options||[]).map(o=><option key={o}>{o}</option>)}
                        </select>
                      ):(
                        <input type={type} style={inp} placeholder={placeholder||""} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} />
                      )}
                    </FF>
                  ))}
                </div>
              </div>
            ))}

            {/* Result + Grade */}
            <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:20,padding:24,marginBottom:14,boxShadow:T.shadowSm }}>
              <div style={{ color:T.textMuted,fontSize:11,fontWeight:600,letterSpacing:.8,textTransform:"uppercase",marginBottom:18 }}>Result & Execution</div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",gap:14,marginBottom:16 }}>
                <FF label="Result" t={T}><select style={inp} value={form.result} onChange={e=>setForm(f=>({...f,result:e.target.value}))}>{RESULTS.map(r=><option key={r}>{r}</option>)}</select></FF>
                <FF label="After BE" t={T}><select style={inp} value={form.afterBE} onChange={e=>setForm(f=>({...f,afterBE:e.target.value}))}>{AFTER_BE.map(a=><option key={a}>{a}</option>)}</select></FF>
                <FF label="RR" t={T}><input style={inp} placeholder="2 sau -1" value={form.rr} onChange={e=>setForm(f=>({...f,rr:e.target.value}))} /></FF>
                <FF label="Risk %" t={T}><input style={inp} placeholder="1" value={form.risk} onChange={e=>setForm(f=>({...f,risk:e.target.value}))} /></FF>
                <FF label="Income (€)" t={T}><input style={inp} placeholder="+200" value={form.income} onChange={e=>setForm(f=>({...f,income:e.target.value}))} /></FF>
              </div>
              {/* Grade */}
              <div style={{ color:T.textMuted,fontSize:11,fontWeight:500,marginBottom:10 }}>EXECUTION GRADE — cât de bine ai respectat planul?</div>
              <div style={{ display:"flex",gap:10 }}>
                {GRADES.map(g=>(
                  <button key={g} onClick={()=>setForm(f=>({...f,grade:g}))}
                    style={{ flex:1,background:form.grade===g?gradeColor[g]+"22":"transparent",border:`2px solid ${form.grade===g?gradeColor[g]:T.border}`,color:form.grade===g?gradeColor[g]:T.textMuted,borderRadius:12,padding:"12px 0",fontSize:18,fontWeight:800,cursor:"pointer",transition:"all .15s" }}>
                    {g}
                  </button>
                ))}
              </div>
              <div style={{ color:T.textMuted,fontSize:11,marginTop:8 }}>
                {{"A":"Execuție perfectă — ai respectat toate regulile","B":"Bun — mici abateri de la plan","C":"Mediocru — ai forțat trade-ul","D":"Slab — ai ignorat regulile"}[form.grade]}
              </div>
            </div>

            {/* Confluences */}
            <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:20,padding:24,marginBottom:14,boxShadow:T.shadowSm }}>
              <div style={{ color:T.textMuted,fontSize:11,fontWeight:600,letterSpacing:.8,textTransform:"uppercase",marginBottom:18 }}>Confluențe</div>
              <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginBottom:16 }}>
                {allConf.map(c=>{
                  const sel=(form.confluences||[]).includes(c);
                  return (
                    <button key={c} onClick={()=>setForm(f=>({...f,confluences:sel?f.confluences.filter(x=>x!==c):[...(f.confluences||[]),c]}))}
                      style={{ background:sel?T.accent+"22":(dark?"#1c1c1e":"#f2f2f7"),border:`1px solid ${sel?T.accent+"66":T.border}`,color:sel?T.accent:T.textMuted,padding:"7px 14px",borderRadius:20,fontSize:12,fontWeight:sel?600:400,cursor:"pointer",transition:"all .15s" }}>
                      {c}
                    </button>
                  );
                })}
              </div>
              <div style={{ display:"flex",gap:8 }}>
                <input style={{ ...inp,flex:1 }} placeholder="+ Adaugă confluență custom..." value={newConf} onChange={e=>setNewConf(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"&&newConf.trim()){setCustConf(p=>[...p,newConf.trim()]);setNewConf("");}}} />
                <button onClick={()=>{ if(newConf.trim()){setCustConf(p=>[...p,newConf.trim()]);setNewConf("");} }} style={{ background:T.accent,color:"#fff",border:"none",borderRadius:10,padding:"0 18px",fontSize:13,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap" }}>Add</button>
              </div>
            </div>

            {/* Screenshot */}
            <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:20,padding:24,marginBottom:14,boxShadow:T.shadowSm }}>
              <div style={{ color:T.textMuted,fontSize:11,fontWeight:600,letterSpacing:.8,textTransform:"uppercase",marginBottom:18 }}>Screenshot Chart</div>
              {form.screenshot?(
                <div>
                  <img src={form.screenshot} alt="chart" style={{ maxWidth:"100%",maxHeight:300,borderRadius:12,border:`1px solid ${T.border}`,marginBottom:12 }} />
                  <button onClick={()=>setForm(f=>({...f,screenshot:""}))} style={{ background:T.red+"18",border:"none",color:T.red,borderRadius:9,padding:"8px 18px",fontSize:13,fontWeight:600,cursor:"pointer" }}>× Remove</button>
                </div>
              ):(
                <label style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",border:`2px dashed ${T.border}`,borderRadius:14,padding:"32px 20px",cursor:"pointer",gap:8 }}>
                  <span style={{ fontSize:32 }}>📸</span>
                  <span style={{ color:T.textMuted,fontSize:13 }}>Click pentru a atașa screenshot</span>
                  <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{ const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=ev=>setForm(f=>({...f,screenshot:ev.target.result}));r.readAsDataURL(file); }} />
                </label>
              )}
            </div>

            {/* Notes */}
            <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:20,padding:24,marginBottom:22,boxShadow:T.shadowSm }}>
              <div style={{ color:T.textMuted,fontSize:11,fontWeight:600,letterSpacing:.8,textTransform:"uppercase",marginBottom:18 }}>Notes</div>
              <textarea style={{ ...inp,resize:"vertical" }} rows={3} placeholder="Observații, psihologie, ce ai putea face mai bine..." value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} />
            </div>

            <div style={{ display:"flex",gap:10 }}>
              <button onClick={handleSave} style={{ background:T.accent,color:"#fff",border:"none",borderRadius:12,padding:"13px 30px",fontSize:15,fontWeight:600,cursor:"pointer" }}>{editId?"Save Changes":"Add Trade"}</button>
              <button onClick={()=>{setForm({...emptyTrade});setEditId(null);}} style={{ background:dark?"#2c2c2e":"#e5e5ea",color:T.text,border:"none",borderRadius:12,padding:"13px 20px",fontSize:15,cursor:"pointer" }}>Reset</button>
            </div>
          </div>
        )}

        {/* ══════════════════ TRADE LOG ══════════════════ */}
        {tab==="trades" && (
          <div>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
              <h1 style={{ fontSize:30,fontWeight:700,letterSpacing:-1 }}>Trade Log</h1>
              <button onClick={()=>{setTab("add");setEditId(null);setForm({...emptyTrade});}} style={{ background:T.accent,color:"#fff",border:"none",borderRadius:12,padding:"10px 22px",fontSize:14,fontWeight:600,cursor:"pointer" }}>+ Add Trade</button>
            </div>
            <div style={{ display:"flex",gap:10,marginBottom:16,flexWrap:"wrap" }}>
              <input style={{ ...inp,maxWidth:280 }} placeholder="🔍  Search..." value={search} onChange={e=>setSearch(e.target.value)} />
              <select style={{ ...inp,width:"auto" }} value={logAccount} onChange={e=>setLogAccount(e.target.value)}>
                <option value="All">All Accounts</option>{accounts.map(a=><option key={a.id} value={a.name}>{a.name}</option>)}
              </select>
              <select style={{ ...inp,width:"auto" }} value={logMonth} onChange={e=>setLogMonth(e.target.value)}>
                <option value="All">All Months</option>{allMonths.map(m=><option key={m}>{m}</option>)}
              </select>
              <div style={{ display:"flex",alignItems:"center",color:T.textMuted,fontSize:13 }}>{logFiltered.length} trades</div>
            </div>
            <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:20,overflow:"hidden",boxShadow:T.shadowSm }}>
              {logFiltered.length===0?(
                <div style={{ textAlign:"center",padding:"60px 0",color:T.textMuted,fontSize:15 }}>No trades found</div>
              ):(
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12 }}>
                    <thead><tr style={{ background:dark?"#1c1c1e":"#f2f2f7" }}>
                      {["#","Account","Market","Order","Session","Open","News","Liq","Trend","MSS","Setup","Result","After BE","RR","Risk","Income","Grade",""].map(h=>(
                        <th key={h} style={{ color:T.textMuted,fontSize:11,fontWeight:500,padding:"12px 11px",textAlign:"left",whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>{logFiltered.slice().reverse().map((tr,i)=>{
                      const rc=tr.result==="Win"?T.green:tr.result==="Lose"?T.red:T.yellow;
                      const gc=gradeColor[tr.grade||"A"];
                      return (
                        <tr key={tr.id} className="trow">
                          <td style={{ padding:"10px 11px",color:T.textMuted,borderTop:`1px solid ${T.borderLight}` }}>{logFiltered.length-i}</td>
                          <td style={{ padding:"10px 11px",color:T.textSub,borderTop:`1px solid ${T.borderLight}`,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{tr.account}</td>
                          <td style={{ padding:"10px 11px",color:T.text,fontWeight:600,borderTop:`1px solid ${T.borderLight}` }}>{tr.market}</td>
                          <td style={{ padding:"10px 11px",borderTop:`1px solid ${T.borderLight}` }}><Pill label={tr.order} color={tr.order==="BUY"?T.green:T.red} /></td>
                          <td style={{ padding:"10px 11px",color:T.textMuted,borderTop:`1px solid ${T.borderLight}`,whiteSpace:"nowrap" }}>{tr.session?.split(" ")[0]}</td>
                          <td style={{ padding:"10px 11px",color:T.textMuted,borderTop:`1px solid ${T.borderLight}`,whiteSpace:"nowrap" }}>{tr.open?.replace("T"," ")}</td>
                          <td style={{ padding:"10px 11px",borderTop:`1px solid ${T.borderLight}` }}><Pill label={tr.news} color={tr.news==="Safe"?T.green:T.yellow} /></td>
                          <td style={{ padding:"10px 11px",color:T.textSub,borderTop:`1px solid ${T.borderLight}` }}>{tr.liquidity}</td>
                          <td style={{ padding:"10px 11px",borderTop:`1px solid ${T.borderLight}` }}><Pill label={tr.trend} color={tr.trend==="Together"?T.green:tr.trend==="Against"?T.red:T.textMuted} /></td>
                          <td style={{ padding:"10px 11px",color:T.textSub,borderTop:`1px solid ${T.borderLight}` }}>{tr.mss}</td>
                          <td style={{ padding:"10px 11px",borderTop:`1px solid ${T.borderLight}` }}><Pill label={tr.setup} color={T.accent} /></td>
                          <td style={{ padding:"10px 11px",borderTop:`1px solid ${T.borderLight}` }}><Pill label={tr.result} color={rc} /></td>
                          <td style={{ padding:"10px 11px",color:T.textMuted,borderTop:`1px solid ${T.borderLight}` }}>{tr.afterBE}</td>
                          <td style={{ padding:"10px 11px",color:parseFloat(tr.rr)>=0?T.green:T.red,fontWeight:600,borderTop:`1px solid ${T.borderLight}` }}>{tr.rr}R</td>
                          <td style={{ padding:"10px 11px",color:T.textMuted,borderTop:`1px solid ${T.borderLight}` }}>{tr.risk}%</td>
                          <td style={{ padding:"10px 11px",color:parseFloat(tr.income)>=0?T.green:T.red,fontWeight:700,borderTop:`1px solid ${T.borderLight}` }}>{tr.income?eur(parseFloat(tr.income)):"—"}</td>
                          <td style={{ padding:"10px 11px",borderTop:`1px solid ${T.borderLight}` }}>
                            {tr.grade&&<span style={{ background:gc+"22",color:gc,borderRadius:6,padding:"2px 8px",fontSize:12,fontWeight:700 }}>{tr.grade}</span>}
                          </td>
                          <td style={{ padding:"10px 11px",borderTop:`1px solid ${T.borderLight}`,whiteSpace:"nowrap" }}>
                            {tr.screenshot&&<button title="View screenshot" onClick={()=>window.open(tr.screenshot)} style={{ background:"none",border:"none",cursor:"pointer",marginRight:4,fontSize:14 }}>🖼</button>}
                            <button onClick={()=>{setForm({...tr});setEditId(tr.id);setTab("add");}} style={{ background:dark?"#2c2c2e":"#e5e5ea",border:"none",color:T.textSub,borderRadius:7,padding:"5px 10px",fontSize:12,cursor:"pointer",marginRight:4 }}>Edit</button>
                            <button onClick={()=>{if(confirm("Delete?")){ setTrades(p=>p.filter(x=>x.id!==tr.id)); notify("Trade șters",T.red); }}} style={{ background:T.red+"18",border:"none",color:T.red,borderRadius:7,padding:"5px 10px",fontSize:12,cursor:"pointer" }}>×</button>
                          </td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════ TOOLS ══════════════════ */}
        {tab==="tools" && (
          <div>
            <h1 style={{ fontSize:30,fontWeight:700,letterSpacing:-1,marginBottom:24 }}>Tools</h1>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,alignItems:"start" }}>
              <SCard title="Position Size Calculator" t={T}>
                <PositionCalc t={T} dark={dark} />
              </SCard>
              <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
                <SCard title="Win Rate pe Combinații" t={T}>
                  <ComboStats trades={trades} t={T} />
                </SCard>
                <SCard title="Streak History" t={T}>
                  <StreakInfo trades={trades} t={T} />
                </SCard>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════ ACCOUNTS ══════════════════ */}
        {tab==="accounts" && (
          <div>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24 }}>
              <h1 style={{ fontSize:30,fontWeight:700,letterSpacing:-1 }}>Accounts</h1>
              <button onClick={()=>setShowAccModal(true)} style={{ background:T.accent,color:"#fff",border:"none",borderRadius:12,padding:"10px 22px",fontSize:14,fontWeight:600,cursor:"pointer" }}>+ Add Account</button>
            </div>
            {showAccModal&&(
              <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:20,padding:28,maxWidth:480,marginBottom:24,boxShadow:T.shadow }}>
                <div style={{ fontWeight:700,fontSize:18,marginBottom:20 }}>New Account</div>
                <div style={{ display:"grid",gap:14 }}>
                  <FF label="Account Name" t={T}><input style={inp} placeholder="10K 5%ers Phase 1" value={accForm.name} onChange={e=>setAccForm(f=>({...f,name:e.target.value}))} /></FF>
                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12 }}>
                    <FF label="Type" t={T}><select style={inp} value={accForm.type} onChange={e=>setAccForm(f=>({...f,type:e.target.value}))}>{ACC_TYPES.map(x=><option key={x}>{x}</option>)}</select></FF>
                    <FF label="Firm" t={T}><select style={inp} value={accForm.firm} onChange={e=>setAccForm(f=>({...f,firm:e.target.value}))}>{FIRMS.map(x=><option key={x}>{x}</option>)}</select></FF>
                    <FF label="Balance $" t={T}><input style={inp} placeholder="10000" value={accForm.balance} onChange={e=>setAccForm(f=>({...f,balance:e.target.value}))} /></FF>
                  </div>
                  <div style={{ display:"flex",gap:10 }}>
                    <button onClick={()=>{ if(!accForm.name)return; setAccounts(p=>[...p,{...accForm,id:Date.now()}]); setAccForm({name:"",type:"Phase 1",firm:"5%ers",balance:""}); setShowAccModal(false); notify("Account adăugat ✓",T.green); }} style={{ background:T.accent,color:"#fff",border:"none",borderRadius:10,padding:"12px 26px",fontSize:14,fontWeight:600,cursor:"pointer" }}>Save</button>
                    <button onClick={()=>setShowAccModal(false)} style={{ background:dark?"#2c2c2e":"#e5e5ea",color:T.text,border:"none",borderRadius:10,padding:"12px 18px",fontSize:14,cursor:"pointer" }}>Cancel</button>
                  </div>
                </div>
              </div>
            )}
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",gap:14 }}>
              {accounts.map(a=>{
                const at=trades.filter(tr=>tr.account===a.name);
                const aw=at.filter(tr=>tr.result==="Win").length;
                const ai=at.reduce((s,tr)=>s+parseFloat(tr.income||0),0);
                const tc=a.type==="Live"?T.red:a.type==="Phase 2"?T.yellow:T.green;
                return (
                  <div key={a.id} style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:20,padding:22,boxShadow:T.shadowSm }}>
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16 }}>
                      <div><div style={{ fontWeight:700,fontSize:15,marginBottom:4 }}>{a.name}</div><div style={{ color:T.textMuted,fontSize:12 }}>Balance: ${parseFloat(a.balance||0).toLocaleString()}</div></div>
                      <div style={{ display:"flex",gap:6 }}><Pill label={a.type} color={tc} /><Pill label={a.firm} color={T.accent} /></div>
                    </div>
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14 }}>
                      {[["Trades",at.length,T.text],["Win Rate",pct(aw,at.length),T.accent],["Income",eur(ai),ai>=0?T.green:T.red]].map(([l,v,c])=>(
                        <div key={l} style={{ background:dark?"#1c1c1e":"#f2f2f7",borderRadius:10,padding:"10px 12px" }}>
                          <div style={{ color:T.textMuted,fontSize:10,fontWeight:500,marginBottom:4 }}>{l}</div>
                          <div style={{ color:c,fontSize:17,fontWeight:700 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {at.length>0&&<WinBar wins={aw} total={at.length} t={T} />}
                    <button onClick={()=>{if(confirm("Delete account?"))setAccounts(p=>p.filter(x=>x.id!==a.id));}} style={{ marginTop:14,background:"none",border:`1px solid ${T.border}`,color:T.textMuted,borderRadius:9,padding:"8px 16px",fontSize:12,cursor:"pointer",width:"100%" }}>Remove Account</button>
                  </div>
                );
              })}
              {accounts.length===0&&<div style={{ color:T.textMuted,fontSize:15,padding:"40px 0" }}>No accounts yet.</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
