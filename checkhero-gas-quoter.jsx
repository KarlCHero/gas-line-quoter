import { useState, useRef, useEffect } from "react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const GRID = 40;
const METER_POS = { x: 120, y: 280 };

const APPLIANCE_TYPES = [
  { id:"cooktop",             label:"Cooktop",             mj:30  },
  { id:"freestanding_cooker", label:"Freestanding Cooker", mj:50  },
  { id:"wall_heater",         label:"Wall / Space Heater", mj:25  },
  { id:"ducted_heater",       label:"Ducted Heater",       mj:120 },
  { id:"storage_hws",         label:"Storage HWS",         mj:200 },
  { id:"instant_hws",         label:"Instantaneous HWS",   mj:200 },
];

// Coloured badge icons — iOS-style circle disc with white stroke SVG icon
const APPLIANCE_ICONS = {
  cooktop:             { color: '#EA580C' },
  freestanding_cooker: { color: '#E8472A' },
  wall_heater:         { color: '#DC2626' },
  ducted_heater:       { color: '#2563EB' },
  storage_hws:         { color: '#0891B2' },
  instant_hws:         { color: '#059669' },
};

// Returns SVG elements for a 20×20 viewBox (white stroke, no fill)
function ApplianceIconGlyphs(typeId) {
  const sw = {stroke:"white",strokeWidth:1.6,fill:"none",strokeLinecap:"round"};
  switch (typeId) {
    case 'cooktop': return (<>
      <circle cx="10" cy="10" r="6.5" {...sw}/>
      <circle cx="10" cy="10" r="3"   {...sw}/>
      <line x1="10" y1="3.5" x2="10" y2="7"    {...sw}/>
      <line x1="10" y1="13"  x2="10" y2="16.5" {...sw}/>
      <line x1="3.5" y1="10" x2="7"  y2="10"   {...sw}/>
      <line x1="13"  y1="10" x2="16.5" y2="10" {...sw}/>
    </>);
    case 'freestanding_cooker': return (<>
      <rect x="3" y="8" width="14" height="9" rx="1.5" {...sw}/>
      <rect x="6" y="10.5" width="8" height="4" rx="0.8" stroke="white" strokeWidth="1.3" fill="none"/>
      <circle cx="7.5"  cy="5" r="1.8" {...sw}/>
      <circle cx="12.5" cy="5" r="1.8" {...sw}/>
    </>);
    case 'wall_heater': return (<>
      <path d="M5,15.5 Q4,13 5,10.5 Q6,8 5,5.5"   {...sw}/>
      <path d="M10,15.5 Q9,13 10,10.5 Q11,8 10,5.5" {...sw}/>
      <path d="M15,15.5 Q14,13 15,10.5 Q16,8 15,5.5" {...sw}/>
    </>);
    case 'ducted_heater': return (<>
      <rect x="3" y="5" width="14" height="10" rx="2" {...sw}/>
      <line x1="3" y1="8"    x2="17" y2="8"    stroke="white" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
      <line x1="3" y1="10.5" x2="17" y2="10.5" stroke="white" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
      <line x1="3" y1="13"   x2="17" y2="13"   stroke="white" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
    </>);
    case 'storage_hws': return (<>
      <rect x="6" y="2" width="8" height="13" rx="3" {...sw}/>
      <line x1="8"  y1="15" x2="7"  y2="18" {...sw}/>
      <line x1="12" y1="15" x2="13" y2="18" {...sw}/>
      <line x1="7"  y1="18" x2="13" y2="18" {...sw}/>
    </>);
    case 'instant_hws': return (<>
      <rect x="7.5" y="2" width="5" height="7" rx="1.2" {...sw}/>
      <line x1="4.5" y1="5.5" x2="7.5" y2="5.5" {...sw}/>
      <path d="M10,9 L10,12 C9,13 9,15.5 10,16 C11,15.5 11,13 10,12" {...sw}/>
    </>);
    default: return <circle cx="10" cy="10" r="5" {...sw}/>;
  }
}

