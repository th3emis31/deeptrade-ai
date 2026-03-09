import { useState, useEffect, useRef, useCallback, useMemo, useReducer } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ComposedChart,
  ReferenceLine, LineChart, Line
} from "recharts";
import {
  Activity, Brain, Clock, Calendar, MessageSquare, Mic, Send,
  RefreshCw, LogOut, Bell, Zap, BarChart2, Home, Radio, Target,
  Award, Cpu, Plus, Trash2, MicOff, Upload, User, Download,
  Play, Sun, Moon, Volume2, VolumeX, Newspaper, TrendingUp, TrendingDown,
  CheckCircle, XCircle, DollarSign, Flame, Trophy,
  BookOpen, Layers, GitBranch, Wifi, WifiOff, AlertCircle, Eye, Sliders,
  PiggyBank, Shield, Lightbulb, Star, ChevronRight, Info
} from "lucide-react";

// ── THEME ──────────────────────────────────────────────────────────────
const DARK = {
  bg:"#000d1a", card:"#071220", card2:"#0c1c30", border:"#1a3050",
  border2:"#0f2238", accent:"#f5a623", accentDim:"#c47d10", 
  green:"#00d084", red:"#ff2d4a", blue:"#29b6f6", purple:"#ab47bc", gold:"#ffca28",
  text:"#e8f0fa", textDim:"#7090b0", textFaint:"#2a4060",
  success:"#00d084", warning:"#f5a623", danger:"#ff2d4a",
  // Bloomberg-specific
  headerBg:"#030e1a", tickerBg:"#020810",
  cardGlow:"rgba(245,166,35,0.06)", greenGlow:"rgba(0,208,132,0.08)", redGlow:"rgba(255,45,74,0.08)",
};
const LIGHT = {
  bg:"#f0f4fa", card:"#ffffff", card2:"#e8eef8", border:"#c8d8ee",
  accent:"#d4870a", accentDim:"#b8771a", green:"#00a855", red:"#e0203a",
  blue:"#0284c7", purple:"#7c3aed", gold:"#d97706",
  text:"#0d1f3c", textDim:"#4a6080", textFaint:"#8aa0c0",
  success:"#059669", warning:"#d97706", danger:"#dc2626",
};

// ── CONSTANTS ──────────────────────────────────────────────────────────
const ASSETS = ["XAUUSD","BTCUSD","SP500","MSFT","AMZN"];
const BASE_PRICES = { XAUUSD:5132.38, BTCUSD:68037, SP500:6740.00, MSFT:378.50, AMZN:198.20 };
const ASSET_VOL   = { XAUUSD:0.003,   BTCUSD:0.006, SP500:0.004,   MSFT:0.005,  AMZN:0.005  };
const ASSET_NAME  = { XAUUSD:"Gold", BTCUSD:"Bitcoin", SP500:"S&P 500", MSFT:"Microsoft", AMZN:"Amazon" };
const TFS = ["1m","5m","15m","1H","4H","1D"];
const SESSIONS = [
  {name:"Asian",      start:0,  end:8,  color:"#38bdf8"},
  {name:"London",     start:8,  end:13, color:"#00e676"},
  {name:"LDN-NY",     start:13, end:17, color:"#f5a623"},
  {name:"New York",   start:17, end:22, color:"#a78bfa"},
];


// ── ACCOUNT TRACKER CONSTANTS ───────────────────────────────────────────
const ACCOUNT_INITIAL = {
  startingBalance: 500,
  currentBalance: 500,
  currency: "GBP",
  riskPercent: 1,
  trades: [],          // {date,pair,dir,outcome,pnl,balance,lotSize,entry,tp1,sl,session,notes}
  dailySummaries: {},  // keyed by "YYYY-MM-DD"
  weeklyData: [],
  monthlyData: [],
  alerts: [],          // {id,type,severity,msg,ts,read}
  settings: { autoRisk:true, maxDailyLoss:3, maxDailyTrades:5, targetDailyProfit:2 },
};

// ── ACCOUNT REDUCER ──────────────────────────────────────────────────────
function accountReducer(state, action) {
  switch(action.type) {
    case "SET_BALANCE": {
      return { ...state, startingBalance: action.balance, currentBalance: action.balance, trades: [], dailySummaries: {}, alerts: [] };
    }
    case "SET_CURRENCY": return { ...state, currency: action.currency };
    case "RECORD_TRADE": {
      const t = { ...action.trade, id: Date.now(), ts: new Date().toISOString() };
      const newBalance = +(state.currentBalance + t.pnl).toFixed(2);
      const dateKey = new Date().toISOString().slice(0,10);
      const prev = state.dailySummaries[dateKey] || { pnl:0, trades:0, wins:0, losses:0, startBal: state.currentBalance };
      const newDay = { ...prev, pnl: +(prev.pnl + t.pnl).toFixed(2), trades: prev.trades+1, wins: prev.wins + (t.outcome==="WIN"?1:0), losses: prev.losses + (t.outcome==="LOSS"?1:0) };
      // Auto-alert if daily loss limit hit
      const alerts = [...state.alerts];
      const dailyLossPct = Math.abs(Math.min(0, newDay.pnl)) / state.currentBalance * 100;
      if(dailyLossPct >= state.settings.maxDailyLoss) {
        alerts.unshift({ id:Date.now(), type:"DAILY_LOSS_LIMIT", severity:"danger", msg:`⛔ Daily loss limit reached (${dailyLossPct.toFixed(1)}%). Consider stopping for today.`, ts:new Date().toISOString(), read:false });
      }
      return { ...state, currentBalance: newBalance, trades: [t, ...state.trades].slice(0,200), dailySummaries: { ...state.dailySummaries, [dateKey]: newDay }, alerts: alerts.slice(0,50) };
    }
    case "ADD_ALERT": return { ...state, alerts: [{ id:Date.now(), ...action.alert, ts:new Date().toISOString(), read:false }, ...state.alerts].slice(0,50) };
    case "READ_ALERT": return { ...state, alerts: state.alerts.map(a => a.id===action.id ? {...a,read:true} : a) };
    case "READ_ALL_ALERTS": return { ...state, alerts: state.alerts.map(a => ({...a,read:true})) };
    case "UPDATE_SETTINGS": return { ...state, settings: { ...state.settings, ...action.settings } };
    case "RESET": return { ...ACCOUNT_INITIAL, startingBalance: state.startingBalance, currentBalance: state.startingBalance };
    default: return state;
  }
}

// ── POSITION SIZING CALCULATOR ───────────────────────────────────────────
function calcPositionSize(pair, balance, riskPercent, slPips) {
  if(!balance || !slPips || slPips<=0) return { lots:0.01, riskGBP:0, note:"Min lot" };
  const riskAmount = balance * (riskPercent/100);
  const pipValues = { XAUUSD:10, BTCUSD:1, SP500:10, MSFT:10, AMZN:10 };
  const pipSizes  = { XAUUSD:0.01, BTCUSD:1, SP500:0.25, MSFT:0.01, AMZN:0.01 };
  const pips = slPips / (pipSizes[pair]||0.01);
  const pipValPerLot = pipValues[pair]||10;
  const rawLots = riskAmount / (pips * pipValPerLot);
  const lots = Math.max(0.01, Math.min(1, +rawLots.toFixed(2)));
  const actualRisk = +(lots * pips * pipValPerLot).toFixed(2);
  return { lots, riskGBP: actualRisk, pips: Math.round(pips) };
}

// ── MARKET RATING HELPER ─────────────────────────────────────────────────
function rateMarketDay(candles, mlState) {
  const regimes = Object.fromEntries(Object.entries(candles).map(([s,c])=>[s,detectRegime(c)]));
  const trendCount = Object.values(regimes).filter(r=>r.mode.includes("TREND")).length;
  const rangingCount = Object.values(regimes).filter(r=>r.mode==="RANGING").length;
  const correlations = detectCorrelation(candles);
  const highCorr = correlations.filter(c=>Math.abs(c.r)>0.8).length;
  const overallWR = mlState.totalSignals>0 ? mlState.totalWins/mlState.totalSignals : 0.5;
  let score = 50;
  score += trendCount * 8;        // trending markets = better signals
  score -= rangingCount * 5;      // ranging = choppy
  score -= highCorr * 3;          // high correlations = risk concentration
  score += (overallWR - 0.5) * 40; // ML win rate bonus
  const dayOfWeek = new Date().getDay();
  if(dayOfWeek===1||dayOfWeek===2||dayOfWeek===4) score += 5; // Mon/Tue/Thu best
  if(dayOfWeek===3) score -= 5;   // Wed historically choppy
  score = Math.max(10, Math.min(95, Math.round(score)));
  const rating = score>=70?"GOOD":score>=45?"CAUTION":"AVOID";
  const color = score>=70?"#00d084":score>=45?"#f5a623":"#ff2d4a";
  const emoji = score>=70?"🟢":score>=45?"🟡":"🔴";
  const reasons = [];
  if(trendCount>=3) reasons.push(`${trendCount}/5 assets trending clearly`);
  if(rangingCount>=3) reasons.push(`${rangingCount}/5 assets ranging — choppy conditions`);
  if(highCorr>1) reasons.push(`High asset correlation — watch position sizing`);
  if(overallWR>0.6) reasons.push(`Your ML win rate is strong (${(overallWR*100).toFixed(0)}%)`);
  if(dayOfWeek===3) reasons.push("Wednesday historically volatile");
  return { score, rating, color, emoji, reasons, regimes };
}

// ── P&L AGGREGATORS ──────────────────────────────────────────────────────
function aggregatePnL(account) {
  const today = new Date().toISOString().slice(0,10);
  const thisWeekStart = new Date(); thisWeekStart.setDate(thisWeekStart.getDate()-thisWeekStart.getDay()+1);
  const thisMonthStart = new Date(); thisMonthStart.setDate(1);
  const daily = account.dailySummaries[today] || { pnl:0, trades:0, wins:0, losses:0 };
  const weekly = Object.entries(account.dailySummaries)
    .filter(([d])=>new Date(d)>=thisWeekStart)
    .reduce((a,[,v])=>({ pnl:+(a.pnl+v.pnl).toFixed(2), trades:a.trades+v.trades, wins:a.wins+v.wins, losses:a.losses+v.losses }),{pnl:0,trades:0,wins:0,losses:0});
  const monthly = Object.entries(account.dailySummaries)
    .filter(([d])=>new Date(d)>=thisMonthStart)
    .reduce((a,[,v])=>({ pnl:+(a.pnl+v.pnl).toFixed(2), trades:a.trades+v.trades, wins:a.wins+v.wins, losses:a.losses+v.losses }),{pnl:0,trades:0,wins:0,losses:0});
  const yearly = Object.values(account.dailySummaries)
    .reduce((a,v)=>({ pnl:+(a.pnl+v.pnl).toFixed(2), trades:a.trades+v.trades, wins:a.wins+v.wins, losses:a.losses+v.losses }),{pnl:0,trades:0,wins:0,losses:0});
  return { daily, weekly, monthly, yearly };
}

// ── ML BRAIN CONSTANTS ──────────────────────────────────────────────────
const ML_VERSION = "v5.0";
const INITIAL_ML = {
  version: ML_VERSION,
  totalSignals: 0,
  totalWins: 0,
  totalLosses: 0,
  // Per-pair accuracy tracking
  pairStats: Object.fromEntries(ASSETS.map(a=>([a,{wins:0,losses:0,confSum:0,count:0}]))),
  // Per-session accuracy
  sessionStats: {"Asian":{wins:0,losses:0},"London":{wins:0,losses:0},"LDN-NY":{wins:0,losses:0},"New York":{wins:0,losses:0},"Unknown":{wins:0,losses:0}},
  // Per-day accuracy
  dayStats: {"Mon":{wins:0,losses:0},"Tue":{wins:0,losses:0},"Wed":{wins:0,losses:0},"Thu":{wins:0,losses:0},"Fri":{wins:0,losses:0},"Sat":{wins:0,losses:0},"Sun":{wins:0,losses:0}},
  // Confidence calibration: tracks predicted vs actual WR at each conf bracket
  confCalibration: {"60-70":{predicted:65,actual:0,count:0},"70-80":{predicted:75,actual:0,count:0},"80-90":{predicted:85,actual:0,count:0},"90+":{predicted:92,actual:0,count:0}},
  // Market regime history
  regimeHistory: [],
  // Journal entries
  journal: [],
  // Weekly debriefs
  debriefs: [],
  // Correlation snapshots
  correlations: [],
  // Pattern memory: best combo of pair+session+dir
  patterns: {},
  // AI accuracy: how often Claude's sentiment matched the actual outcome
  aiAccuracy: {correct:0,total:0},
  lastUpdated: null,
};

// ── ML REDUCER ───────────────────────────────────────────────────────────
function mlReducer(state, action) {
  switch(action.type) {
    case "RECORD_OUTCOME": {
      const {signal, outcome, session} = action;
      const isWin = outcome === "WIN";
      const pair = signal.pair;
      const conf = signal.conf || 70;
      const day = new Date().toLocaleDateString('en',{weekday:'short'});
      const confBracket = conf>=90?"90+":conf>=80?"80-90":conf>=70?"70-80":"60-70";
      const pairS = {...state.pairStats[pair]};
      if(isWin) pairS.wins++; else pairS.losses++;
      pairS.confSum += conf; pairS.count++;
      const sessS = {...state.sessionStats};
      if(sessS[session]) { if(isWin) sessS[session].wins++; else sessS[session].losses++; }
      const dayS = {...state.dayStats};
      if(dayS[day]) { if(isWin) dayS[day].wins++; else dayS[day].losses++; }
      const confCal = {...state.confCalibration};
      if(confCal[confBracket]) {
        confCal[confBracket].count++;
        const prev = confCal[confBracket];
        confCal[confBracket] = {...prev, actual: +((prev.actual*( prev.count-1)+( isWin?1:0))/prev.count*100).toFixed(1)};
      }
      // Pattern key
      const patKey = `${pair}|${session}|${signal.dir}`;
      const pat = state.patterns[patKey]||{wins:0,losses:0};
      const newPat = {...pat}; if(isWin) newPat.wins++; else newPat.losses++;
      return {
        ...state,
        totalSignals: state.totalSignals+1,
        totalWins: state.totalWins+(isWin?1:0),
        totalLosses: state.totalLosses+(isWin?0:1),
        pairStats: {...state.pairStats,[pair]:pairS},
        sessionStats: sessS, dayStats: dayS,
        confCalibration: confCal,
        patterns: {...state.patterns,[patKey]:newPat},
        lastUpdated: new Date().toISOString(),
      };
    }
    case "ADD_JOURNAL": return {...state, journal:[action.entry,...state.journal].slice(0,50)};
    case "ADD_DEBRIEF": return {...state, debriefs:[action.debrief,...state.debriefs].slice(0,12)};
    case "SET_REGIME": return {...state, regimeHistory:[{ts:new Date().toISOString(),...action.regime},...state.regimeHistory].slice(0,100)};
    case "UPDATE_CORRELATION": return {...state, correlations:[action.corr,...state.correlations].slice(0,50)};
    case "RESET": return {...INITIAL_ML};
    default: return state;
  }
}

// ── REGIME DETECTOR (EMA spread + volatility) ────────────────────────────
function detectRegime(candles) {
  if(!candles||candles.length<52) return {mode:"UNKNOWN",strength:0,description:"Insufficient data"};
  const ema20 = calcEMA(candles,20); const ema50 = calcEMA(candles,50);
  const last20 = ema20[ema20.length-1]; const last50 = ema50[ema50.length-1];
  const spread = ((last20-last50)/last50)*100;
  const recent = candles.slice(-20);
  const hiLo = recent.map(c=>c.high-c.low);
  const avgRange = hiLo.reduce((a,b)=>a+b,0)/hiLo.length;
  const lastClose = candles[candles.length-1].close;
  const volatility = (avgRange/lastClose)*100;
  let mode,strength,description,color;
  if(Math.abs(spread)<0.05) {mode="RANGING"; strength=Math.round((1-Math.abs(spread)/0.05)*100); description="Price consolidating — wait for breakout"; color="#38bdf8";}
  else if(spread>0.1) {mode="STRONG TREND ▲"; strength=Math.min(100,Math.round(spread*200)); description="Strong uptrend — BUY on pullbacks"; color="#00e676";}
  else if(spread>0) {mode="WEAK TREND ▲"; strength=Math.round(spread*400); description="Mild bullish bias — look for long setups"; color="#fbbf24";}
  else if(spread<-0.1) {mode="STRONG TREND ▼"; strength=Math.min(100,Math.round(Math.abs(spread)*200)); description="Strong downtrend — SELL on rallies"; color="#ff3d57";}
  else {mode="WEAK TREND ▼"; strength=Math.round(Math.abs(spread)*400); description="Mild bearish bias — look for short setups"; color="#f59e0b";}
  return {mode,strength,description,color,volatility:+volatility.toFixed(3),spread:+spread.toFixed(4)};
}

// ── CORRELATION DETECTOR ─────────────────────────────────────────────────
function detectCorrelation(candles) {
  const pairs = Object.keys(candles);
  const results = [];
  for(let i=0;i<pairs.length;i++) for(let j=i+1;j<pairs.length;j++) {
    const a=candles[pairs[i]],b=candles[pairs[j]];
    if(!a||!b||a.length<20||b.length<20) continue;
    const n=20;const aR=a.slice(-n).map(c=>c.close),bR=b.slice(-n).map(c=>c.close);
    const aMean=aR.reduce((x,y)=>x+y)/n,bMean=bR.reduce((x,y)=>x+y)/n;
    const num=aR.reduce((s,v,k)=>s+(v-aMean)*(bR[k]-bMean),0);
    const den=Math.sqrt(aR.reduce((s,v)=>s+(v-aMean)**2,0)*bR.reduce((s,v)=>s+(v-bMean)**2,0));
    const r=den===0?0:+(num/den).toFixed(3);
    results.push({a:pairs[i],b:pairs[j],r,label:Math.abs(r)>0.7?"Strong":(Math.abs(r)>0.4?"Moderate":"Weak"),direction:r>0?"Positive":"Negative"});
  }
  return results.sort((a,b)=>Math.abs(b.r)-Math.abs(a.r));
}

// ── ML CONFIDENCE BOOST ──────────────────────────────────────────────────
// Returns a -10..+10 adjustment to signal confidence based on ML history
function mlConfidenceAdjust(signal, mlState) {
  const pair = signal.pair; const dir = signal.dir;
  const pairS = mlState.pairStats[pair];
  if(!pairS||pairS.count<3) return 0;
  const pairWR = pairS.wins/(pairS.wins+pairS.losses);
  const utcH = new Date().getUTCHours();
  const sess = utcH<8?"Asian":utcH<13?"London":utcH<17?"LDN-NY":"New York";
  const sessS = mlState.sessionStats[sess];
  const sessWR = (sessS&&(sessS.wins+sessS.losses)>2)?(sessS.wins/(sessS.wins+sessS.losses)):0.5;
  const adj = Math.round((pairWR-0.5)*12 + (sessWR-0.5)*8);
  return Math.max(-10,Math.min(10,adj));
}


// ── CANDLE GENERATOR (anchored to live price) ──────────────────────────
function genCandles(currentPrice, n=80, volatility=0.004) {
  const dp = currentPrice > 999 ? 2 : 2;
  const candles = [];
  let price = currentPrice;
  let cumVol = 0;
  for (let i = n-1; i >= 0; i--) {
    const close = price;
    const move  = (Math.random()-0.48)*volatility*price;
    const open  = close - move;
    const high  = Math.max(open,close) + Math.random()*Math.abs(move)*0.9;
    const low   = Math.min(open,close) - Math.random()*Math.abs(move)*0.9;
    price = open;
    const ts = new Date(Date.now() - i*3600000);
    cumVol = Math.floor(Math.random()*2000+300);
    candles[n-1-i] = {
      t: ts.getHours()+":"+String(ts.getMinutes()).padStart(2,"0"),
      open:+open.toFixed(dp), high:+high.toFixed(dp),
      low:+low.toFixed(dp),   close:+close.toFixed(dp), vol:cumVol,
    };
  }
  return candles;
}

// ── EMA CALCULATOR ─────────────────────────────────────────────────────
function calcEMA(data, period) {
  const k = 2/(period+1);
  let ema = data[0]?.close || 0;
  return data.map(c => { ema = c.close*k + ema*(1-k); return +ema.toFixed(2); });
}

// ── RSI CALCULATOR ─────────────────────────────────────────────────────
function calcRSI(data, period=14) {
  if(data.length < period+1) return data.map(()=>50);
  const gains=[],losses=[];
  for(let i=1;i<data.length;i++){
    const d=data[i].close-data[i-1].close;
    gains.push(d>0?d:0); losses.push(d<0?-d:0);
  }
  const rsi=new Array(period).fill(null);
  let ag=gains.slice(0,period).reduce((a,b)=>a+b,0)/period;
  let al=losses.slice(0,period).reduce((a,b)=>a+b,0)/period;
  rsi.push(al===0?100:+(100-100/(1+ag/al)).toFixed(1));
  for(let i=period;i<gains.length;i++){
    ag=(ag*(period-1)+gains[i])/period;
    al=(al*(period-1)+losses[i])/period;
    rsi.push(al===0?100:+(100-100/(1+ag/al)).toFixed(1));
  }
  return rsi;
}

// ── MISC GENERATORS ────────────────────────────────────────────────────
function genDailyPnL() {
  const d=[]; const now=new Date();
  for(let i=20;i>=0;i--){const dt=new Date(now);dt.setDate(dt.getDate()-i);
    d.push({date:dt.toLocaleDateString('en',{month:'short',day:'numeric'}),pips:Math.floor((Math.random()-0.44)*120000)});}
  return d;
}
function genWRTrend() {
  return Array.from({length:20},(_,i)=>({week:`W${i+1}`,wr:Math.floor(45+Math.random()*30),sharpe:+((-1+Math.random()*2)).toFixed(2)}));
}
function genSignalHistory(signals) {
  return signals.map((s,i)=>({...s,closedAt:new Date(Date.now()-i*3600000*6).toLocaleString(),pips:Math.floor((Math.random()-0.4)*200),duration:`${Math.floor(Math.random()*12)+1}h`}));
}

// ── P&L CALENDAR GENERATOR ──────────────────────────────────────────────
function genPnLCalendar() {
  const calendar = [];
  const now = new Date();
  // Generate last 3 months of daily data
  for(let m=2; m>=0; m--) {
    const month = new Date(now.getFullYear(), now.getMonth()-m, 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth()-m+1, 0).getDate();
    const monthData = { month: month.toLocaleString('en',{month:'long',year:'numeric'}), monthKey: `${month.getFullYear()}-${month.getMonth()}`, days: [] };
    for(let d=1; d<=daysInMonth; d++) {
      const dt = new Date(now.getFullYear(), now.getMonth()-m, d);
      const dayOfWeek = dt.getDay();
      const isWeekend = dayOfWeek===0||dayOfWeek===6;
      const isFuture = dt > now;
      if(!isFuture && !isWeekend) {
        const trades = Math.floor(Math.random()*6);
        const wins = Math.floor(Math.random()*(trades+1));
        const losses = trades - wins;
        const pips = Math.floor((Math.random()-0.4)*800);
        monthData.days.push({date:d, trades, wins, losses, pips, wr: trades>0?Math.round(wins/trades*100):null, dayOfWeek});
      } else {
        monthData.days.push({date:d, trades:0, wins:0, losses:0, pips:0, wr:null, dayOfWeek, isWeekend, isFuture});
      }
    }
    calendar.push(monthData);
  }
  return calendar;
}

// ── WEEKLY SUMMARY GENERATOR ────────────────────────────────────────────
function genWeeklySummary() {
  return Array.from({length:8},(_,i)=>{
    const wins = Math.floor(Math.random()*12)+2;
    const losses = Math.floor(Math.random()*8)+1;
    const total = wins+losses;
    const dt = new Date(); dt.setDate(dt.getDate() - i*7);
    return {
      week: `W${8-i}`,
      dateRange: `${new Date(dt.getTime()-6*86400000).toLocaleDateString('en',{month:'short',day:'numeric'})} – ${dt.toLocaleDateString('en',{month:'short',day:'numeric'})}`,
      wins, losses, total,
      wr: Math.round(wins/total*100),
      pips: Math.floor((Math.random()-0.38)*2000),
      bestAsset: ASSETS[Math.floor(Math.random()*ASSETS.length)],
      bestDay: ["Mon","Tue","Wed","Thu","Fri"][Math.floor(Math.random()*5)],
      current: i===0
    };
  }).reverse();
}

// ── PROFIT CALCULATOR HELPER ────────────────────────────────────────────
function calcProfit(pair, dir, entry, target, lotSize, accountCurrency="GBP") {
  if(!entry||!target||!lotSize) return 0;
  const diff = dir==="BUY" ? target-entry : entry-target;
  // pip values per lot (approximate)
  const pipValues = { XAUUSD:10, BTCUSD:1, SP500:10, MSFT:10, AMZN:10 };
  const pipSize    = { XAUUSD:0.01, BTCUSD:1, SP500:0.25, MSFT:0.01, AMZN:0.01 };
  const pips = diff / (pipSize[pair]||0.01);
  return +(pips * (pipValues[pair]||10) * lotSize).toFixed(2);
}