// React component for HTML (div) contexts
function ApplianceIcon({ typeId, size = 32 }) {
  const ic = APPLIANCE_ICONS[typeId] || { color: '#888' };
  const s = size * 0.6;
  return (
    <div style={{width:size,height:size,borderRadius:'50%',background:ic.color,
      display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
      <svg width={s} height={s} viewBox="0 0 20 20">{ApplianceIconGlyphs(typeId)}</svg>
    </div>
  );
}

// AS/NZS 5601 Table F8 — NG, Copper AS1432 Type B, 0.75 kPa ref
const F8 = [
  [2,168,554,1218,2336,3931,9046],[4,115,381,837,1606,2702,6217],
  [6,93,306,672,1289,2170,4993],[8,79,262,575,1104,1857,4273],
  [10,70,232,510,978,1646,3787],[12,64,210,462,886,1491,3431],
  [14,59,193,425,815,1372,3157],[16,54,180,396,758,1276,2937],
  [18,51,169,371,712,1197,2755],[20,48,160,351,672,1131,2603],
  [25,43,141,311,596,1002,2307],[30,39,128,281,540,908,2090],
  [35,36,118,259,497,836,1923],[40,33,110,241,462,777,1789],
  [50,29,97,214,409,689,1585],[60,27,88,193,371,624,1437],
  [80,23,77,168,324,546,1255],[100,20,69,152,293,495,1139],
  [120,18,63,139,269,454,1045],[160,16,57,122,237,400,921],
  [200,14,52,111,218,369,850],
];
const CU_SIZES = [15,20,25,32,40,50];
const PIPE_COLORS = {15:"#059669",20:"#2563eb",25:"#d97706",32:"#dc2626",40:"#7c3aed",50:"#db2777"};

function interpolate(col, len) {
  if (len <= F8[0][0]) return F8[0][col+1];
  if (len >= F8[F8.length-1][0]) return F8[F8.length-1][col+1];
  for (let i=0;i<F8.length-1;i++) {
    if (F8[i][0]<=len && F8[i+1][0]>=len) {
      const t=(len-F8[i][0])/(F8[i+1][0]-F8[i][0]);
      return F8[i][col+1]+t*(F8[i+1][col+1]-F8[i][col+1]);
    }
  }
  return F8[F8.length-1][col+1];
}
function findSize(flowMJ, runLen, allowDP) {
  const scale = Math.sqrt(Math.max(0.05, allowDP) / 0.75);
  for (let i=0; i<CU_SIZES.length; i++) {
    if (interpolate(i, Math.max(runLen,1)) * scale >= flowMJ) return CU_SIZES[i];
  }
  return CU_SIZES[CU_SIZES.length-1];
}

function analyse(segs, apps) {
  const sk=(x,y)=>`${Math.round(x/GRID)*GRID},${Math.round(y/GRID)*GRID}`;
  const MK=sk(METER_POS.x,METER_POS.y);
  const adj={};
  const addN=k=>{if(!adj[k])adj[k]=[];};
  segs.forEach(s=>{
    const k1=sk(s.x1,s.y1), k2=sk(s.x2,s.y2);
    addN(k1); addN(k2);
    adj[k1].push({id:s.id,other:k2,len:s.length||0});
    adj[k2].push({id:s.id,other:k1,len:s.length||0});
  });
  const allKeys=Object.keys(adj);
  const atNode={};
  apps.forEach(a=>{
    let bestKey=sk(a.x,a.y), bestDist=Infinity;
    allKeys.forEach(k=>{
      const [nx,ny]=k.split(",").map(Number);
      const d=Math.hypot(a.x-nx,a.y-ny);
      if(d<bestDist){bestDist=d;bestKey=k;}
    });
    if(!atNode[bestKey])atNode[bestKey]=[];
    atNode[bestKey].push(a);
  });
  const flows={};
  let longest=0;
  function dfs(node,parent,pathLen){
    const local=(atNode[node]||[]).reduce((s,a)=>s+a.mj,0);
    if(local>0)longest=Math.max(longest,pathLen);
    let total=local;
    for(const e of(adj[node]||[])){
      if(e.other===parent)continue;
      const child=dfs(e.other,node,pathLen+e.len);
      total+=child;
      flows[e.id]=(flows[e.id]||0)+child;
    }
    return total;
  }
  if(adj[MK])dfs(MK,null,0);
  const totalMJ=apps.reduce((s,a)=>s+a.mj,0);
  segs.forEach(s=>{if(!flows[s.id])flows[s.id]=totalMJ;});
  if(!longest)longest=segs.reduce((s,g)=>s+(g.length||0),0);
  return {flows,longest};
}

const DEFAULT = {
  callOutFee:95, baseLabour:500, baseLabourMetres:5, labourPerMetre:45,
  copperRates:{15:18,20:24,25:32,32:42,40:55,50:72},
  meterConnectionFlat:150, meterCopperTail:45,
  applianceCosts:{cooktop:120,freestanding_cooker:145,wall_heater:110,ducted_heater:150,storage_hws:150,instant_hws:165},
  penetrationCost:45, diggingRate:85, concreteCuttingRate:120, twoStoreyFlat:150,
  margin:20,
  companyName:"CheckHero",
  companyPhone:"(03) 9000 0423",
  companyEmail:"Repairs@checkhero.com.au",
  acceptUrl:"",
  systemUrl:"",
};

const snapV = v => Math.round(v/GRID)*GRID;
const fmt   = v => `$${Number(v).toFixed(2)}`;
const today = () => new Date().toLocaleDateString("en-AU",{day:"2-digit",month:"long",year:"numeric"});
const newRef = () => `QT-${Date.now().toString(36).toUpperCase().slice(-6)}`;

// ─── MATERIALS ESTIMATOR ──────────────────────────────────────────────────────
function calcMaterials(segs, apps, q, qr) {
  if (!qr) return null;
  const sk = (x, y) => `${Math.round(x/GRID)*GRID},${Math.round(y/GRID)*GRID}`;
  const sizeOf = {};
  qr.sized.forEach(s => { sizeOf[s.id] = s.size; });

  // Build endpoint adjacency: key -> [{segId, vec}]
  const epMap = {};
  segs.forEach(s => {
    const k1 = sk(s.x1,s.y1), k2 = sk(s.x2,s.y2);
    if (!epMap[k1]) epMap[k1] = [];
    if (!epMap[k2]) epMap[k2] = [];
    const len = Math.hypot(s.x2-s.x1, s.y2-s.y1) || 1;
    epMap[k1].push({ segId:s.id, vec:{ x:(s.x2-s.x1)/len, y:(s.y2-s.y1)/len } });
    epMap[k2].push({ segId:s.id, vec:{ x:(s.x1-s.x2)/len, y:(s.y1-s.y2)/len } });
  });

  let elbows=0, tees=0, couplings=0, reducers=0, midRunCouplers=0;
  Object.values(epMap).forEach(entries => {
    const n = entries.length;
    if (n === 2) {
      const v1=entries[0].vec, v2=entries[1].vec;
      const dot = -(v1.x*v2.x + v1.y*v2.y); // negate: vectors point away from junction
      if (dot > 0.97) { couplings++; } else { elbows += 2; }
      if (sizeOf[entries[0].segId] !== sizeOf[entries[1].segId]) reducers++;
    } else if (n >= 3) {
      tees++;
      const sizes = [...new Set(entries.map(e => sizeOf[e.segId]))];
      if (sizes.length > 1) reducers += sizes.length - 1;
    }
  });

  // Mid-run couplers (copper pipe comes in ~4m lengths)
  segs.forEach(s => { if (s.length && s.length > 4) midRunCouplers += Math.floor(s.length/4); });

  // Appliance stub-in elbows (2 per appliance)
  elbows += apps.length * 2;

  // Supports @ 1.5m centres, broken out by DN size
  const supportsBySize = {};
  qr.sized.forEach(s => {
    if (s.length) {
      const count = Math.ceil((q.twoS ? s.length * 1.5 : s.length) / 1.5);
      supportsBySize[s.size] = (supportsBySize[s.size] || 0) + count;
    }
  });

  // Pipe quantities by size (+ 10% waste)
  const pipeBySize = {};
  qr.sized.forEach(s => { if (s.length) pipeBySize[s.size] = (pipeBySize[s.size]||0) + s.length; });

  return { elbows, tees, couplings, reducers, midRunCouplers, supportsBySize,
    flexHoses: apps.filter(a => a.typeId === 'cooktop' || a.typeId === 'freestanding_cooker').length,
    isolationValves: apps.length + (q.newMeter ? 1 : 0), pipeBySize };
}

// ─── TRADES DIAGRAM ───────────────────────────────────────────────────────────
function TradesDiagram({segs, apps, tradesQr}) {
  if (!segs.length && !apps.length) return null;
  const allX=[METER_POS.x,...segs.flatMap(s=>[s.x1,s.x2]),...apps.map(a=>a.x)];
  const allY=[METER_POS.y,...segs.flatMap(s=>[s.y1,s.y2]),...apps.map(a=>a.y)];
  const pad=52, minX=Math.min(...allX)-pad, maxX=Math.max(...allX)+pad, minY=Math.min(...allY)-pad, maxY=Math.max(...allY)+pad;
  const sc=Math.min(520/((maxX-minX)||1),340/((maxY-minY)||1),1.5);
  const tx=x=>(x-minX)*sc, ty=y=>(y-minY)*sc;
  const sizeOf={};
  if (tradesQr) tradesQr.sized.forEach(s => { sizeOf[s.id]=s.size; });
  return (
    <svg width={(maxX-minX)*sc} height={(maxY-minY)*sc} viewBox={`0 0 ${(maxX-minX)*sc} ${(maxY-minY)*sc}`} style={{display:"block",margin:"0 auto",maxWidth:"100%"}}>
      <defs><pattern id="tdg" x="0" y="0" width={GRID*sc} height={GRID*sc} patternUnits="userSpaceOnUse"><circle cx={GRID*sc/2} cy={GRID*sc/2} r="1.2" fill="#e5dfd6"/></pattern></defs>
      <rect width="100%" height="100%" fill="url(#tdg)"/>
      {segs.map((s,idx) => {
        const sn=idx+1, sz=sizeOf[s.id]||15, col=PIPE_COLORS[sz]||"#E8472A";
        const mx=(tx(s.x1)+tx(s.x2))/2, my=(ty(s.y1)+ty(s.y2))/2;
        const label = `S${sn} · DN${sz}${s.length ? ` · ${s.length}m` : ""}`;
        const bw = label.length * 5.5 + 10;
        return (
          <g key={s.id}>
            <line x1={tx(s.x1)} y1={ty(s.y1)} x2={tx(s.x2)} y2={ty(s.y2)} stroke={col} strokeWidth={4} strokeLinecap="round"/>
            <rect x={mx-bw/2} y={my-12} width={bw} height={20} rx={3} fill="white" stroke={col} strokeWidth={1}/>
            <text x={mx} y={my+4} textAnchor="middle" fontSize={9} fontWeight={800} fill={col}>{label}</text>
          </g>
        );
      })}
      {apps.map(a=>{const ic=APPLIANCE_ICONS[a.typeId]||{color:'#888'};return(<g key={a.id}><circle cx={tx(a.x)} cy={ty(a.y)} r={18} fill={ic.color}/><g transform={`translate(${tx(a.x)-10},${ty(a.y)-10})`}>{ApplianceIconGlyphs(a.typeId)}</g><text x={tx(a.x)} y={ty(a.y)+30} textAnchor="middle" fontSize={8} fontWeight={700} fill="#666">{a.label.split(" ")[0]}</text></g>);})}
      <polygon points={`${tx(METER_POS.x)},${ty(METER_POS.y)-17} ${tx(METER_POS.x)+14},${ty(METER_POS.y)-8} ${tx(METER_POS.x)+14},${ty(METER_POS.y)+8} ${tx(METER_POS.x)},${ty(METER_POS.y)+17} ${tx(METER_POS.x)-14},${ty(METER_POS.y)+8} ${tx(METER_POS.x)-14},${ty(METER_POS.y)-8}`} fill="#E8472A"/>
      <text x={tx(METER_POS.x)} y={ty(METER_POS.y)+2} textAnchor="middle" fontSize={7} fontWeight={800} fill="white">METER</text>
      <text x={tx(METER_POS.x)} y={ty(METER_POS.y)+12} textAnchor="middle" fontSize={7} fill="rgba(255,255,255,.75)">GAS</text>
    </svg>
  );
}

// ─── TRADES PDF ───────────────────────────────────────────────────────────────
function TradesPDF({segs, apps, q, cfg, quoteId, tradesQr, onBack}) {
  const mat = calcMaterials(segs, apps, q, tradesQr);
  return (
    <div style={{maxWidth:820,margin:"0 auto",padding:"24px 20px"}}>
      <div className="no-print" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div>
          <div style={{fontWeight:800,fontSize:16}}>Trades Installation Guide</div>
          <div style={{fontSize:12,color:"#aaa",marginTop:2}}>Print or Save as PDF for site use.</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="bg" onClick={onBack}>← Back</button>
          <button className="bp" onClick={()=>window.print()}>🖨️ Print / Save PDF</button>
        </div>
      </div>

      <div className="client-doc" style={{background:"white",borderRadius:16,border:"1px solid #ede6dc",boxShadow:"0 4px 24px rgba(0,0,0,.08)",overflow:"hidden"}}>
        {/* Header */}
        <div style={{background:"#444",padding:"20px 28px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <svg width="34" height="34" viewBox="0 0 40 40">
              <rect width="40" height="40" rx="8" fill="rgba(255,255,255,.08)"/>
              <path d="M20 5 L8 12 L8 25 C8 32 14 37.5 20 39.5 C26 37.5 32 32 32 25 L32 12 Z" fill="none" stroke="#E8472A" strokeWidth="2.2"/>
              <path d="M14 21 L18 25 L27 16" stroke="#E8472A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
            <div>
              <div style={{fontWeight:800,fontSize:17,color:"white",lineHeight:1.1}}>Check<span style={{color:"#E8472A"}}>Hero</span></div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.45)",marginTop:2}}>Installation Guide · INTERNAL USE ONLY</div>
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{color:"rgba(255,255,255,.5)",fontSize:11}}>{today()}</div>
            <div style={{color:"rgba(255,255,255,.35)",fontSize:10,marginTop:2}}>{cfg.companyPhone}</div>
          </div>
        </div>

        <div style={{padding:"28px 28px"}}>
          {/* Address + quick stats */}
          <div style={{marginBottom:22,paddingBottom:16,borderBottom:"2px solid #f0e8e0"}}>
            <div style={{fontSize:9,fontWeight:700,color:"#bbb",textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>Installation Address</div>
            <div style={{fontSize:20,fontWeight:800,marginBottom:10}}>{q.addr||"Not specified"}</div>
            <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
              {[["Supply",`${q.pressure} kPa`],["Demand",`${apps.reduce((s,a)=>s+a.mj,0)} MJ/hr`],["Pipe",`${segs.reduce((s,g)=>s+(g.length||0),0).toFixed(1)} m`],["Appliances",`${apps.length}`]].map(([k,v])=>(
                <div key={k} style={{fontSize:12}}>
                  <span style={{color:"#aaa",fontWeight:600}}>{k}:</span> <span style={{fontWeight:800}}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Map */}
          {(segs.length>0||apps.length>0) ? (
            <div style={{marginBottom:22}}>
              <div style={{fontWeight:800,fontSize:11,marginBottom:10,color:"#2D2D2D",textTransform:"uppercase",letterSpacing:.5}}>Installation Map</div>
              <div style={{background:"#FAF6F1",borderRadius:10,padding:"16px 12px",border:"1px solid #ede6dc"}}>
                <TradesDiagram segs={segs} apps={apps} tradesQr={tradesQr}/>
                {tradesQr && (
                  <div style={{display:"flex",gap:14,justifyContent:"center",marginTop:12,flexWrap:"wrap"}}>
                    {[...new Set(tradesQr.sized.map(s=>s.size))].sort((a,b)=>a-b).map(sz=>(
                      <div key={sz} style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:"#555"}}>
                        <div style={{width:20,height:4,background:PIPE_COLORS[sz],borderRadius:2}}/>
                        <span style={{fontWeight:800}}>DN{sz}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{textAlign:"center",fontSize:9,color:"#ccc",marginTop:6}}>Schematic — not to scale. Actual routing subject to site conditions.</div>
              </div>
            </div>
          ) : (
            <div style={{textAlign:"center",padding:40,color:"#bbb",marginBottom:22}}>
              <div style={{fontSize:36,marginBottom:10}}>📐</div>
              <div style={{fontWeight:700}}>Draw a pipe layout and add appliances to generate this guide.</div>
            </div>
          )}

          {/* Pipe sections table */}
          {tradesQr && (
            <div style={{marginBottom:22}}>
              <div style={{fontWeight:800,fontSize:11,marginBottom:10,color:"#2D2D2D",textTransform:"uppercase",letterSpacing:.5}}>Pipe Sections</div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead>
                  <tr style={{borderBottom:"2px solid #f0e8e0"}}>
                    {["Section","Length","Flow","Size"].map(h=>(<th key={h} style={{textAlign:h==="Section"?"left":"right",padding:"7px 10px",fontWeight:700,color:"#bbb",fontSize:11}}>{h}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {tradesQr.sized.map((s,idx)=>(
                    <tr key={s.id} style={{borderBottom:"1px solid #f7f2ec"}}>
                      <td style={{padding:"8px 10px"}}><span style={{fontWeight:700,background:"#f0e8e0",borderRadius:4,padding:"2px 7px",fontSize:11}}>S{idx+1}</span></td>
                      <td style={{padding:"8px 10px",textAlign:"right",color:"#666"}}>{s.length?`${s.length} m`:"—"}</td>
                      <td style={{padding:"8px 10px",textAlign:"right",color:"#666"}}>{s.flow} MJ/hr</td>
                      <td style={{padding:"8px 10px",textAlign:"right"}}><span style={{background:PIPE_COLORS[s.size]||"#E8472A",color:"white",borderRadius:4,padding:"2px 10px",fontSize:11,fontWeight:800}}>DN{s.size}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Estimated materials — order guide */}
          {mat && (
            <div style={{marginBottom:22}}>
              <div style={{fontWeight:800,fontSize:11,marginBottom:10,color:"#2D2D2D",textTransform:"uppercase",letterSpacing:.5}}>Estimated Materials — Order Guide</div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead>
                  <tr style={{borderBottom:"2px solid #f0e8e0"}}>
                    {["Item","Est. Qty","Notes"].map(h=>(<th key={h} style={{textAlign:h==="Est. Qty"?"right":"left",padding:"7px 10px",fontWeight:700,color:"#bbb",fontSize:11}}>{h}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(mat.pipeBySize).sort(([a],[b])=>parseInt(a)-parseInt(b)).map(([sz,len])=>(
                    <tr key={`pipe-${sz}`} style={{borderBottom:"1px solid #f7f2ec"}}>
                      <td style={{padding:"8px 10px",fontWeight:600}}>DN{sz} Copper pipe</td>
                      <td style={{padding:"8px 10px",textAlign:"right",fontWeight:700}}>{(len*1.1).toFixed(1)} m</td>
                      <td style={{padding:"8px 10px",color:"#888",fontSize:12}}>incl. 10% waste</td>
                    </tr>
                  ))}
                  {mat.elbows>0&&(<tr style={{borderBottom:"1px solid #f7f2ec"}}><td style={{padding:"8px 10px",fontWeight:600}}>90° Elbows</td><td style={{padding:"8px 10px",textAlign:"right",fontWeight:700}}>~{mat.elbows}</td><td style={{padding:"8px 10px",color:"#888",fontSize:12}}>at bends + 2 per appliance connection</td></tr>)}
                  {mat.tees>0&&(<tr style={{borderBottom:"1px solid #f7f2ec"}}><td style={{padding:"8px 10px",fontWeight:600}}>Tees</td><td style={{padding:"8px 10px",textAlign:"right",fontWeight:700}}>~{mat.tees}</td><td style={{padding:"8px 10px",color:"#888",fontSize:12}}>at branch points</td></tr>)}
                  {mat.couplings>0&&(<tr style={{borderBottom:"1px solid #f7f2ec"}}><td style={{padding:"8px 10px",fontWeight:600}}>Straight couplings</td><td style={{padding:"8px 10px",textAlign:"right",fontWeight:700}}>~{mat.couplings}</td><td style={{padding:"8px 10px",color:"#888",fontSize:12}}>inline connections</td></tr>)}
                  {mat.reducers>0&&(<tr style={{borderBottom:"1px solid #f7f2ec"}}><td style={{padding:"8px 10px",fontWeight:600}}>Reducers</td><td style={{padding:"8px 10px",textAlign:"right",fontWeight:700}}>~{mat.reducers}</td><td style={{padding:"8px 10px",color:"#888",fontSize:12}}>where pipe size changes</td></tr>)}
                  {mat.midRunCouplers>0&&(<tr style={{borderBottom:"1px solid #f7f2ec"}}><td style={{padding:"8px 10px",fontWeight:600}}>Couplers (mid-run)</td><td style={{padding:"8px 10px",textAlign:"right",fontWeight:700}}>~{mat.midRunCouplers}</td><td style={{padding:"8px 10px",color:"#888",fontSize:12}}>for runs &gt;4 m (copper length)</td></tr>)}
                  {Object.entries(mat.supportsBySize||{}).sort(([a],[b])=>parseInt(a)-parseInt(b)).map(([sz,count])=>(
                    <tr key={`supp-${sz}`} style={{borderBottom:"1px solid #f7f2ec"}}>
                      <td style={{padding:"8px 10px",fontWeight:600}}>DN{sz} Pipe supports / clips</td>
                      <td style={{padding:"8px 10px",textAlign:"right",fontWeight:700}}>~{count}</td>
                      <td style={{padding:"8px 10px",color:"#888",fontSize:12}}>@ 1.5 m centres — {sz}mm saddle clamps{q.twoS?" (incl. vertical)":""}</td>
                    </tr>
                  ))}
                  {mat.flexHoses>0&&(<tr style={{borderBottom:"1px solid #f7f2ec"}}><td style={{padding:"8px 10px",fontWeight:600}}>Flexible hose connectors</td><td style={{padding:"8px 10px",textAlign:"right",fontWeight:700}}>{mat.flexHoses}</td><td style={{padding:"8px 10px",color:"#888",fontSize:12}}>cooktops &amp; freestanding cookers only</td></tr>)}
                  <tr style={{borderBottom:"1px solid #f7f2ec"}}><td style={{padding:"8px 10px",fontWeight:600}}>Isolation valves</td><td style={{padding:"8px 10px",textAlign:"right",fontWeight:700}}>{mat.isolationValves}</td><td style={{padding:"8px 10px",color:"#888",fontSize:12}}>1 per appliance{q.newMeter?" + 1 at meter":""}</td></tr>
                </tbody>
              </table>
              <div style={{marginTop:8,padding:"8px 12px",background:"#fff9f7",borderRadius:8,border:"1px solid #fcd0c3",fontSize:11,color:"#999"}}>
                Quantities are estimates based on the pipe layout. Verify before ordering — actual fittings may vary based on site conditions.
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:"1px solid #ede6dc",paddingTop:14}}>
            <div style={{fontSize:10,color:"#ccc",lineHeight:1.8}}>{cfg.companyName}<br/>{cfg.companyPhone} · {cfg.companyEmail}</div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <svg width="18" height="18" viewBox="0 0 40 40"><path d="M20 5 L8 12 L8 25 C8 32 14 37.5 20 39.5 C26 37.5 32 32 32 25 L32 12 Z" fill="none" stroke="#E8472A" strokeWidth="2"/><path d="M14 21 L18 25 L27 16" stroke="#E8472A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
              <span style={{fontWeight:800,color:"#2D2D2D",fontSize:11}}>Check<span style={{color:"#E8472A"}}>Hero</span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CLIENT DIAGRAM ───────────────────────────────────────────────────────────
function ClientDiagram({segs,apps}) {
  if(!segs.length&&!apps.length)return null;
  const allX=[METER_POS.x,...segs.flatMap(s=>[s.x1,s.x2]),...apps.map(a=>a.x)];
  const allY=[METER_POS.y,...segs.flatMap(s=>[s.y1,s.y2]),...apps.map(a=>a.y)];
  const pad=52,minX=Math.min(...allX)-pad,maxX=Math.max(...allX)+pad,minY=Math.min(...allY)-pad,maxY=Math.max(...allY)+pad;
  const sc=Math.min(660/((maxX-minX)||1),280/((maxY-minY)||1),1.5);
  const tx=x=>(x-minX)*sc, ty=y=>(y-minY)*sc;
  return(
    <svg width={(maxX-minX)*sc} height={(maxY-minY)*sc} viewBox={`0 0 ${(maxX-minX)*sc} ${(maxY-minY)*sc}`} style={{display:"block",margin:"0 auto",maxWidth:"100%"}}>
      {segs.map(s=>{
        const mx=(tx(s.x1)+tx(s.x2))/2, my=(ty(s.y1)+ty(s.y2))/2;
        return(
          <g key={s.id}>
            <line x1={tx(s.x1)} y1={ty(s.y1)} x2={tx(s.x2)} y2={ty(s.y2)} stroke="#E8472A" strokeWidth={3.5} strokeLinecap="round"/>
            {s.length&&(<><rect x={mx-18} y={my-9} width={36} height={16} rx={3} fill="white" stroke="#f0e0d6"/><text x={mx} y={my+4} textAnchor="middle" fontSize={9} fontWeight={700} fill="#E8472A">{s.length}m</text></>)}
          </g>
        );
      })}
      {apps.map(a=>{const ic=APPLIANCE_ICONS[a.typeId]||{color:'#888'};return(<g key={a.id}><circle cx={tx(a.x)} cy={ty(a.y)} r={18} fill={ic.color}/><g transform={`translate(${tx(a.x)-10},${ty(a.y)-10})`}>{ApplianceIconGlyphs(a.typeId)}</g><text x={tx(a.x)} y={ty(a.y)+30} textAnchor="middle" fontSize={8} fontWeight={700} fill="#666">{a.label.split(" ")[0]}</text></g>);})}
      <polygon points={`${tx(METER_POS.x)},${ty(METER_POS.y)-17} ${tx(METER_POS.x)+14},${ty(METER_POS.y)-8} ${tx(METER_POS.x)+14},${ty(METER_POS.y)+8} ${tx(METER_POS.x)},${ty(METER_POS.y)+17} ${tx(METER_POS.x)-14},${ty(METER_POS.y)+8} ${tx(METER_POS.x)-14},${ty(METER_POS.y)-8}`} fill="#E8472A"/>
      <text x={tx(METER_POS.x)} y={ty(METER_POS.y)+2} textAnchor="middle" fontSize={7} fontWeight={800} fill="white">METER</text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function GasQuoter() {
  // localStorage helpers
  const load = (key, fallback) => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  };

  const [tab,    setTab]   = useState("main");
  const [step,   setStep]  = useState(() => load('chk_gq_step', 'draw'));
  const [cfg,    setCfg]   = useState(() => ({...DEFAULT, ...load('chk_gq_cfg', {})}));
  const [segs,   setSegs]  = useState(() => load('chk_gq_segs', []));
  const [apps,   setApps]  = useState(() => load('chk_gq_apps', []));
  const [tool,   setTool]  = useState("draw");
  const [appT,   setAppT]  = useState("cooktop");
  const [mouse,  setMouse] = useState(null);
  const [selSeg, setSelSeg]= useState(null);  // id of segment whose length is being edited inline
  const [editVal,setEditVal]= useState("");   // current text in inline input
  const [editErr,setEditErr]= useState("");   // validation error for inline editor
  const [margin, setMargin]= useState(() => load('chk_gq_margin', 20));
  const [quoteId]= useState(newRef);
  const [q,setQ] = useState(() => load('chk_gq_q', {addr:"",pressure:2.0,newMeter:true,pens:0,dig:0,conc:0,twoS:false}));

  // Undo history
  const [history,  setHistory]  = useState([]);

  // UI state
  const [toast,       setToast]       = useState('');
  const [confirmNew,  setConfirmNew]  = useState(false);
  const [confirmReset,setConfirmReset]= useState(false);

  // Drawing state split: drawRef drives event logic (no stale closure); drawPreview drives the visual
  const [drawPreview, setDrawPreview] = useState(null);
  const drawRef = useRef(null);

  const svgRef    = useRef(null);
  const canvasRef = useRef(null); // outer div, for positioning inline input
  const inputRef  = useRef(null);
  const sidRef    = useRef(1);
  const aidRef    = useRef(1);
  const segsRef   = useRef(segs);
  const appsRef   = useRef(apps);
  const toastRef  = useRef(null);

  // Keep refs in sync for undo snapshots (avoids stale closures)
  useEffect(() => { segsRef.current = segs; }, [segs]);
  useEffect(() => { appsRef.current = apps; }, [apps]);

  // Auto-focus inline input when a segment is selected
  useEffect(() => { if (selSeg && inputRef.current) inputRef.current.focus(); }, [selSeg]);

  // Persist to localStorage on every meaningful state change
  useEffect(() => {
    try {
      localStorage.setItem('chk_gq_segs',   JSON.stringify(segs));
      localStorage.setItem('chk_gq_apps',   JSON.stringify(apps));
      localStorage.setItem('chk_gq_q',      JSON.stringify(q));
      localStorage.setItem('chk_gq_cfg',    JSON.stringify(cfg));
      localStorage.setItem('chk_gq_margin', String(margin));
      localStorage.setItem('chk_gq_step',   step);
    } catch(e) {}
  }, [segs, apps, q, cfg, margin, step]);

  // Toast helper
  function showToast(msg) {
    setToast(msg);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(''), 2500);
  }

  // Expiry date helper (30 days from today)
  function expiryDate() {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toLocaleDateString('en-AU', {day:'numeric',month:'long',year:'numeric'});
  }

  // Keyboard shortcuts for draw step
  useEffect(() => {
    const handle = e => {
      if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
      if (step !== 'draw') return;
      if (e.key==='d'||e.key==='D') { setTool('draw');      showToast('✏️  Draw Pipe  [D]'); }
      if (e.key==='a'||e.key==='A') { setTool('appliance'); showToast('🔧  Add Appliance  [A]'); }
      if (e.key==='e'||e.key==='E') { setTool('erase');     showToast('✕  Erase  [E]'); }
      if ((e.ctrlKey||e.metaKey) && e.key==='z') { e.preventDefault(); undo(); }
      if (e.key==='Escape') { setSelSeg(null); setEditVal(''); setEditErr(''); setDrawPreview(null); drawRef.current=null; }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [step]);

  // Reliable draw commit even when mouse is released outside the SVG
  useEffect(() => {
    const up = () => {
      const d = drawRef.current;
      if (!d) return;
      drawRef.current = null;
      setDrawPreview(null);
      const dx = d.x2 - d.x1, dy = d.y2 - d.y1;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        pushHistory();
        setSegs(prev => [...prev, { ...d, id: sidRef.current++, length: null }]);
        showToast('✓ Pipe segment added');
      }
    };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  function svgPos(e) {
    const r = svgRef.current.getBoundingClientRect();
    return { x: snapV(e.clientX - r.left), y: snapV(e.clientY - r.top) };
  }

  // Inline input screen position — midpoint of selected segment translated to page coords
  function inputScreenPos() {
    if (!selSeg || !svgRef.current) return null;
    const s = segs.find(x => x.id === selSeg);
    if (!s) return null;
    const r = svgRef.current.getBoundingClientRect();
    const cr = canvasRef.current.getBoundingClientRect();
    return {
      x: r.left - cr.left + (s.x1 + s.x2) / 2,
      y: r.top  - cr.top  + (s.y1 + s.y2) / 2,
    };
  }

  // ── Mouse handlers ────────────────────────────────────────────────────────
  function onMouseDown(e) {
    // Block if clicking an SVG element tagged as non-interactive for drawing
    // (appliances, meter). NOTE: ghost cursor must NOT have this class.
    if (e.target.closest(".nd")) return;

    // Close any open inline editor on canvas click
    if (selSeg) { commitEdit(); return; }

    const p = svgPos(e);

    if (tool === "draw") {
      const d = { x1:p.x, y1:p.y, x2:p.x, y2:p.y };
      drawRef.current = d;
      setDrawPreview(d);

    } else if (tool === "appliance") {
      // Snap to nearest segment endpoint within 1.5 grid cells
      let pos = p, bestDist = GRID * 1.5;
      segs.forEach(s => {
        [{x:s.x1,y:s.y1},{x:s.x2,y:s.y2}].forEach(ep => {
          const d = Math.hypot(p.x-ep.x, p.y-ep.y);
          if (d < bestDist) { bestDist = d; pos = ep; }
        });
      });
      const aType = APPLIANCE_TYPES.find(a => a.id === appT);
      pushHistory();
      setApps(prev => [...prev, { ...aType, typeId: aType.id, id: aidRef.current++, x: pos.x, y: pos.y }]);
      showToast(`✓ ${aType.label} added`);
    }
  }

  function onMouseMove(e) {
    const p = svgPos(e);
    setMouse(p);
    if (drawRef.current) {
      const d = { ...drawRef.current, x2:p.x, y2:p.y };
      drawRef.current = d;
      setDrawPreview(d);
    }
  }

  function onMouseUp() {
    // Intentionally empty — the window mouseup useEffect handles segment commit +
    // pushHistory(). Doing anything with drawRef here would clear it before that
    // handler fires, breaking undo for every segment drawn inside the SVG.
  }

  function onMouseLeave() {
    setMouse(null); // only clear ghost cursor; drawing state stays for window mouseup to commit
  }

  // ── Inline segment length editing ────────────────────────────────────────
  function openEdit(seg, e) {
    e.stopPropagation();
    if (tool === "erase") { delSeg(seg.id); return; }
    setSelSeg(seg.id);
    setEditVal(seg.length != null ? String(seg.length) : "");
    setEditErr("");
  }

  function commitEdit() {
    if (selSeg) {
      const v = parseFloat(editVal);
      if (isNaN(v) || v <= 0) { setEditErr('Enter a length > 0 m'); return; }
      setEditErr('');
      pushHistory();
      setSegs(prev => prev.map(s => s.id === selSeg ? { ...s, length: v } : s));
      showToast(`✓ Length set to ${v} m`);
    }
    setSelSeg(null);
    setEditVal("");
  }

  function handleEditKey(e) {
    if (e.key === "Enter") commitEdit();
    if (e.key === "Escape") { setSelSeg(null); setEditVal(""); setEditErr(""); }
  }

  // ── Undo history stack (up to 30 snapshots) ───────────────────────────────
  function pushHistory() {
    setHistory(h => [...h.slice(-29), {segs:[...segsRef.current], apps:[...appsRef.current]}]);
  }
  function undo() {
    setHistory(h => {
      if (!h.length) { showToast('Nothing to undo'); return h; }
      const prev = h[h.length - 1];
      setSegs([...prev.segs]);
      setApps([...prev.apps]);
      showToast('↩ Undone');
      return h.slice(0, -1);
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function delSeg(id) { pushHistory(); setSegs(p => p.filter(s => s.id !== id)); if (selSeg===id) setSelSeg(null); showToast('Segment removed'); }
  function delApp(id) { pushHistory(); setApps(p => p.filter(a => a.id !== id)); showToast('Appliance removed'); }

  function upd(path, val) {
    setCfg(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const parts = path.split(".");
      let o = next;
      for (let i=0; i<parts.length-1; i++) o = o[parts[i]];
      o[parts[parts.length-1]] = val;
      return next;
    });
  }

  function buildSystemUrl(total) {
    return cfg.systemUrl
      .replace('{ref}',      quoteId)
      .replace('{addr}',     encodeURIComponent(q.addr))
      .replace('{total}',    (total||0).toFixed(2))
      .replace('{totalGST}', ((total||0)*1.1).toFixed(2))
      .replace('{date}',     today());
  }

  function calcQuote() {
    const totalLen = segs.reduce((s,g) => s + (g.length||0), 0);
    if (!totalLen || !apps.length) return null;
    const { flows, longest } = analyse(segs, apps);
    const allowDP  = Math.max(0.05, q.pressure - 1.13);
    const totalMJ  = apps.reduce((s,a) => s + a.mj, 0);
    const sized    = segs.map(s => ({ ...s, flow: flows[s.id]||totalMJ, size: findSize(flows[s.id]||totalMJ, longest||1, allowDP) }));
    const matCost  = sized.reduce((sum,s) => sum + (s.length||0) * (cfg.copperRates[s.size]||25), 0);
    const extraM   = Math.max(0, totalLen - cfg.baseLabourMetres);
    const labTot   = cfg.baseLabour + extraM * cfg.labourPerMetre;
    const appCost  = apps.reduce((s,a) => s + (cfg.applianceCosts[a.typeId]||120), 0);
    const metCost  = q.newMeter ? cfg.meterConnectionFlat + cfg.meterCopperTail : 0;
    const penCost  = q.pens  * cfg.penetrationCost;
    const digCost  = q.dig   * cfg.diggingRate;
    const concCost = q.conc  * cfg.concreteCuttingRate;
    const twoCost  = q.twoS  ? cfg.twoStoreyFlat : 0;
    const subtotal = cfg.callOutFee + labTot + matCost + appCost + metCost + penCost + digCost + concCost + twoCost;
    const total    = subtotal / (1 - Math.min(margin, 99.9) / 100);
    return { sized, totalMJ, longest, allowDP, totalLen, extraM,
      labTot, labBase:cfg.baseLabour, labExtra:extraM*cfg.labourPerMetre,
      matCost, appCost, metCost, penCost, digCost, concCost, twoCost,
      callOut:cfg.callOutFee, subtotal, marginAmt:total-subtotal, total };
  }

  const qr        = step==="quote"  ? calcQuote() : null;
  const clientQr  = tab==="client"  ? calcQuote() : null;
  const tradesQr  = tab==="trades"  ? calcQuote() : null;
  const appCounts = APPLIANCE_TYPES.map(at => ({ ...at, count: apps.filter(a=>a.typeId===at.id).length })).filter(a => a.count > 0);

  function buildScope() {
    const items = [];
    const totalApps = apps.length;
    items.push("Attend site and set up");
    if (q.newMeter) items.push("Connect to existing gas meter");
    items.push(`Run new pipework to ${totalApps} appliance${totalApps!==1?"s":""}`);
    const tl = segs.reduce((s,g)=>s+(g.length||0),0);
    if (tl>0) items.push(`Approx. ${tl}m total pipe run`);
    appCounts.forEach(a => items.push(`${a.count>1?a.count+"× ":""}${a.label} — connect and commission`));
    if (q.pens>0)  items.push(`${q.pens} wall/floor penetration${q.pens>1?"s":""}`);
    if (q.dig>0)   items.push(`Trenching and backfill — ${q.dig}m`);
    if (q.conc>0)  items.push(`Concrete cutting — ${q.conc}m`);
    if (q.twoS)    items.push("Multi-storey access included");
    items.push("Pressure test to AS/NZS 5601.1");
    items.push("Tidy up job related rubbish");
    items.push("Supply COC within 5 days");
    return items;
  }

  const inPos = inputScreenPos();

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{fontFamily:"'DM Sans',sans-serif",minHeight:"100vh",background:"#FAF6F1",color:"#2D2D2D"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .bp{background:#E8472A;color:white;border:none;padding:10px 22px;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit;font-size:13px;transition:.15s}
        .bp:hover{background:#cc3d24;box-shadow:0 4px 12px rgba(232,71,42,.3)}
        .bg{background:transparent;border:1.5px solid #e5dfd6;color:#555;padding:9px 18px;border-radius:8px;font-weight:600;cursor:pointer;font-family:inherit;font-size:13px;transition:.15s}
        .bg:hover{border-color:#E8472A;color:#E8472A}
        .card{background:white;border-radius:14px;padding:20px;border:1px solid #ede6dc;box-shadow:0 1px 4px rgba(0,0,0,.04)}
        .lbl{font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px;display:block}
        input[type=number],input[type=text]{border:1.5px solid #e5dfd6;border-radius:8px;padding:8px 12px;font-family:inherit;font-size:13px;background:white;width:100%;transition:.15s;color:#2D2D2D}
        input:focus{outline:none;border-color:#E8472A;box-shadow:0 0 0 3px rgba(232,71,42,.1)}
        input[type=range]{accent-color:#E8472A;width:100%}
        .ton{background:#fff5f2;border:1.5px solid #E8472A;color:#E8472A;padding:8px 18px;border-radius:8px;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer}
        .tof{background:white;border:1.5px solid #e5dfd6;color:#777;padding:8px 18px;border-radius:8px;font-family:inherit;font-weight:600;font-size:13px;cursor:pointer;transition:.15s}
        .tof:hover{border-color:#E8472A;color:#E8472A}
        .tlb{display:flex;align-items:center;gap:8px;width:100%;padding:9px 10px;border-radius:8px;margin-bottom:3px;border:1.5px solid transparent;background:transparent;font-family:inherit;font-weight:600;font-size:13px;cursor:pointer;text-align:left;transition:.15s;color:#555}
        .tlb:hover{background:#f5f0ea}
        .tlb.act{border-color:#E8472A!important;background:#fff5f2!important;color:#E8472A!important}
        .rp{display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid #f7f2ec;font-size:13px}
        .pw{display:flex;align-items:center;gap:3px}
        .pw>span{color:#bbb;font-size:13px}
        .pw input{width:90px;text-align:right}
        @keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        @media print{body{background:white!important}.no-print{display:none!important}.client-doc{box-shadow:none!important;border:none!important;border-radius:0!important}}
        @media (max-width:640px){
          .draw-wrap{flex-direction:column!important;height:auto!important;min-height:calc(100vh - 106px)}
          .left-panel{width:100%!important;border-right:none!important;border-bottom:1px solid #ede6dc!important;flex-direction:row!important;flex-wrap:wrap!important;overflow-x:auto!important;gap:8px!important;padding:10px!important}
          .cvs-area{height:55vw!important;min-height:280px!important}
        }
      `}</style>

      {/* ── HEADER ── */}
      <header className="no-print" style={{background:"white",borderBottom:"1px solid #ede6dc",padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",height:60,position:"sticky",top:0,zIndex:200}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <svg width="36" height="36" viewBox="0 0 40 40">
            <rect width="40" height="40" rx="9" fill="#fff0ee"/>
            <path d="M20 5 L8 12 L8 25 C8 32 14 37.5 20 39.5 C26 37.5 32 32 32 25 L32 12 Z" fill="none" stroke="#E8472A" strokeWidth="2.2"/>
            <path d="M14 21 L18 25 L27 16" stroke="#E8472A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
          <div>
            <div style={{fontWeight:800,fontSize:17,lineHeight:1.1}}>Check<span style={{color:"#E8472A"}}>Hero</span></div>
            <div style={{fontSize:10,color:"#bbb",fontWeight:500}}>Gas Line Quoter</div>
          </div>
        </div>
        <div style={{display:"flex",gap:3,background:"#F2EDE6",borderRadius:10,padding:3}}>
          {[["main","🏠  Quote Tool"],["client","📄  Client Quote"],["trades","📋  Trades"],["backend","⚙️  Settings"]].map(([id,lbl])=>(
            <button key={id} onClick={()=>setTab(id)} style={{padding:"7px 16px",borderRadius:8,border:"none",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:12,transition:".15s",background:tab===id?"white":"transparent",color:tab===id?"#E8472A":"#999",boxShadow:tab===id?"0 1px 5px rgba(0,0,0,.1)":"none"}}>{lbl}</button>
          ))}
        </div>
      </header>

      {/* ═══ MAIN TOOL ═══ */}
      {tab==="main" && (<>
        {/* Step nav */}
        <div className="no-print" style={{background:"white",borderBottom:"1px solid #ede6dc",padding:"0 24px",display:"flex",alignItems:"center",gap:4,height:46}}>
          {[["draw","1","Draw Layout"],["questionnaire","2","Job Details"],["quote","3","View Quote"]].map(([id,n,lbl],i)=>(
            <span key={id} style={{display:"flex",alignItems:"center",gap:4}}>
              <button onClick={()=>setStep(id)} style={{display:"flex",alignItems:"center",gap:7,padding:"5px 14px",borderRadius:20,border:"none",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:12,background:step===id?"#E8472A":"transparent",color:step===id?"white":"#bbb",transition:".15s"}}>
                <span style={{width:18,height:18,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,background:step===id?"rgba(255,255,255,.25)":"#f0e8e0",color:step===id?"white":"#bbb"}}>{n}</span>{lbl}
              </button>
              {i<2 && <span style={{color:"#ddd",fontSize:12}}>›</span>}
            </span>
          ))}
        </div>

        {/* ── DRAW ── */}
        {step==="draw" && (
          <div className="draw-wrap" style={{display:"flex",height:"calc(100vh - 106px)"}}>

            {/* Left panel — tools only, no segment list */}
            <div className="left-panel" style={{width:220,background:"white",borderRight:"1px solid #ede6dc",padding:14,display:"flex",flexDirection:"column",gap:14,overflowY:"auto",flexShrink:0}}>
              <div>
                <span className="lbl">Tools</span>
                {[["draw","✏️","Draw Pipe","D"],["appliance","🔧","Add Appliance","A"],["erase","✕","Erase","E"]].map(([id,ic,lb,key])=>(
                  <button key={id} className={`tlb${tool===id?" act":""}`} onClick={()=>setTool(id)}>
                    <span style={{fontSize:14}}>{ic}</span>
                    <span style={{flex:1}}>{lb}</span>
                    <span style={{fontSize:10,color:"#ccc",fontFamily:"monospace",background:"#f0ece8",padding:"1px 5px",borderRadius:4}}>{key}</span>
                  </button>
                ))}
                <button className="tlb" onClick={undo} style={{marginTop:4,color:"#888"}}>
                  <span style={{fontSize:14}}>↩️</span>
                  <span style={{flex:1}}>Undo</span>
                  <span style={{fontSize:10,color:"#ccc",fontFamily:"monospace",background:"#f0ece8",padding:"1px 5px",borderRadius:4}}>⌘Z</span>
                </button>
              </div>

              {tool==="appliance" && (
                <div>
                  <span className="lbl">Appliance Type</span>
                  {APPLIANCE_TYPES.map(a=>(
                    <button key={a.id} onClick={()=>setAppT(a.id)} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"7px 10px",borderRadius:8,marginBottom:3,cursor:"pointer",textAlign:"left",border:appT===a.id?"1.5px solid #E8472A":"1.5px solid #ede6dc",background:appT===a.id?"#fff5f2":"white",fontFamily:"inherit",fontSize:12,fontWeight:appT===a.id?700:400,color:"#333"}}>
                      <ApplianceIcon typeId={a.id} size={24}/>
                      <div><div style={{lineHeight:1.3}}>{a.label}</div><div style={{color:"#bbb",fontSize:10}}>{a.mj} MJ/hr</div></div>
                    </button>
                  ))}
                </div>
              )}

              {apps.length>0 && (
                <div style={{background:"#fff5f2",borderRadius:10,padding:"12px 14px",border:"1px solid #fcd0c3"}}>
                  <span className="lbl" style={{color:"#E8472A"}}>Total Demand</span>
                  <div style={{fontSize:24,fontWeight:800,color:"#E8472A"}}>{apps.reduce((s,a)=>s+a.mj,0)} MJ/hr</div>
                  <div style={{fontSize:11,color:"#E8472A",opacity:.7,marginTop:2}}>{apps.length} appliance{apps.length!==1?"s":""}</div>
                </div>
              )}

              <div style={{padding:"10px 12px",background:"#f7f3ee",borderRadius:8,fontSize:11,color:"#999",lineHeight:1.8}}>
                {tool==="draw"    && <><strong style={{color:"#777"}}>Drag</strong> on the canvas to draw pipe runs. <strong style={{color:"#777"}}>Click any section</strong> to set its length.</>}
                {tool==="appliance" && <>Click on or near a pipe endpoint on the canvas to place an appliance — it will snap to the nearest endpoint.</>}
                {tool==="erase"   && <><strong style={{color:"#777"}}>Click</strong> any segment or appliance to remove it.</>}
              </div>

              <div style={{marginTop:"auto"}}>
                <button className="bp" style={{width:"100%"}} onClick={()=>setStep("questionnaire")}>Next: Job Details →</button>
              </div>
            </div>

            {/* CANVAS */}
            <div className="cvs-area" ref={canvasRef} style={{flex:1,position:"relative",overflow:"hidden"}}>
              <svg
                ref={svgRef}
                width="100%" height="100%"
                style={{display:"block",userSelect:"none",touchAction:"none",
                  cursor: tool==="draw" ? "crosshair" : tool==="appliance" ? "cell" : tool==="erase" ? "not-allowed" : "default"}}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseLeave}
                onTouchStart={e=>{e.preventDefault();const t=e.touches[0];onMouseDown({clientX:t.clientX,clientY:t.clientY,target:e.target});}}
                onTouchMove={e=>{const t=e.touches[0];onMouseMove({clientX:t.clientX,clientY:t.clientY});}}
                onTouchEnd={()=>onMouseLeave()}
              >
                <defs>
                  <pattern id="dg" x="0" y="0" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                    <circle cx={GRID/2} cy={GRID/2} r="1.5" fill="#e5dfd6"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#dg)"/>

                {/* Sections */}
                {segs.map((s, segIdx) => {
                  const sn = segIdx + 1;
                  const mx=(s.x1+s.x2)/2, my=(s.y1+s.y2)/2;
                  const isSel = selSeg === s.id;
                  return (
                    <g key={s.id}
                      style={{cursor:"pointer"}}
                      onClick={e => openEdit(s, e)}>
                      {/* Wide transparent hit area */}
                      <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="transparent" strokeWidth={20}/>
                      {/* Visible line */}
                      <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                        stroke={isSel ? "#c0392b" : "#E8472A"} strokeWidth={isSel?5:4} strokeLinecap="round"/>
                      {/* Section badge — shows S{n}, updates with length when set */}
                      {!isSel && (s.length != null
                        ? (<><rect x={mx-34} y={my-12} width={68} height={22} rx={4} fill="white" stroke="#ede6dc"/>
                           <text x={mx} y={my+5} textAnchor="middle" fontSize={11} fontWeight={700} fill="#333">S{sn} · {s.length}m</text></>)
                        : (<><rect x={mx-20} y={my-12} width={40} height={22} rx={4} fill="#fff5f2" stroke="#E8472A" opacity={.95}/>
                           <text x={mx} y={my+5} textAnchor="middle" fontSize={11} fontWeight={700} fill="#E8472A">S{sn}</text></>)
                      )}
                    </g>
                  );
                })}

                {/* Draw preview line */}
                {drawPreview && (
                  <line x1={drawPreview.x1} y1={drawPreview.y1} x2={drawPreview.x2} y2={drawPreview.y2}
                    stroke="#E8472A" strokeWidth={3} strokeDasharray="8,5" strokeLinecap="round" opacity={.5}/>
                )}

                {/* Appliance ghost cursor — NO .nd class so it doesn't block clicks */}
                {tool==="appliance" && mouse && (()=>{
                  const ic=APPLIANCE_ICONS[appT]||{color:'#888'};
                  return(
                    <g opacity={.4} style={{pointerEvents:"none"}}>
                      <circle cx={mouse.x} cy={mouse.y} r={20} fill={ic.color} fillOpacity={.15} stroke={ic.color} strokeWidth={1.5} strokeDasharray="5,3"/>
                      <circle cx={mouse.x} cy={mouse.y} r={14} fill={ic.color}/>
                      <g transform={`translate(${mouse.x-10},${mouse.y-10})`}>{ApplianceIconGlyphs(appT)}</g>
                    </g>
                  );
                })()}

                {/* Appliances — .nd blocks draw/appliance tool from firing on them */}
                {apps.map(a => {
                  const ic=APPLIANCE_ICONS[a.typeId]||{color:'#888'};
                  return (
                    <g key={a.id} className="nd"
                      style={{cursor: tool==="erase"?"pointer":"default"}}
                      onClick={e => { e.stopPropagation(); if(tool==="erase") delApp(a.id); }}>
                      <circle cx={a.x} cy={a.y} r={22} fill="white"
                        stroke={tool==="erase"?"#fca5a5":"#e5dfd6"}
                        strokeWidth={tool==="erase"?2.5:1.5}/>
                      <circle cx={a.x} cy={a.y} r={16} fill={ic.color}/>
                      <g transform={`translate(${a.x-10},${a.y-10})`}>{ApplianceIconGlyphs(a.typeId)}</g>
                      <text x={a.x} y={a.y+38} textAnchor="middle" fontSize={9} fontWeight={700} fill="#555">{a.label.split(" ")[0]}</text>
                      <text x={a.x} y={a.y+50} textAnchor="middle" fontSize={9} fill="#bbb">{a.mj} MJ/hr</text>
                    </g>
                  );
                })}

                {/* Gas meter — .nd */}
                <g className="nd">
                  <polygon
                    points={`${METER_POS.x},${METER_POS.y-20} ${METER_POS.x+17},${METER_POS.y-10} ${METER_POS.x+17},${METER_POS.y+10} ${METER_POS.x},${METER_POS.y+20} ${METER_POS.x-17},${METER_POS.y+10} ${METER_POS.x-17},${METER_POS.y-10}`}
                    fill="#E8472A"/>
                  <text x={METER_POS.x} y={METER_POS.y+1} textAnchor="middle" fontSize={8} fontWeight={800} fill="white">METER</text>
                  <text x={METER_POS.x} y={METER_POS.y+12} textAnchor="middle" fontSize={7} fill="rgba(255,255,255,.75)">GAS</text>
                </g>
              </svg>

              {/* ── Inline segment length input — floats over canvas at midpoint ── */}
              {selSeg && inPos && (
                <div style={{position:"absolute",left:inPos.x,top:inPos.y,transform:"translate(-50%,-50%)",zIndex:100,
                  background:"white",border:`2px solid ${editErr?"#DC2626":"#E8472A"}`,borderRadius:10,padding:"10px 12px",
                  boxShadow:"0 4px 20px rgba(232,71,42,.25)",display:"flex",flexDirection:"column",alignItems:"center",gap:6,minWidth:160}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,width:"100%"}}>
                    <input
                      ref={inputRef}
                      type="number"
                      placeholder="Length"
                      value={editVal}
                      onChange={e=>{setEditVal(e.target.value);setEditErr('');}}
                      onKeyDown={handleEditKey}
                      style={{width:90,padding:"6px 10px",fontSize:14,fontWeight:700,
                        border:`1.5px solid ${editErr?"#DC2626":"#fcd0c3"}`,borderRadius:7,textAlign:"center"}}
                    />
                    <span style={{fontSize:13,fontWeight:700,color:"#E8472A"}}>m</span>
                    <button onClick={commitEdit} style={{background:"#E8472A",color:"white",border:"none",borderRadius:7,padding:"6px 12px",fontWeight:700,fontSize:12,cursor:"pointer"}}>✓</button>
                    <button onClick={()=>{delSeg(selSeg);setSelSeg(null);setEditErr('');}} title="Delete segment"
                      style={{background:"none",border:"1.5px solid #fcd0c3",borderRadius:7,padding:"5px 9px",color:"#E8472A",fontWeight:700,fontSize:13,cursor:"pointer",lineHeight:1}}>✕</button>
                  </div>
                  {editErr && <div style={{fontSize:10,color:"#DC2626",fontWeight:600,alignSelf:"flex-start"}}>{editErr}</div>}
                </div>
              )}

              {/* Empty state — contextual hints */}
              {segs.length===0 && apps.length===0 && (
                <div style={{position:"absolute",top:"50%",left:"55%",transform:"translate(-50%,-50%)",textAlign:"center",pointerEvents:"none"}}>
                  <div style={{fontSize:40,marginBottom:10}}>✏️</div>
                  <div style={{fontSize:15,fontWeight:700,color:"#ccc"}}>Drag to draw pipe runs</div>
                  <div style={{fontSize:12,color:"#ddd",marginTop:5}}>Start from the meter (left side) and draw to each appliance location</div>
                </div>
              )}
              {segs.length>0 && segs.some(s=>!s.length||s.length<=0) && !selSeg && (
                <div style={{position:"absolute",bottom:16,left:"55%",transform:"translateX(-50%)",pointerEvents:"none",
                  background:"rgba(217,119,6,.1)",border:"1px solid #D97706",borderRadius:8,padding:"7px 16px"}}>
                  <span style={{fontSize:12,color:"#B45309",fontWeight:600}}>⚠️ Click any <strong>? m</strong> badge to set its length</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── JOB DETAILS ── */}
        {step==="questionnaire" && (
          <div style={{maxWidth:620,margin:"0 auto",padding:"28px 20px"}}>
            <h2 style={{fontSize:20,fontWeight:800,marginBottom:20}}>Job Details</h2>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div className="card">
                <span className="lbl">Property Address <span style={{color:"#E8472A"}}>*</span></span>
                <input type="text" placeholder="e.g. 42 Smith Street, Kew VIC 3101" value={q.addr} onChange={e=>setQ(p=>({...p,addr:e.target.value}))}/>
                <div style={{fontSize:11,color:"#bbb",marginTop:4}}>Required for Client Quote PDF</div>
              </div>

              <div className="card">
                <div style={{fontWeight:700,marginBottom:12}}>Gas Supply Pressure at Meter</div>
                <span className="lbl">Meter outlet pressure (kPa)</span>
                <input type="number" step="0.1" min="1.2" max="2.75" value={q.pressure}
                  onChange={e=>{const v=parseFloat(e.target.value);if(!isNaN(v))setQ(p=>({...p,pressure:Math.min(2.75,Math.max(1.2,v))}));}}
                  style={{maxWidth:160}}/>
                <div style={{marginTop:10,padding:"11px 14px",background:"#f7f3ee",borderRadius:8,fontSize:12,color:"#666",lineHeight:1.7}}>
                  Allowable pressure drop: <strong style={{color:"#E8472A"}}>{Math.max(0.05,q.pressure-1.13).toFixed(2)} kPa</strong>
                  <span style={{color:"#bbb",marginLeft:8}}>(min. 1.13 kPa at appliance — AS/NZS 5601)</span>
                  {q.pressure<1.4 && <div style={{color:"#d97706",fontSize:11,marginTop:4}}>⚠️ Very low supply — larger pipe sizes will be selected.</div>}
                  {q.pressure>=2.0 && <div style={{color:"#059669",fontSize:11,marginTop:4}}>✓ Good supply pressure.</div>}
                </div>
              </div>

              <div className="card">
                <div style={{fontWeight:700,marginBottom:14}}>Additional Works</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr",gap:12}}>
                  <div>
                    <span className="lbl">New meter connection?</span>
                    <div style={{display:"flex",gap:6}}>
                      {[true,false].map(v=>(<button key={String(v)} className={q.newMeter===v?"ton":"tof"} onClick={()=>setQ(p=>({...p,newMeter:v}))} style={{flex:1}}>{v?"Yes":"No"}</button>))}
                    </div>
                  </div>
                  <div>
                    <span className="lbl">2-storey?</span>
                    <div style={{display:"flex",gap:6}}>
                      {[true,false].map(v=>(<button key={String(v)} className={q.twoS===v?"ton":"tof"} onClick={()=>setQ(p=>({...p,twoS:v}))} style={{flex:1}}>{v?"Yes":"No"}</button>))}
                    </div>
                  </div>
                  <div><span className="lbl">Penetrations</span><input type="number" min={0} value={q.pens} onChange={e=>setQ(p=>({...p,pens:parseInt(e.target.value)||0}))}/></div>
                  <div><span className="lbl">Digging (metres)</span><input type="number" min={0} step={0.5} value={q.dig} onChange={e=>setQ(p=>({...p,dig:parseFloat(e.target.value)||0}))}/></div>
                  <div><span className="lbl">Concrete cutting (metres)</span><input type="number" min={0} step={0.5} value={q.conc} onChange={e=>setQ(p=>({...p,conc:parseFloat(e.target.value)||0}))}/></div>
                </div>
              </div>

              <div style={{display:"flex",gap:10}}>
                <button className="bg" onClick={()=>setStep("draw")}>← Back</button>
                <button className="bp" style={{flex:1}} onClick={()=>{setMargin(cfg.margin);setStep("quote");}}>Calculate Quote →</button>
              </div>
            </div>
          </div>
        )}

        {/* ── QUOTE ── */}
        {step==="quote" && (
          <div style={{maxWidth:820,margin:"0 auto",padding:"28px 20px"}}>
            {!qr ? (
              <div style={{textAlign:"center",padding:60}}>
                <div style={{fontSize:48,marginBottom:12}}>📐</div>
                <div style={{fontWeight:700,color:"#bbb",fontSize:16}}>Draw pipe segments, set their lengths, and add at least one appliance.</div>
                <button className="bp" style={{marginTop:18}} onClick={()=>setStep("draw")}>← Draw Layout</button>
              </div>
            ) : (
              <>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
                  <div>
                    <h2 style={{fontSize:22,fontWeight:800}}>Gas Installation Quote</h2>
                    {q.addr && <div style={{color:"#888",fontSize:13,marginTop:3}}>{q.addr}</div>}
                    <div style={{fontSize:11,color:"#bbb",marginTop:2}}>Natural Gas · Copper · AS/NZS 5601 · Ex GST</div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    {cfg.systemUrl && <button className="bg" onClick={()=>window.open(buildSystemUrl(qr.total),'_blank')}>↗ Send to System</button>}
                    <button className="bg" onClick={()=>setTab("client")}>📄 Client Quote</button>
                  </div>
                </div>

                {/* Pipe sizing */}
                <div className="card" style={{marginBottom:14}}>
                  <div style={{fontWeight:800,fontSize:15,marginBottom:14}}>Pipe Sizing — AS/NZS 5601 Table F8</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
                    {[["Supply Pressure",`${q.pressure} kPa`],["Allowable Drop",`${Math.max(0.05,q.pressure-1.13).toFixed(2)} kPa`],["Longest Run",`${qr.longest.toFixed(1)} m`],["Total Demand",`${qr.totalMJ} MJ/hr`]].map(([k,v])=>(
                      <div key={k} style={{background:"#FAF6F1",borderRadius:8,padding:"10px 12px"}}><span className="lbl">{k}</span><div style={{fontWeight:800,fontSize:16}}>{v}</div></div>
                    ))}
                  </div>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                    <thead>
                      <tr style={{borderBottom:"2px solid #f0e8e0"}}>
                        {["Section","Length","Flow","Size","Material Cost"].map(h=>(<th key={h} style={{textAlign:h==="Section"?"left":"right",padding:"7px 10px",fontWeight:700,color:"#bbb",fontSize:11}}>{h}</th>))}
                      </tr>
                    </thead>
                    <tbody>
                      {qr.sized.map((s,idx)=>(
                        <tr key={s.id} style={{borderBottom:"1px solid #f7f2ec"}}>
                          <td style={{padding:"8px 10px",fontWeight:600}}>Section {idx+1}</td>
                          <td style={{padding:"8px 10px",textAlign:"right",color:"#666"}}>{s.length?`${s.length} m`:"—"}</td>
                          <td style={{padding:"8px 10px",textAlign:"right",color:"#666"}}>{s.flow} MJ/hr</td>
                          <td style={{padding:"8px 10px",textAlign:"right"}}><span style={{background:PIPE_COLORS[s.size]||"#E8472A",color:"white",borderRadius:4,padding:"2px 10px",fontSize:11,fontWeight:800}}>DN{s.size}</span></td>
                          <td style={{padding:"8px 10px",textAlign:"right",fontWeight:600}}>{s.length?fmt(s.length*(cfg.copperRates[s.size]||25)):"—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Margin */}
                <div className="card" style={{marginBottom:14,background:"#fff9f7",border:"1px solid #fcd0c3"}}>
                  <div style={{fontWeight:800,marginBottom:10}}>Profit Margin</div>
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                    <input type="range" min={0} max={60} step={1} value={margin}
                      onChange={e=>setMargin(Number(e.target.value))}
                      style={{flex:1,accentColor:"#E8472A",height:6}}/>
                    <input type="number" min={0} max={60} step={1} value={margin}
                      onChange={e=>setMargin(Math.min(60,Math.max(0,Number(e.target.value)||0)))}
                      style={{width:64,textAlign:"center",border:"1.5px solid #e5dfd6",borderRadius:8,
                        padding:"5px 8px",fontFamily:"inherit",fontWeight:700,fontSize:14}}/>
                    <span style={{fontSize:13,color:"#888",fontWeight:600}}>%</span>
                  </div>
                  <div style={{padding:"10px 14px",background:"#f7f3ee",borderRadius:8,fontSize:12,color:"#777",lineHeight:1.6}}>
                    You keep <strong style={{color:"#E8472A"}}>{margin}%</strong> of every dollar charged as profit —
                    the other {100-margin}% covers materials &amp; labour.
                    At this rate, {fmt(qr.subtotal)} in costs → <strong style={{color:"#E8472A"}}>{fmt(qr.total)}</strong> quoted.
                  </div>
                </div>

                {/* Breakdown */}
                <div className="card">
                  <div style={{fontWeight:800,fontSize:15,marginBottom:16}}>Breakdown — Ex GST</div>
                  <div className="rp"><span style={{fontWeight:600}}>Call-out / site fee</span><span style={{fontWeight:700}}>{fmt(qr.callOut)}</span></div>
                  <div className="rp" style={{flexDirection:"column",alignItems:"flex-start",gap:4}}>
                    <div style={{display:"flex",justifyContent:"space-between",width:"100%"}}><span style={{fontWeight:600}}>Labour</span><span style={{fontWeight:700}}>{fmt(qr.labTot)}</span></div>
                    <div style={{fontSize:12,color:"#aaa",paddingLeft:8}}>Base (first {cfg.baseLabourMetres}m): {fmt(qr.labBase)}{qr.extraM>0&&` · ${qr.extraM.toFixed(1)}m × ${fmt(cfg.labourPerMetre)}/m = ${fmt(qr.labExtra)}`}</div>
                  </div>
                  <div className="rp"><span style={{fontWeight:600}}>Pipe materials (copper)</span><span style={{fontWeight:700}}>{fmt(qr.matCost)}</span></div>
                  {apps.map(a=>(<div key={a.id} className="rp" style={{paddingLeft:16}}><span style={{display:"flex",alignItems:"center",gap:6,color:"#555"}}><ApplianceIcon typeId={a.typeId} size={20}/>{a.label}</span><span>{fmt(cfg.applianceCosts[a.typeId]||120)}</span></div>))}
                  {qr.metCost>0  && <div className="rp"><span style={{fontWeight:600}}>Meter connection + copper tail</span><span style={{fontWeight:700}}>{fmt(qr.metCost)}</span></div>}
                  {qr.penCost>0  && <div className="rp" style={{paddingLeft:16}}><span style={{color:"#555"}}>{q.pens} penetration{q.pens!==1?"s":""}</span><span>{fmt(qr.penCost)}</span></div>}
                  {qr.digCost>0  && <div className="rp" style={{paddingLeft:16}}><span style={{color:"#555"}}>Digging ({q.dig}m)</span><span>{fmt(qr.digCost)}</span></div>}
                  {qr.concCost>0 && <div className="rp" style={{paddingLeft:16}}><span style={{color:"#555"}}>Concrete cutting ({q.conc}m)</span><span>{fmt(qr.concCost)}</span></div>}
                  {qr.twoCost>0  && <div className="rp" style={{paddingLeft:16}}><span style={{color:"#555"}}>2-storey allowance</span><span>{fmt(qr.twoCost)}</span></div>}
                  <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0 8px",borderTop:"2px solid #ede6dc",marginTop:6,fontWeight:700}}>
                    <span>Cost (before margin)</span><span style={{fontSize:15}}>{fmt(qr.subtotal)}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0 14px",color:"#888",fontSize:13}}>
                    <span>Margin ({margin}%)</span><span>{fmt(qr.marginAmt)}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:"2px solid #ede6dc",paddingTop:16}}>
                    <div>
                      <div style={{fontSize:16,fontWeight:800}}>Total (Ex GST)</div>
                      <div style={{fontSize:12,color:"#aaa",marginTop:2}}>+ GST {fmt(qr.total*0.1)} = <strong>{fmt(qr.total*1.1)}</strong> inc GST</div>
                    </div>
                    <div style={{fontSize:38,fontWeight:800,color:"#E8472A"}}>{fmt(qr.total)}</div>
                  </div>
                </div>

                <div style={{display:"flex",gap:10,marginTop:14}}>
                  <button className="bg" onClick={()=>setStep("questionnaire")}>← Back</button>
                  {!confirmNew
                    ? <button className="bg" onClick={()=>setConfirmNew(true)}>🔄 New Job</button>
                    : <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <span style={{fontSize:12,color:"#888"}}>Clear this quote?</span>
                        <button onClick={()=>{
                          setSegs([]); setApps([]); setStep("draw");
                          setQ(p=>({...p,addr:""})); setHistory([]); setConfirmNew(false);
                          ['chk_gq_segs','chk_gq_apps','chk_gq_step'].forEach(k=>localStorage.removeItem(k));
                        }} style={{padding:"5px 12px",background:"#DC2626",color:"white",border:"none",borderRadius:8,fontWeight:700,cursor:"pointer",fontSize:12}}>
                          Yes, clear
                        </button>
                        <button className="bg" onClick={()=>setConfirmNew(false)}>Cancel</button>
                      </div>
                  }
                </div>
              </>
            )}
          </div>
        )}
      </>)}

      {/* ═══ CLIENT QUOTE ═══ */}
      {tab==="client" && (
        <div style={{maxWidth:820,margin:"0 auto",padding:"24px 20px"}}>
          <div className="no-print" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <div>
              <div style={{fontWeight:800,fontSize:16}}>Client Quote Preview</div>
              <div style={{fontSize:12,color:"#aaa",marginTop:2}}>Print or Save as PDF to share with your customer.</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button className="bg" onClick={()=>setTab("main")}>← Back</button>
              <button className="bp" onClick={()=>window.print()}>🖨️ Print / Save PDF</button>
            </div>
          </div>

          <div className="client-doc" style={{background:"white",borderRadius:16,border:"1px solid #ede6dc",boxShadow:"0 4px 24px rgba(0,0,0,.08)",overflow:"hidden"}}>
            {/* Header */}
            <div style={{background:"#E8472A",padding:"26px 36px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <svg width="42" height="42" viewBox="0 0 40 40"><rect width="40" height="40" rx="9" fill="rgba(255,255,255,.15)"/><path d="M20 5 L8 12 L8 25 C8 32 14 37.5 20 39.5 C26 37.5 32 32 32 25 L32 12 Z" fill="none" stroke="white" strokeWidth="2.2"/><path d="M14 21 L18 25 L27 16" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
                <div><div style={{fontWeight:800,fontSize:22,color:"white",lineHeight:1.1}}>Check<span style={{color:"rgba(255,255,255,.7)"}}>Hero</span></div></div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{color:"rgba(255,255,255,.65)",fontSize:11}}>{today()}</div>
                <div style={{color:"rgba(255,255,255,.55)",fontSize:10,marginTop:5}}>{cfg.companyPhone} · {cfg.companyEmail}</div>
              </div>
            </div>

            <div style={{padding:"32px 36px"}}>
              <div style={{marginBottom:26,paddingBottom:22,borderBottom:"1px solid #f0e8e0"}}>
                <div style={{fontSize:10,fontWeight:700,color:"#ccc",textTransform:"uppercase",letterSpacing:.8,marginBottom:5}}>Gas Installation Proposal for</div>
                <h1 style={{fontSize:22,fontWeight:800,color:"#2D2D2D",marginBottom:4}}>{q.addr||"Property Address"}</h1>
                <div style={{fontSize:12,color:"#bbb"}}>Natural Gas · Copper pipework · Valid until {expiryDate()}</div>
              </div>

              {(segs.length>0||apps.length>0) && (
                <div style={{marginBottom:26}}>
                  <div style={{fontWeight:800,fontSize:12,marginBottom:12,color:"#2D2D2D",textTransform:"uppercase",letterSpacing:.5}}>Proposed Gas Line Layout</div>
                  <div style={{background:"#FAF6F1",borderRadius:12,padding:"20px 16px",border:"1px solid #ede6dc"}}>
                    <ClientDiagram segs={segs} apps={apps}/>
                    <div style={{display:"flex",gap:20,justifyContent:"center",marginTop:14,flexWrap:"wrap"}}>
                      <div style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:"#aaa"}}><div style={{width:20,height:3,background:"#E8472A",borderRadius:1}}/>Copper gas pipe</div>
                      {appCounts.map(a=>(<div key={a.id} style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:"#aaa"}}><div style={{width:10,height:10,borderRadius:'50%',background:APPLIANCE_ICONS[a.id]?.color||'#888',flexShrink:0}}/>{a.count>1?`${a.count}× `:""}{a.label}</div>))}
                    </div>
                    <div style={{textAlign:"center",fontSize:9,color:"#ccc",marginTop:8}}>Schematic only — not to scale. Actual routing subject to site conditions.</div>
                  </div>
                </div>
              )}

              <div style={{marginBottom:26}}>
                <div style={{fontWeight:800,fontSize:12,marginBottom:12,color:"#2D2D2D",textTransform:"uppercase",letterSpacing:.5}}>Scope of Works</div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {buildScope().map((item,i)=>(
                    <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"9px 12px",background:i%2===0?"#FAF6F1":"white",borderRadius:7,border:"1px solid #ede6dc"}}>
                      <div style={{width:17,height:17,borderRadius:"50%",background:"#E8472A",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>
                        <svg width="9" height="9" viewBox="0 0 9 9"><path d="M1.5 4.5 L3.5 6.5 L7.5 2.5" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
                      </div>
                      <span style={{fontSize:12.5,color:"#444",lineHeight:1.5}}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {clientQr && (
                <div style={{marginBottom:26,background:"linear-gradient(135deg,#E8472A,#c0392b)",borderRadius:14,padding:"26px 30px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{color:"rgba(255,255,255,.8)",fontSize:12,fontWeight:600,marginBottom:6}}>Total</div>
                    <div style={{color:"rgba(255,255,255,.7)",fontSize:12,lineHeight:1.7}}>All labour, materials &amp; compliance<br/>GST included</div>
                    <div style={{color:"rgba(255,255,255,.5)",fontSize:10,marginTop:8}}>50% deposit to commence · balance on completion</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{color:"rgba(255,255,255,.6)",fontSize:11,marginBottom:4}}>Total inc. GST</div>
                    <div style={{color:"white",fontWeight:800,fontSize:40,lineHeight:1}}>{fmt(clientQr.total*1.1)}</div>
                    <div style={{color:"rgba(255,255,255,.45)",fontSize:10,marginTop:4}}>{fmt(clientQr.total)} ex GST + {fmt(clientQr.total*0.1)} GST</div>
                  </div>
                </div>
              )}

              <div style={{borderTop:"1px solid #ede6dc",paddingTop:18,marginBottom:18}}>
                <div style={{fontSize:9,color:"#999",lineHeight:1.7}}>
                  <div style={{marginBottom:8}}>
                    <strong style={{color:"#777",fontSize:9,textTransform:"uppercase",letterSpacing:.3}}>Important Notes</strong><br/>
                    Please note that it is not possible for CheckHero to accurately determine the age/year of construction/installation/alteration/renovation date of a property. Energy Safe Victoria does provide some ruling that may possibly allow for certain loop holes therefore certain non-compliant marked items may not be required to be addressed. CheckHero will not be held responsible for advice given on non-compliance items as those may/may not apply at time of construction/renovation/alteration/upgrade. Per ESV guidelines: inspection and testing should provide evidence that the installation complies with the relevant requirements at the time of construction of the installation.
                  </div>
                  <div style={{marginBottom:8}}>
                    <strong style={{color:"#777",fontSize:9,textTransform:"uppercase",letterSpacing:.3}}>Switchboard &amp; Safety Switch (RCD/RCBO) Disclaimer</strong><br/>
                    Existing electrical problems like fault current or crossed wiring cannot be detected by circuit breakers. When adding RCD protection, these existing issues may be detected by the RCD, which triggers circuit shut off. These issues may not occur immediately or they can be triggered by factors like rain, showers, or high humidity situations. If faults occur with the RCD upgrade, additional fault finding will be necessary and will incur further charges, explicitly not included as part of the safety-switch/RCD/RCBO upgrade.
                  </div>
                  <div style={{marginBottom:8}}>
                    <strong style={{color:"#777",fontSize:9,textTransform:"uppercase",letterSpacing:.3}}>Cancellation &amp; Changes</strong><br/>
                    CheckHero requires notice to change, cancel or re-schedule an installation or assessment and/or repair service that has been scheduled. CheckHero may at its discretion charge a minimum cancellation fee of 20% of the original quote due to admin/handling/parts preordered and incurred to service the job.
                  </div>
                  <div style={{marginBottom:8}}>
                    <strong style={{color:"#777",fontSize:9,textTransform:"uppercase",letterSpacing:.3}}>Subcontract</strong><br/>
                    Checkhero Pty Ltd trading as &ldquo;CheckHero&rdquo; ABN 66654158951 may engage a subcontractor to carry out the repair works. Some/all gas fitting, plumbing work and some electrical work is performed by licensed subcontractors engaged by CheckHero, and the required electrical and gas safety/compliance certificates are issued by these licensed subcontractors, all of whom are appropriately ESV and VBA registered and verified. Checkhero Pty Ltd itself is a Registered Electrical Contractor #34345.
                  </div>
                  <div style={{marginBottom:8}}>
                    <strong style={{color:"#777",fontSize:9,textTransform:"uppercase",letterSpacing:.3}}>Disclaimer</strong><br/>
                    CheckHero will use its best efforts to deliver timely service notwithstanding unpredictable scheduling volume spikes, unscheduled transport or sickness problems and other factors beyond its control, including but not limited to power failure, technical breakdowns and acts of God. Except to the extent otherwise required by law (including, without limitation, the Australian Consumer Law), all express or implied representations, conditions, warranties, guarantees or other provisions that are not contained in these terms and conditions are excluded. If CheckHero&apos;s ability to perform the Services is impaired by your/occupier failure to cooperate or circumstances beyond CheckHero&apos;s control, CheckHero may choose not to provide the Services and where appropriate will provide a refund or cancel the order. CheckHero may also choose not to provide the Services if dangerous or unhealthy conditions are present at the Premises. Unless removal of old appliances is included in the scope of works, it is your exclusive responsibility to dispose of any goods replaced by Service Personnel.
                  </div>
                  <div style={{marginBottom:8}}>
                    <strong style={{color:"#777",fontSize:9,textTransform:"uppercase",letterSpacing:.3}}>Unforeseen Extra Works</strong><br/>
                    Installations and repairs do not include any labour or parts or accessories (fittings, extension hoses, pressure limiting valves, power points) except where specifically listed in the scope of works. Examples include but are not limited to: missing power points for gas cooktop installation; bench top alterations due to modern appliances differing in size to the original cut out; plaster patching/filling work; painting works required after installation/repair; physical alteration/partial destruction to property such as parts of cabinetry and walls where plumbing/electrical works must pass through.
                  </div>
                  <div style={{marginBottom:8}}>
                    <strong style={{color:"#777",fontSize:9,textTransform:"uppercase",letterSpacing:.3}}>Additional Charges</strong><br/>
                    CheckHero provide estimates for additional labour and material required, over and above the inclusions listed in the scope of work, prior to commencing and during an installation or assessment and/or repair service — it must be authorised by the rental provider or their agency. Unless otherwise specified explicitly, delivery, decommissioning of existing units and removal of existing units is not included in the price.
                  </div>
                  <div style={{marginTop:10,padding:"8px 12px",background:"#FAF6F1",borderRadius:6,border:"1px solid #ede6dc",fontSize:9,color:"#888",lineHeight:1.6}}>
                    <strong>Quote valid until {expiryDate()}.</strong> 50% deposit required prior to works commencing; balance due on completion. All gas work performed by licensed gasfitters — Certificate of Compliance issued on completion. All amounts in AUD excl. GST.
                  </div>
                </div>
              </div>

              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:10,color:"#ccc",lineHeight:1.8}}>{cfg.companyName}<br/>{cfg.companyPhone} · {cfg.companyEmail}</div>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  <svg width="20" height="20" viewBox="0 0 40 40"><path d="M20 5 L8 12 L8 25 C8 32 14 37.5 20 39.5 C26 37.5 32 32 32 25 L32 12 Z" fill="none" stroke="#E8472A" strokeWidth="2"/><path d="M14 21 L18 25 L27 16" stroke="#E8472A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
                  <span style={{fontWeight:800,color:"#2D2D2D",fontSize:12}}>Check<span style={{color:"#E8472A"}}>Hero</span></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TRADES PDF ═══ */}
      {tab==="trades" && (
        <TradesPDF segs={segs} apps={apps} q={q} cfg={cfg} quoteId={quoteId} tradesQr={tradesQr} onBack={()=>setTab("main")}/>
      )}

      {/* ═══ SETTINGS ═══ */}
      {tab==="backend" && (
        <div style={{maxWidth:900,margin:"0 auto",padding:"28px 20px"}}>
          <h2 style={{fontSize:20,fontWeight:800,marginBottom:4}}>Pricing Settings</h2>
          <div style={{fontSize:13,color:"#aaa",marginBottom:22}}>All prices ex GST.</div>
          <div className="card" style={{marginBottom:16}}>
            <div style={{fontWeight:800,fontSize:15,marginBottom:14}}>🏢 Company Details</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div><span className="lbl">Company Name</span><input type="text" value={cfg.companyName} onChange={e=>upd("companyName",e.target.value)}/></div>
              <div><span className="lbl">Phone</span><input type="text" value={cfg.companyPhone} onChange={e=>upd("companyPhone",e.target.value)}/></div>
              <div><span className="lbl">Email</span><input type="text" value={cfg.companyEmail} onChange={e=>upd("companyEmail",e.target.value)}/></div>
              <div style={{gridColumn:"1 / -1"}}><span className="lbl">Send to System URL Template</span><input type="text" placeholder="https://app.checkhero.com.au/version-live/new_quote?ref={ref}&addr={addr}&total={total}" value={cfg.systemUrl||""} onChange={e=>upd("systemUrl",e.target.value)}/></div>
            </div>
            <div style={{marginTop:10,fontSize:11,color:"#bbb"}}>
              <strong>System URL:</strong> enables the "Send to System" button on the quote view. Use placeholders: <code style={{background:"#f0e8e0",borderRadius:3,padding:"0 4px"}}>{"{ref}"}</code> <code style={{background:"#f0e8e0",borderRadius:3,padding:"0 4px"}}>{"{addr}"}</code> <code style={{background:"#f0e8e0",borderRadius:3,padding:"0 4px"}}>{"{total}"}</code> <code style={{background:"#f0e8e0",borderRadius:3,padding:"0 4px"}}>{"{totalGST}"}</code> <code style={{background:"#f0e8e0",borderRadius:3,padding:"0 4px"}}>{"{date}"}</code>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <div className="card">
              <div style={{fontWeight:800,fontSize:15,marginBottom:4}}>👷 Labour Rates</div>
              <div style={{fontSize:12,color:"#aaa",marginBottom:14}}>Size-independent</div>
              <div className="rp"><div><div style={{fontWeight:600}}>Call-out / site fee</div><div style={{fontSize:11,color:"#aaa"}}>Every job</div></div><div className="pw"><span>$</span><input type="number" min={0} value={cfg.callOutFee} onChange={e=>upd("callOutFee",parseFloat(e.target.value)||0)}/></div></div>
              <div className="rp">
                <div>
                  <div style={{fontWeight:600}}>Base labour rate</div>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginTop:5}}>
                    <span style={{fontSize:11,color:"#aaa"}}>covers first</span>
                    <input type="number" min={1} value={cfg.baseLabourMetres} onChange={e=>upd("baseLabourMetres",parseFloat(e.target.value)||1)} style={{width:56,padding:"4px 8px",fontSize:12,textAlign:"center"}}/>
                    <span style={{fontSize:11,color:"#aaa"}}>metres</span>
                  </div>
                </div>
                <div className="pw"><span>$</span><input type="number" min={0} value={cfg.baseLabour} onChange={e=>upd("baseLabour",parseFloat(e.target.value)||0)}/></div>
              </div>
              <div className="rp"><div><div style={{fontWeight:600}}>Labour per metre</div><div style={{fontSize:11,color:"#aaa"}}>Beyond base</div></div><div className="pw"><span>$</span><input type="number" min={0} value={cfg.labourPerMetre} onChange={e=>upd("labourPerMetre",parseFloat(e.target.value)||0)}/><span style={{fontSize:12}}>/m</span></div></div>
            </div>

            <div className="card">
              <div style={{fontWeight:800,fontSize:15,marginBottom:4,color:"#b45309"}}>🔶 Copper Pipe — All-in ($/m)</div>
              <div style={{fontSize:12,color:"#aaa",marginBottom:14}}>Pipe + clips + average fittings</div>
              {CU_SIZES.map(sz=>(
                <div key={sz} className="rp">
                  <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{background:PIPE_COLORS[sz],color:"white",borderRadius:4,padding:"2px 10px",fontSize:11,fontWeight:800}}>DN{sz}</span></div>
                  <div className="pw"><span>$</span><input type="number" min={0} step={0.5} value={cfg.copperRates[sz]} onChange={e=>upd(`copperRates.${sz}`,parseFloat(e.target.value)||0)}/><span style={{fontSize:12}}>/m</span></div>
                </div>
              ))}
            </div>

            <div className="card">
              <div style={{fontWeight:800,fontSize:15,marginBottom:4}}>🔧 Appliance Connections</div>
              <div style={{fontSize:12,color:"#aaa",marginBottom:14}}>Valve, flex + commissioning</div>
              {APPLIANCE_TYPES.map(a=>(
                <div key={a.id} className="rp">
                  <div style={{display:"flex",alignItems:"center",gap:8}}><ApplianceIcon typeId={a.id} size={28}/><div><div style={{fontSize:13,fontWeight:600}}>{a.label}</div><div style={{fontSize:11,color:"#aaa"}}>{a.mj} MJ/hr</div></div></div>
                  <div className="pw"><span>$</span><input type="number" min={0} value={cfg.applianceCosts[a.id]} onChange={e=>upd(`applianceCosts.${a.id}`,parseFloat(e.target.value)||0)}/></div>
                </div>
              ))}
            </div>

            <div className="card">
              <div style={{fontWeight:800,fontSize:15,marginBottom:14}}>⚙️ Extras & Quote Defaults</div>
              {[["Meter connection (flat)","meterConnectionFlat",""],["Meter copper tail","meterCopperTail",""],["Penetrations (each)","penetrationCost",""],["Digging","diggingRate","/m"],["Concrete cutting","concreteCuttingRate","/m"],["2-storey (flat)","twoStoreyFlat",""]].map(([lbl,key,unit])=>(
                <div key={key} className="rp"><span style={{fontWeight:500}}>{lbl}</span><div className="pw"><span>$</span><input type="number" min={0} value={cfg[key]} onChange={e=>upd(key,parseFloat(e.target.value)||0)}/>{unit&&<span style={{fontSize:12}}>{unit}</span>}</div></div>
              ))}
              <div style={{borderTop:"1px solid #f0e8e0",paddingTop:14,marginTop:6}}>
                <div className="rp">
                  <div><div style={{fontWeight:700}}>Default gross margin</div><div style={{fontSize:11,color:"#aaa"}}>price = cost ÷ (1 − margin%)</div></div>
                  <div className="pw"><input type="number" min={0} max={90} value={cfg.margin} onChange={e=>{const v=parseFloat(e.target.value)||0;upd("margin",v);setMargin(v);}}/><span style={{fontSize:12}}>%</span></div>
                </div>
                <div style={{marginTop:10,padding:"10px 14px",background:"#f7f3ee",borderRadius:8,fontSize:12,color:"#888"}}>
                  At {cfg.margin}% margin, $1,000 cost → <strong style={{color:"#E8472A"}}>{fmt(1000/(1-cfg.margin/100))}</strong> quoted
                </div>
              </div>
            </div>

            {/* Restore Defaults */}
            <div style={{marginTop:16,display:"flex",gap:8,justifyContent:"flex-end",alignItems:"center"}}>
              {confirmReset && <span style={{fontSize:12,color:"#888"}}>Reset all rates &amp; company details?</span>}
              {confirmReset && (
                <button onClick={()=>{setCfg(DEFAULT);setMargin(DEFAULT.margin||20);setConfirmReset(false);showToast('↺ Settings restored to defaults');}}
                  style={{padding:"6px 14px",background:"#DC2626",color:"white",border:"none",borderRadius:8,fontWeight:700,cursor:"pointer",fontSize:12}}>
                  Yes, reset
                </button>
              )}
              <button className="bg" onClick={()=>setConfirmReset(v=>!v)}>
                {confirmReset ? "Cancel" : "↺ Restore Defaults"}
              </button>
            </div>
          </div>
          <div style={{marginTop:16,padding:"13px 16px",background:"#eef6fb",borderRadius:10,border:"1px solid #bae6fd",fontSize:13,color:"#0369a1"}}>
            💡 Pipe sizing follows AS/NZS 5601 Table F8. At 2.0 kPa supply, DN15 handles ~42 MJ/hr on a 30m run. At 1.5 kPa it drops to ~27 MJ/hr — below a cooktop's 30 MJ/hr, so DN20 is selected.
          </div>
        </div>
      )}

      {/* ── Toast notification ── */}
      {toast && (
        <div style={{position:"fixed",top:20,right:20,zIndex:9999,background:"#1C1C1E",
          color:"white",padding:"10px 18px",borderRadius:10,fontSize:13,fontWeight:600,
          boxShadow:"0 4px 20px rgba(0,0,0,.25)",pointerEvents:"none",fontFamily:"DM Sans,sans-serif",
          animation:"fadeIn .15s ease"}}>
          {toast}
        </div>
      )}
    </div>
  );
}