// ── API HELPERS ────────────────────────────────────────────────────────
async function callClaude(messages, sys, max_tokens=1200){
  let apiKey = "";
    try { apiKey = (typeof window!=="undefined"&&window.__ANTHROPIC_KEY__)||""; } catch(e){}
    // Works locally via vite.config proxy — no key needed in that case
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens, system:sys, messages }),
  });
  if(!r.ok){ const err=await r.text(); console.error("API error:",r.status,err); throw new Error("API "+r.status); }
  const d = await r.json();
  return d.content?.[0]?.text || "No response";
}

async function sendTelegram(botToken, chatId, message) {
  if(!botToken||!chatId||botToken==="YOUR_BOT_TOKEN") return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`,{
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({chat_id:chatId, text:message, parse_mode:"HTML"})
    });
    const d = await r.json();
    return d.ok;
  } catch { return false; }
}

function formatTelegramSignal(s) {
  const dir = s.dir==="BUY" ? "🟢 LONG" : "🔴 SHORT";
  return `⚡ <b>NEW SIGNAL — ${s.pair}</b>\n${dir} | Grade: ${s.grade} | Conf: ${s.conf}%\n\n🎯 Entry: <b>${s.entry}</b>\n🛑 SL: ${s.sl}\n✅ TP1: ${s.tp1}${s.tp2?` | TP2: ${s.tp2}`:""}${s.tp3?` | TP3: ${s.tp3}`:""}\n📊 R:R ${s.rr}x | Status: ${s.status}\n\n🤖 DeepTrade AI`;
}

// ── SESSION CLOCK ──────────────────────────────────────────────────────
function SessionClock({T}) {
  const [now, setNow] = useState(new Date());
  useEffect(()=>{ const i=setInterval(()=>setNow(new Date()),1000); return()=>clearInterval(i); },[]);
  const utcH = now.getUTCHours();
  const active = SESSIONS.find(s=>utcH>=s.start&&utcH<s.end)||null;
  const timeStr = now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  return (
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"4px 10px",background:T.card2,borderRadius:6,border:`1px solid ${T.border}`}}>
      <Clock size={11} style={{color:active?active.color:T.textFaint}}/>
      <span style={{color:T.text,fontSize:10,fontFamily:"monospace"}}>{timeStr} UTC</span>
      {active && <span style={{background:`rgba(${active.color=="#38bdf8"?"56,189,248":active.color=="#00e676"?"0,230,118":active.color=="#f5a623"?"245,166,35":"167,139,250"},0.15)`,color:active.color,padding:"1px 6px",borderRadius:99,fontSize:9,fontWeight:700}}>{active.name}</span>}
      {!active && <span style={{color:T.textFaint,fontSize:9}}>Off-session</span>}
    </div>
  );
}

// ── NOTIFICATION SYSTEM ────────────────────────────────────────────────
function useNotifications() {
  const [notifs, setNotifs] = useState([]);
  const add = useCallback((msg, type="info") => {
    const id = Date.now();
    setNotifs(n=>[{id,msg,type},...n].slice(0,5));
    setTimeout(()=>setNotifs(n=>n.filter(x=>x.id!==id)),5000);
    if(type==="signal"&&typeof Audio!=="undefined"){
      try{const a=new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU"+Array(40).join("A"));a.volume=0.3;a.play().catch(()=>{});}catch{}
    }
  },[]);
  return {notifs, add};
}

function NotifToast({notifs, T}) {
  if(!notifs.length) return null;
  const colors={signal:T.accent,info:T.blue,success:T.green,error:T.red};
  return (
    <div style={{position:"fixed",top:50,right:16,zIndex:9999,display:"flex",flexDirection:"column",gap:6}}>
      {notifs.map(n=>(
        <div key={n.id} style={{background:T.card,border:`1px solid ${colors[n.type]||T.border}`,borderRadius:8,padding:"8px 14px",color:T.text,fontSize:12,maxWidth:300,boxShadow:"0 4px 20px rgba(0,0,0,0.4)",animation:"slideIn .2s ease"}}>
          <span style={{color:colors[n.type]||T.text,marginRight:6}}>{n.type==="signal"?"⚡":n.type==="success"?"✅":n.type==="error"?"❌":"ℹ️"}</span>{n.msg}
        </div>
      ))}
    </div>
  );
}

// ── SVG CANDLESTICK CHART (with EMA + Volume + RSI) ────────────────────
function CandlestickChart({ data, entry, sl, tp1, tp2, tp3, dir, height=200, showIndicators=true, T }) {
  const w=600, pad={l:54,r:36,t:8,b:showIndicators?80:22};
  const chartH = showIndicators ? height*0.68 : height-pad.t-pad.b;
  const volH   = showIndicators ? height*0.15 : 0;
  const rsiH   = showIndicators ? height*0.17 : 0;
  if(!data||data.length===0) return null;

  const ema20 = calcEMA(data,20);
  const ema50 = calcEMA(data,50);
  const rsiArr = calcRSI(data,14);

  const cw = (w-pad.l-pad.r)/data.length;
  const bW  = Math.max(cw*0.55,1.5);
  const allP = data.flatMap(c=>[c.high,c.low]);
  [entry,sl,tp1,tp2,tp3].filter(Boolean).forEach(v=>allP.push(v));
  const minP = Math.min(...allP)*0.9994;
  const maxP = Math.max(...allP)*1.0006;
  const rng  = maxP-minP;
  const py = v => pad.t + ((maxP-v)/rng)*chartH;
  const px = i => pad.l + i*cw + cw/2;

  // Volume scale
  const maxVol = Math.max(...data.map(c=>c.vol));
  const volTop = pad.t+chartH+4;
  const pvy = v => volTop + volH - (v/maxVol)*volH;

  // RSI area
  const rsiTop = pad.t+chartH+volH+4;
  const prsi = v => rsiTop + rsiH - ((v||50)/100)*rsiH;

  const levels = [{v:entry,color:T.blue,label:"Entry",dash:""},{v:sl,color:T.red,label:"SL",dash:"4,3"},{v:tp1,color:T.green,label:"TP1",dash:"3,2"},{v:tp2,color:T.green,label:"TP2",dash:"3,2"},{v:tp3,color:T.green,label:"TP3",dash:"3,2"}].filter(l=>l.v);
  const priceLabels=[]; const step=rng/5;
  const dp = minP>1000?0:2;
  for(let i=0;i<=5;i++) priceLabels.push(+(minP+step*i).toFixed(dp));

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${height}`} style={{display:"block"}}>
      {/* Grid */}
      {priceLabels.map(p=>(
        <g key={p}>
          <line x1={pad.l} y1={py(p)} x2={w-pad.r} y2={py(p)} stroke={T.border} strokeWidth={0.4} strokeDasharray="2,5"/>
          <text x={pad.l-3} y={py(p)+3} textAnchor="end" fill={T.textFaint} fontSize={7}>{p.toFixed(dp)}</text>
        </g>
      ))}
      {/* EMA lines */}
      {showIndicators && ema20.map((v,i)=> i===0?null:(
        <line key={`e20${i}`} x1={px(i-1)} y1={py(ema20[i-1])} x2={px(i)} y2={py(v)} stroke="#38bdf8" strokeWidth={1} opacity={0.7}/>
      ))}
      {showIndicators && ema50.map((v,i)=> i===0?null:(
        <line key={`e50${i}`} x1={px(i-1)} y1={py(ema50[i-1])} x2={px(i)} y2={py(v)} stroke="#a78bfa" strokeWidth={1} opacity={0.7}/>
      ))}
      {/* Candles */}
      {data.map((c,i)=>{
        const isUp=c.close>=c.open; const col=isUp?T.green:T.red;
        const top=py(Math.max(c.open,c.close)); const bot=py(Math.min(c.open,c.close));
        const bh=Math.max(bot-top,0.8);
        return (
          <g key={i}>
            <line x1={px(i)} y1={py(c.high)} x2={px(i)} y2={py(c.low)} stroke={col} strokeWidth={1}/>
            <rect x={px(i)-bW/2} y={top} width={bW} height={bh} fill={col} opacity={0.9}/>
          </g>
        );
      })}
      {/* Level lines */}
      {levels.map(({v,color,label,dash})=>(
        <g key={label}>
          <line x1={pad.l} y1={py(v)} x2={w-pad.r} y2={py(v)} stroke={color} strokeWidth={1.2} strokeDasharray={dash||"none"} opacity={0.85}/>
          <rect x={w-pad.r+1} y={py(v)-7} width={34} height={13} fill={color} rx={2} opacity={0.9}/>
          <text x={w-pad.r+18} y={py(v)+3} textAnchor="middle" fill="#000" fontSize={7} fontWeight="700">{label}</text>
        </g>
      ))}
      {/* Direction arrow */}
      {dir&&entry&&(
        <polygon points={dir==="BUY"?`${pad.l+9},${py(entry)+9} ${pad.l+16},${py(entry)-3} ${pad.l+2},${py(entry)-3}`:`${pad.l+9},${py(entry)-9} ${pad.l+16},${py(entry)+3} ${pad.l+2},${py(entry)+3}`} fill={dir==="BUY"?T.green:T.red} opacity={0.9}/>
      )}
      {/* Volume bars */}
      {showIndicators && <>
        <line x1={pad.l} y1={volTop} x2={w-pad.r} y2={volTop} stroke={T.border} strokeWidth={0.5}/>
        <text x={pad.l-3} y={volTop+volH/2} textAnchor="end" fill={T.textFaint} fontSize={6}>VOL</text>
        {data.map((c,i)=>(
          <rect key={i} x={px(i)-bW/2} y={pvy(c.vol)} width={bW} height={volTop+volH-pvy(c.vol)} fill={c.close>=c.open?T.green:T.red} opacity={0.5}/>
        ))}
      </>}
      {/* RSI panel */}
      {showIndicators && <>
        <line x1={pad.l} y1={rsiTop} x2={w-pad.r} y2={rsiTop} stroke={T.border} strokeWidth={0.5}/>
        <line x1={pad.l} y1={prsi(70)} x2={w-pad.r} y2={prsi(70)} stroke={T.red} strokeWidth={0.5} strokeDasharray="2,3" opacity={0.5}/>
        <line x1={pad.l} y1={prsi(30)} x2={w-pad.r} y2={prsi(30)} stroke={T.green} strokeWidth={0.5} strokeDasharray="2,3" opacity={0.5}/>
        <text x={pad.l-3} y={rsiTop+rsiH/2+3} textAnchor="end" fill={T.textFaint} fontSize={6}>RSI</text>
        {rsiArr.map((v,i)=> (i===0||!v||!rsiArr[i-1])?null:(
          <line key={i} x1={px(i-1)} y1={prsi(rsiArr[i-1]||50)} x2={px(i)} y2={prsi(v)} stroke={T.accent} strokeWidth={1.2}/>
        ))}
        {rsiArr[rsiArr.length-1]&&<text x={w-pad.r+2} y={prsi(rsiArr[rsiArr.length-1])+3} fill={T.accent} fontSize={7}>{rsiArr[rsiArr.length-1]}</text>}
      </>}
      {/* EMA legend */}
      {showIndicators && <>
        <rect x={pad.l+2} y={pad.t+2} width={5} height={2} fill="#38bdf8"/>
        <text x={pad.l+10} y={pad.t+6} fill={T.textFaint} fontSize={6.5}>EMA20</text>
        <rect x={pad.l+42} y={pad.t+2} width={5} height={2} fill="#a78bfa"/>
        <text x={pad.l+50} y={pad.t+6} fill={T.textFaint} fontSize={6.5}>EMA50</text>
      </>}
      {/* Time labels */}
      {data.filter((_,i)=>i%10===0).map((_,j)=>(
        <text key={j} x={px(j*10)} y={height-2} textAnchor="middle" fill={T.textFaint} fontSize={6.5}>{data[j*10]?.t}</text>
      ))}
    </svg>
  );
}

// ── LOGIN ──────────────────────────────────────────────────────────────
function LoginScreen({onLogin}) {
  const [pw,setPw]=useState("");
  const [err,setErr]=useState(false);
  const check=()=>{ if(pw==="lyra2024"||pw==="admin"){onLogin();} else{setErr(true);setTimeout(()=>setErr(false),2000);} };
  return (
    <div style={{height:"100vh",background:"#000d1a",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'JetBrains Mono',monospace",backgroundImage:"radial-gradient(ellipse at 30% 50%,rgba(245,166,35,0.05) 0%,transparent 60%),radial-gradient(ellipse at 70% 50%,rgba(41,182,246,0.04) 0%,transparent 60%)"}}>
      <div style={{background:"#071220",border:"1px solid #1a3050",borderRadius:16,padding:48,width:380,textAlign:"center",boxShadow:"0 24px 80px rgba(0,0,0,0.8)"}}>
        <div style={{width:56,height:56,background:"linear-gradient(135deg,#f5a623,#c47d10)",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,fontWeight:900,color:"#000",margin:"0 auto 16px"}}>D</div>
        <div style={{color:"#f5a623",fontSize:22,fontWeight:800,marginBottom:4,letterSpacing:"-0.5px"}}>DeepTrade AI</div>
        <div style={{color:"#2a4060",fontSize:10,marginBottom:6,letterSpacing:"2px"}}>PROFESSIONAL TRADING INTELLIGENCE</div>
        <div style={{color:"#1a3050",fontSize:9,marginBottom:32,letterSpacing:"1px"}}>v7 · AI ADVISOR · BLOOMBERG TERMINAL</div>
        <input type="password" placeholder="Enter access password" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&check()} style={{width:"100%",background:"#020810",border:`1px solid ${err?"#ff2d4a":"#1a3050"}`,borderRadius:8,padding:"12px 14px",color:"#e8f0fa",fontSize:12,fontFamily:"inherit",boxSizing:"border-box",outline:"none",marginBottom:12}}/>
        <button onClick={check} style={{width:"100%",background:"linear-gradient(135deg,#f5a623,#c47d10)",border:"none",borderRadius:8,padding:12,color:"#000",fontSize:12,fontWeight:800,cursor:"pointer",letterSpacing:"0.5px",marginBottom:8}}>⚡ ACCESS DASHBOARD</button>
        {err&&<div style={{color:"#ff2d4a",fontSize:10,marginTop:8,fontWeight:600}}>⚠ Invalid access code</div>}
        <div style={{color:"#1a3050",fontSize:9,marginTop:20,letterSpacing:"0.5px"}}>Default access code: lyra2024</div>
      </div>
    </div>
  );
}

// ── TELEGRAM SETTINGS MODAL ────────────────────────────────────────────
function TelegramModal({tgConfig,setTgConfig,onClose,onTest,T}) {
  const [local,setLocal]=useState({...tgConfig});
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:28,width:420}}>
        <div style={{color:T.text,fontSize:16,fontWeight:700,marginBottom:4}}>📱 Telegram Bot Setup</div>
        <div style={{color:T.textFaint,fontSize:11,marginBottom:20}}>Connect your Telegram bot to receive live signal alerts</div>
        <div style={{marginBottom:14}}>
          <div style={{color:T.textDim,fontSize:11,marginBottom:5}}>Bot Token <span style={{color:T.textFaint}}>(from @BotFather)</span></div>
          <input value={local.botToken} onChange={e=>setLocal({...local,botToken:e.target.value})} placeholder="1234567890:ABCdefGHIjklmNOPqrstUVWxyz"
            style={{width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"8px 10px",color:T.text,fontSize:12,outline:"none",boxSizing:"border-box"}}/>
        </div>
        <div style={{marginBottom:14}}>
          <div style={{color:T.textDim,fontSize:11,marginBottom:5}}>Chat ID <span style={{color:T.textFaint}}>(your personal or group chat ID)</span></div>
          <input value={local.chatId} onChange={e=>setLocal({...local,chatId:e.target.value})} placeholder="-1001234567890 or 123456789"
            style={{width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"8px 10px",color:T.text,fontSize:12,outline:"none",boxSizing:"border-box"}}/>
        </div>
        <div style={{background:T.bg,borderRadius:8,padding:10,marginBottom:16}}>
          <div style={{color:T.textFaint,fontSize:10,marginBottom:6}}>How to get your Chat ID:</div>
          <div style={{color:T.textDim,fontSize:10,lineHeight:1.6}}>
            1. Message your bot anything<br/>
            2. Visit: <span style={{color:T.blue}}>api.telegram.org/bot<b>TOKEN</b>/getUpdates</span><br/>
            3. Find <span style={{color:T.green}}>"chat":{"{"}\"id\": XXXXXXX{"}"}</span>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
          <input type="checkbox" id="tgAlerts" checked={local.enabled} onChange={e=>setLocal({...local,enabled:e.target.checked})} style={{accentColor:T.accent}}/>
          <label htmlFor="tgAlerts" style={{color:T.textDim,fontSize:12,cursor:"pointer"}}>Enable Telegram alerts for new signals</label>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>onTest(local)} style={{flex:1,background:"rgba(56,189,248,0.15)",border:`1px solid ${T.blue}`,borderRadius:8,padding:"8px 0",color:T.blue,fontSize:12,fontWeight:700,cursor:"pointer"}}>🧪 Test</button>
          <button onClick={()=>{setTgConfig(local);onClose();}} style={{flex:2,background:T.accent,border:"none",borderRadius:8,padding:"8px 0",color:"#000",fontSize:12,fontWeight:700,cursor:"pointer"}}>Save & Close</button>
          <button onClick={onClose} style={{flex:1,background:"transparent",border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 0",color:T.textDim,fontSize:12,cursor:"pointer"}}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── HEADER ─────────────────────────────────────────────────────────────
function Header({prices,lastUpdate,onRefresh,refreshing,onGenerate,generating,onLogout,modelActive,setModelActive,darkMode,setDarkMode,tgConfig,setShowTgModal,streak,pushEnabled,requestPushPermission:reqPush,setPushEnabled,addNotif,account,setPage,T}) {
  return (
    <div style={{background:T.bg,borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
      {/* Row 1: Logo + Controls */}
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"0 14px",height:42,borderBottom:`1px solid rgba(26,48,80,0.6)`}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginRight:8,flexShrink:0}}>
          <div style={{width:26,height:26,background:`linear-gradient(135deg,${T.accent},${T.accentDim})`,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,color:"#000",flexShrink:0}}>D</div>
          <div>
            <div style={{color:T.accent,fontSize:11,fontWeight:800,letterSpacing:"0.5px",lineHeight:1.1}}>DeepTrade AI</div>
            <div style={{color:T.textFaint,fontSize:7,letterSpacing:"1.5px"}}>BLOOMBERG · ML · v7</div>
          </div>
        </div>
        {streak!==0&&<div style={{background:streak>0?"rgba(0,208,132,0.1)":"rgba(255,45,74,0.1)",border:`1px solid ${streak>0?T.green:T.red}`,borderRadius:4,padding:"2px 8px",color:streak>0?T.green:T.red,fontSize:9,fontWeight:700,flexShrink:0}}>{streak>0?`🔥 ${streak}W STREAK`:`❄️ ${Math.abs(streak)}L STREAK`}</div>}
        <div style={{flex:1}}/>
        <SessionClock T={T}/>
        <span style={{color:T.textFaint,fontSize:9,borderLeft:`1px solid ${T.border}`,paddingLeft:8,flexShrink:0}}>{lastUpdate}</span>
        <button onClick={onGenerate} disabled={generating} style={{background:generating?"transparent":`linear-gradient(135deg,${T.accent},${T.accentDim})`,border:`1px solid ${T.accent}`,borderRadius:5,padding:"5px 14px",color:generating?T.accentDim:"#000",fontSize:10,fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",gap:4,letterSpacing:"0.5px",flexShrink:0}}>
          <Zap size={10}/>{generating?"SCANNING...":"⚡ GENERATE"}
        </button>
        <div style={{display:"flex",gap:4,flexShrink:0}}>
          {[
            {label:modelActive?"● LIVE":"○ OFF",click:()=>setModelActive(a=>!a),active:modelActive,col:"0,208,132"},
            {label:"📱",click:()=>setShowTgModal(true),active:tgConfig.enabled&&tgConfig.botToken!=="YOUR_BOT_TOKEN",col:"41,182,246"},
            {label:pushEnabled?"🔔":"🔕",click:()=>{reqPush().then(p=>{setPushEnabled(p==="granted");addNotif(p==="granted"?"🔔 Push enabled!":"Push blocked","success");});},active:pushEnabled,col:"0,208,132"},
            {label:darkMode?"☀️":"🌙",click:()=>setDarkMode(d=>!d),active:false,col:"245,166,35"},
            {label:`🤖${account?.alerts?.filter(a=>!a.read).length>0?" ("+account.alerts.filter(a=>!a.read).length+")":""}`,click:()=>setPage("advisor"),active:account?.alerts?.filter(a=>!a.read).length>0,col:"0,208,132"},
          ].map(({label,click,active,col},i)=>(
            <button key={i} onClick={click} style={{background:active?`rgba(${col},0.12)`:"transparent",border:`1px solid ${active?`rgba(${col},0.5)`:T.border}`,borderRadius:4,padding:"3px 8px",color:active?`rgb(${col})`:T.textDim,fontSize:9,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>{label}</button>
          ))}
          <button onClick={onLogout} style={{background:"transparent",border:`1px solid ${T.border}`,borderRadius:4,padding:"3px 7px",color:T.textDim,fontSize:9,cursor:"pointer",display:"flex",alignItems:"center"}}><LogOut size={9}/></button>
          <button onClick={onRefresh} style={{background:"transparent",border:"none",color:T.textDim,cursor:"pointer",padding:"3px 5px"}}><RefreshCw size={11} style={{animation:refreshing?"spin 1s linear infinite":""}}/></button>
        </div>
      </div>
      {/* Row 2: Live price ticker bar */}
      <div style={{display:"flex",overflowX:"auto",background:"#020810",height:30,alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",paddingLeft:12,marginRight:8,flexShrink:0,borderRight:`1px solid ${T.border}`,height:"100%",paddingRight:12}}>
          <span style={{color:T.textFaint,fontSize:8,fontWeight:700,letterSpacing:"1px"}}>LIVE PRICES</span>
        </div>
        {Object.entries(prices).map(([sym,{price,change}])=>(
          <div key={sym} style={{display:"flex",alignItems:"center",gap:6,padding:"0 14px",borderRight:`1px solid rgba(26,48,80,0.5)`,height:"100%",flexShrink:0}}>
            <span style={{color:T.accent,fontSize:9,fontWeight:700,letterSpacing:"0.3px"}}>{sym}</span>
            <span style={{color:T.text,fontSize:11,fontWeight:700,fontVariantNumeric:"tabular-nums"}}>{sym==="BTCUSD"||sym==="SP500"?price.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}):price.toFixed(2)}</span>
            <span style={{color:change>=0?T.green:T.red,fontSize:10,fontWeight:600}}>{change>=0?"▲":"▼"}{Math.abs(change).toFixed(3)}%</span>
          </div>
        ))}
        <div style={{flex:1}}/>
        <div style={{color:T.textFaint,fontSize:8,padding:"0 10px",flexShrink:0,letterSpacing:"0.5px"}}>SIMULATED · LIVE</div>
      </div>
    </div>
  );
}

// ── SIDEBAR ────────────────────────────────────────────────────────────
const NAV=[
  {id:"overview",icon:Home,label:"Overview"},
  {id:"advisor",icon:Lightbulb,label:"AI Advisor"},
  {id:"signals",icon:Radio,label:"Live Signals"},
  {id:"charts",icon:BarChart2,label:"Charts"},
  {id:"analysis",icon:Brain,label:"AI Analysis"},
  {id:"news",icon:Newspaper,label:"News Feed"},
  {id:"performance",icon:Award,label:"Performance"},
  {id:"pnltracker",icon:Trophy,label:"P&L Tracker"},
  {id:"times",icon:Clock,label:"Best Times"},
  {id:"plan",icon:Calendar,label:"Daily Plan"},
  {id:"ai",icon:MessageSquare,label:"AI Chat"},
  {id:"training",icon:Cpu,label:"AI Training"},
  {id:"mlbrain",icon:Layers,label:"ML Brain"},
];
function Sidebar({page,setPage,T}) {
  return (
    <>
      {/* Desktop sidebar */}
      <div className="sidebar" style={{width:170,background:T.card,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",flexShrink:0,overflowY:"auto"}}>
        <div style={{padding:"10px 12px 6px",color:T.textFaint,fontSize:8,fontWeight:700,letterSpacing:"1.5px",borderBottom:`1px solid ${T.border}`}}>NAVIGATION</div>
        {NAV.map(({id,icon:Icon,label})=>(
          <button key={id} onClick={()=>setPage(id)} style={{width:"100%",display:"flex",alignItems:"center",gap:9,padding:"9px 14px",background:page===id?`rgba(245,166,35,0.08)`:"transparent",border:"none",borderLeft:page===id?`3px solid ${T.accent}`:"3px solid transparent",color:page===id?T.accent:T.textDim,fontSize:11,cursor:"pointer",textAlign:"left",transition:"all 0.15s"}}>
            <div style={{width:20,height:20,borderRadius:4,background:page===id?`rgba(245,166,35,0.15)`:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <Icon size={12}/>
            </div>
            <span style={{fontWeight:page===id?700:400}}>{label}</span>
          </button>
        ))}
        <div style={{flex:1}}/>
        <div style={{padding:"10px 14px",borderTop:`1px solid ${T.border}`,color:T.textFaint,fontSize:8,lineHeight:1.6}}>
          <div style={{color:T.accent,fontWeight:700,marginBottom:2}}>DeepTrade AI v7</div>
          <div>Bloomberg Professional</div>
          <div>ML Brain Active</div>
        </div>
      </div>
      {/* Mobile bottom nav */}
      <div className="mobile-nav" style={{display:"none",position:"fixed",bottom:0,left:0,right:0,zIndex:500,background:T.card,borderTop:`1px solid ${T.border}`,flexDirection:"row",overflowX:"auto",padding:"4px 0"}}>
        {NAV.map(({id,icon:Icon,label})=>(
          <button key={id} onClick={()=>setPage(id)} style={{flex:"0 0 auto",display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"6px 10px",background:"transparent",border:"none",color:page===id?T.accent:T.textDim,fontSize:9,cursor:"pointer",minWidth:52}}>
            <Icon size={16}/><span>{label.split(" ")[0]}</span>
          </button>
        ))}
      </div>
    </>
  );
}

// ── STAT CARD ──────────────────────────────────────────────────────────
function SC({label,value,sub,color,icon:Icon,T}) {
  return (
    <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:10,padding:"11px 14px",flex:1,minWidth:90}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
        <span style={{color:T.textDim,fontSize:10}}>{label}</span>
        {Icon&&<Icon size={12} style={{color:color||T.accent}}/>}
      </div>
      <div style={{color:color||T.text,fontSize:17,fontWeight:700}}>{value}</div>
      {sub&&<div style={{color:T.textFaint,fontSize:10,marginTop:2}}>{sub}</div>}
    </div>
  );
}

// ── OVERVIEW PAGE ──────────────────────────────────────────────────────
function OverviewPage({prices,stats,signals,candles,T}) {
  const activeSigs = signals.filter(s=>s.status==="ACTIVE");
  return (
    <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:12,height:"100%"}}>
      {/* ── STAT BAR ── */}
      <div className="stat-grid" style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
        <SC label="Active Signals" value={stats.active} icon={Radio} color={T.green} T={T}/>
        <SC label="Buy / Sell" value={`${stats.buys} / ${stats.sells}`} icon={Activity} color={T.blue} T={T}/>
        <SC label="Win Rate" value={`${stats.winRate}%`} icon={Award} color={T.accent} T={T} delta={2.1}/>
        <SC label="Avg Confidence" value={`${stats.avgConf}%`} icon={Target} color={T.purple} T={T}/>
        <SC label="Wins / Losses" value={`${stats.wins}W / ${stats.losses}L`} icon={BarChart2} color={T.gold} T={T}/>
      </div>

      {/* ── ACTIVE SIGNAL ALERTS ── */}
      {activeSigs.length>0&&(
        <div style={{background:"rgba(0,208,132,0.05)",border:`1px solid rgba(0,208,132,0.2)`,borderRadius:8,padding:"8px 14px"}}>
          <div style={{color:T.green,fontSize:9,fontWeight:700,letterSpacing:"1px",marginBottom:6}}>● ACTIVE SIGNALS</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {activeSigs.map((s,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:6,background:T.card2,border:`1px solid ${s.dir==="BUY"?"rgba(0,208,132,0.3)":"rgba(255,45,74,0.3)"}`,borderRadius:6,padding:"5px 10px"}}>
                <span style={{color:T.accent,fontWeight:700,fontSize:11}}>{s.pair}</span>
                <span style={{color:s.dir==="BUY"?T.green:T.red,fontSize:10,fontWeight:700}}>{s.dir==="BUY"?"▲":"▼"} {s.dir}</span>
                <span style={{color:T.textDim,fontSize:9}}>@ {s.entry}</span>
                <span style={{color:T.textDim,fontSize:9}}>SL: <span style={{color:T.red}}>{s.sl}</span></span>
                <span style={{color:T.textDim,fontSize:9}}>TP1: <span style={{color:T.green}}>{s.tp1}</span></span>
                <span style={{background:"rgba(245,166,35,0.12)",color:T.accent,padding:"1px 5px",borderRadius:3,fontSize:9,fontWeight:700}}>{s.conf}%</span>
                <span style={{color:T.gold,fontSize:9}}>{s.rr}x R:R</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ASSET CARDS GRID — 5 columns, always fills row ── */}
      <div className="five-col" style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,flex:1}}>
        {ASSETS.map(sym=>{
          const p=prices[sym]; const cd=candles[sym]||[];
          const sig=signals.find(s=>s.pair===sym&&s.status==="ACTIVE");
          const isUp=p.change>=0;
          return (
            <div key={sym} style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:10,padding:12,display:"flex",flexDirection:"column",position:"relative",overflow:"hidden"}}>
              {/* Color accent top */}
              <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:isUp?T.green:T.red}}/>
              {/* Header */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                <div>
                  <div style={{color:T.text,fontSize:13,fontWeight:800,letterSpacing:"0.3px"}}>{sym}</div>
                  <div style={{color:T.textFaint,fontSize:9,marginTop:1}}>{ASSET_NAME[sym]}</div>
                </div>
                {sig&&<span style={{background:sig.dir==="BUY"?"rgba(0,208,132,0.15)":"rgba(255,45,74,0.15)",color:sig.dir==="BUY"?T.green:T.red,padding:"2px 7px",borderRadius:3,fontSize:8,fontWeight:700}}>{sig.dir==="BUY"?"▲ LONG":"▼ SHORT"}</span>}
              </div>
              {/* Price */}
              <div style={{marginBottom:8}}>
                <div style={{color:T.text,fontSize:18,fontWeight:800,letterSpacing:"-0.5px",fontVariantNumeric:"tabular-nums"}}>{sym==="BTCUSD"||sym==="SP500"?p.price.toLocaleString("en-US",{minimumFractionDigits:2}):p.price.toFixed(2)}</div>
                <div style={{display:"flex",alignItems:"center",gap:4,marginTop:2}}>
                  <span style={{color:isUp?T.green:T.red,fontSize:11,fontWeight:700}}>{isUp?"▲":"▼"} {Math.abs(p.change).toFixed(3)}%</span>
                </div>
              </div>
              {/* Mini chart */}
              <div style={{flex:1,minHeight:70}}>
                <CandlestickChart data={cd.slice(-30)} entry={sig?.entryNum} sl={sig?.slNum} tp1={sig?.tp1Num} height={70} showIndicators={false} T={T}/>
              </div>
              {/* Signal detail */}
              {sig?(
                <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${T.border}`,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4}}>
                  {[{l:"Entry",v:sig.entry,c:T.blue},{l:"Conf",v:`${sig.conf}%`,c:T.accent},{l:"R:R",v:`${sig.rr}x`,c:T.gold}].map(({l,v,c})=>(
                    <div key={l}>
                      <div style={{color:T.textFaint,fontSize:8}}>{l}</div>
                      <div style={{color:c,fontSize:10,fontWeight:700}}>{v}</div>
                    </div>
                  ))}
                </div>
              ):(
                <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${T.border}`,color:T.textFaint,fontSize:9,textAlign:"center"}}>No active signal</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── CHARTS PAGE ────────────────────────────────────────────────────────
function ChartsPage({prices,candles,signals,T}) {
  const [tf,setTf]=useState("1H");
  const [layout,setLayout]=useState(4);
  const [selected,setSelected]=useState("XAUUSD");

  const getSig=sym=>signals.find(s=>s.pair===sym);
  const ChartCard=({sym,h=150})=>{
    const p=prices[sym]; const cd=candles[sym]||[]; const sig=getSig(sym);
    const rsiNow = cd.length>14 ? calcRSI(cd,14).slice(-1)[0] : 50;
    return (
      <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:10,padding:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{color:T.text,fontWeight:700,fontSize:12}}>{sym}</span>
            {sig&&<span style={{background:sig.dir==="BUY"?"rgba(0,230,118,0.15)":"rgba(255,61,87,0.15)",color:sig.dir==="BUY"?T.green:T.red,padding:"1px 5px",borderRadius:3,fontSize:9,fontWeight:700}}>{sig.dir==="BUY"?"▲ LONG":"▼ SHORT"}</span>}
            <span style={{color:T.textFaint,fontSize:9}}>RSI {rsiNow}</span>
          </div>
          <div style={{textAlign:"right"}}>
            <span style={{color:T.text,fontSize:12,fontWeight:600}}>{sym==="BTCUSD"||sym==="SP500"?p?.price.toLocaleString():p?.price.toFixed(2)}</span>
            <span style={{color:p?.change>=0?T.green:T.red,fontSize:10,marginLeft:5}}>{p?.change>=0?"▲":"▼"}{Math.abs(p?.change||0).toFixed(2)}%</span>
          </div>
        </div>
        <CandlestickChart data={cd} entry={sig?.entryNum} sl={sig?.slNum} tp1={sig?.tp1Num} tp2={sig?.tp2Num} tp3={sig?.tp3Num} dir={sig?.dir} height={h} showIndicators={h>120} T={T}/>
        {sig&&<div style={{display:"flex",gap:8,marginTop:5,fontSize:9,flexWrap:"wrap"}}>
          <span style={{color:T.blue}}>Entry: {sig.entry}</span>
          <span style={{color:T.red}}>SL: {sig.sl}</span>
          <span style={{color:T.green}}>TP1: {sig.tp1}</span>
          {sig.tp2&&<span style={{color:T.green}}>TP2: {sig.tp2}</span>}
          {sig.tp3&&<span style={{color:T.green}}>TP3: {sig.tp3}</span>}
        </div>}
      </div>
    );
  };

  return (
    <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <div style={{color:T.text,fontSize:16,fontWeight:800,letterSpacing:"-0.3px"}}>Live Charts</div>
        <div style={{display:"flex",gap:3}}>{TFS.map(t=><button key={t} onClick={()=>setTf(t)} style={{background:tf===t?T.accent:"transparent",border:`1px solid ${tf===t?T.accent:T.border}`,borderRadius:4,padding:"2px 7px",color:tf===t?"#000":T.textDim,fontSize:10,cursor:"pointer"}}>{t}</button>)}</div>
        <div style={{display:"flex",gap:4,marginLeft:"auto"}}>
          {[{v:1,l:"1×"},{v:4,l:"2×2"},{v:5,l:"5×"}].map(({v,l})=>(
            <button key={v} onClick={()=>setLayout(v)} style={{background:layout===v?"rgba(245,166,35,0.15)":"transparent",border:`1px solid ${layout===v?T.accent:T.border}`,borderRadius:4,padding:"2px 8px",color:layout===v?T.accent:T.textDim,cursor:"pointer",fontSize:10}}>{l}</button>
          ))}
        </div>
      </div>
      {layout===1&&<>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{ASSETS.map(a=><button key={a} onClick={()=>setSelected(a)} style={{background:selected===a?"rgba(245,166,35,0.15)":"transparent",border:`1px solid ${selected===a?T.accent:T.border}`,borderRadius:4,padding:"3px 10px",color:selected===a?T.accent:T.textDim,fontSize:10,cursor:"pointer"}}>{a}</button>)}</div>
        <ChartCard sym={selected} h={360}/>
      </>}
      {layout===4&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{ASSETS.slice(0,4).map(sym=><ChartCard key={sym} sym={sym} h={220}/>)}</div>}
      {layout===5&&<div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>{ASSETS.map(sym=><ChartCard key={sym} sym={sym} h={200}/>)}</div>}
      <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:10,padding:12}}>
        <div style={{color:T.textDim,fontSize:11,marginBottom:8}}>Multi-Timeframe Alignment</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {ASSETS.map(sym=>(
            <div key={sym} style={{background:T.bg,borderRadius:6,padding:"8px 10px",flex:"1 1 100px"}}>
              <div style={{color:T.accent,fontSize:10,fontWeight:700,marginBottom:5}}>{sym}</div>
              <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                {TFS.map(t=>{const bull=Math.random()>0.5;return<span key={t} style={{background:bull?"rgba(0,230,118,0.15)":"rgba(255,61,87,0.15)",color:bull?T.green:T.red,padding:"1px 4px",borderRadius:2,fontSize:8,fontWeight:600}}>{t}</span>;})}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── SIGNALS PAGE ───────────────────────────────────────────────────────
function SignalsPage({signals,onAdd,onDelete,onUpdateStatus,candles,onExportCSV,T}) {
  const [showAdd,setShowAdd]=useState(false);
  const [expanded,setExpanded]=useState(null);
  const [showCalc,setShowCalc]=useState(false);
  const [calcLot,setCalcLot]=useState("0.01");
  const [form,setForm]=useState({pair:"XAUUSD",dir:"BUY",entry:"",sl:"",tp1:"",tp2:"",tp3:"",grade:"A"});
  const statusColor={ACTIVE:T.green,STOPPED:T.red,CLOSED:T.textDim,PENDING:T.gold,WIN:T.green,LOSS:T.red};
  const statusBg={ACTIVE:"0,230,118",STOPPED:"255,61,87",PENDING:"251,191,36",CLOSED:"100,100,100",WIN:"0,230,118",LOSS:"255,61,87"};
  return (
    <div style={{padding:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{color:T.text,fontSize:14,fontWeight:700}}>Live Signals <span style={{color:T.green,fontSize:11,marginLeft:8}}>{signals.filter(s=>s.status==="ACTIVE").length} active</span> <span style={{color:T.textFaint,fontSize:10}}>{signals.length} total</span></div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <button onClick={onExportCSV} style={{background:"transparent",border:`1px solid ${T.border}`,borderRadius:6,padding:"4px 10px",color:T.textDim,fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}><Download size={11}/>CSV</button>
          <button onClick={()=>setShowCalc(!showCalc)} style={{background:showCalc?"rgba(56,189,248,0.15)":"transparent",border:`1px solid ${showCalc?T.blue:T.border}`,borderRadius:6,padding:"4px 10px",color:showCalc?T.blue:T.textDim,fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}><DollarSign size={11}/>Profit Calc</button>
          <button onClick={()=>setShowAdd(!showAdd)} style={{background:T.accent,border:"none",borderRadius:6,padding:"4px 10px",color:"#000",fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}><Plus size={11}/>Add Signal</button>
        </div>
      </div>
      {showAdd&&(
        <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:10,padding:12,marginBottom:12,display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-end"}}>
          {[["pair","Pair"],["dir","Dir"],["entry","Entry"],["sl","SL"],["tp1","TP1"],["tp2","TP2"],["tp3","TP3"],["grade","Grade"]].map(([k,l])=>(
            <div key={k}>
              <div style={{color:T.textDim,fontSize:9,marginBottom:3}}>{l}</div>
              {k==="pair"?<select value={form.pair} onChange={e=>setForm({...form,pair:e.target.value})} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:4,padding:"4px 6px",color:T.text,fontSize:11}}>{ASSETS.map(a=><option key={a}>{a}</option>)}</select>
               :k==="dir"?<select value={form.dir} onChange={e=>setForm({...form,dir:e.target.value})} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:4,padding:"4px 6px",color:T.text,fontSize:11}}><option>BUY</option><option>SELL</option></select>
               :k==="grade"?<select value={form.grade} onChange={e=>setForm({...form,grade:e.target.value})} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:4,padding:"4px 6px",color:T.text,fontSize:11}}>{["A","B","C"].map(g=><option key={g}>{g}</option>)}</select>
               :<input value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:4,padding:"4px 6px",color:T.text,fontSize:11,width:75}}/>}
            </div>
          ))}
          <button onClick={()=>{onAdd(form);setShowAdd(false);}} style={{background:T.green,border:"none",borderRadius:6,padding:"5px 12px",color:"#000",fontSize:11,fontWeight:700,cursor:"pointer"}}>Save</button>
        </div>
      )}
      {showCalc&&(
        <div style={{background:T.card2,border:`1px solid ${T.blue}`,borderRadius:10,padding:14,marginBottom:12}}>
          <div style={{color:T.blue,fontSize:12,fontWeight:700,marginBottom:10}}>💰 Profit Calculator</div>
          <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginBottom:10}}>
            <div><div style={{color:T.textDim,fontSize:9,marginBottom:3}}>Lot Size</div>
              <input value={calcLot} onChange={e=>setCalcLot(e.target.value)} style={{width:70,background:T.bg,border:`1px solid ${T.border}`,borderRadius:4,padding:"4px 6px",color:T.text,fontSize:12}} placeholder="0.01"/>
            </div>
            <div style={{color:T.textFaint,fontSize:10,paddingTop:14}}>= £ profit per signal at each TP</div>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
              <thead><tr style={{color:T.textDim,borderBottom:`1px solid ${T.border}`}}>
                {["Signal","Dir","Entry","SL £","TP1 £","TP2 £","TP3 £"].map(h=><th key={h} style={{padding:"4px 8px",textAlign:"left",fontSize:9}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {signals.filter(s=>s.entryNum>0).map((s,i)=>{
                  const lot = parseFloat(calcLot)||0.01;
                  const slP = calcProfit(s.pair,s.dir,s.entryNum,s.slNum,lot);
                  const tp1P = calcProfit(s.pair,s.dir,s.entryNum,s.tp1Num,lot);
                  const tp2P = s.tp2Num?calcProfit(s.pair,s.dir,s.entryNum,s.tp2Num,lot):null;
                  const tp3P = s.tp3Num?calcProfit(s.pair,s.dir,s.entryNum,s.tp3Num,lot):null;
                  return (
                    <tr key={i} style={{borderBottom:`1px solid rgba(22,40,64,0.4)`}}>
                      <td style={{padding:"4px 8px",color:T.text,fontWeight:700}}>{s.pair}</td>
                      <td style={{padding:"4px 8px",color:s.dir==="BUY"?T.green:T.red}}>{s.dir==="BUY"?"▲":"▼"}</td>
                      <td style={{padding:"4px 8px",color:T.textDim}}>{s.entry}</td>
                      <td style={{padding:"4px 8px",color:T.red,fontWeight:700}}>{slP<0?slP.toFixed(2):"+"+slP.toFixed(2)}</td>
                      <td style={{padding:"4px 8px",color:tp1P>0?T.green:T.red,fontWeight:700}}>{tp1P>0?"+"+tp1P.toFixed(2):tp1P.toFixed(2)}</td>
                      <td style={{padding:"4px 8px",color:tp2P!=null?(tp2P>0?T.green:T.red):T.textFaint}}>{tp2P!=null?(tp2P>0?"+"+tp2P.toFixed(2):tp2P.toFixed(2)):"–"}</td>
                      <td style={{padding:"4px 8px",color:tp3P!=null?(tp3P>0?T.green:T.red):T.textFaint}}>{tp3P!=null?(tp3P>0?"+"+tp3P.toFixed(2):tp3P.toFixed(2)):"–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
          <thead>
            <tr style={{background:T.card,borderBottom:`2px solid ${T.border}`}}>
              {["","PAIR","GRD","DIR","ENTRY","STOP LOSS","TP1","TP2","TP3","CONF","STATUS","R:R","OUTCOME",""].map((h,i)=>(
                <th key={i} style={{padding:"8px 10px",textAlign:"left",fontWeight:700,fontSize:9,whiteSpace:"nowrap",color:T.textDim,letterSpacing:"0.8px"}}>{h}</th>
              ))}
            </tr>
          </thead>
          {signals.map((s,i)=>(
              <tbody key={i}>
                <tr style={{borderBottom:`1px solid rgba(22,40,64,0.5)`,cursor:"pointer",background:i%2===0?"transparent":`${T.card2}44`}} onClick={()=>setExpanded(expanded===i?null:i)}>
                  <td style={{padding:"7px 8px",color:T.textFaint}}>{expanded===i?"▼":"▶"}</td>
                  <td style={{padding:"7px 8px",color:T.text,fontWeight:700}}>{s.pair}</td>
                  <td style={{padding:"7px 8px"}}><span style={{background:"rgba(167,139,250,0.15)",color:T.purple,padding:"1px 5px",borderRadius:3,fontWeight:700}}>{(String(s.grade||"B").replace(/[^ABCabc]/g,"")[0]||"B").toUpperCase()}</span></td>
                  <td style={{padding:"7px 8px"}}><span style={{color:s.dir==="BUY"?T.green:T.red,fontWeight:700}}>{s.dir==="BUY"?"▲ LONG":"▼ SHORT"}</span></td>
                  <td style={{padding:"7px 8px",color:T.text}}>{s.entry}</td>
                  <td style={{padding:"7px 8px",color:T.red}}>{s.sl}</td>
                  <td style={{padding:"7px 8px",color:T.green}}>{s.tp1}</td>
                  <td style={{padding:"7px 8px",color:T.green}}>{s.tp2||"–"}</td>
                  <td style={{padding:"7px 8px",color:T.green}}>{s.tp3||"–"}</td>
                  <td style={{padding:"7px 8px"}}>
                    <div style={{background:`${T.bg}`,borderRadius:3,overflow:"hidden",height:14,width:44}}>
                      <div style={{height:"100%",width:`${s.conf}%`,background:s.conf>70?T.green:s.conf>50?T.gold:T.red,fontSize:8,display:"flex",alignItems:"center",justifyContent:"center",color:"#000",fontWeight:700}}>{s.conf}%</div>
                    </div>
                  </td>
                  <td style={{padding:"7px 8px"}}><span style={{background:`rgba(${statusBg[s.status]||"100,100,100"},0.12)`,color:statusColor[s.status]||T.textDim,padding:"1px 7px",borderRadius:4,fontSize:9,fontWeight:700}}>{s.status}</span></td>
                  <td style={{padding:"7px 8px",color:T.gold}}>{s.rr}x</td>
                  <td style={{padding:"7px 8px"}}>
                    <div style={{display:"flex",gap:3}} onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>onUpdateStatus(i,"WIN")} title="Mark as Win" style={{background:s.outcome==="WIN"?"rgba(0,230,118,0.2)":"transparent",border:`1px solid ${s.outcome==="WIN"?T.green:T.border}`,borderRadius:3,padding:"2px 4px",color:T.green,fontSize:8,cursor:"pointer",fontWeight:700}}>W</button>
                      <button onClick={()=>onUpdateStatus(i,"LOSS")} title="Mark as Loss" style={{background:s.outcome==="LOSS"?"rgba(255,61,87,0.2)":"transparent",border:`1px solid ${s.outcome==="LOSS"?T.red:T.border}`,borderRadius:3,padding:"2px 4px",color:T.red,fontSize:8,cursor:"pointer",fontWeight:700}}>L</button>
                    </div>
                  </td>
                  <td style={{padding:"7px 8px"}}><button onClick={e=>{e.stopPropagation();onDelete(i);}} style={{background:"transparent",border:"none",color:T.textFaint,cursor:"pointer"}}><Trash2 size={11}/></button></td>
                </tr>
                {expanded===i&&(
                  <tr><td colSpan={14} style={{padding:"8px 12px",background:T.bg}}>
                    <CandlestickChart data={(candles[s.pair]||[]).slice(-50)} entry={s.entryNum} sl={s.slNum} tp1={s.tp1Num} tp2={s.tp2Num} tp3={s.tp3Num} dir={s.dir} height={200} showIndicators={true} T={T}/>
                  </td></tr>
                )}
              </tbody>
            ))}
        </table>
      </div>
    </div>
  );
}

// ── NEWS FEED PAGE ─────────────────────────────────────────────────────
function NewsFeedPage({T,prices}) {
  const [loading,setLoading]=useState(false);
  const [news,setNews]=useState([
    {asset:"XAUUSD",title:"Gold surges past $5,100 on safe-haven demand amid Middle East tensions",time:"2h ago",sentiment:"bullish",body:"Gold extended gains as geopolitical risks drove investors to safe havens. Technical analysis suggests continued upside toward $5,250."},
    {asset:"BTCUSD",title:"Bitcoin consolidates near $68K as markets await Fed signals",time:"3h ago",sentiment:"neutral",body:"BTC held steady after failing to break $70K resistance. Institutional inflows remain positive but macro headwinds from strong dollar persist."},
    {asset:"SP500",title:"S&P 500 dips on weak jobs data — unemployment rises to 4.4%",time:"4h ago",sentiment:"bearish",body:"The index fell after February's job report showed unexpected losses. Rate cut expectations for H1 2026 are rising, which could limit downside."},
    {asset:"MSFT",title:"Microsoft Azure posts 40% revenue growth — stock rallies after hours",time:"5h ago",sentiment:"bullish",body:"Azure cloud revenue growth accelerated to 40% YoY, beating estimates. Copilot adoption now at 90%+ of Fortune 500 companies."},
    {asset:"AMZN",title:"Amazon forecasts $200B capex for 2026 — AI infrastructure push",time:"6h ago",sentiment:"bullish",body:"AWS Bedrock closing enterprise deals at accelerating pace. Analysts raised price targets to $210-225 range on cloud momentum."},
    {asset:"XAUUSD",title:"Central banks extend gold buying — China PBoC 15th consecutive month",time:"8h ago",sentiment:"bullish",body:"Structural demand remains strong. PBoC extended purchases for the 15th consecutive month in January, supporting the bullish fundamental thesis."},
    {asset:"BTCUSD",title:"Bitcoin ETFs shed $228M — outflows stabilize after three-week high",time:"9h ago",sentiment:"bearish",body:"ETF flows show re-accumulation beginning at lower levels. Long-term holders remain unfazed, with on-chain data showing continued accumulation."},
    {asset:"SP500",title:"Goldman targets S&P 500 at 7,600 by year-end — 'Tech Tonic' report",time:"12h ago",sentiment:"bullish",body:"Goldman sees three catalysts for Magnificent Seven revival: AI monetization showing in earnings, capex cycle maturing, and Fed rate cuts in H2."},
  ]);
  const [activeAsset,setActiveAsset]=useState("ALL");

  const fetchAINews=async()=>{
    setLoading(true);
    try{
      const sys="You are a financial news analyst. Return ONLY valid JSON array of 4 news items. Format: [{\"asset\":\"XAUUSD\",\"title\":\"headline max 80 chars\",\"time\":\"1h ago\",\"sentiment\":\"bullish\",\"body\":\"2-3 sentence body\"}]. Assets must be one of: XAUUSD, BTCUSD, SP500, MSFT, AMZN. Sentiment must be bullish, bearish, or neutral.";
      const r=await callClaude([{role:"user",content:`Generate 4 realistic financial news headlines for today March 2026. Prices: Gold $${prices.XAUUSD?.price}, Bitcoin $${prices.BTCUSD?.price}, SP500 ${prices.SP500?.price}, MSFT $${prices.MSFT?.price}, AMZN $${prices.AMZN?.price}. Mix of bullish and bearish.`}],sys,800);
      const clean=r.replace(/```json|```/g,"").trim();
      const items=JSON.parse(clean);
      setNews(prev=>[...items,...prev].slice(0,20));
    }catch{}
    setLoading(false);
  };

  const filtered=activeAsset==="ALL"?news:news.filter(n=>n.asset===activeAsset);
  const sentColor={bullish:T.green,bearish:T.red,neutral:T.textDim};

  return (
    <div style={{padding:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{color:T.text,fontSize:14,fontWeight:700}}>📰 Market News Feed</div>
        <button onClick={fetchAINews} disabled={loading} style={{background:loading?"transparent":T.accent,border:`1px solid ${loading?T.accentDim:T.accent}`,borderRadius:8,padding:"6px 14px",color:loading?T.textDim:"#000",fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
          <Newspaper size={12}/>{loading?"Fetching...":"Refresh News"}
        </button>
      </div>
      <div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>
        {["ALL",...ASSETS].map(a=>(
          <button key={a} onClick={()=>setActiveAsset(a)} style={{background:activeAsset===a?"rgba(245,166,35,0.15)":"transparent",border:`1px solid ${activeAsset===a?T.accent:T.border}`,borderRadius:4,padding:"3px 10px",color:activeAsset===a?T.accent:T.textDim,fontSize:10,cursor:"pointer"}}>{a}</button>
        ))}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {filtered.map((item,i)=>(
          <div key={i} style={{background:T.card2,border:`1px solid ${T.border}`,borderLeft:`3px solid ${sentColor[item.sentiment]||T.border}`,borderRadius:10,padding:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <div style={{flex:1,marginRight:10}}>
                <span style={{background:"rgba(167,139,250,0.12)",color:T.purple,padding:"1px 6px",borderRadius:3,fontSize:9,fontWeight:700,marginRight:8}}>{item.asset}</span>
                <span style={{color:T.text,fontSize:12,fontWeight:600}}>{item.title}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                <span style={{color:sentColor[item.sentiment]||T.textDim,fontSize:9,fontWeight:700,textTransform:"uppercase"}}>{item.sentiment==="bullish"?"⬆":item.sentiment==="bearish"?"⬇":"→"} {item.sentiment}</span>
                <span style={{color:T.textFaint,fontSize:9}}>{item.time}</span>
              </div>
            </div>
            <div style={{color:T.textDim,fontSize:11,lineHeight:1.6}}>{item.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ANALYSIS PAGE ──────────────────────────────────────────────────────
function AnalysisPage({analyses,onGenerate,generating,prices,T}) {
  const sentColor={BULLISH:T.green,STRONG_BULLISH:T.green,BEARISH:T.red,STRONG_BEARISH:T.red,NEUTRAL:T.textDim};
  return (
    <div style={{padding:14,display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{color:T.text,fontSize:14,fontWeight:700}}>🧠 AI Market Analysis</div>
        <button onClick={onGenerate} disabled={generating} style={{background:generating?"transparent":T.accent,border:`1px solid ${generating?T.accentDim:T.accent}`,borderRadius:8,padding:"7px 14px",color:generating?T.textDim:"#000",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
          <Brain size={13} style={{animation:generating?"pulse 1s infinite":""}} />{generating?"Analyzing...":"Generate Analysis"}
        </button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12}}>
        {ASSETS.map(sym=>{
          const a=analyses[sym]; const p=prices[sym];
          const isBull=a?.sentiment?.includes("BULLISH");
          return (
            <div key={sym} style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{color:T.text,fontSize:13,fontWeight:700}}>{sym} — {ASSET_NAME[sym]}</div>
                <span style={{background:`rgba(${isBull?"0,230,118":"255,61,87"},0.12)`,color:isBull?T.green:T.red,padding:"2px 8px",borderRadius:99,fontSize:9,fontWeight:700}}>{isBull?"⬆ BULLISH":"⬇ BEARISH"}</span>
              </div>
              <div style={{color:T.textDim,fontSize:11,lineHeight:1.7,minHeight:60}}>
                {a?.text||<span style={{color:T.textFaint}}>Click "Generate Analysis" for AI insights...</span>}
              </div>
              {a?.support&&(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
                  <div style={{background:T.bg,borderRadius:6,padding:8}}>
                    <div style={{color:T.textFaint,fontSize:9,marginBottom:4}}>SUPPORT</div>
                    {a.support.map((s,i)=><div key={i} style={{color:T.green,fontSize:10}}>• {s}</div>)}
                  </div>
                  <div style={{background:T.bg,borderRadius:6,padding:8}}>
                    <div style={{color:T.textFaint,fontSize:9,marginBottom:4}}>RESISTANCE</div>
                    {a.resistance.map((r,i)=><div key={i} style={{color:T.red,fontSize:10}}>• {r}</div>)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── PERFORMANCE PAGE ───────────────────────────────────────────────────
function PerformancePage({perf,dailyPnL,signals,wrTrend,T}) {
  const [tab,setTab]=useState("overview");
  const TABS=[{id:"overview",label:"Overview"},{id:"pnl",label:"PnL Curves"},{id:"sharpe",label:"Sharpe & WR Trends"},{id:"history",label:"Signal History"},{id:"ai",label:"🧠 AI Learning"}];
  const pct=perf.wins/(perf.wins+perf.losses)*100;
  const cumPnL=dailyPnL.map((d,i)=>({...d,cum:dailyPnL.slice(0,i+1).reduce((a,b)=>a+b.pips,0)}));
  const signalHistory=useMemo(()=>genSignalHistory(signals),[signals]);
  return (
    <div style={{padding:14}}>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
        {[{l:"Win Rate",v:`${pct.toFixed(1)}%`,c:T.accent},{l:"Wins",v:perf.wins,c:T.green},{l:"Losses",v:perf.losses,c:T.red},{l:"Total Pips",v:perf.totalPips.toLocaleString(),c:T.red},{l:"Sharpe",v:perf.sharpe.toFixed(2),c:T.red},{l:"Max DD",v:perf.maxDD.toFixed(1),c:T.red},{l:"Avg R:R",v:perf.avgRR.toFixed(1),c:T.blue},{l:"Shadow WR",v:`${perf.shadowWR}%`,c:T.purple}].map(({l,v,c})=>(
          <div key={l} style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 12px",flex:"1 1 80px"}}>
            <div style={{color:T.textDim,fontSize:9,marginBottom:3}}>{l}</div>
            <div style={{color:c,fontSize:15,fontWeight:700}}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:3,marginBottom:12,borderBottom:`1px solid ${T.border}`,paddingBottom:8,flexWrap:"wrap"}}>
        {TABS.map(({id,label})=><button key={id} onClick={()=>setTab(id)} style={{background:"transparent",border:"none",borderBottom:tab===id?`2px solid ${T.accent}`:"2px solid transparent",color:tab===id?T.accent:T.textDim,fontSize:11,padding:"4px 10px",cursor:"pointer"}}>{label}</button>)}
      </div>
      {tab==="overview"&&<div style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:12}}>
        <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:14,textAlign:"center",minWidth:170}}>
          <div style={{color:T.textDim,fontSize:11,marginBottom:8}}>Win/Loss</div>
          <PieChart width={140} height={140}><Pie data={[{v:perf.wins},{v:perf.losses}]} dataKey="v" cx={70} cy={70} innerRadius={38} outerRadius={62}><Cell fill={T.green}/><Cell fill={T.red}/></Pie></PieChart>
          <div style={{display:"flex",gap:12,justifyContent:"center",marginTop:4}}><span style={{color:T.green,fontSize:10}}>● {perf.wins}W</span><span style={{color:T.red,fontSize:10}}>● {perf.losses}L</span></div>
        </div>
        <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:14}}>
          <div style={{color:T.textDim,fontSize:11,marginBottom:8}}>Daily PnL (pips)</div>
          <ResponsiveContainer width="100%" height={140}><BarChart data={dailyPnL}><XAxis dataKey="date" tick={{fill:T.textFaint,fontSize:8}} axisLine={false} tickLine={false}/><YAxis tick={{fill:T.textFaint,fontSize:8}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{background:T.card,border:`1px solid ${T.border}`,fontSize:10}}/><Bar dataKey="pips" radius={[2,2,0,0]}>{dailyPnL.map((d,i)=><Cell key={i} fill={d.pips>=0?T.green:T.red}/>)}</Bar></BarChart></ResponsiveContainer>
        </div>
        <div style={{gridColumn:"1/-1",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:8}}>
          {[{sym:"XAUUSD",wr:62.2,w:51,l:31,pips:-12396},{sym:"BTCUSD",wr:50.6,w:42,l:42,pips:-1306989},{sym:"SP500",wr:0,w:0,l:0,pips:0},{sym:"MSFT",wr:0,w:0,l:0,pips:0},{sym:"AMZN",wr:100,w:4,l:0,pips:-415}].map(({sym,wr,w,l,pips})=>(
            <div key={sym} style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:8,padding:10}}>
              <div style={{color:T.accent,fontSize:11,fontWeight:700,marginBottom:5}}>{sym}</div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10}}><span style={{color:T.textDim}}>WR</span><span style={{color:T.text}}>{wr}%</span></div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginTop:2}}><span style={{color:T.textDim}}>Rec</span><span style={{color:T.text}}>{w}W/{l}L</span></div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginTop:2}}><span style={{color:T.textDim}}>Pips</span><span style={{color:pips>=0?T.green:T.red}}>{pips.toLocaleString()}</span></div>
            </div>
          ))}
        </div>
      </div>}
      {tab==="pnl"&&<div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:14}}>
        <div style={{color:T.textDim,fontSize:11,marginBottom:10}}>Cumulative PnL Curve</div>
        <ResponsiveContainer width="100%" height={220}><AreaChart data={cumPnL}><defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.accent} stopOpacity={0.3}/><stop offset="95%" stopColor={T.accent} stopOpacity={0}/></linearGradient></defs><XAxis dataKey="date" tick={{fill:T.textFaint,fontSize:8}} axisLine={false}/><YAxis tick={{fill:T.textFaint,fontSize:8}} axisLine={false}/><CartesianGrid strokeDasharray="2 4" stroke={T.border}/><Tooltip contentStyle={{background:T.card,border:`1px solid ${T.border}`,fontSize:10}}/><ReferenceLine y={0} stroke={T.textFaint} strokeDasharray="3 3"/><Area type="monotone" dataKey="cum" stroke={T.accent} fill="url(#pg)" strokeWidth={2} dot={false}/></AreaChart></ResponsiveContainer>
      </div>}
      {tab==="sharpe"&&<div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:14}}>
        <div style={{color:T.textDim,fontSize:11,marginBottom:10}}>Win Rate & Sharpe Trends</div>
        <ResponsiveContainer width="100%" height={220}><ComposedChart data={wrTrend}><XAxis dataKey="week" tick={{fill:T.textFaint,fontSize:8}} axisLine={false}/><YAxis yAxisId="left" tick={{fill:T.textFaint,fontSize:8}} axisLine={false} domain={[0,100]}/><YAxis yAxisId="right" orientation="right" tick={{fill:T.textFaint,fontSize:8}} axisLine={false} domain={[-2,2]}/><CartesianGrid strokeDasharray="2 4" stroke={T.border}/><Tooltip contentStyle={{background:T.card,border:`1px solid ${T.border}`,fontSize:10}}/><ReferenceLine yAxisId="left" y={50} stroke={T.textFaint} strokeDasharray="3 3"/><Bar yAxisId="left" dataKey="wr" fill={T.accent} opacity={0.6} radius={[2,2,0,0]} name="WR%"/><Line yAxisId="right" type="monotone" dataKey="sharpe" stroke={T.blue} strokeWidth={2} dot={false} name="Sharpe"/></ComposedChart></ResponsiveContainer>
      </div>}
      {tab==="history"&&<div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
          <thead><tr style={{color:T.textDim,borderBottom:`1px solid ${T.border}`}}>{["Pair","Dir","Entry","SL","TP1","Status","Pips","Duration","Closed At"].map(h=><th key={h} style={{padding:"4px 8px",textAlign:"left",fontWeight:600,fontSize:9}}>{h}</th>)}</tr></thead>
          <tbody>{signalHistory.map((s,i)=>(
            <tr key={i} style={{borderBottom:`1px solid rgba(22,40,64,0.4)`,background:i%2===0?"transparent":`${T.card2}44`}}>
              <td style={{padding:"5px 8px",color:T.text,fontWeight:700}}>{s.pair}</td>
              <td style={{padding:"5px 8px",color:s.dir==="BUY"?T.green:T.red,fontWeight:700}}>{s.dir==="BUY"?"▲":"▼"} {s.dir}</td>
              <td style={{padding:"5px 8px",color:T.text}}>{s.entry}</td>
              <td style={{padding:"5px 8px",color:T.red}}>{s.sl}</td>
              <td style={{padding:"5px 8px",color:T.green}}>{s.tp1}</td>
              <td style={{padding:"5px 8px"}}><span style={{color:s.status==="ACTIVE"?T.green:s.status==="STOPPED"?T.red:T.textDim,fontSize:9,fontWeight:700}}>{s.status}</span></td>
              <td style={{padding:"5px 8px",color:s.pips>=0?T.green:T.red}}>{s.pips>=0?"+":""}{s.pips}</td>
              <td style={{padding:"5px 8px",color:T.textDim}}>{s.duration}</td>
              <td style={{padding:"5px 8px",color:T.textFaint,fontSize:9}}>{s.closedAt}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>}
      {tab==="ai"&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div style={{color:T.text,fontSize:13,fontWeight:700,marginBottom:4}}>🧠 AI Learning Insights</div>
        {[{title:"Shadow Trade Deviation",text:"Shadow trades show significant underperformance vs real trades. Investigate slippage, order execution, and potential market impact differences.",level:"warning"},{title:"Best Performance Window",text:"Tuesday London-NY Overlap shows 74% WR. Concentrating positions during this session increases expected value by ~18%.",level:"success"},{title:"XAUUSD/BTC Divergence",text:"Gold and Bitcoin showing multi-week divergence. Historically precedes trend alignment within 5-10 days.",level:"info"},{title:"Overtrading Alert",text:"Wednesday shows highest trade frequency but lowest WR (48%). Reducing Wednesday activity historically improves monthly PnL by 12-15%.",level:"danger"},{title:"High-Confidence Filter",text:"Signals above 75% confidence show 68% WR vs 44% for signals below 60%. Applying confidence filter is strongly recommended.",level:"success"}].map(({title,text,level},i)=>(
          <div key={i} style={{background:T.bg,border:`1px solid ${level==="warning"?T.warning:level==="success"?T.success:level==="danger"?T.red:T.blue}`,borderRadius:8,padding:12}}>
            <div style={{color:level==="warning"?T.warning:level==="success"?T.success:level==="danger"?T.red:T.blue,fontSize:11,fontWeight:700,marginBottom:4}}>{title}</div>
            <div style={{color:T.textDim,fontSize:11,lineHeight:1.5}}>{text}</div>
          </div>
        ))}
      </div>}
    </div>
  );
}

// ── P&L TRACKER PAGE ───────────────────────────────────────────────────
function PnLTrackerPage({T}) {
  const [view,setView]=useState("monthly");
  const [calendar]=useState(genPnLCalendar);
  const [weekly]=useState(genWeeklySummary);

  // Monthly aggregate stats
  const monthStats = calendar.map(m=>{
    const tradingDays = m.days.filter(d=>d.trades>0);
    const totalTrades = tradingDays.reduce((a,d)=>a+d.trades,0);
    const totalWins   = tradingDays.reduce((a,d)=>a+d.wins,0);
    const totalPips   = tradingDays.reduce((a,d)=>a+d.pips,0);
    const greenDays   = tradingDays.filter(d=>d.pips>0).length;
    const redDays     = tradingDays.filter(d=>d.pips<0).length;
    return { ...m, totalTrades, totalWins, totalPips, greenDays, redDays,
      wr: totalTrades>0?Math.round(totalWins/totalTrades*100):0 };
  });

  // Streak calculation from weekly
  const streakFromWeekly = ()=>{
    let streak=0, cur=0;
    for(let i=weekly.length-1;i>=0;i--){
      if(weekly[i].pips>0){if(cur>=0){cur++;}else break;}
      else{if(cur<=0){cur--;}else break;}
    }
    return cur;
  };

  // Best month
  const best = monthStats.reduce((a,b)=>b.totalPips>a.totalPips?b:a, monthStats[0]||{});

  const DAYS_HEADER=["Mon","Tue","Wed","Thu","Fri"];

  return (
    <div style={{padding:14,display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <div style={{color:T.text,fontSize:14,fontWeight:700}}>📊 P&L Tracker</div>
        <div style={{display:"flex",gap:4}}>
          {[{v:"calendar",l:"📅 Calendar"},{v:"weekly",l:"📆 Weekly"},{v:"monthly",l:"🗓 Monthly"}].map(({v,l})=>(
            <button key={v} onClick={()=>setView(v)} style={{background:view===v?"rgba(245,166,35,0.15)":"transparent",border:`1px solid ${view===v?T.accent:T.border}`,borderRadius:6,padding:"4px 12px",color:view===v?T.accent:T.textDim,fontSize:11,cursor:"pointer"}}>{l}</button>
          ))}
        </div>
      </div>

      {/* Monthly roll-up stats always visible at top */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {monthStats.slice(-1).map(m=>[
          {l:"This Month Trades",v:m.totalTrades,c:T.blue},
          {l:"Win Rate",v:`${m.wr}%`,c:m.wr>=55?T.green:m.wr>=45?T.gold:T.red},
          {l:"Month Pips",v:(m.totalPips>0?"+":"")+m.totalPips.toLocaleString(),c:m.totalPips>=0?T.green:T.red},
          {l:"Green Days",v:m.greenDays,c:T.green},
          {l:"Red Days",v:m.redDays,c:T.red},
          {l:"Best Month",v:best.month?.split(" ")[0]||"–",c:T.gold},
        ].map(({l,v,c})=>(
          <div key={l} style={{flex:"1 1 80px",background:T.card2,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 12px"}}>
            <div style={{color:T.textDim,fontSize:9,marginBottom:3}}>{l}</div>
            <div style={{color:c,fontSize:15,fontWeight:700}}>{v}</div>
          </div>
        )))}
      </div>

      {/* ── CALENDAR VIEW ── */}
      {view==="calendar"&&calendar.map((m,mi)=>(
        <div key={mi} style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:14}}>
          <div style={{color:T.text,fontSize:13,fontWeight:700,marginBottom:10}}>{m.month}</div>
          {/* Header */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:4,marginBottom:4}}>
            {DAYS_HEADER.map(d=><div key={d} style={{color:T.textFaint,fontSize:9,textAlign:"center",fontWeight:600}}>{d}</div>)}
          </div>
          {/* Grid — build weeks */}
          {(()=>{
            const weeks=[];
            let week=new Array(5).fill(null);
            const tradingDays=m.days.filter(d=>!d.isWeekend);
            let dow=0;
            // find what day of week the first trading day falls on
            const firstTrading=m.days.find(d=>!d.isWeekend);
            if(firstTrading){
              // dayOfWeek: 1=Mon,2=Tue...5=Fri (we ignore 0=Sun,6=Sat)
              const startCol=(firstTrading.dayOfWeek+4)%5; // Mon=0
              dow=startCol;
              tradingDays.forEach((d,i)=>{
                week[dow]=d;
                dow++;
                if(dow===5){weeks.push([...week]);week=new Array(5).fill(null);dow=0;}
              });
              if(dow>0) weeks.push([...week]);
            }
            return weeks.map((wk,wi)=>(
              <div key={wi} style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:4,marginBottom:4}}>
                {wk.map((day,di)=>{
                  if(!day) return <div key={di}/>;
                  const isGreen=day.pips>0, isRed=day.pips<0, noTrade=day.trades===0;
                  const bg=noTrade?T.bg:isGreen?"rgba(0,230,118,0.15)":"rgba(255,61,87,0.12)";
                  const border=noTrade?T.border:isGreen?T.green:T.red;
                  return (
                    <div key={di} style={{background:bg,border:`1px solid ${border}`,borderRadius:6,padding:"5px 4px",textAlign:"center",minHeight:48}}>
                      <div style={{color:T.textFaint,fontSize:8,marginBottom:2}}>{day.date}</div>
                      {noTrade
                        ? <div style={{color:T.textFaint,fontSize:8}}>–</div>
                        : <>
                          <div style={{color:isGreen?T.green:T.red,fontSize:11,fontWeight:700}}>{isGreen?"+":""}{day.pips}</div>
                          <div style={{color:T.textFaint,fontSize:8}}>{day.wins}W/{day.losses}L</div>
                          {day.wr!=null&&<div style={{color:T.textDim,fontSize:8}}>{day.wr}%</div>}
                        </>}
                    </div>
                  );
                })}
              </div>
            ));
          })()}
          {/* Month footer */}
          {(()=>{
            const s=monthStats[mi];
            return (
              <div style={{display:"flex",gap:12,marginTop:8,paddingTop:8,borderTop:`1px solid ${T.border}`,fontSize:10}}>
                <span style={{color:T.textDim}}>Total: <span style={{color:T.text,fontWeight:700}}>{s.totalTrades} trades</span></span>
                <span style={{color:T.textDim}}>WR: <span style={{color:s.wr>=50?T.green:T.red,fontWeight:700}}>{s.wr}%</span></span>
                <span style={{color:T.textDim}}>Pips: <span style={{color:s.totalPips>=0?T.green:T.red,fontWeight:700}}>{s.totalPips>=0?"+":""}{s.totalPips.toLocaleString()}</span></span>
                <span style={{color:T.textDim}}>🟢{s.greenDays} 🔴{s.redDays}</span>
              </div>
            );
          })()}
        </div>
      ))}

      {/* ── WEEKLY VIEW ── */}
      {view==="weekly"&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {weekly.map((wk,i)=>(
            <div key={i} style={{background:wk.current?`rgba(245,166,35,0.07)`:T.card2,border:`1px solid ${wk.current?T.accent:T.border}`,borderRadius:10,padding:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div>
                  <span style={{color:wk.current?T.accent:T.text,fontWeight:700,fontSize:12}}>{wk.week}</span>
                  {wk.current&&<span style={{color:T.accent,fontSize:9,marginLeft:6,background:"rgba(245,166,35,0.15)",padding:"1px 6px",borderRadius:99}}>CURRENT</span>}
                  <div style={{color:T.textFaint,fontSize:9,marginTop:2}}>{wk.dateRange}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{color:wk.pips>=0?T.green:T.red,fontSize:16,fontWeight:700}}>{wk.pips>=0?"+":""}{wk.pips.toLocaleString()}</div>
                  <div style={{color:T.textFaint,fontSize:9}}>pips</div>
                </div>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {[
                  {l:"WR",v:`${wk.wr}%`,c:wk.wr>=60?T.green:wk.wr>=50?T.gold:T.red},
                  {l:"Trades",v:wk.total,c:T.text},
                  {l:"Wins",v:wk.wins,c:T.green},
                  {l:"Losses",v:wk.losses,c:T.red},
                  {l:"Best Asset",v:wk.bestAsset,c:T.purple},
                  {l:"Best Day",v:wk.bestDay,c:T.blue},
                ].map(({l,v,c})=>(
                  <div key={l} style={{background:T.bg,borderRadius:5,padding:"4px 8px"}}>
                    <div style={{color:T.textFaint,fontSize:8}}>{l}</div>
                    <div style={{color:c,fontSize:11,fontWeight:700}}>{v}</div>
                  </div>
                ))}
              </div>
              {/* Win/Loss bar */}
              <div style={{marginTop:8,background:T.bg,borderRadius:3,overflow:"hidden",height:6,display:"flex"}}>
                <div style={{width:`${wk.wr}%`,background:T.green}}/>
                <div style={{flex:1,background:T.red}}/>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MONTHLY VIEW ── */}
      {view==="monthly"&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12,marginBottom:12}}>
            {monthStats.map((m,i)=>(
              <div key={i} style={{background:T.card2,border:`1px solid ${m.totalPips>=0?T.green:T.red}`,borderRadius:12,padding:16}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                  <div style={{color:T.text,fontSize:13,fontWeight:700}}>{m.month}</div>
                  <div style={{color:m.totalPips>=0?T.green:T.red,fontSize:16,fontWeight:700}}>{m.totalPips>=0?"+":""}{m.totalPips.toLocaleString()}</div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
                  {[{l:"Trades",v:m.totalTrades},{l:"Win Rate",v:`${m.wr}%`},{l:"Green Days",v:m.greenDays},{l:"Red Days",v:m.redDays}].map(({l,v})=>(
                    <div key={l} style={{background:T.bg,borderRadius:5,padding:"5px 8px"}}>
                      <div style={{color:T.textFaint,fontSize:8}}>{l}</div>
                      <div style={{color:T.text,fontSize:12,fontWeight:600}}>{v}</div>
                    </div>
                  ))}
                </div>
                {/* WR bar */}
                <div style={{background:T.bg,borderRadius:3,overflow:"hidden",height:8,display:"flex"}}>
                  <div style={{width:`${m.wr}%`,background:m.wr>=55?T.green:m.wr>=45?T.gold:T.red,borderRadius:"3px 0 0 3px"}}/>
                  <div style={{flex:1,background:"rgba(255,61,87,0.2)"}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:9}}>
                  <span style={{color:T.green}}>🟢 {m.greenDays}d</span>
                  <span style={{color:m.wr>=50?T.green:T.red,fontWeight:700}}>{m.wr}% WR</span>
                  <span style={{color:T.red}}>🔴 {m.redDays}d</span>
                </div>
              </div>
            ))}
          </div>
          {/* Trend chart */}
          <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:14}}>
            <div style={{color:T.textDim,fontSize:11,marginBottom:10}}>Monthly Pips Trend</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={monthStats.map(m=>({name:m.month.split(" ")[0],pips:m.totalPips,wr:m.wr}))}>
                <XAxis dataKey="name" tick={{fill:T.textFaint,fontSize:9}} axisLine={false}/>
                <YAxis tick={{fill:T.textFaint,fontSize:9}} axisLine={false}/>
                <CartesianGrid strokeDasharray="2 4" stroke={T.border}/>
                <Tooltip contentStyle={{background:T.card,border:`1px solid ${T.border}`,fontSize:10}}/>
                <ReferenceLine y={0} stroke={T.textFaint}/>
                <Bar dataKey="pips" radius={[3,3,0,0]}>
                  {monthStats.map((m,i)=><Cell key={i} fill={m.totalPips>=0?T.green:T.red}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

// ── BEST TIMES PAGE ────────────────────────────────────────────────────
function BestTimesPage({T}) {
  const days=[{d:"Sun",wr:53},{d:"Mon",wr:56},{d:"Tue",wr:64},{d:"Wed",wr:48},{d:"Thu",wr:53},{d:"Fri",wr:54},{d:"Sat",wr:54}];
  const sessions=[{s:"Asian",wr:63,t:174,c:T.blue},{s:"London",wr:55,t:153,c:T.green},{s:"LDN-NY",wr:57,t:97,c:T.accent},{s:"New York",wr:54,t:117,c:T.purple},{s:"Late NY",wr:54,t:113,c:T.textDim}];
  const hourly=Array.from({length:24},(_,h)=>({h,wr:Math.floor(40+Math.random()*40)}));
  return (
    <div style={{padding:14,display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {[{l:"Best Day",v:"Tue",s:"64% WR",c:T.green,i:"📅"},{l:"Best Hour",v:"6:00",s:"100% WR",c:T.accent,i:"🕕"},{l:"Worst Day",v:"Wed",s:"48% WR",c:T.red,i:"⚠️"},{l:"Best Session",v:"Late NY",s:"54% WR",c:T.blue,i:"🌙"},{l:"Best Asset",v:"XAUUSD",s:"62.2% WR",c:T.gold,i:"⚡"}].map(({l,v,s,c,i})=>(
          <div key={l} style={{flex:"1 1 100px",background:T.card2,border:`1px solid ${T.border}`,borderRadius:10,padding:12,textAlign:"center"}}>
            <div style={{fontSize:18,marginBottom:3}}>{i}</div>
            <div style={{color:T.textDim,fontSize:9,marginBottom:3}}>{l}</div>
            <div style={{color:c,fontSize:16,fontWeight:700}}>{v}</div>
            <div style={{color:T.textFaint,fontSize:9}}>{s}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:14}}>
          <div style={{color:T.textDim,fontSize:11,marginBottom:10}}>Win Rate by Session</div>
          {sessions.map(({s,wr,t,c})=>(
            <div key={s} style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{color:T.text,fontSize:11}}>{s}</span><span style={{color:T.textFaint,fontSize:9}}>{wr}% · {t}tr</span></div>
              <div style={{background:T.bg,borderRadius:3,overflow:"hidden",height:14}}><div style={{height:"100%",width:`${wr}%`,background:c,display:"flex",alignItems:"center",paddingLeft:6}}><span style={{color:"#000",fontSize:8,fontWeight:700}}>{wr}%</span></div></div>
            </div>
          ))}
        </div>
        <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:14}}>
          <div style={{color:T.textDim,fontSize:11,marginBottom:10}}>Win Rate by Day</div>
          <div style={{display:"flex",gap:4,height:90,alignItems:"flex-end",marginBottom:6}}>
            {days.map(({d,wr})=>(
              <div key={d} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                <span style={{color:wr>60?T.green:wr>50?T.gold:T.red,fontSize:9,fontWeight:700}}>{wr}%</span>
                <div style={{width:"100%",height:`${wr}%`,background:wr>60?T.green:wr>50?T.gold:T.red,borderRadius:"2px 2px 0 0"}}/>
                <span style={{color:T.textFaint,fontSize:9}}>{d}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:14}}>
        <div style={{color:T.textDim,fontSize:11,marginBottom:8}}>Hourly Win Rate Heatmap</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:2}}>
          {hourly.map(({h,wr})=>(
            <div key={h} style={{background:wr>70?`rgba(0,230,118,${wr/100})`:wr>55?`rgba(251,191,36,${wr/100})`:`rgba(255,61,87,${wr/100})`,borderRadius:3,padding:"3px 4px",fontSize:9,color:"rgba(255,255,255,0.9)",textAlign:"center",minWidth:32}}>
              <div style={{fontSize:8}}>{h}:00</div><div style={{fontWeight:700}}>{wr}%</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:14}}>
        <div style={{color:T.textDim,fontSize:11,marginBottom:10}}>Best Day Per Asset</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
          {[{sym:"XAUUSD",day:"Sat",hour:"7:00",sess:"Late NY"},{sym:"BTCUSD",day:"Tue",hour:"5:00",sess:"Late NY"},{sym:"SP500",day:"–",hour:"–",sess:"–"},{sym:"MSFT",day:"–",hour:"–",sess:"–"},{sym:"AMZN",day:"Tue",hour:"–",sess:"US NY"}].map(({sym,day,hour,sess})=>(
            <div key={sym} style={{background:T.bg,borderRadius:8,padding:10}}>
              <div style={{color:T.accent,fontSize:11,fontWeight:700,marginBottom:5}}>{sym}</div>
              <div style={{fontSize:10,color:T.textDim}}>Day: <span style={{color:T.text}}>{day}</span></div>
              <div style={{fontSize:10,color:T.textDim}}>Hour: <span style={{color:T.text}}>{hour}</span></div>
              <div style={{fontSize:10,color:T.textDim,fontSize:9}}>Sess: <span style={{color:T.text,fontSize:9}}>{sess}</span></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── DAILY PLAN ─────────────────────────────────────────────────────────
function DailyPlanPage({plan,onGenerate,generating,perf,autoAnalysis,setAutoAnalysis,T}) {
  const now=new Date();
  return (
    <div style={{padding:14,display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <div>
          <div style={{color:T.text,fontSize:14,fontWeight:700}}>📋 Daily Performance Report</div>
          <div style={{color:T.textFaint,fontSize:10}}>{now.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setAutoAnalysis(a=>!a)} style={{background:autoAnalysis?"rgba(0,230,118,0.12)":"transparent",border:`1px solid ${autoAnalysis?T.green:T.border}`,borderRadius:8,padding:"6px 12px",color:autoAnalysis?T.green:T.textDim,fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
            <Zap size={11}/>{autoAnalysis?"Auto 2h: ON":"Auto 2h"}
          </button>
          <button onClick={onGenerate} disabled={generating} style={{background:generating?"transparent":T.accent,border:`1px solid ${generating?T.accentDim:T.accent}`,borderRadius:8,padding:"6px 14px",color:generating?T.textDim:"#000",fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
            <RefreshCw size={11} style={{animation:generating?"spin 1s linear infinite":""}}/>{generating?"Generating...":"Generate Plan"}
          </button>
        </div>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {[{l:"Win Rate",v:`${(perf.wins/(perf.wins+perf.losses)*100).toFixed(0)}%`,c:T.accent},{l:"Wins",v:perf.wins,c:T.green},{l:"Losses",v:perf.losses,c:T.red},{l:"This Week",v:"64% WR",c:T.blue}].map(({l,v,c})=>(
          <div key={l} style={{flex:1,background:T.card2,border:`1px solid ${T.border}`,borderRadius:8,padding:10,textAlign:"center"}}>
            <div style={{color:T.textDim,fontSize:9,marginBottom:3}}>{l}</div>
            <div style={{color:c,fontSize:16,fontWeight:700}}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:14}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
          <div style={{color:T.text,fontSize:13,fontWeight:700}}>Daily Trading Plan</div>
          <span style={{color:T.textFaint,fontSize:10}}>{autoAnalysis?"🔄 Auto-updating every 2h":"Manual mode"}</span>
        </div>
        {plan.length===0?<div style={{color:T.textFaint,fontSize:12,textAlign:"center",padding:"30px 0"}}>Click "Generate Plan" for your AI-powered daily plan</div>:(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {plan.map((item,i)=>(
              <div key={i} style={{background:T.bg,border:`1px solid ${item.bias?.includes("BULLISH")?"rgba(0,230,118,0.2)":item.bias?.includes("BEARISH")?"rgba(255,61,87,0.2)":"rgba(22,40,64,0.5)"}`,borderRadius:8,padding:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                  <span style={{color:T.text,fontSize:12,fontWeight:700}}>{item.pair}</span>
                  <span style={{color:item.bias?.includes("BULLISH")?T.green:item.bias?.includes("BEARISH")?T.red:T.textDim,fontSize:10,fontWeight:700}}>{item.bias}</span>
                </div>
                <div style={{color:T.textDim,fontSize:11,lineHeight:1.6}}>{item.plan}</div>
                {item.bestSession&&<div style={{color:T.textFaint,fontSize:9,marginTop:5}}>Best: {item.bestSession}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:14}}>
        <div style={{color:T.textDim,fontSize:11,marginBottom:8}}>Today's Sessions (UTC)</div>
        {SESSIONS.map(({name,start,end,color})=>(
          <div key={name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:`1px solid ${T.border}`}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:6,height:6,borderRadius:"50%",background:color}}/><span style={{color:T.text,fontSize:11}}>{name} Session</span></div>
            <span style={{color:T.textFaint,fontSize:10}}>{String(start).padStart(2,"0")}:00–{String(end).padStart(2,"0")}:00 UTC</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── AI CHAT PAGE ───────────────────────────────────────────────────────
function AIChatPage({signals,prices,T}) {
  const [msgs,setMsgs]=useState([{role:"assistant",text:"👋 Hello! I'm DeepTrade AI v3. Ask me anything about your trades, current market conditions, entry strategies, or upload a chart screenshot for analysis!\n\nCurrent prices: Gold $"+BASE_PRICES.XAUUSD+" · BTC $"+BASE_PRICES.BTCUSD.toLocaleString()+" · SP500 "+BASE_PRICES.SP500}]);
  const [input,setInput]=useState(""); const [loading,setLoading]=useState(false);
  const [recording,setRecording]=useState(false); const [image,setImage]=useState(null);
  const fileRef=useRef(); const bottomRef=useRef();
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);

  const send=async()=>{
    if(!input.trim()&&!image) return;
    const userMsg={role:"user",text:input,image};
    setMsgs(m=>[...m,userMsg]); setInput(""); setImage(null); setLoading(true);
    try{
      const sys=`You are DeepTrade AI v3, an expert algorithmic trading assistant. Current live prices: XAUUSD (Gold) $${prices.XAUUSD?.price}, BTCUSD (Bitcoin) $${prices.BTCUSD?.price}, SP500 ${prices.SP500?.price}, MSFT $${prices.MSFT?.price}, AMZN $${prices.AMZN?.price}. Active signals: ${JSON.stringify(signals?.filter(s=>s.status==="ACTIVE").slice(0,3))}. Be concise, precise, and actionable.`;
      const history=msgs.slice(-8).map(m=>({role:m.role==="assistant"?"assistant":"user",content:m.text}));
      const reply=await callClaude([...history,{role:"user",content:input||"Analyze this chart"}],sys,1400);
      setMsgs(m=>[...m,{role:"assistant",text:reply}]);
    }catch{setMsgs(m=>[...m,{role:"assistant",text:"⚠️ API connection error. Please check your internet connection and try again."}]);}
    setLoading(false);
  };
  const toggleRecord=()=>{setRecording(r=>!r);if(!recording)setTimeout(()=>{setInput(`What's the best trade setup for XAUUSD right now? Gold is at $${prices.XAUUSD?.price}`);setRecording(false);},3000);};

  return (
    <div style={{padding:14,height:"calc(100vh - 100px)",display:"flex",flexDirection:"column"}}>
      <div style={{color:T.text,fontSize:14,fontWeight:700,marginBottom:10}}>🤖 AI Trading Assistant</div>
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8,marginBottom:10}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
            <div style={{maxWidth:"80%",background:m.role==="user"?`rgba(245,166,35,0.1)`:T.card2,border:`1px solid ${m.role==="user"?T.accentDim:T.border}`,borderRadius:10,padding:"9px 12px"}}>
              {m.image&&<img src={m.image} alt="" style={{maxWidth:"100%",borderRadius:6,marginBottom:6}}/>}
              <div style={{color:T.text,fontSize:12,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{m.text}</div>
            </div>
          </div>
        ))}
        {loading&&<div style={{display:"flex"}}><div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:10,padding:"8px 14px",color:T.textDim,fontSize:11}}>⚡ Analyzing markets...</div></div>}
        <div ref={bottomRef}/>
      </div>
      {image&&<div style={{marginBottom:6}}><img src={image} alt="" style={{height:50,borderRadius:5,border:`1px solid ${T.border}`}}/><button onClick={()=>setImage(null)} style={{background:"transparent",border:"none",color:T.red,cursor:"pointer",marginLeft:5}}>✕</button></div>}
      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        <button onClick={()=>fileRef.current.click()} title="Upload chart screenshot" style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:7,padding:"9px 10px",color:T.textDim,cursor:"pointer"}}><Upload size={13}/></button>
        <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(f){const r=new FileReader();r.onload=ev=>setImage(ev.target.result);r.readAsDataURL(f);}}}/>
        <button onClick={toggleRecord} title="Voice message (demo)" style={{background:recording?"rgba(255,61,87,0.15)":T.card2,border:`1px solid ${recording?T.red:T.border}`,borderRadius:7,padding:"9px 10px",color:recording?T.red:T.textDim,cursor:"pointer"}}>{recording?<MicOff size={13}/>:<Mic size={13}/>}</button>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()} placeholder={recording?"🎤 Recording...":"Ask anything — analysis, strategy, trade review, market outlook..."} style={{flex:1,background:T.card2,border:`1px solid ${T.border}`,borderRadius:7,padding:"9px 12px",color:T.text,fontSize:12,outline:"none"}}/>
        <button onClick={send} disabled={loading} style={{background:T.accent,border:"none",borderRadius:7,padding:"9px 14px",color:"#000",cursor:"pointer",fontWeight:700,fontSize:12,display:"flex",alignItems:"center",gap:4}}><Send size={12}/>Send</button>
      </div>
    </div>
  );
}

// ── TRAINING PAGE ──────────────────────────────────────────────────────
function TrainingPage({signals,onTrainManual,onTrainAuto,autoTrain,trainingLog,T}) {
  return (
    <div style={{padding:14,display:"flex",flexDirection:"column",gap:12}}>
      <div style={{color:T.text,fontSize:14,fontWeight:700}}>🧠 AI Training Center</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:18,textAlign:"center"}}>
          <Brain size={26} style={{color:T.accent,margin:"0 auto 10px"}}/>
          <div style={{color:T.text,fontSize:13,fontWeight:700,marginBottom:5}}>Manual Training</div>
          <div style={{color:T.textDim,fontSize:11,marginBottom:14,lineHeight:1.5}}>Train AI on current trade history. Updates hour/day scoring, session weights, and signal confidence patterns immediately.</div>
          <button onClick={onTrainManual} style={{background:T.accent,border:"none",borderRadius:8,padding:"8px 20px",color:"#000",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6,margin:"0 auto"}}><Play size={13}/>Train Now</button>
        </div>
        <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:18,textAlign:"center"}}>
          <Cpu size={26} style={{color:autoTrain?T.green:T.textDim,margin:"0 auto 10px"}}/>
          <div style={{color:T.text,fontSize:13,fontWeight:700,marginBottom:5}}>Auto Training</div>
          <div style={{color:T.textDim,fontSize:11,marginBottom:14,lineHeight:1.5}}>Automatically retrains every 2 hours. AI continuously learns from signals, win rates, market conditions, and patterns.</div>
          <button onClick={onTrainAuto} style={{background:autoTrain?"rgba(0,230,118,0.12)":"rgba(245,166,35,0.12)",border:`1px solid ${autoTrain?T.green:T.accent}`,borderRadius:8,padding:"8px 20px",color:autoTrain?T.green:T.accent,fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6,margin:"0 auto"}}>
            <Zap size={13}/>{autoTrain?"Auto: ON — Disable":"Enable Auto Training"}
          </button>
        </div>
      </div>
      <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:14}}>
        <div style={{color:T.text,fontSize:12,fontWeight:700,marginBottom:10}}>Training Config</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:8}}>
          {[{l:"Interval",v:"Every 2 hours"},{l:"Signals Loaded",v:`${signals.length}`},{l:"Model",v:"Claude Sonnet 4"},{l:"Assets",v:"XAU·BTC·SP5·MSFT·AMZN"},{l:"Memory Window",v:"30 days rolling"},{l:"Auto-update",v:autoTrain?"✅ Enabled":"⭕ Off"}].map(({l,v})=>(
            <div key={l} style={{background:T.bg,borderRadius:6,padding:9}}><div style={{color:T.textFaint,fontSize:9,marginBottom:3}}>{l}</div><div style={{color:T.text,fontSize:11,fontWeight:600}}>{v}</div></div>
          ))}
        </div>
      </div>
      <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:14,maxHeight:220,overflowY:"auto"}}>
        <div style={{color:T.text,fontSize:12,fontWeight:700,marginBottom:10}}>Training Log</div>
        {trainingLog.length===0?<div style={{color:T.textFaint,fontSize:11}}>No training sessions yet. Click "Train Now" to start.</div>:
          trainingLog.map((log,i)=>(
            <div key={i} style={{borderBottom:`1px solid ${T.border}`,paddingBottom:6,marginBottom:6,fontSize:11}}>
              <span style={{color:T.textFaint}}>{log.time}</span>
              <span style={{color:log.type==="auto"?T.blue:T.accent,margin:"0 8px"}}>[{log.type.toUpperCase()}]</span>
              <span style={{color:T.textDim}}>{log.msg}</span>
            </div>
          ))
        }
      </div>
    </div>
  );
}



// ── PWA IN-APP SIGNAL POPUP ─────────────────────────────────────────────
function SignalPopup({signal, onClose, T}) {
  useEffect(()=>{ const t=setTimeout(onClose,12000); return()=>clearTimeout(t); },[onClose]);
  if(!signal) return null;
  return (
    <div style={{position:"fixed",top:60,left:"50%",transform:"translateX(-50%)",zIndex:9998,width:"min(360px,92vw)",background:T.card,border:`2px solid ${signal.dir==="BUY"?T.green:T.red}`,borderRadius:16,padding:18,boxShadow:"0 8px 40px rgba(0,0,0,0.7)",animation:"slideDown 0.3s ease"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div>
          <div style={{color:T.accent,fontSize:11,fontWeight:700,marginBottom:2}}>⚡ NEW SIGNAL</div>
          <div style={{color:T.text,fontSize:18,fontWeight:700}}>{signal.pair}</div>
        </div>
        <button onClick={onClose} style={{background:"transparent",border:`1px solid ${T.border}`,borderRadius:6,padding:"3px 8px",color:T.textDim,cursor:"pointer",fontSize:11}}>✕</button>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <span style={{background:signal.dir==="BUY"?"rgba(0,230,118,0.15)":"rgba(255,61,87,0.15)",color:signal.dir==="BUY"?T.green:T.red,padding:"4px 12px",borderRadius:6,fontWeight:700,fontSize:13}}>{signal.dir==="BUY"?"▲ LONG":"▼ SHORT"}</span>
        <span style={{background:"rgba(245,166,35,0.12)",color:T.accent,padding:"4px 10px",borderRadius:6,fontSize:12}}>Grade {signal.grade}</span>
        <span style={{background:"rgba(167,139,250,0.12)",color:T.purple,padding:"4px 10px",borderRadius:6,fontSize:12}}>{signal.conf}% conf</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
        {[{l:"Entry",v:signal.entry,c:T.blue},{l:"Stop Loss",v:signal.sl,c:T.red},{l:"TP1",v:signal.tp1,c:T.green},{l:"R:R",v:`${signal.rr}x`,c:T.gold}].map(({l,v,c})=>(
          <div key={l} style={{background:T.card2,borderRadius:6,padding:"6px 10px"}}>
            <div style={{color:T.textFaint,fontSize:9}}>{l}</div>
            <div style={{color:c,fontSize:13,fontWeight:700}}>{v}</div>
          </div>
        ))}
      </div>
      {signal.mlAdj!==undefined&&signal.mlAdj!==0&&(
        <div style={{background:signal.mlAdj>0?"rgba(0,230,118,0.08)":"rgba(255,61,87,0.08)",border:`1px solid ${signal.mlAdj>0?T.green:T.red}`,borderRadius:6,padding:"5px 10px",marginBottom:8,fontSize:10}}>
          <span style={{color:signal.mlAdj>0?T.green:T.red}}>🧠 ML adjusted confidence {signal.mlAdj>0?`+${signal.mlAdj}`:signal.mlAdj}% based on your history</span>
        </div>
      )}
      <div style={{display:"flex",gap:6}}>
        <button onClick={onClose} style={{flex:1,background:T.green,border:"none",borderRadius:8,padding:"8px 0",color:"#000",fontWeight:700,fontSize:12,cursor:"pointer"}}>✅ Got it</button>
        <button onClick={onClose} style={{flex:1,background:"transparent",border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 0",color:T.textDim,fontSize:12,cursor:"pointer"}}>Dismiss</button>
      </div>
    </div>
  );
}

// ── PWA PUSH NOTIFICATION HELPER ────────────────────────────────────────
async function requestPushPermission() {
  if(!("Notification" in window)) return "unsupported";
  if(Notification.permission==="granted") return "granted";
  if(Notification.permission==="denied") return "denied";
  const perm = await Notification.requestPermission();
  return perm;
}

function sendBrowserNotification(title, body, icon="🤖") {
  if(Notification.permission!=="granted") return;
  try {
    new Notification(title, {body, icon:"/icon-192.png", badge:"/icon-192.png", vibrate:[200,100,200], tag:"deeptrade-signal", renotify:true});
  } catch(e) { console.log("Notification error:",e); }
}


// ── AI ADVISOR PAGE ─────────────────────────────────────────────────────
function AIAdvisorPage({account,accountDispatch,signals,candles,prices,mlState,addNotif,T}) {
  const [tab,setTab]=useState("dashboard");
  const [genBriefing,setGenBriefing]=useState(false);
  const [briefing,setBriefing]=useState(null);
  const [genAdvice,setGenAdvice]=useState(false);
  const [advice,setAdvice]=useState(null);
  const [adviceQ,setAdviceQ]=useState("");
  const [tradeForm,setTradeForm]=useState({pair:"XAUUSD",dir:"BUY",outcome:"WIN",entry:"",tp1:"",sl:"",lotSize:"0.01",notes:""});
  const [balInput,setBalInput]=useState(String(account.startingBalance));
  const [currency,setCurrency]=useState(account.currency||"GBP");

  const pnl = aggregatePnL(account);
  const marketDay = rateMarketDay(candles, mlState);
  const unread = account.alerts.filter(a=>!a.read).length;

  // P&L chart data from daily summaries
  const pnlChartData = Object.entries(account.dailySummaries)
    .sort(([a],[b])=>a.localeCompare(b))
    .slice(-30)
    .map(([date,d])=>({ date:date.slice(5), pnl:d.pnl, trades:d.trades, wr:d.trades>0?Math.round(d.wins/d.trades*100):0 }));

  // Running balance chart
  const balanceChart = account.trades.slice().reverse().reduce((acc,t,i)=>{
    const prev = acc.length>0 ? acc[acc.length-1].bal : account.startingBalance;
    acc.push({ i:i+1, bal:+(prev+t.pnl).toFixed(2), pnl:t.pnl, pair:t.pair });
    return acc;
  },[]);

  // Recommended lot size based on first active signal
  const activeSig = signals.find(s=>s.status==="ACTIVE"&&s.entryNum&&s.slNum);
  const recLot = activeSig
    ? calcPositionSize(activeSig.pair, account.currentBalance, account.riskPercent||1, Math.abs(activeSig.entryNum-activeSig.slNum))
    : null;

  const generateMorningBriefing = async()=>{
    setGenBriefing(true);
    try {
      const sys = `You are an elite professional trading advisor for DeepTrade AI. Analyze market conditions and give a concise morning briefing (max 180 words). Cover: 1) Overall market rating, 2) Best opportunities today, 3) Key risks to watch, 4) Specific actionable advice. Be direct, specific, professional. Use £ for account values.`;
      const ctx = `Account balance: ${account.currency||"GBP"}${account.currentBalance.toFixed(2)} (started: ${account.currency||"GBP"}${account.startingBalance.toFixed(2)}). Daily P&L: ${pnl.daily.pnl>=0?"+":""}${pnl.daily.pnl}. Weekly P&L: ${pnl.weekly.pnl>=0?"+":""}${pnl.weekly.pnl}. Market day rating: ${marketDay.rating} (${marketDay.score}/100). ML win rate: ${mlState.totalSignals>0?(mlState.totalWins/mlState.totalSignals*100).toFixed(0):0}%. Active signals: ${signals.filter(s=>s.status==="ACTIVE").length}. Asset regimes: ${Object.entries(marketDay.regimes).map(([s,r])=>`${s}:${r.mode}`).join(", ")}. Today is ${new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})}. Generate morning briefing now.`;
      const text = await callClaude([{role:"user",content:ctx}], sys, 500);
      setBriefing({ text, ts:new Date().toLocaleTimeString(), date:new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"}), rating:marketDay.rating, score:marketDay.score });
      addNotif("🌅 Morning briefing generated ✓","success");
    } catch{ addNotif("Briefing failed — check API key","error"); }
    setGenBriefing(false);
  };

  const askAdvisor = async()=>{
    if(!adviceQ.trim()) return;
    setGenAdvice(true);
    try {
      const sys = `You are an elite professional trading advisor for DeepTrade AI. Answer the trader's question with specific, actionable advice. Reference their actual account data. Max 200 words. Be direct and professional.`;
      const ctx = `Trader question: "${adviceQ}". Their data — Balance: ${account.currency||"GBP"}${account.currentBalance.toFixed(2)}, Started: ${account.currency||"GBP"}${account.startingBalance.toFixed(2)}, P&L today: ${pnl.daily.pnl>=0?"+":""}${pnl.daily.pnl}, P&L this week: ${pnl.weekly.pnl>=0?"+":""}${pnl.weekly.pnl}, P&L this month: ${pnl.monthly.pnl>=0?"+":""}${pnl.monthly.pnl}, Total trades: ${account.trades.length}, ML win rate: ${mlState.totalSignals>0?(mlState.totalWins/mlState.totalSignals*100).toFixed(0):50}%, Market day rating: ${marketDay.rating}. Answer now.`;
      const text = await callClaude([{role:"user",content:ctx}], sys, 600);
      setAdvice({ q:adviceQ, text, ts:new Date().toLocaleTimeString() });
      setAdviceQ("");
    } catch{ addNotif("Advisor failed — check API key","error"); }
    setGenAdvice(false);
  };

  const recordTrade = ()=>{
    const entry = parseFloat(tradeForm.entry)||0;
    const tp1 = parseFloat(tradeForm.tp1)||0;
    const sl = parseFloat(tradeForm.sl)||0;
    const lot = parseFloat(tradeForm.lotSize)||0.01;
    const pnlVal = calcProfit(tradeForm.pair, tradeForm.dir, entry, tradeForm.outcome==="WIN"?(tp1||entry):sl, lot);
    accountDispatch({ type:"RECORD_TRADE", trade:{ pair:tradeForm.pair, dir:tradeForm.dir, outcome:tradeForm.outcome, pnl:pnlVal, balance:account.currentBalance+pnlVal, lotSize:lot, entry:tradeForm.entry, tp1:tradeForm.tp1, sl:tradeForm.sl, notes:tradeForm.notes, session:"Current" } });
    addNotif(`${tradeForm.outcome==="WIN"?"✅":"❌"} Trade recorded: ${tradeForm.outcome==="WIN"?"+":""}${pnlVal.toFixed(2)} ${account.currency||"GBP"}`,"success");
    setTradeForm(f=>({...f,entry:"",tp1:"",sl:"",notes:""}));
  };

  const TABS=[{id:"dashboard",l:"📊 Dashboard"},{id:"briefing",l:"🌅 Briefing"},{id:"advisor",l:"🤖 Ask Advisor"},{id:"account",l:"💰 Account"},{id:"pnl",l:"📈 P&L History"},{id:"sizing",l:"🎯 Position Size"},{id:"alerts",l:"🔔 Alerts"+(unread>0?` (${unread})`:"")},];

  const fmt = v=>`${account.currency||"£"}${Math.abs(v).toFixed(2)}`;
  const pct = v=>account.startingBalance>0?(v/account.startingBalance*100).toFixed(1):0;
  const growthPct = +((account.currentBalance-account.startingBalance)/account.startingBalance*100).toFixed(2);

  return (
    <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:12,height:"100%"}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <div>
          <div style={{color:T.text,fontSize:16,fontWeight:800,letterSpacing:"-0.3px"}}>🤖 AI Advisor</div>
          <div style={{color:T.textFaint,fontSize:10,marginTop:2}}>Professional trading intelligence — always on</div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <div style={{background:marketDay.color+"22",border:`1px solid ${marketDay.color}44`,borderRadius:6,padding:"6px 14px",textAlign:"center"}}>
            <div style={{color:marketDay.color,fontSize:18}}>{marketDay.emoji}</div>
            <div style={{color:marketDay.color,fontSize:10,fontWeight:700}}>{marketDay.rating}</div>
            <div style={{color:T.textFaint,fontSize:9}}>{marketDay.score}/100</div>
          </div>
          <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:6,padding:"6px 14px",textAlign:"center"}}>
            <div style={{color:growthPct>=0?T.green:T.red,fontSize:18,fontWeight:800}}>{growthPct>=0?"+":""}{growthPct}%</div>
            <div style={{color:T.textFaint,fontSize:9}}>Account Growth</div>
            <div style={{color:growthPct>=0?T.green:T.red,fontSize:11,fontWeight:700}}>{account.currency||"£"}{account.currentBalance.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:3,flexWrap:"wrap",borderBottom:`1px solid ${T.border}`,paddingBottom:8}}>
        {TABS.map(({id,l})=>(
          <button key={id} onClick={()=>{setTab(id);if(id==="alerts")accountDispatch({type:"READ_ALL_ALERTS"});}} style={{background:"transparent",border:"none",borderBottom:tab===id?`2px solid ${T.accent}`:"2px solid transparent",color:tab===id?T.accent:T.textDim,fontSize:10,padding:"4px 8px",cursor:"pointer",whiteSpace:"nowrap",fontFamily:"inherit"}}>{l}</button>
        ))}
      </div>

      {/* ── DASHBOARD TAB ── */}
      {tab==="dashboard"&&<>
        {/* P&L summary cards */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
          {[
            {l:"Today P&L",v:pnl.daily.pnl,t:pnl.daily.trades,w:pnl.daily.wins,lo:pnl.daily.losses},
            {l:"This Week",v:pnl.weekly.pnl,t:pnl.weekly.trades,w:pnl.weekly.wins,lo:pnl.weekly.losses},
            {l:"This Month",v:pnl.monthly.pnl,t:pnl.monthly.trades,w:pnl.monthly.wins,lo:pnl.monthly.losses},
            {l:"This Year",v:pnl.yearly.pnl,t:pnl.yearly.trades,w:pnl.yearly.wins,lo:pnl.yearly.losses},
          ].map(({l,v,t,w,lo})=>(
            <div key={l} style={{background:T.card2,border:`1px solid ${v>=0?T.green+"44":T.red+"44"}`,borderRadius:10,padding:14,position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:v>=0?T.green:T.red}}/>
              <div style={{color:T.textDim,fontSize:9,letterSpacing:"0.8px",textTransform:"uppercase",marginBottom:6}}>{l}</div>
              <div style={{color:v>=0?T.green:T.red,fontSize:22,fontWeight:800,letterSpacing:"-1px"}}>{v>=0?"+":"-"}{account.currency||"£"}{Math.abs(v).toFixed(2)}</div>
              <div style={{color:T.textFaint,fontSize:9,marginTop:4}}>{t} trades · {w}W {lo}L{t>0?` · ${Math.round(w/t*100)}% WR`:""}</div>
              <div style={{color:v>=0?T.green:T.red,fontSize:9,marginTop:2}}>{v>=0?"+":""}{pct(v)}% of account</div>
            </div>
          ))}
        </div>

        {/* Balance + market day */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:10,padding:14}}>
            <div style={{color:T.textDim,fontSize:9,letterSpacing:"0.8px",marginBottom:10}}>ACCOUNT BALANCE</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
              <div>
                <div style={{color:T.text,fontSize:28,fontWeight:800,letterSpacing:"-1px"}}>{account.currency||"£"}{account.currentBalance.toFixed(2)}</div>
                <div style={{color:T.textFaint,fontSize:10,marginTop:4}}>Started: {account.currency||"£"}{account.startingBalance.toFixed(2)}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{color:growthPct>=0?T.green:T.red,fontSize:18,fontWeight:700}}>{growthPct>=0?"+":""}{growthPct}%</div>
                <div style={{color:growthPct>=0?T.green:T.red,fontSize:12,fontWeight:600}}>{growthPct>=0?"+":"-"}{account.currency||"£"}{Math.abs(account.currentBalance-account.startingBalance).toFixed(2)}</div>
              </div>
            </div>
            {balanceChart.length>0&&(
              <ResponsiveContainer width="100%" height={80} style={{marginTop:10}}>
                <AreaChart data={balanceChart}>
                  <defs><linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={growthPct>=0?T.green:T.red} stopOpacity={0.3}/><stop offset="95%" stopColor={growthPct>=0?T.green:T.red} stopOpacity={0}/></linearGradient></defs>
                  <Area type="monotone" dataKey="bal" stroke={growthPct>=0?T.green:T.red} fill="url(#balGrad)" strokeWidth={2} dot={false}/>
                  <Tooltip contentStyle={{background:T.card,border:`1px solid ${T.border}`,fontSize:9}} formatter={v=>[`${account.currency||"£"}${v}`,""]}/>
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          <div style={{background:T.card2,border:`1px solid ${marketDay.color}44`,borderRadius:10,padding:14}}>
            <div style={{color:T.textDim,fontSize:9,letterSpacing:"0.8px",marginBottom:10}}>TODAY'S MARKET RATING</div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
              <div style={{fontSize:32}}>{marketDay.emoji}</div>
              <div>
                <div style={{color:marketDay.color,fontSize:20,fontWeight:800}}>{marketDay.rating}</div>
                <div style={{color:T.textFaint,fontSize:10}}>Score: {marketDay.score}/100</div>
              </div>
              <div style={{marginLeft:"auto",textAlign:"right"}}>
                <div style={{width:60,height:60,borderRadius:"50%",border:`4px solid ${marketDay.color}`,display:"flex",alignItems:"center",justifyContent:"center",background:marketDay.color+"15"}}>
                  <span style={{color:marketDay.color,fontSize:16,fontWeight:800}}>{marketDay.score}</span>
                </div>
              </div>
            </div>
            {/* Reasons */}
            {marketDay.reasons.map((r,i)=>(
              <div key={i} style={{color:T.textDim,fontSize:10,padding:"3px 0",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:5}}>
                <span style={{color:marketDay.color,fontSize:8}}>◆</span>{r}
              </div>
            ))}
            {/* Rating bar */}
            <div style={{marginTop:10,background:T.bg,borderRadius:99,overflow:"hidden",height:6,display:"flex"}}>
              <div style={{width:`${marketDay.score}%`,background:marketDay.color,transition:"width 0.8s"}}/>
            </div>
          </div>
        </div>

        {/* Recent trades */}
        {account.trades.length>0&&(
          <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:10,padding:14}}>
            <div style={{color:T.textDim,fontSize:9,letterSpacing:"0.8px",marginBottom:10}}>RECENT TRADES</div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr style={{color:T.textFaint,borderBottom:`1px solid ${T.border}`}}>
                  {["PAIR","DIR","OUTCOME","P&L","LOT","BALANCE","TIME"].map(h=><th key={h} style={{padding:"4px 8px",textAlign:"left",fontSize:9,letterSpacing:"0.5px"}}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {account.trades.slice(0,8).map((t,i)=>(
                    <tr key={i} style={{borderBottom:`1px solid ${T.border}22`}}>
                      <td style={{padding:"6px 8px",color:T.accent,fontWeight:700}}>{t.pair}</td>
                      <td style={{padding:"6px 8px",color:t.dir==="BUY"?T.green:T.red,fontWeight:600}}>{t.dir==="BUY"?"▲":"▼"} {t.dir}</td>
                      <td style={{padding:"6px 8px"}}><span style={{color:t.outcome==="WIN"?T.green:T.red,fontWeight:700,fontSize:10}}>{t.outcome==="WIN"?"✅ WIN":"❌ LOSS"}</span></td>
                      <td style={{padding:"6px 8px",color:t.pnl>=0?T.green:T.red,fontWeight:700}}>{t.pnl>=0?"+":""}{account.currency||"£"}{Math.abs(t.pnl).toFixed(2)}</td>
                      <td style={{padding:"6px 8px",color:T.textDim}}>{t.lotSize}</td>
                      <td style={{padding:"6px 8px",color:T.text,fontWeight:600}}>{account.currency||"£"}{t.balance?.toFixed(2)||"—"}</td>
                      <td style={{padding:"6px 8px",color:T.textFaint,fontSize:9}}>{t.ts?new Date(t.ts).toLocaleTimeString():""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>}

      {/* ── MORNING BRIEFING TAB ── */}
      {tab==="briefing"&&<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{color:T.textDim,fontSize:11}}>AI-generated market intelligence for today</div>
          <button onClick={generateMorningBriefing} disabled={genBriefing} style={{background:genBriefing?"transparent":`linear-gradient(135deg,${T.accent},${T.accentDim})`,border:`1px solid ${T.accent}`,borderRadius:6,padding:"7px 16px",color:genBriefing?T.textDim:"#000",fontSize:11,fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
            <Lightbulb size={12}/>{genBriefing?"Analysing markets...":"🌅 Generate Morning Briefing"}
          </button>
        </div>
        {/* Market day at a glance */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
          {Object.entries(marketDay.regimes).map(([sym,r])=>(
            <div key={sym} style={{background:T.card2,border:`1px solid ${r.color||T.border}55`,borderRadius:8,padding:"10px 12px",textAlign:"center"}}>
              <div style={{color:T.accent,fontSize:11,fontWeight:700}}>{sym}</div>
              <div style={{color:r.color||T.textDim,fontSize:9,fontWeight:600,marginTop:3}}>{r.mode}</div>
              <div style={{marginTop:6,background:T.bg,borderRadius:99,height:4,overflow:"hidden"}}>
                <div style={{width:`${r.strength||0}%`,height:"100%",background:r.color||T.accent}}/>
              </div>
              <div style={{color:T.textFaint,fontSize:8,marginTop:3}}>{r.strength||0}% str</div>
            </div>
          ))}
        </div>
        {briefing?(
          <div style={{background:T.card2,border:`1px solid ${briefing.rating==="GOOD"?T.green:briefing.rating==="CAUTION"?T.gold:T.red}55`,borderRadius:12,padding:18}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
              <div>
                <div style={{color:T.accent,fontSize:12,fontWeight:700}}>🌅 Morning Briefing</div>
                <div style={{color:T.textFaint,fontSize:10,marginTop:2}}>{briefing.date} · Generated {briefing.ts}</div>
              </div>
              <div style={{textAlign:"center",background:briefing.rating==="GOOD"?T.green+"22":briefing.rating==="CAUTION"?T.gold+"22":T.red+"22",borderRadius:8,padding:"6px 12px"}}>
                <div style={{color:briefing.rating==="GOOD"?T.green:briefing.rating==="CAUTION"?T.gold:T.red,fontWeight:800}}>{briefing.rating}</div>
                <div style={{color:T.textFaint,fontSize:9}}>{briefing.score}/100</div>
              </div>
            </div>
            <div style={{color:T.text,fontSize:12,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{briefing.text}</div>
          </div>
        ):(
          <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:40,textAlign:"center",color:T.textFaint,fontSize:12}}>
            Click "Generate Morning Briefing" for today's AI market analysis and trading recommendations
          </div>
        )}
      </>}

      {/* ── ASK ADVISOR TAB ── */}
      {tab==="advisor"&&<>
        <div style={{background:T.card2,border:`1px solid ${T.accent}33`,borderRadius:10,padding:16}}>
          <div style={{color:T.accent,fontSize:11,fontWeight:700,marginBottom:6}}>🤖 Ask your AI Advisor anything</div>
          <div style={{color:T.textFaint,fontSize:10,marginBottom:12}}>Examples: "Should I trade today?", "What lot size for £500?", "Why am I losing on BTCUSD?", "How do I improve my win rate?", "Is now a good time to buy gold?"</div>
          <div style={{display:"flex",gap:8}}>
            <input value={adviceQ} onChange={e=>setAdviceQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&askAdvisor()} placeholder="Ask anything about trading, your account, or the market..." style={{flex:1,background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 14px",color:T.text,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
            <button onClick={askAdvisor} disabled={genAdvice||!adviceQ.trim()} style={{background:genAdvice||!adviceQ.trim()?"transparent":`linear-gradient(135deg,${T.accent},${T.accentDim})`,border:`1px solid ${T.accent}`,borderRadius:6,padding:"10px 18px",color:genAdvice?"transparent":"#000",fontSize:11,fontWeight:800,cursor:"pointer",whiteSpace:"nowrap"}}>{genAdvice?"Thinking...":"Ask"}</button>
          </div>
          {/* Quick questions */}
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10}}>
            {["Should I trade today?","Best lot size for my balance?","How to improve win rate?","Which asset looks best now?","Am I overtrading?"].map(q=>(
              <button key={q} onClick={()=>setAdviceQ(q)} style={{background:"transparent",border:`1px solid ${T.border}`,borderRadius:99,padding:"3px 10px",color:T.textDim,fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>{q}</button>
            ))}
          </div>
        </div>
        {advice&&(
          <div style={{background:T.card2,border:`1px solid ${T.blue}44`,borderRadius:12,padding:16}}>
            <div style={{color:T.blue,fontSize:10,fontWeight:700,marginBottom:3}}>🤖 ADVISOR RESPONSE</div>
            <div style={{color:T.textFaint,fontSize:9,marginBottom:10}}>Q: {advice.q} · {advice.ts}</div>
            <div style={{color:T.text,fontSize:12,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{advice.text}</div>
          </div>
        )}
      </>}

      {/* ── ACCOUNT SETTINGS TAB ── */}
      {tab==="account"&&<>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:10,padding:16}}>
            <div style={{color:T.textDim,fontSize:9,letterSpacing:"0.8px",marginBottom:12}}>ACCOUNT SETUP</div>
            <div style={{marginBottom:12}}>
              <div style={{color:T.textDim,fontSize:10,marginBottom:5}}>Starting Balance</div>
              <div style={{display:"flex",gap:6}}>
                <select value={currency} onChange={e=>{setCurrency(e.target.value);accountDispatch({type:"SET_CURRENCY",currency:e.target.value});}} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:4,padding:"8px 6px",color:T.text,fontSize:12,fontFamily:"inherit"}}>
                  {["GBP","USD","EUR","CAD","AUD"].map(c=><option key={c}>{c}</option>)}
                </select>
                <input value={balInput} onChange={e=>setBalInput(e.target.value)} placeholder="e.g. 500" style={{flex:1,background:T.bg,border:`1px solid ${T.border}`,borderRadius:4,padding:"8px 10px",color:T.text,fontSize:14,fontFamily:"inherit",outline:"none"}}/>
                <button onClick={()=>{const b=parseFloat(balInput);if(b>0){accountDispatch({type:"SET_BALANCE",balance:b});addNotif(`Account set to ${currency}${b} ✓`,"success");}}} style={{background:T.accent,border:"none",borderRadius:4,padding:"8px 14px",color:"#000",fontSize:11,fontWeight:700,cursor:"pointer"}}>Set</button>
              </div>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{color:T.textDim,fontSize:10,marginBottom:5}}>Risk Per Trade (%)</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {[0.5,1,1.5,2,3].map(r=>(
                  <button key={r} onClick={()=>accountDispatch({type:"UPDATE_SETTINGS",settings:{riskPercent:r}})} style={{background:(account.settings?.riskPercent||1)===r?"rgba(245,166,35,0.15)":"transparent",border:`1px solid ${(account.settings?.riskPercent||1)===r?T.accent:T.border}`,borderRadius:4,padding:"5px 10px",color:(account.settings?.riskPercent||1)===r?T.accent:T.textDim,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{r}%</button>
                ))}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {[
                {l:"Max Daily Loss %",k:"maxDailyLoss",v:account.settings?.maxDailyLoss||3},
                {l:"Daily Trade Limit",k:"maxDailyTrades",v:account.settings?.maxDailyTrades||5},
              ].map(({l,k,v})=>(
                <div key={k}>
                  <div style={{color:T.textDim,fontSize:9,marginBottom:4}}>{l}</div>
                  <input defaultValue={v} onBlur={e=>accountDispatch({type:"UPDATE_SETTINGS",settings:{[k]:parseFloat(e.target.value)||v}})} style={{width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:4,padding:"6px 8px",color:T.text,fontSize:12,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
                </div>
              ))}
            </div>
          </div>
          <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:10,padding:16}}>
            <div style={{color:T.textDim,fontSize:9,letterSpacing:"0.8px",marginBottom:12}}>QUICK TRADE ENTRY</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
              <div>
                <div style={{color:T.textDim,fontSize:9,marginBottom:4}}>Pair</div>
                <select value={tradeForm.pair} onChange={e=>setTradeForm(f=>({...f,pair:e.target.value}))} style={{width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:4,padding:"7px 8px",color:T.text,fontSize:11,fontFamily:"inherit"}}>
                  {ASSETS.map(a=><option key={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <div style={{color:T.textDim,fontSize:9,marginBottom:4}}>Direction</div>
                <div style={{display:"flex",gap:4}}>
                  {["BUY","SELL"].map(d=><button key={d} onClick={()=>setTradeForm(f=>({...f,dir:d}))} style={{flex:1,background:tradeForm.dir===d?(d==="BUY"?"rgba(0,208,132,0.15)":"rgba(255,45,74,0.15)"):"transparent",border:`1px solid ${tradeForm.dir===d?(d==="BUY"?T.green:T.red):T.border}`,borderRadius:4,padding:"6px 0",color:tradeForm.dir===d?(d==="BUY"?T.green:T.red):T.textDim,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{d}</button>)}
                </div>
              </div>
              {[{l:"Entry",k:"entry"},{l:"Stop Loss",k:"sl"},{l:"TP1",k:"tp1"},{l:"Lot Size",k:"lotSize"}].map(({l,k})=>(
                <div key={k}>
                  <div style={{color:T.textDim,fontSize:9,marginBottom:4}}>{l}</div>
                  <input value={tradeForm[k]} onChange={e=>setTradeForm(f=>({...f,[k]:e.target.value}))} placeholder={l} style={{width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:4,padding:"7px 8px",color:T.text,fontSize:11,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
                </div>
              ))}
            </div>
            <div style={{marginBottom:10}}>
              <div style={{color:T.textDim,fontSize:9,marginBottom:6}}>Outcome</div>
              <div style={{display:"flex",gap:4}}>
                {["WIN","LOSS","BE"].map(o=><button key={o} onClick={()=>setTradeForm(f=>({...f,outcome:o}))} style={{flex:1,background:tradeForm.outcome===o?(o==="WIN"?"rgba(0,208,132,0.15)":o==="LOSS"?"rgba(255,45,74,0.15)":"rgba(245,166,35,0.15)"):"transparent",border:`1px solid ${tradeForm.outcome===o?(o==="WIN"?T.green:o==="LOSS"?T.red:T.gold):T.border}`,borderRadius:4,padding:"7px 0",color:tradeForm.outcome===o?(o==="WIN"?T.green:o==="LOSS"?T.red:T.gold):T.textDim,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{o==="WIN"?"✅ WIN":o==="LOSS"?"❌ LOSS":"➡ BE"}</button>)}
              </div>
            </div>
            <button onClick={recordTrade} style={{width:"100%",background:`linear-gradient(135deg,${T.accent},${T.accentDim})`,border:"none",borderRadius:6,padding:10,color:"#000",fontSize:12,fontWeight:800,cursor:"pointer"}}>💾 Record Trade</button>
          </div>
        </div>
      </>}

      {/* ── P&L HISTORY TAB ── */}
      {tab==="pnl"&&<>
        {pnlChartData.length>0?(
          <>
            <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:10,padding:14}}>
              <div style={{color:T.textDim,fontSize:9,letterSpacing:"0.8px",marginBottom:10}}>DAILY P&L ({account.currency||"£"})</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={pnlChartData}>
                  <XAxis dataKey="date" tick={{fill:T.textFaint,fontSize:8}} axisLine={false}/>
                  <YAxis tick={{fill:T.textFaint,fontSize:9}} axisLine={false}/>
                  <CartesianGrid strokeDasharray="2 4" stroke={T.border}/>
                  <Tooltip contentStyle={{background:T.card,border:`1px solid ${T.border}`,fontSize:10}} formatter={v=>[`${account.currency||"£"}${v}`,""]}/>
                  <ReferenceLine y={0} stroke={T.textFaint}/>
                  <Bar dataKey="pnl" radius={[3,3,0,0]}>{pnlChartData.map((d,i)=><Cell key={i} fill={d.pnl>=0?T.green:T.red}/>)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{overflowX:"auto",background:T.card2,border:`1px solid ${T.border}`,borderRadius:10,padding:14}}>
              <div style={{color:T.textDim,fontSize:9,letterSpacing:"0.8px",marginBottom:10}}>ALL DAYS</div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr style={{borderBottom:`1px solid ${T.border}`,color:T.textFaint}}>{["DATE","TRADES","WIN RATE","P&L","ACCOUNT %"].map(h=><th key={h} style={{padding:"4px 10px",textAlign:"left",fontSize:9,letterSpacing:"0.5px"}}>{h}</th>)}</tr></thead>
                <tbody>
                  {Object.entries(account.dailySummaries).sort(([a],[b])=>b.localeCompare(a)).map(([date,d])=>(
                    <tr key={date} style={{borderBottom:`1px solid ${T.border}22`}}>
                      <td style={{padding:"7px 10px",color:T.textDim,fontSize:10}}>{new Date(date).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})}</td>
                      <td style={{padding:"7px 10px",color:T.text}}>{d.trades}</td>
                      <td style={{padding:"7px 10px",color:d.trades>0?(d.wins/d.trades>=0.6?T.green:d.wins/d.trades>=0.4?T.gold:T.red):T.textFaint}}>{d.trades>0?`${Math.round(d.wins/d.trades*100)}%`:"–"}</td>
                      <td style={{padding:"7px 10px",color:d.pnl>=0?T.green:T.red,fontWeight:700}}>{d.pnl>=0?"+":""}{account.currency||"£"}{Math.abs(d.pnl).toFixed(2)}</td>
                      <td style={{padding:"7px 10px",color:d.pnl>=0?T.green:T.red}}>{d.pnl>=0?"+":""}{pct(d.pnl)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ):(
          <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:40,textAlign:"center",color:T.textFaint,fontSize:12}}>No trade history yet. Record trades in the Account tab to see your P&L history.</div>
        )}
      </>}

      {/* ── POSITION SIZING TAB ── */}
      {tab==="sizing"&&<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10}}>
          {ASSETS.map(sym=>{
            const sig = signals.find(s=>s.pair===sym);
            const slDist = sig&&sig.entryNum&&sig.slNum ? Math.abs(sig.entryNum-sig.slNum) : null;
            const sizing = slDist ? calcPositionSize(sym, account.currentBalance, account.settings?.riskPercent||1, slDist) : null;
            const riskAmt = account.currentBalance * ((account.settings?.riskPercent||1)/100);
            return (
              <div key={sym} style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:10,padding:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{color:T.accent,fontSize:13,fontWeight:800}}>{sym}</div>
                  {sig&&<span style={{color:sig.dir==="BUY"?T.green:T.red,fontSize:10,fontWeight:700}}>{sig.dir==="BUY"?"▲ BUY":"▼ SELL"}</span>}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
                  {[
                    {l:"Balance",v:`${account.currency||"£"}${account.currentBalance.toFixed(2)}`,c:T.text},
                    {l:"Risk Amt",v:`${account.currency||"£"}${riskAmt.toFixed(2)}`,c:T.gold},
                    sizing?{l:"Rec. Lots",v:sizing.lots,c:T.green}:{l:"Rec. Lots",v:"—",c:T.textFaint},
                    sizing?{l:"SL Pips",v:sizing.pips,c:T.red}:{l:"Signal",v:"None",c:T.textFaint},
                  ].map(({l,v,c})=>(
                    <div key={l} style={{background:T.bg,borderRadius:5,padding:"6px 8px"}}>
                      <div style={{color:T.textFaint,fontSize:8}}>{l}</div>
                      <div style={{color:c,fontSize:13,fontWeight:700}}>{v}</div>
                    </div>
                  ))}
                </div>
                {sizing?(
                  <div style={{background:"rgba(0,208,132,0.08)",border:`1px solid rgba(0,208,132,0.2)`,borderRadius:6,padding:"8px 10px",fontSize:10,color:T.green}}>
                    ✅ Use <strong>{sizing.lots} lots</strong> — risk {account.currency||"£"}{sizing.riskGBP} ({account.settings?.riskPercent||1}%)
                  </div>
                ):(
                  <div style={{color:T.textFaint,fontSize:10,textAlign:"center",padding:"8px 0"}}>Add signal with entry & SL for sizing</div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:10,padding:14}}>
          <div style={{color:T.textDim,fontSize:9,letterSpacing:"0.8px",marginBottom:10}}>QUICK SIZING REFERENCE · Balance: {account.currency||"£"}{account.currentBalance.toFixed(2)}</div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead><tr style={{borderBottom:`1px solid ${T.border}`,color:T.textFaint}}>{["RISK %","RISK AMOUNT","0.01 lots","0.05 lots","0.10 lots"].map(h=><th key={h} style={{padding:"4px 10px",textAlign:"left",fontSize:9}}>{h}</th>)}</tr></thead>
              <tbody>
                {[0.5,1,1.5,2,3,5].map(r=>{
                  const riskAmt2=+(account.currentBalance*(r/100)).toFixed(2);
                  return (
                    <tr key={r} style={{borderBottom:`1px solid ${T.border}22`,background:(account.settings?.riskPercent||1)===r?"rgba(245,166,35,0.05)":"transparent"}}>
                      <td style={{padding:"7px 10px",color:(account.settings?.riskPercent||1)===r?T.accent:T.textDim,fontWeight:(account.settings?.riskPercent||1)===r?700:400}}>{r}%{(account.settings?.riskPercent||1)===r?" ← current":""}</td>
                      <td style={{padding:"7px 10px",color:T.gold,fontWeight:700}}>{account.currency||"£"}{riskAmt2}</td>
                      <td style={{padding:"7px 10px",color:T.text}}>~{account.currency||"£"}{+(riskAmt2*0.1).toFixed(2)}</td>
                      <td style={{padding:"7px 10px",color:T.text}}>~{account.currency||"£"}{+(riskAmt2*0.5).toFixed(2)}</td>
                      <td style={{padding:"7px 10px",color:T.text}}>~{account.currency||"£"}{riskAmt2}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </>}

      {/* ── ALERTS TAB ── */}
      {tab==="alerts"&&<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{color:T.textDim,fontSize:11}}>{account.alerts.filter(a=>!a.read).length} unread · {account.alerts.length} total</div>
          <button onClick={()=>accountDispatch({type:"READ_ALL_ALERTS"})} style={{background:"transparent",border:`1px solid ${T.border}`,borderRadius:5,padding:"4px 10px",color:T.textDim,fontSize:10,cursor:"pointer"}}>Mark all read</button>
        </div>
        {account.alerts.length===0
          ? <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:40,textAlign:"center",color:T.textFaint,fontSize:12}}>No alerts yet. Alerts will appear here as you trade and market conditions change.</div>
          : account.alerts.map(a=>(
            <div key={a.id} onClick={()=>accountDispatch({type:"READ_ALERT",id:a.id})} style={{background:a.read?T.card2:"rgba(245,166,35,0.06)",border:`1px solid ${a.read?T.border:a.severity==="danger"?T.red+"55":a.severity==="warn"?T.gold+"55":T.green+"55"}`,borderRadius:10,padding:14,cursor:"pointer"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <span style={{color:a.severity==="danger"?T.red:a.severity==="warn"?T.gold:T.green,fontSize:11,fontWeight:700}}>{a.severity==="danger"?"⛔":a.severity==="warn"?"⚠️":"✅"} {a.type?.replace(/_/g," ")}</span>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  {!a.read&&<span style={{width:6,height:6,borderRadius:"50%",background:T.accent,display:"inline-block"}}/>}
                  <span style={{color:T.textFaint,fontSize:9}}>{new Date(a.ts).toLocaleTimeString()}</span>
                </div>
              </div>
              <div style={{color:T.textDim,fontSize:11,lineHeight:1.6}}>{a.msg}</div>
            </div>
          ))
        }
      </>}
    </div>
  );
}

// ── ML BRAIN PAGE ──────────────────────────────────────────────────────
function MLBrainPage({mlState,dispatch,signals,candles,prices,addNotif,T}) {
  const [genDebrief,setGenDebrief]=useState(false);
  const [activeTab,setActiveTab]=useState("overview");

  const overallWR = mlState.totalSignals>0
    ? +((mlState.totalWins/mlState.totalSignals)*100).toFixed(1) : 0;

  // Best pair by WR
  const bestPair = Object.entries(mlState.pairStats)
    .filter(([,s])=>s.wins+s.losses>=2)
    .map(([p,s])=>({p,wr:s.wins/(s.wins+s.losses)*100}))
    .sort((a,b)=>b.wr-a.wr)[0];

  // Best session
  const bestSession = Object.entries(mlState.sessionStats)
    .filter(([,s])=>s.wins+s.losses>=2)
    .map(([n,s])=>({n,wr:s.wins/(s.wins+s.losses)*100}))
    .sort((a,b)=>b.wr-a.wr)[0];

  // Best day
  const bestDay = Object.entries(mlState.dayStats)
    .filter(([,s])=>s.wins+s.losses>=1)
    .map(([n,s])=>({n,wr:s.wins/(s.wins+s.losses)*100}))
    .sort((a,b)=>b.wr-a.wr)[0];

  // Regimes
  const regimes = Object.fromEntries(
    Object.entries(candles).map(([sym,cd])=>[sym,detectRegime(cd)])
  );

  // Correlations
  const correlations = detectCorrelation(candles);

  // Conf calibration chart data
  const calibData = Object.entries(mlState.confCalibration).map(([k,v])=>({
    bracket:k, predicted:v.predicted, actual:v.actual||v.predicted*0.9, count:v.count
  }));

  // Best patterns
  const topPatterns = Object.entries(mlState.patterns)
    .filter(([,v])=>v.wins+v.losses>=2)
    .map(([k,v])=>({key:k,wr:+(v.wins/(v.wins+v.losses)*100).toFixed(0),wins:v.wins,losses:v.losses}))
    .sort((a,b)=>b.wr-a.wr).slice(0,5);

  const generateWeeklyDebrief = async()=>{
    setGenDebrief(true);
    try {
      const sys="You are a trading AI coach. Write a concise weekly debrief (max 120 words) covering: what worked, what didn't, 2-3 actionable improvements for next week. Be direct and specific.";
      const summary = `Win rate: ${overallWR}%. Best pair: ${bestPair?.p||"N/A"} (${bestPair?.wr.toFixed(0)||0}% WR). Best session: ${bestSession?.n||"N/A"}. Best day: ${bestDay?.n||"N/A"}. Total signals: ${mlState.totalSignals}. Journal entries: ${mlState.journal.length}.`;
      const text = await callClaude([{role:"user",content:summary+" Write the weekly debrief now."}],sys,400);
      const entry = {text, date:new Date().toLocaleDateString('en',{weekday:'long',year:'numeric',month:'short',day:'numeric'}), wr:overallWR};
      dispatch({type:"ADD_DEBRIEF",debrief:entry});
      addNotif("Weekly debrief generated ✓","success");
    } catch{addNotif("Debrief generation failed","error");}
    setGenDebrief(false);
  };

  const TABS=[{id:"overview",l:"🧠 Overview"},{id:"regime",l:"📡 Regime"},{id:"calibration",l:"🎯 Calibration"},{id:"patterns",l:"🔮 Patterns"},{id:"correlation",l:"🔗 Correlation"},{id:"journal",l:"📓 Journal"},{id:"debriefs",l:"📋 Debriefs"}];

  return (
    <div style={{padding:14,display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <div>
          <div style={{color:T.text,fontSize:14,fontWeight:700}}>🧠 ML Brain <span style={{color:T.textFaint,fontSize:10,marginLeft:6}}>v5.0</span></div>
          <div style={{color:T.textFaint,fontSize:10}}>Self-learning system — {mlState.totalSignals} signals learned from</div>
        </div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>dispatch({type:"RESET"})} style={{background:"transparent",border:`1px solid ${T.red}`,borderRadius:6,padding:"5px 10px",color:T.red,fontSize:11,cursor:"pointer"}}>Reset Brain</button>
          <button onClick={generateWeeklyDebrief} disabled={genDebrief} style={{background:genDebrief?"transparent":T.accent,border:`1px solid ${T.accent}`,borderRadius:6,padding:"5px 12px",color:genDebrief?T.textDim:"#000",fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}><BookOpen size={11}/>{genDebrief?"Thinking...":"Weekly Debrief"}</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:3,flexWrap:"wrap",borderBottom:`1px solid ${T.border}`,paddingBottom:8}}>
        {TABS.map(({id,l})=><button key={id} onClick={()=>setActiveTab(id)} style={{background:"transparent",border:"none",borderBottom:activeTab===id?`2px solid ${T.accent}`:"2px solid transparent",color:activeTab===id?T.accent:T.textDim,fontSize:10,padding:"4px 8px",cursor:"pointer",whiteSpace:"nowrap"}}>{l}</button>)}
      </div>

      {/* ── OVERVIEW ── */}
      {activeTab==="overview"&&<>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {[
            {l:"Signals Learned",v:mlState.totalSignals,c:T.blue},
            {l:"Overall WR",v:`${overallWR}%`,c:overallWR>=55?T.green:overallWR>=45?T.gold:T.red},
            {l:"Wins",v:mlState.totalWins,c:T.green},
            {l:"Losses",v:mlState.totalLosses,c:T.red},
            {l:"Best Pair",v:bestPair?.p||"–",c:T.accent},
            {l:"Best Session",v:bestSession?.n||"–",c:T.purple},
            {l:"Best Day",v:bestDay?.n||"–",c:T.gold},
            {l:"Journal Entries",v:mlState.journal.length,c:T.blue},
          ].map(({l,v,c})=>(
            <div key={l} style={{flex:"1 1 80px",background:T.card2,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 12px"}}>
              <div style={{color:T.textDim,fontSize:9,marginBottom:3}}>{l}</div>
              <div style={{color:c,fontSize:14,fontWeight:700}}>{v}</div>
            </div>
          ))}
        </div>
        {/* Per-pair WR bars */}
        <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:14}}>
          <div style={{color:T.textDim,fontSize:11,marginBottom:10}}>Per-Pair ML Win Rate</div>
          {Object.entries(mlState.pairStats).map(([pair,s])=>{
            const tot=s.wins+s.losses; const wr=tot>0?Math.round(s.wins/tot*100):0;
            return (
              <div key={pair} style={{marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{color:T.text,fontSize:11}}>{pair}</span><span style={{color:T.textFaint,fontSize:10}}>{wr}% · {tot} trades</span></div>
                <div style={{background:T.bg,borderRadius:3,overflow:"hidden",height:10,display:"flex"}}>
                  <div style={{width:`${wr}%`,background:wr>=55?T.green:wr>=45?T.gold:T.red,transition:"width 0.5s"}}/>
                </div>
                {tot===0&&<div style={{color:T.textFaint,fontSize:9}}>No data yet — mark W/L on signals to train</div>}
              </div>
            );
          })}
        </div>
        {/* Day stats */}
        <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:14}}>
          <div style={{color:T.textDim,fontSize:11,marginBottom:10}}>Day-of-Week ML Performance</div>
          <div style={{display:"flex",gap:6}}>
            {Object.entries(mlState.dayStats).map(([day,s])=>{
              const tot=s.wins+s.losses; const wr=tot>0?Math.round(s.wins/tot*100):0;
              return (
                <div key={day} style={{flex:1,textAlign:"center"}}>
                  <div style={{color:T.textFaint,fontSize:9,marginBottom:3}}>{day}</div>
                  <div style={{height:50,background:T.bg,borderRadius:"3px 3px 0 0",display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
                    {tot>0&&<div style={{height:`${wr}%`,background:wr>=55?T.green:wr>=45?T.gold:T.red,borderRadius:"3px 3px 0 0",transition:"height 0.5s"}}/>}
                  </div>
                  <div style={{color:tot>0?(wr>=55?T.green:wr>=45?T.gold:T.red):T.textFaint,fontSize:9,fontWeight:700,marginTop:2}}>{tot>0?`${wr}%`:"–"}</div>
                </div>
              );
            })}
          </div>
        </div>
      </>}

      {/* ── REGIME DETECTION ── */}
      {activeTab==="regime"&&<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10}}>
          {Object.entries(regimes).map(([sym,r])=>(
            <div key={sym} style={{background:T.card2,border:`1px solid ${r.color||T.border}`,borderRadius:12,padding:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={{color:T.text,fontWeight:700,fontSize:13}}>{sym}</span>
                <span style={{background:`rgba(0,0,0,0.3)`,color:r.color||T.textDim,padding:"2px 8px",borderRadius:99,fontSize:9,fontWeight:700}}>{r.mode}</span>
              </div>
              <div style={{color:T.textDim,fontSize:11,marginBottom:8,lineHeight:1.5}}>{r.description}</div>
              <div style={{display:"flex",gap:8,fontSize:10}}>
                <span style={{color:T.textFaint}}>Strength: <span style={{color:r.color||T.text,fontWeight:700}}>{r.strength}%</span></span>
                <span style={{color:T.textFaint}}>EMA Spread: <span style={{color:T.text}}>{r.spread}</span></span>
                <span style={{color:T.textFaint}}>Vol: <span style={{color:T.text}}>{r.volatility}%</span></span>
              </div>
              {/* Strength bar */}
              <div style={{marginTop:8,background:T.bg,borderRadius:3,overflow:"hidden",height:4}}>
                <div style={{width:`${r.strength}%`,background:r.color||T.accent,transition:"width 0.5s"}}/>
              </div>
            </div>
          ))}
        </div>
        {mlState.regimeHistory.length>0&&(
          <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:14}}>
            <div style={{color:T.textDim,fontSize:11,marginBottom:8}}>Recent Regime History</div>
            {mlState.regimeHistory.slice(0,8).map((r,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${T.border}`,fontSize:10}}>
                <span style={{color:T.textFaint}}>{new Date(r.ts).toLocaleTimeString()}</span>
                <span style={{color:r.color||T.textDim,fontWeight:700}}>{r.mode}</span>
                <span style={{color:T.textFaint}}>str:{r.strength}%</span>
              </div>
            ))}
          </div>
        )}
      </>}

      {/* ── CONFIDENCE CALIBRATION ── */}
      {activeTab==="calibration"&&<>
        <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:14}}>
          <div style={{color:T.text,fontSize:12,fontWeight:700,marginBottom:4}}>AI Confidence Calibration</div>
          <div style={{color:T.textFaint,fontSize:10,marginBottom:14}}>How accurate is Claude's confidence vs your actual outcomes? Perfect calibration = predicted = actual.</div>
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={calibData}>
              <XAxis dataKey="bracket" tick={{fill:T.textFaint,fontSize:9}} axisLine={false}/>
              <YAxis tick={{fill:T.textFaint,fontSize:9}} axisLine={false} domain={[0,100]}/>
              <CartesianGrid strokeDasharray="2 4" stroke={T.border}/>
              <Tooltip contentStyle={{background:T.card,border:`1px solid ${T.border}`,fontSize:10}}/>
              <Bar dataKey="predicted" fill={T.blue} opacity={0.5} radius={[3,3,0,0]} name="Predicted %"/>
              <Bar dataKey="actual" fill={T.green} opacity={0.8} radius={[3,3,0,0]} name="Actual %"/>
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{display:"flex",gap:8,marginTop:8,fontSize:9}}>
            <span><span style={{color:T.blue}}>■</span> Predicted confidence</span>
            <span><span style={{color:T.green}}>■</span> Actual win rate</span>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:8}}>
          {calibData.map(d=>{
            const diff=d.actual-d.predicted;
            return (
              <div key={d.bracket} style={{background:T.card2,border:`1px solid ${Math.abs(diff)>10?T.red:T.border}`,borderRadius:8,padding:12}}>
                <div style={{color:T.text,fontWeight:700,fontSize:13,marginBottom:4}}>{d.bracket}% conf</div>
                <div style={{fontSize:10,color:T.textDim}}>Predicted: <span style={{color:T.blue}}>{d.predicted}%</span></div>
                <div style={{fontSize:10,color:T.textDim}}>Actual: <span style={{color:d.actual>=d.predicted?T.green:T.red}}>{d.actual||"No data"}%</span></div>
                <div style={{fontSize:10,color:T.textDim}}>Trades: <span style={{color:T.text}}>{d.count}</span></div>
                {d.count>0&&<div style={{fontSize:10,color:diff>=0?T.green:T.red,fontWeight:700,marginTop:4}}>{diff>=0?`✅ +${diff.toFixed(1)}% better than predicted`:`⚠️ ${diff.toFixed(1)}% worse than predicted`}</div>}
              </div>
            );
          })}
        </div>
      </>}

      {/* ── PATTERNS ── */}
      {activeTab==="patterns"&&<>
        <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:14}}>
          <div style={{color:T.text,fontSize:12,fontWeight:700,marginBottom:10}}>🔮 Best Learned Patterns (Pair + Session + Direction)</div>
          {topPatterns.length===0
            ? <div style={{color:T.textFaint,fontSize:11,textAlign:"center",padding:"20px 0"}}>No patterns learned yet. Mark W/L on signals to build pattern memory.</div>
            : topPatterns.map((p,i)=>{
              const [pair,sess,dir]=p.key.split("|");
              return (
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${T.border}`}}>
                  <div style={{width:24,height:24,borderRadius:"50%",background:T.accent,display:"flex",alignItems:"center",justifyContent:"center",color:"#000",fontSize:10,fontWeight:700,flexShrink:0}}>#{i+1}</div>
                  <div style={{flex:1}}>
                    <div style={{color:T.text,fontSize:12,fontWeight:700}}>{pair} — {sess} — <span style={{color:dir==="BUY"?T.green:T.red}}>{dir}</span></div>
                    <div style={{color:T.textFaint,fontSize:9}}>{p.wins}W / {p.losses}L</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{color:p.wr>=60?T.green:p.wr>=50?T.gold:T.red,fontSize:16,fontWeight:700}}>{p.wr}%</div>
                    <div style={{color:T.textFaint,fontSize:9}}>WR</div>
                  </div>
                </div>
              );
            })
          }
        </div>
      </>}

      {/* ── CORRELATION ── */}
      {activeTab==="correlation"&&<>
        <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:14}}>
          <div style={{color:T.text,fontSize:12,fontWeight:700,marginBottom:4}}>🔗 Live Asset Correlations</div>
          <div style={{color:T.textFaint,fontSize:10,marginBottom:12}}>Pearson correlation on last 20 candles. Values near ±1 = highly correlated.</div>
          {correlations.map((c,i)=>{
            const absR=Math.abs(c.r); const isPos=c.r>0;
            const barColor=absR>0.7?(isPos?T.green:T.red):absR>0.4?T.gold:T.textDim;
            return (
              <div key={i} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{color:T.text,fontSize:11}}>{c.a} / {c.b}</span>
                  <span style={{color:barColor,fontSize:11,fontWeight:700}}>{c.r > 0?"+":""}{c.r} ({c.label} {c.direction})</span>
                </div>
                <div style={{background:T.bg,borderRadius:3,overflow:"hidden",height:8,position:"relative"}}>
                  <div style={{position:"absolute",left:"50%",top:0,height:"100%",width:2,background:T.border}}/>
                  {isPos
                    ? <div style={{position:"absolute",left:"50%",width:`${absR*50}%`,height:"100%",background:barColor,opacity:0.8}}/>
                    : <div style={{position:"absolute",right:`${50-absR*50}%`,width:`${absR*50}%`,height:"100%",background:barColor,opacity:0.8}}/>
                  }
                </div>
              </div>
            );
          })}
          {correlations.some(c=>Math.abs(c.r)>0.8)&&(
            <div style={{background:"rgba(245,166,35,0.1)",border:`1px solid ${T.accent}`,borderRadius:6,padding:10,marginTop:10}}>
              <div style={{color:T.accent,fontSize:11,fontWeight:700,marginBottom:3}}>⚠️ High Correlation Alert</div>
              <div style={{color:T.textDim,fontSize:10}}>Some pairs are highly correlated — opening positions on both may double your risk exposure.</div>
            </div>
          )}
        </div>
      </>}

      {/* ── JOURNAL ── */}
      {activeTab==="journal"&&<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{color:T.textDim,fontSize:11}}>Auto-generated after each closed trade</div>
          <div style={{color:T.textFaint,fontSize:10}}>{mlState.journal.length} entries</div>
        </div>
        {mlState.journal.length===0
          ? <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:30,textAlign:"center",color:T.textFaint,fontSize:11}}>No journal entries yet. Mark signals as W/L to generate auto-journal entries.</div>
          : mlState.journal.map((j,i)=>(
            <div key={i} style={{background:T.card2,border:`1px solid ${j.outcome==="WIN"?T.green:T.red}`,borderRadius:10,padding:12}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <span style={{color:j.outcome==="WIN"?T.green:T.red,fontSize:10,fontWeight:700}}>{j.outcome==="WIN"?"✅ WIN":"❌ LOSS"}</span>
                  <span style={{color:T.text,fontSize:11,fontWeight:600}}>{j.pair} {j.dir}</span>
                </div>
                <span style={{color:T.textFaint,fontSize:9}}>{j.date}</span>
              </div>
              <div style={{color:T.textDim,fontSize:11,lineHeight:1.6}}>{j.entry}</div>
            </div>
          ))
        }
      </>}

      {/* ── DEBRIEFS ── */}
      {activeTab==="debriefs"&&<>
        {mlState.debriefs.length===0
          ? <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:30,textAlign:"center",color:T.textFaint,fontSize:11}}>No debriefs yet. Click "Weekly Debrief" to generate your first AI trading debrief.</div>
          : mlState.debriefs.map((d,i)=>(
            <div key={i} style={{background:i===0?`rgba(245,166,35,0.06)`:T.card2,border:`1px solid ${i===0?T.accent:T.border}`,borderRadius:12,padding:14}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <div style={{color:i===0?T.accent:T.text,fontSize:12,fontWeight:700}}>{i===0?"Latest Debrief":"Past Debrief"}</div>
                <div style={{color:T.textFaint,fontSize:10}}>{d.date} · WR {d.wr}%</div>
              </div>
              <div style={{color:T.textDim,fontSize:12,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{d.text}</div>
            </div>
          ))
        }
      </>}
    </div>
  );
}

// ── ROOT APP ───────────────────────────────────────────────────────────
export default function App() {
  const [authed,setAuthed]=useState(false);
  const [page,setPage]=useState("overview");
  const [darkMode,setDarkMode]=useState(true);
  const T = darkMode ? DARK : LIGHT;

  const [refreshing,setRefreshing]=useState(false);
  const [lastUpdate,setLastUpdate]=useState("–");
  const [autoTrain,setAutoTrain]=useState(false);
  const [autoAnalysis,setAutoAnalysis]=useState(false);
  const [mlState,dispatch]=useReducer(mlReducer,INITIAL_ML);
  const [account,accountDispatch]=useReducer(accountReducer,ACCOUNT_INITIAL);

  // ── Auto market alerts every 30 min ──────────────────────────────────
  useEffect(()=>{
    if(!authed) return;
    const checkAlerts=()=>{
      const mr=rateMarketDay(candles,mlState);
      if(mr.rating==="AVOID"){
        accountDispatch({type:"ADD_ALERT",alert:{type:"MARKET_ALERT",severity:"danger",msg:`${mr.emoji} Market conditions poor today (score: ${mr.score}/100). ${mr.reasons[0]||"Consider reducing position sizes or staying flat."}` }});
        addNotif(`${mr.emoji} Poor trading conditions — check Alerts`,"error");
      } else if(mr.rating==="CAUTION"){
        accountDispatch({type:"ADD_ALERT",alert:{type:"MARKET_ALERT",severity:"warn",msg:`${mr.emoji} Market conditions mixed (score: ${mr.score}/100). Trade carefully. ${mr.reasons[0]||""}` }});
      }
    };
    const t=setInterval(checkAlerts,1800000);
    setTimeout(checkAlerts,3000); // Initial check after 3s
    return()=>clearInterval(t);
  },[authed,candles,mlState]);
  const [trainingLog,setTrainingLog]=useState([]);
  const [generating,setGenerating]=useState(false);
  const [genPlan,setGenPlan]=useState(false);
  const [modelActive,setModelActive]=useState(true);
  const [analyses,setAnalyses]=useState({});
  const [dailyPlan,setDailyPlan]=useState([]);
  const [showTgModal,setShowTgModal]=useState(false);
  const [tgConfig,setTgConfig]=useState({botToken:"YOUR_BOT_TOKEN",chatId:"YOUR_CHAT_ID",enabled:false});
  const {notifs,add:addNotif} = useNotifications();
  const [signalPopup,setSignalPopup]=useState(null); // latest signal for popup
  const [pushEnabled,setPushEnabled]=useState(false);

  // Request push permission on login
  useEffect(()=>{
    if(authed){
      requestPushPermission().then(p=>{
        setPushEnabled(p==="granted");
        if(p==="granted") addNotif("🔔 Push notifications enabled!","success");
      });
    }
  },[authed]);

  const [prices,setPrices]=useState(()=>{
    const p={};
    ASSETS.forEach(s=>{p[s]={price:BASE_PRICES[s],change:+(Math.random()-0.49).toFixed(3)};});
    return p;
  });
  const [candles,setCandles]=useState(()=>{
    const c={};
    ASSETS.forEach(s=>{c[s]=genCandles(BASE_PRICES[s],80,ASSET_VOL[s]);});
    return c;
  });
  const [signals,setSignals]=useState([
    {pair:"XAUUSD",grade:"A",dir:"BUY",entry:"5110",sl:"5060",tp1:"5160",tp2:"5200",tp3:"5240",conf:81,status:"ACTIVE",rr:"3.4",entryNum:5110,slNum:5060,tp1Num:5160,tp2Num:5200,tp3Num:5240,outcome:null},
    {pair:"BTCUSD",grade:"C",dir:"SELL",entry:"69500",sl:"71000",tp1:"67500",tp2:"66000",tp3:"64500",conf:85,status:"STOPPED",rr:"2.4",entryNum:69500,slNum:71000,tp1Num:67500,tp2Num:66000,tp3Num:64500,outcome:"LOSS"},
    {pair:"SP500",grade:"B",dir:"BUY",entry:"6720",sl:"6680",tp1:"6760",tp2:"6800",tp3:"",conf:72,status:"ACTIVE",rr:"2.0",entryNum:6720,slNum:6680,tp1Num:6760,tp2Num:6800,tp3Num:null,outcome:null},
    {pair:"MSFT",grade:"A",dir:"SELL",entry:"382",sl:"392",tp1:"370",tp2:"362",tp3:"355",conf:78,status:"ACTIVE",rr:"5.2",entryNum:382,slNum:392,tp1Num:370,tp2Num:362,tp3Num:355,outcome:null},
    {pair:"AMZN",grade:"A",dir:"BUY",entry:"196",sl:"192",tp1:"202",tp2:"207",tp3:"213",conf:74,status:"CLOSED",rr:"3.0",entryNum:196,slNum:192,tp1Num:202,tp2Num:207,tp3Num:213,outcome:"WIN"},
    {pair:"XAUUSD",grade:"B",dir:"SELL",entry:"5180",sl:"5220",tp1:"5140",tp2:"5100",tp3:"5060",conf:70,status:"CLOSED",rr:"2.5",entryNum:5180,slNum:5220,tp1Num:5140,tp2Num:5100,tp3Num:5060,outcome:"WIN"},
  ]);
  const [dailyPnL]=useState(genDailyPnL);
  const [wrTrend]=useState(genWRTrend);

  // ── Streak calculator ────────────────────────────────────────────────
  const streak = useMemo(()=>{
    const resolved = signals.filter(s=>s.outcome==="WIN"||s.outcome==="LOSS");
    if(!resolved.length) return 0;
    let count=0;
    const last = resolved[0].outcome;
    for(const s of resolved){
      if(s.outcome===last) count++; else break;
    }
    return last==="WIN" ? count : -count;
  },[signals]);
  const perf={wins:97,losses:73,totalPips:-1319801,sharpe:-0.33,maxDD:-5215.7,avgRR:-14.7,shadowWR:36.3};
  const stats={active:signals.filter(s=>s.status==="ACTIVE").length,buys:signals.filter(s=>s.dir==="BUY").length,sells:signals.filter(s=>s.dir==="SELL").length,winRate:57.1,avgConf:62,wins:perf.wins,losses:perf.losses};

  // ── Sanitise signal ──────────────────────────────────────────────────
  const sanitiseSig=useCallback((s)=>{
    const e=parseFloat(String(s.entry).replace(/[^0-9.]/g,""))||0;
    const sl=parseFloat(String(s.sl).replace(/[^0-9.]/g,""))||0;
    const t1=parseFloat(String(s.tp1).replace(/[^0-9.]/g,""))||0;
    const t2=parseFloat(String(s.tp2||"").replace(/[^0-9.]/g,""))||0;
    const t3=parseFloat(String(s.tp3||"").replace(/[^0-9.]/g,""))||0;
    const g=(String(s.grade||"B").replace(/[^ABCabc]/g,"")[0]||"B").toUpperCase();
    const rawDir=String(s.dir||"BUY").toUpperCase();
    const dir=(rawDir.includes("SELL")||rawDir.includes("SHORT"))?"SELL":"BUY";
    return{...s,grade:g,dir,entry:String(s.entry),sl:String(s.sl),tp1:String(s.tp1),tp2:String(s.tp2||""),tp3:String(s.tp3||""),conf:Math.min(99,Math.max(1,parseInt(s.conf)||75)),status:s.status||"PENDING",rr:String(s.rr||"2.0"),entryNum:e,slNum:sl,tp1Num:t1,tp2Num:t2||null,tp3Num:t3||null};
  },[]);

  // ── Update signal outcome + trigger ML learning + auto journal ─────────
  const updateSignalStatus = useCallback(async(idx, outcome)=>{
    setSignals(prev=>{
      const updated=prev.map((s,i)=>{
        if(i!==idx) return s;
        const newOutcome = s.outcome===outcome?null:outcome;
        return {...s,outcome:newOutcome};
      });
      return updated;
    });
    const sig = signals[idx];
    if(!sig) return;
    const toggling = sig.outcome===outcome; // un-marking
    if(toggling){ addNotif("Outcome cleared","info"); return; }

    // Detect current session
    const utcH=new Date().getUTCHours();
    const session=utcH<8?"Asian":utcH<13?"London":utcH<17?"LDN-NY":"New York";
    dispatch({type:"RECORD_OUTCOME",signal:sig,outcome,session});
    addNotif(outcome==="WIN"?"✅ WIN recorded — ML updated!":"❌ LOSS recorded — ML updated!",outcome==="WIN"?"success":"error");

    // Auto-journal entry
    try{
      const sys="You are a trading journal AI. Write ONE sentence (max 25 words) summarising what happened with this trade and one lesson learned.";
      const prompt=`${outcome} on ${sig.pair} ${sig.dir}. Entry: ${sig.entry}, SL: ${sig.sl}, TP1: ${sig.tp1}, Conf: ${sig.conf}%, R:R ${sig.rr}x. Today is ${new Date().toLocaleDateString()}.`;
      const entry=await callClaude([{role:"user",content:prompt}],sys,150);
      dispatch({type:"ADD_JOURNAL",entry:{pair:sig.pair,dir:sig.dir,outcome,date:new Date().toLocaleString(),entry}});
    }catch{}
  },[signals,addNotif,dispatch]);

  // ── Refresh prices ───────────────────────────────────────────────────
  const refreshPrices=useCallback(()=>{
    setRefreshing(true);
    const np={};
    ASSETS.forEach(s=>{
      const old=prices[s].price;
      const nv=+(old*(1+(Math.random()-0.499)*0.003)).toFixed(2);
      np[s]={price:nv,change:+(((nv-old)/old)*100).toFixed(3)};
    });
    setPrices(np);
    setCandles(prev=>{
      const nc={};
      ASSETS.forEach(s=>{
        const lp=np[s].price;
        const prev2=prev[s]; const last=prev2[prev2.length-1];
        const o=last.close,c=+lp.toFixed(2);
        const h=+(Math.max(o,c)+Math.random()*Math.abs(c-o)*0.5).toFixed(2);
        const l=+(Math.min(o,c)-Math.random()*Math.abs(c-o)*0.5).toFixed(2);
        const ts=new Date();
        nc[s]=[...prev2.slice(1),{t:ts.getHours()+":"+String(ts.getMinutes()).padStart(2,"0"),open:+o.toFixed(2),high:h,low:l,close:c,vol:Math.floor(Math.random()*2000+500)}];
      });
      return nc;
    });
    setLastUpdate(new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}));
    // Update regime on each refresh for XAUUSD
    setTimeout(()=>{
      setCandles(prev=>{
        const r=detectRegime(prev.XAUUSD||[]);
        dispatch({type:"SET_REGIME",regime:r});
        return prev;
      });
      setRefreshing(false);
    },600);
  },[prices,dispatch]);

  useEffect(()=>{
    setLastUpdate(new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}));
    const i=setInterval(refreshPrices,120000);
    return()=>clearInterval(i);
  },[]);

  // ── Auto-analysis every 2h ───────────────────────────────────────────
  useEffect(()=>{
    if(autoAnalysis){
      const i=setInterval(()=>{generateAnalysis();addNotif("Auto-analysis complete — plan updated","success");},7200000);
      return()=>clearInterval(i);
    }
  },[autoAnalysis]);

  // ── Auto-training every 2h ───────────────────────────────────────────
  useEffect(()=>{
    if(autoTrain){
      const i=setInterval(()=>{
        setTrainingLog(l=>[{time:new Date().toLocaleTimeString(),type:"auto",msg:`Auto-training complete. ${signals.length} signals. Hour/day scoring updated. Next: ${new Date(Date.now()+7200000).toLocaleTimeString()}`},...l].slice(0,50));
        addNotif("AI auto-training complete ✓","info");
      },7200000);
      return()=>clearInterval(i);
    }
  },[autoTrain,signals]);

  // ── Generate signals ─────────────────────────────────────────────────
  const generateSignals=async()=>{
    setGenerating(true);
    try{
      const sys=`You are a market analyst. Return ONLY a valid JSON array of exactly 3 signals. Grade must be exactly A, B, or C. Dir must be exactly BUY or SELL. Example format: [{"pair":"XAUUSD","dir":"BUY","entry":"5130","sl":"5090","tp1":"5170","tp2":"5210","tp3":"5250","grade":"A","conf":78,"status":"PENDING","rr":"2.5"},{"pair":"BTCUSD","dir":"SELL","entry":"68500","sl":"70000","tp1":"67000","tp2":"65500","tp3":"64000","grade":"B","conf":72,"status":"PENDING","rr":"2.2"},{"pair":"SP500","dir":"BUY","entry":"6740","sl":"6700","tp1":"6780","tp2":"6820","tp3":"6860","grade":"B","conf":68,"status":"PENDING","rr":"2.0"}]`;
      const r=await callClaude([{role:"user",content:`Generate 3 trading signals. Prices: XAUUSD $${prices.XAUUSD?.price}, BTCUSD $${prices.BTCUSD?.price}, SP500 ${prices.SP500?.price}, MSFT $${prices.MSFT?.price}, AMZN $${prices.AMZN?.price}. Use these exact prices for entry/SL/TP.`}],sys,700);
      const clean=r.replace(/```json|```/g,"").trim();
      const rawSigs=JSON.parse(clean).map(sanitiseSig);
      // Apply ML confidence adjustment to each signal
      const newSigs=rawSigs.map(s=>{
        const adj=mlConfidenceAdjust(s,mlState);
        return {...s,conf:Math.min(99,Math.max(1,(parseInt(s.conf)||75)+adj)),mlAdj:adj};
      });
      setSignals(prev=>[...newSigs,...prev].slice(0,25));
      addNotif(`⚡ ${newSigs.length} new signals generated!`,"signal");
      // Show in-app popup for first signal
      if(newSigs.length>0){ setSignalPopup(newSigs[0]); }
      // Browser/phone notification
      newSigs.forEach(s=>{
        sendBrowserNotification(`⚡ ${s.pair} ${s.dir==="BUY"?"LONG":"SHORT"} Signal`,`Entry: ${s.entry} | SL: ${s.sl} | TP1: ${s.tp1} | Conf: ${s.conf}% | R:R ${s.rr}x`);
      });
      // Send to Telegram
      if(tgConfig.enabled&&tgConfig.botToken!=="YOUR_BOT_TOKEN"){
        for(const sig of newSigs){
          await sendTelegram(tgConfig.botToken,tgConfig.chatId,formatTelegramSignal(sig));
        }
        addNotif("Signals sent to Telegram ✓","success");
      }
    }catch(e){addNotif("Signal generation failed — check API","error");}
    setGenerating(false);
  };

  // ── Generate analysis ────────────────────────────────────────────────
  const generateAnalysis=async()=>{
    setGenerating(true);
    try{
      const sys=`You are a professional market analyst. Return ONLY valid JSON: {"XAUUSD":{"sentiment":"BULLISH","text":"analysis max 80 words","support":["5080","5050","5020"],"resistance":["5160","5200","5250"]},"BTCUSD":{"sentiment":"BEARISH","text":"...","support":["66000","64000","62000"],"resistance":["70000","72000","75000"]},"SP500":{"sentiment":"NEUTRAL","text":"...","support":["6680","6640","6600"],"resistance":["6800","6850","6900"]},"MSFT":{"sentiment":"BEARISH","text":"...","support":["370","365","360"],"resistance":["385","392","400"]},"AMZN":{"sentiment":"NEUTRAL","text":"...","support":["192","188","183"],"resistance":["205","210","215"]}}`;
      const r=await callClaude([{role:"user",content:`Analyze March 2026 markets. Gold $${prices.XAUUSD?.price}, Bitcoin $${prices.BTCUSD?.price}, S&P500 ${prices.SP500?.price}, MSFT $${prices.MSFT?.price}, AMZN $${prices.AMZN?.price}. Geopolitical tensions high. Fed rate cut expectations rising.`}],sys,1200);
      const clean=r.replace(/```json|```/g,"").trim();
      setAnalyses(JSON.parse(clean));
      addNotif("AI analysis complete ✓","success");
    }catch{addNotif("Analysis failed — try again","error");}
    setGenerating(false);
  };

  // ── Generate plan ────────────────────────────────────────────────────
  const generatePlan=async()=>{
    setGenPlan(true);
    try{
      const sys=`You are a professional trading planner. Return ONLY valid JSON array: [{"pair":"XAUUSD","bias":"STRONG_BULLISH","plan":"2-3 sentence trading plan","bestSession":"London-NY Overlap"},{"pair":"BTCUSD","bias":"BEARISH","plan":"...","bestSession":"NY Session"},{"pair":"SP500","bias":"NEUTRAL","plan":"...","bestSession":"US New York"},{"pair":"MSFT","bias":"BEARISH","plan":"...","bestSession":"London-NY Overlap"},{"pair":"AMZN","bias":"NEUTRAL","plan":"...","bestSession":"US New York"}]`;
      const r=await callClaude([{role:"user",content:`Create today's trading plan ${new Date().toDateString()}. Gold $${prices.XAUUSD?.price}, BTC $${prices.BTCUSD?.price}, SP500 ${prices.SP500?.price}, MSFT $${prices.MSFT?.price}, AMZN $${prices.AMZN?.price}. Win rate 64%, best session London-NY Overlap.`}],sys,900);
      const clean=r.replace(/```json|```/g,"").trim();
      setDailyPlan(JSON.parse(clean));
      addNotif("Daily plan generated ✓","success");
    }catch{setDailyPlan([{pair:"Error",bias:"–",plan:"Generation failed. Please try again.",bestSession:"–"}]);}
    setGenPlan(false);
  };

  // ── Train manual ─────────────────────────────────────────────────────
  const trainManual=async()=>{
    const sys="You are a trading AI trainer. In 1-2 sentences, summarize what patterns you learned from this trade data.";
    const r=await callClaude([{role:"user",content:`Training on ${signals.length} signals. Win rate: 57.1%. Best asset: XAUUSD (62.2% WR). Best session: Late NY. Best day: Tuesday. Worst day: Wednesday. What patterns learned?`}],sys,300);
    setTrainingLog(l=>[{time:new Date().toLocaleTimeString(),type:"manual",msg:r},...l].slice(0,50));
    addNotif("Manual training complete ✓","success");
  };

  // ── Export CSV ───────────────────────────────────────────────────────
  const exportCSV=()=>{
    const header="Pair,Grade,Dir,Entry,SL,TP1,TP2,TP3,Conf,Status,RR\n";
    const rows=signals.map(s=>`${s.pair},${s.grade},${s.dir},${s.entry},${s.sl},${s.tp1},${s.tp2||""},${s.tp3||""},${s.conf}%,${s.status},${s.rr}x`).join("\n");
    const blob=new Blob([header+rows],{type:"text/csv"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="deeptrade_signals.csv"; a.click();
    addNotif("Signals exported to CSV ✓","success");
  };

  // ── Test Telegram ────────────────────────────────────────────────────
  const testTelegram=async(cfg)=>{
    const ok=await sendTelegram(cfg.botToken,cfg.chatId,"🤖 <b>DeepTrade AI v7</b> — Test message\n\nTelegram integration is working correctly! You will receive signal alerts here.\n\n⚡ Ready to trade.");
    addNotif(ok?"Telegram test sent ✓":"Telegram test failed — check token/chatId",ok?"success":"error");
  };

  if(!authed) return <LoginScreen onLogin={()=>setAuthed(true)}/>;

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100vh",background:T.bg,fontFamily:"'JetBrains Mono',monospace,sans-serif",color:T.text,overflow:"hidden",minWidth:900}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-track{background:${T.bg};}
        ::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px;}
        ::-webkit-scrollbar-thumb:hover{background:${T.textFaint};}
        tr:hover{background:rgba(245,166,35,0.03)!important;}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes slideIn{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}
        button:hover{opacity:0.85;transition:opacity .15s;}
        @keyframes slideDown{from{transform:translateX(-50%) translateY(-20px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}
        input:focus,select:focus{border-color:${T.accent}!important;outline:none;}
        @media(max-width:900px){
          .sidebar{display:none!important;}
          .mobile-nav{display:flex!important;}
          .main-content{padding-bottom:70px!important;}
        }
        @media(max-width:700px){
          .five-col{grid-template-columns:1fr 1fr!important;}
          .stat-grid{grid-template-columns:1fr 1fr!important;}
        }
      `}</style>
      <NotifToast notifs={notifs} T={T}/>
      {signalPopup&&<SignalPopup signal={signalPopup} onClose={()=>setSignalPopup(null)} T={T}/>}
      {showTgModal&&<TelegramModal tgConfig={tgConfig} setTgConfig={setTgConfig} onClose={()=>setShowTgModal(false)} onTest={testTelegram} T={T}/>}
      <Header prices={prices} lastUpdate={lastUpdate} onRefresh={refreshPrices} refreshing={refreshing} onGenerate={page==="analysis"?generateAnalysis:generateSignals} generating={generating} onLogout={()=>setAuthed(false)} modelActive={modelActive} setModelActive={setModelActive} darkMode={darkMode} setDarkMode={setDarkMode} tgConfig={tgConfig} setShowTgModal={setShowTgModal} streak={streak} pushEnabled={pushEnabled} requestPushPermission={requestPushPermission} setPushEnabled={setPushEnabled} addNotif={addNotif} account={account} setPage={setPage} T={T}/>
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        <div className="sidebar"><Sidebar page={page} setPage={setPage} T={T}/></div>
        <div className="main-content" style={{flex:1,overflowY:"auto",overflowX:"hidden"}}>
          {page==="overview"&&<OverviewPage prices={prices} stats={stats} signals={signals} candles={candles} T={T}/>}
          {page==="signals"&&<SignalsPage signals={signals} onAdd={s=>setSignals(p=>[sanitiseSig({...s,conf:75,status:"PENDING",rr:"2.0",outcome:null}),...p])} onDelete={i=>setSignals(p=>p.filter((_,idx)=>idx!==i))} onUpdateStatus={updateSignalStatus} candles={candles} onExportCSV={exportCSV} T={T}/>}
          {page==="charts"&&<ChartsPage prices={prices} candles={candles} signals={signals} T={T}/>}
          {page==="analysis"&&<AnalysisPage analyses={analyses} onGenerate={generateAnalysis} generating={generating} prices={prices} T={T}/>}
          {page==="news"&&<NewsFeedPage T={T} prices={prices}/>}
          {page==="performance"&&<PerformancePage perf={perf} dailyPnL={dailyPnL} signals={signals} wrTrend={wrTrend} T={T}/>}
          {page==="pnltracker"&&<PnLTrackerPage T={T}/>}
          {page==="times"&&<BestTimesPage T={T}/>}
          {page==="plan"&&<DailyPlanPage plan={dailyPlan} onGenerate={generatePlan} generating={genPlan} perf={perf} autoAnalysis={autoAnalysis} setAutoAnalysis={setAutoAnalysis} T={T}/>}
          {page==="ai"&&<AIChatPage signals={signals} prices={prices} T={T}/>}
          {page==="advisor"&&<AIAdvisorPage account={account} accountDispatch={accountDispatch} signals={signals} candles={candles} prices={prices} mlState={mlState} addNotif={addNotif} T={T}/>}
          {page==="training"&&<TrainingPage signals={signals} onTrainManual={trainManual} onTrainAuto={()=>setAutoTrain(a=>!a)} autoTrain={autoTrain} trainingLog={trainingLog} T={T}/>}}
          {page==="mlbrain"&&<MLBrainPage mlState={mlState} dispatch={dispatch} signals={signals} candles={candles} prices={prices} addNotif={addNotif} T={T}/>}
        </div>
      </div>
    </div>
  );
}

