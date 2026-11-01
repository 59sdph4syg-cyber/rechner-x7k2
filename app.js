"use strict";
/* =========================================================
   Exposé-Rechner – installierbare Web-App (PWA)
   Daten liegen lokal auf dem Gerät (localStorage).
   Exposé-Auslesen über die Claude-API (eigener Schlüssel).
   ========================================================= */

/* ---------- Konstanten ---------- */
const GREST = {BW:5,BY:3.5,BE:6,BB:6.5,HB:5.5,HH:5.5,HE:6,MV:6,NI:5,NW:6.5,RP:5,SL:6.5,SN:5.5,ST:5,SH:6.5,TH:5};
const BLN = {BW:"Baden-Württemberg",BY:"Bayern",BE:"Berlin",BB:"Brandenburg",HB:"Bremen",HH:"Hamburg",HE:"Hessen",MV:"Mecklenburg-Vorpommern",NI:"Niedersachsen",NW:"Nordrhein-Westfalen",RP:"Rheinland-Pfalz",SL:"Saarland",SN:"Sachsen",ST:"Sachsen-Anhalt",SH:"Schleswig-Holstein",TH:"Thüringen"};
const PROFILE_DEFAULT = {name:"",zve:75000,veranl:"einzel",kist:"0",grenz:"",zins:3.6,tilgung:2,ekquote:0,notar:2,makler:3.57,bl:"NW",gebanteil:80,mietausfall:3,verwaltung:30,instand:6,mietsteig:1.5,wertsteig:1.5,kostensteig:2,inflation:2,zinsbindung:10,anschlusszins:4.5,verkauf:3.57,jahre:30,_example:true};
const DEAL_EXAMPLE = {titel:"2-Zimmer-Wohnung, Leipzig-Gohlis",link:"",adresse:"Leipzig-Gohlis",kp:189000,flaeche:62,zimmer:2,baujahr:1995,miete:620,hg_nu:95,ruecklage:40,bl:"SN",makler:3.57,_example:true};
const DEAL_EMPTY = {titel:"",link:"",adresse:"",kp:"",flaeche:"",zimmer:"",baujahr:"",miete:"",hg_nu:"",ruecklage:"",bl:""};

/* Renovierungs-Richtwerte: Handwerkerpreise Deutschland 2025/26, brutto inkl. 19 % MwSt., ohne Förderung.
   p = [einfach, mittel, gehoben] je Einheit. q = Standardmenge aus Wohnfläche (wf) und Zimmern (zi). */
const RENO = [
  {k:"maler",   l:"Wände & Decken streichen",       u:"m² Wohnfl.", q:(wf)=>wf,                 p:[25,38,55]},
  {k:"boden",   l:"Bodenbeläge erneuern",           u:"m² Wohnfl.", q:(wf)=>wf,                 p:[60,85,130], h:"inkl. Rückbau; Vinyl/Laminat bis Parkett"},
  {k:"tueren",  l:"Innentüren inkl. Zarge",         u:"Stück",      q:(wf,zi)=>Math.max(2,Math.round(zi)+2), p:[700,950,1400]},
  {k:"bad",     l:"Bad komplett sanieren",          u:"Bäder",      q:()=>1,                    p:[18000,25000,35000], h:"inkl. Fliesen, Sanitär, Leitungen im Bad"},
  {k:"wc",      l:"Gäste-WC sanieren",              u:"Stück",      q:()=>1,                    p:[6000,9000,13000]},
  {k:"elektro", l:"Elektrik komplett erneuern",     u:"m² Wohnfl.", q:(wf)=>wf,                 p:[90,125,170], h:"Leitungen, Dosen, Unterverteilung, Putzarbeiten"},
  {k:"leitungen",l:"Wasser- & Abwasserleitungen",   u:"m² Wohnfl.", q:(wf)=>wf,                 p:[50,75,110], h:"in WEG: Steigstränge sind Gemeinschaftseigentum"},
  {k:"fenster", l:"Fenster (3-fach) inkl. Einbau",  u:"Stück",      q:(wf)=>Math.max(2,Math.round(wf/12)), p:[1000,1400,2000], h:"in WEG meist Gemeinschaftseigentum"},
  {k:"heizung", l:"Heizung der Wohnung erneuern",   u:"Stück",      q:()=>1,                    p:[8000,12000,18000], mode:"wohnung", h:"Etagenheizung; gesetzliche Vorgaben (GEG) prüfen"},
  {k:"waermepumpe",l:"Wärmepumpe inkl. Einbau",     u:"Stück",      q:()=>1,                    p:[30000,38000,48000], mode:"haus", h:"vor Förderung; Förderung (BEG) aktuell prüfen"},
  {k:"dach",    l:"Dach neu eindecken + dämmen",    u:"m² Dachfl.", q:(wf)=>Math.round(wf),     p:[220,300,400], mode:"haus", h:"Menge an echte Dachfläche anpassen"},
  {k:"fassade", l:"Fassade dämmen inkl. Gerüst",    u:"m² Fassade", q:(wf)=>Math.round(wf*1.1), p:[180,230,300], mode:"haus"},
  {k:"keller",  l:"Kellerdecke dämmen",             u:"m²",         q:(wf)=>Math.round(wf*0.5), p:[40,60,90], mode:"haus"},
  {k:"kueche",  l:"Einbauküche",                    u:"Stück",      q:()=>1,                    p:[6000,10000,16000], kueche:true, h:"eigenes Wirtschaftsgut, 10 Jahre AfA"},
];
const RENO_KEYS = RENO.map(r=>r.k);

/* Beispiel-Exposé für die Vorführung (keine echte Anzeige) */
const DEMO = {
  deal:{titel:"3-Zimmer-Wohnung mit Balkon, Dortmund-Kreuzviertel",link:"",adresse:"Dortmund, Kreuzviertel",kp:189000,flaeche:74,zimmer:3,baujahr:1962,miete:845,hg_nu:112,ruecklage:42,bl:"NW",makler:3.57},
  notes:["Beispieldaten zur Vorführung, kein echtes Angebot."],
  analyse:{
    beispiel:true, objektart:"wohnung",
    details:{etage:"2. OG von 4",zustand:"gepflegt, Bad im Originalzustand",heizung:"Gas-Zentralheizung (Baujahr 1998)",energie_kennwert:168,energieklasse:"F",modernisierungen:"Fenster 2004, Dach 2011",vermietet:true,wohneinheiten:12,ausstattung:["Balkon","Kellerraum","Laminat"],erbbaurecht:false,denkmalschutz:false},
    markt:{kaufpreis_qm_von:2300,kaufpreis_qm_bis:3300,miete_qm_von:9,miete_qm_bis:11.5,preis_urteil:"marktüblich",miete_urteil:"marktüblich",mietpreisbremse:null,begruendung:"Kaufpreis im unteren Bereich für das gefragte Kreuzviertel, passend zum Baujahr und dem alten Bad. Die Miete liegt am oberen Rand der Spanne; bei Neuvermietung ist kaum Steigerung drin.",stand:"wissen"},
    lage:{makro_note:3,makro_text:"Großstadt mit stabiler Einwohnerzahl, Universität und wachsendem Dienstleistungssektor. Kaufkraft unter Bundesschnitt.",mikro_note:4,mikro_text:"Beliebtes Altbauviertel mit Cafés, Westpark und guter U-Bahn-Anbindung. Parkplätze knapp.",plus:["Hohe Nachfrage nach Mietwohnungen","ÖPNV und Nahversorgung fußläufig","Studenten und junge Berufstätige als Zielgruppe"],minus:["Parkplatzsituation angespannt","Energieklasse F belastet künftige Kosten"]},
    risiken:[{titel:"Energieklasse F",schwere:"mittel",text:"Absehbare Kosten für Heizungstausch und Dämmung über die Gemeinschaft. Höhe der Rücklage und geplante Maßnahmen klären."},{titel:"Bad im Originalzustand",schwere:"mittel",text:"Mittelfristig Sanierung nötig, bei Mieterwechsel einplanen."},{titel:"Miete am oberen Rand",schwere:"niedrig",text:"Wenig Spielraum für Erhöhungen; bei Auszug eher gleich bleibende Miete ansetzen."}],
    fragen:["Wie hoch ist die Instandhaltungsrücklage der Gemeinschaft insgesamt?","Gibt es beschlossene oder geplante Sonderumlagen?","Protokolle der letzten 3 Eigentümerversammlungen?","Wann wurde die Miete zuletzt erhöht, gibt es Rückstände?","Wie alt ist die Heizungsanlage genau, gibt es einen Sanierungsfahrplan?"],
    sanierung:[{bauteil:"bad",grund:"Bad im Originalzustand von 1962"},{bauteil:"maler",grund:"Bei Mieterwechsel üblich"}]
  }
};
const API_URL = "https://api.anthropic.com/v1/messages";
const PREVIEW = !!window.__PREVIEW;
/* Claude-Version: läuft als privates Artefakt im eigenen Claude-Konto (Analyse über das Abo, Speicherung im Konto) */
const ART = !!window.__ARTIFACT;
const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const $ = id => document.getElementById(id);
const LS = {
  get(k){ try { return JSON.parse(localStorage.getItem(k)); } catch(e){ return null; } },
  set(k,v){
    if (ART && (k==="er_profile"||k==="er_deals")) cloud.queue();
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch(e){ return ART; }
  }
};

/* ---------- Cloud-Speicher im Claude-Konto (nur Claude-Version) ---------- */
const cloud = {
  db:null, uid:null, ready:false, timer:null, synced:new Map(), status:"",
  async init(){
    try {
      this.db = await window.claude.use("db"); const user = await window.claude.use("user");
      this.uid = user ? await user.id() : null;
      if (!this.db || !this.uid){ this.db=null; this.status="lokal"; return false; }
      const root=this.db.doc("data/users/"+this.uid+"/state");
      const snap=await root.get();
      const qs=await root.collection("deals").get();
      const remoteDeals=qs.docs.map(d=>d.data()).filter(d=>d&&d._id);
      if (snap.exists || remoteDeals.length){
        const st=snap.exists?snap.data():{};
        if (st.profile) {
          profile={...PROFILE_DEFAULT,...st.profile,_example:false};
          try { localStorage.setItem("er_onboarded","true"); } catch(e){}
          if (!$("onb").hidden) closeOnb();
        }
        deals=remoteDeals;
        remoteDeals.forEach(d=>this.synced.set(d._id,JSON.stringify(d)));
        try { localStorage.setItem("er_profile",JSON.stringify(profile)); localStorage.setItem("er_deals",JSON.stringify(deals)); } catch(e){}
      }
      this.ready=true; this.status="konto";
      if (!snap.exists && (LS.get("er_profile")||deals.length)) this.queue();
      return true;
    } catch(e){ this.db=null; this.status="lokal"; return false; }
  },
  queue(){ if (!ART) return; clearTimeout(this.timer); this.timer=setTimeout(()=>this.flush(),700); },
  async flush(){
    if (!this.db||!this.uid||!this.ready) return;
    const root=this.db.doc("data/users/"+this.uid+"/state");
    try {
      const p={...profile}; delete p._example;
      await root.set({profile:p,_t:Date.now()});
      const ids=new Set(deals.map(d=>d._id));
      for (const d of deals){ const j=JSON.stringify(d); if (this.synced.get(d._id)!==j){ await root.collection("deals").doc(d._id).set(JSON.parse(j)); this.synced.set(d._id,j); } }
      for (const id of [...this.synced.keys()]) if (!ids.has(id)){ await root.collection("deals").doc(id).delete(); this.synced.delete(id); }
    } catch(e){ toast("Speichern im Konto fehlgeschlagen – lokal gesichert"); }
  }
};

let profile = {...PROFILE_DEFAULT, ...(LS.get("er_profile")||{})};
if (LS.get("er_profile")) profile._example = false;
let deals = Array.isArray(LS.get("er_deals")) ? LS.get("er_deals") : [];
let deal = LS.get("er_current") || {...DEAL_EXAMPLE};
let currentId = deal._id || null;
let attachments = [];
let scen = {kp:0, zins:null, miete:0, ek:null};
let cmpSel = [];
let drawWealth = true;

/* ---------- Zahlen & Formatierung ---------- */
const nf0 = new Intl.NumberFormat("de-DE",{maximumFractionDigits:0});
const nf1 = new Intl.NumberFormat("de-DE",{minimumFractionDigits:1,maximumFractionDigits:1});
const nf2 = new Intl.NumberFormat("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2});
const eur  = v => isFinite(v) ? nf0.format(Math.round(v))+" €" : "–";
const eurS = v => isFinite(v) ? (v>=0.5?"+":v<=-0.5?"−":"±")+nf0.format(Math.abs(Math.round(v)))+" €" : "–";
const tEur = v => isFinite(v) ? nf0.format(Math.round(v/1000))+" T€" : "–";
const pct  = (v,d=1) => isFinite(v) ? (d===2?nf2:nf1).format(v*100)+" %" : "–";
function num(v){
  if (v===""||v==null) return NaN;
  if (typeof v==="number") return isFinite(v)?v:NaN;
  let s = String(v).trim().replace(/\s|€|%/g,"");
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g,"");
  s = s.replace(",",".");
  const n = parseFloat(s); return isFinite(n)?n:NaN;
}
const pick = (v,fb) => { const n=num(v); return isNaN(n)?num(fb):n; };
const cls = v => v>=0.5?"pos":v<=-0.5?"neg":"";
const esc = s => String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const show = v => typeof v==="number" ? String(v).replace(".",",") : (v??"");
const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
const nextFrame = fn => requestAnimationFrame(()=>requestAnimationFrame(fn));

/* Zahl weich hochzählen */
function tween(el, to, fmt, colorize){
  if (!el) return;
  const from = el._v;
  el._v = to;
  if (colorize){ el.classList.toggle("pos", to>=0.5); el.classList.toggle("neg", to<=-0.5); }
  cancelAnimationFrame(el._raf);
  if (RM || !isFinite(from) || !isFinite(to) || from===to){ el.textContent = fmt(to); return; }
  const t0 = performance.now(), d = 550;
  const step = t => {
    const k = Math.min(1,(t-t0)/d), e = 1-Math.pow(1-k,3);
    el.textContent = fmt(from+(to-from)*e);
    if (k<1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
}

/* ---------- Einkommensteuer 2026 (§ 32a EStG) ---------- */
function estGrund(x){
  x = Math.floor(Math.max(0,x));
  if (x<=12348) return 0;
  if (x<=17799){ const y=(x-12348)/1e4; return Math.floor((914.51*y+1400)*y); }
  if (x<=69878){ const z=(x-17799)/1e4; return Math.floor((173.10*z+2397)*z+1034.87); }
  if (x<=277825) return Math.floor(.42*x-11135.63);
  return Math.floor(.45*x-19470.38);
}
function steuerGesamt(zve,p){
  const joint = p.veranl==="zusammen";
  const est = joint ? 2*estGrund(zve/2) : estGrund(zve);
  const fg = joint ? 40700 : 20350;                       // Soli-Freigrenze 2026
  const soli = est<=fg ? 0 : Math.min(.055*est, .119*(est-fg));
  return est + soli + est*(num(p.kist)||0)/100;
}
function grenzsatz(p){
  if (!isNaN(num(p.grenz))) return num(p.grenz)/100;
  const z = num(p.zve)||0; return (steuerGesamt(z+1000,p)-steuerGesamt(z,p))/1000;
}
function steuerWirkung(vuv,p){                            // positiv = Erstattung
  if (!isNaN(num(p.grenz))) return -vuv*num(p.grenz)/100;
  const z = num(p.zve)||0; return steuerGesamt(z,p)-steuerGesamt(Math.max(0,z+vuv),p);
}

/* ---------- Renovierung ---------- */
function renoDefault(d){
  return {aktiv:false, mode:"wohnung", std:1, puffer:15, items:{}, su:{gesamt:"",mea:"",rl:""}, fin:"ek", mehr:"", leer:""};
}
/** Kosten der Renovierung für alle drei Standards. Liefert Summen inkl. Puffer. */
function renoCost(d){
  const r = d.reno || renoDefault(d);
  const wf = num(d.flaeche)||0, zi = num(d.zimmer)||Math.max(1,Math.round(wf/25));
  const puf = 1 + Math.max(0, pick(r.puffer,15))/100;
  const lines = [];
  const lv = [0,1,2].map(()=>({other:0,kueche:0}));
  RENO.forEach(it=>{
    if (it.mode && it.mode!==r.mode) return;
    const st = r.items[it.k]; if (!st || !st.on) return;
    const q = Math.max(0, pick(st.qty, it.q(wf,zi)));
    lines.push({k:it.k, q});
    [0,1,2].forEach(i=>{ const v=q*it.p[i]*puf; if (it.kueche) lv[i].kueche+=v; else lv[i].other+=v; });
  });
  let su = 0;
  if (r.mode==="wohnung"){
    const g=num(r.su.gesamt)||0, mea=num(r.su.mea)||0, rl=clamp(num(r.su.rl)||0,0,100);
    su = g*mea/1000*(1-rl/100);
  }
  const tot = lv.map(x=>({other:x.other+su, kueche:x.kueche, total:x.other+su+x.kueche}));
  return {r, lines, su, tot, wf};
}
/** Werte, die die Kalkulation braucht (nur wenn aktiv) */
function renoCalc(d){
  const zero = {aktiv:false,total:0,other:0,kueche:0,leer:0,mehr:0,fin:"ek"};
  if (!d.reno || !d.reno.aktiv) return zero;
  const rc = renoCost(d), t = rc.tot[clamp(Math.round(num(d.reno.std)),0,2)||0];
  if (!(t.total>0) && !(num(d.reno.mehr)>0) && !(num(d.reno.leer)>0)) return zero;
  return {aktiv:true, total:t.total, other:t.other, kueche:t.kueche,
    leer:clamp(num(d.reno.leer)||0,0,12), mehr:num(d.reno.mehr)||0, fin:d.reno.fin==="kredit"?"kredit":"ek"};
}

/* ---------- Kalkulation ---------- */
function autoAfa(bj){ bj=num(bj); if(isNaN(bj)) return 2; if(bj<1925) return 2.5; if(bj>=2023) return 3; return 2; }
const SIM_YEARS = 60;
function calc(d,p){
  const kp=num(d.kp)||0, miete=num(d.miete)||0, flaeche=num(d.flaeche);
  const bl=d.bl||p.bl, grest=(GREST[bl]??5)/100;
  const makler=pick(d.makler,p.makler)/100, notar=pick(d.notar,p.notar)/100;
  const nk=kp*(grest+makler+notar);
  const R=renoCalc(d);
  const invest=kp+nk+R.total;
  const ekAuto=nk+kp*(num(p.ekquote)||0)/100+(R.fin==="ek"?R.total:0);
  const ek=Math.max(0,pick(d.ek,ekAuto));
  const darlehen=Math.max(0,invest-ek);
  const zins=pick(d.zins,p.zins)/100, tilg=pick(d.tilgung,p.tilgung)/100;
  const zb=Math.max(1,Math.round(pick(d.zinsbindung,p.zinsbindung)||10));
  const az=pick(d.anschlusszins,p.anschlusszins)/100;
  const geb=pick(d.gebanteil,p.gebanteil)/100;
  const afaSatz=pick(d.afa,autoAfa(d.baujahr))/100;
  const akGeb=(kp+nk)*geb;
  // Anschaffungsnahe Herstellungskosten (§ 6 Abs. 1 Nr. 1a EStG): netto > 15 % der Gebäude-Anschaffungskosten
  const anschaffungsnah = R.other>0 && R.other/1.19 > 0.15*akGeb;
  const afaBasis=akGeb+(anschaffungsnah?R.other:0);
  const afaJahr=afaBasis*afaSatz;
  const erhaltung=anschaffungsnah?0:R.other;
  const kuecheAfa=R.kueche/10;
  const ausfall=pick(d.mietausfall,p.mietausfall)/100;
  const verw=pick(d.verwaltung,p.verwaltung);
  const hgnu=num(d.hg_nu)||0, rl=Math.min(num(d.ruecklage)||0,hgnu);
  const sonst=num(d.sonst)||0;
  const instandJ=(pick(d.instand,p.instand)||0)*(flaeche||0);
  const ms=(num(p.mietsteig)||0)/100, ws=(num(p.wertsteig)||0)/100, cs=(num(p.kostensteig)||0)/100;
  const infl=(num(p.inflation)||0)/100, vk=(num(p.verkauf)||0)/100;
  const jahre=Math.max(1,Math.min(40,Math.round(num(p.jahre)||30)));
  const mieteMon=miete+R.mehr;
  const rateM=darlehen*(zins+tilg)/12;
  let bal=darlehen, cumCF=0, afaRest=afaBasis, rateCur=rateM, rateAnschluss=null;
  const all=[];
  for (let y=1;y<=SIM_YEARS;y++){
    const f=Math.pow(1+ms,y-1), g=Math.pow(1+cs,y-1);
    const monate = y===1 ? 12-R.leer : 12;
    const mieteJ=mieteMon*monate*f, ausfallJ=mieteJ*ausfall;
    const kostenCash=(hgnu+verw)*12*g+sonst*g+instandJ*g;
    const kostenAbz=(hgnu-rl+verw)*12*g+sonst*g+instandJ*g;   // Rücklage erst bei Verwendung absetzbar
    const zinsSatz = y<=zb ? zins : az;
    // Anschlussfinanzierung: Rate aus Restschuld × (Anschlusszins + Tilgungssatz), mindestens die bisherige Rate
    if (y===zb+1 && bal>0){ rateCur=Math.max(rateM, bal*(az+tilg)/12); rateAnschluss=rateCur; }
    let zinsJ=0,tilgJ=0;
    for (let m=0;m<12;m++){ if(bal<=0.005) break; const zi=bal*zinsSatz/12; const t=Math.min(Math.max(rateCur-zi,0),bal); zinsJ+=zi; tilgJ+=t; bal-=t; }
    if (bal<0.005) bal=0;
    const afaY=Math.min(afaJahr,afaRest); afaRest-=afaY;
    const kAfa = y<=10 ? kuecheAfa : 0;
    const erh = y===1 ? erhaltung : 0;
    const vuv=mieteJ-ausfallJ-zinsJ-afaY-kAfa-erh-kostenAbz;
    const st=steuerWirkung(vuv,p);
    const cfVor=mieteJ-ausfallJ-kostenCash-zinsJ-tilgJ;
    const cfNach=cfVor+st; cumCF+=cfNach;
    const wert=kp*Math.pow(1+ws,y);
    all.push({y,mieteJ,ausfallJ,kostenCash,kostenAbz,zinsSatz,zinsJ,tilgJ,afaY,kAfa,erh,vuv,st,cfVor,cfNach,cumCF,rest:bal,wert,netto:wert-bal-ek+cumCF});
  }
  const rows=all.slice(0,jahre);
  const r1=all[0], rLauf = R.aktiv ? all[1] : all[0];
  const jm=miete*12;
  const firstY = fn => { const r=all.find(fn); return r?r.y:null; };
  const c = {kp,nk,grest,makler,notar,ek,ekAuto,darlehen,invest,zins,tilg,zb,az,rateM,rateAnschluss,geb,afaSatz,afaBasis,afaJahr,akGeb,anschaffungsnah,erhaltung,kuecheAfa,
    ausfall,verw,hgnu,bl,miete,mieteMon,R,infl,vk,ws,
    faktor:jm>0?kp/jm:NaN, brutto:kp>0?jm/kp:NaN,
    netto:invest>0?(mieteMon*12*(1-ausfall)-(hgnu+verw)*12-sonst-instandJ)/invest:NaN,
    qm:flaeche>0?kp/flaeche:NaN, mqm:flaeche>0?miete/flaeche:NaN,
    r1, rLauf, rows, all, jahre, grenz:grenzsatz(p),
    schuldenfrei: darlehen>0 ? firstY(r=>r.rest<=0) : 0,
    cfPositiv: firstY(r=>r.cfNach>0),
    afaEnde: firstY(r=>r.afaY < afaJahr*0.999),
    ekRendite:ek>0?(rLauf.cfNach+rLauf.tilgJ+kp*ws)/ek:NaN};
  c.score = scoreOf(c);
  return c;
}

/* ---------- Deal-Score (0–100) ---------- */
const lin = (v,a,b) => isFinite(v) ? clamp((v-a)/(b-a),0,1)*100 : 0;
function scoreOf(c){
  if (!(c.kp>0) || !(c.miete>0)) return null;
  const cfM = c.rLauf.cfNach/12;
  const deck = c.mieteMon/((c.rateM+c.hgnu+c.verw)||1);
  const parts = {
    cf:   {l:"Cashflow",    v:lin(cfM,-400,100),       w:.35},
    rend: {l:"Mietrendite", v:lin(c.brutto,.03,.065),  w:.25},
    ekr:  {l:"EK-Rendite",  v:lin(c.ekRendite,0,.15),  w:.20},
    deck: {l:"Mietdeckung", v:lin(deck,.6,1.1),        w:.20}
  };
  const total = Math.round(Object.values(parts).reduce((s,x)=>s+x.v*x.w,0));
  let grade, tone;
  if (total>=80){ grade="Sehr gut"; tone="good"; }
  else if (total>=65){ grade="Gut"; tone="good"; }
  else if (total>=50){ grade="Solide"; tone="warn"; }
  else if (total>=35){ grade="Schwach"; tone="warn"; }
  else { grade="Kritisch"; tone="bad"; }
  return {total, parts, grade, tone};
}

/* Kaufpreis, bei dem der laufende Cashflow nach Steuern genau 0 ist */
function zielpreis(d,p){
  const f = kp => calc({...d,kp},p).rLauf.cfNach;
  let lo=1000, hi=Math.max(num(d.kp)||0,1000)*3;
  if (f(lo)<0) return null;
  if (f(hi)>=0) return hi;
  for (let i=0;i<40;i++){ const m=(lo+hi)/2; if (f(m)>=0) lo=m; else hi=m; }
  return Math.floor(lo/500)*500;
}

/* Interner Zinsfuß (jährlich) einer Zahlungsreihe, Index = Jahr */
function irr(flows){
  const npv = r => flows.reduce((s,f,t)=>s+f/Math.pow(1+r,t),0);
  let lo=-0.95, hi=1.5, flo=npv(lo), fhi=npv(hi);
  if (!isFinite(flo)||!isFinite(fhi)||flo*fhi>0) return NaN;
  for (let i=0;i<80;i++){ const m=(lo+hi)/2, fm=npv(m); if (flo*fm<=0){ hi=m; fhi=fm; } else { lo=m; flo=fm; } }
  return (lo+hi)/2;
}
/** Verkauf nach Y Jahren (nur ≥ 10 Jahre: steuerfrei nach § 23 EStG) */
function exitAt(c,Y){
  const row=c.all[Y-1]; if (!row) return null;
  const erloes=row.wert*(1-c.vk)-row.rest;
  const flows=[-c.ek]; for (let i=0;i<Y;i++) flows.push(c.all[i].cfNach + (i===Y-1?erloes:0));
  return {Y, wert:row.wert, rest:row.rest, erloes, cum:row.cumCF, gewinn:erloes+row.cumCF-c.ek, irr: c.ek>0?irr(flows):NaN};
}

/* ---------- Szenario ---------- */
function scenActive(){ return scen.kp!==0 || scen.miete!==0 || scen.zins!==null || scen.ek!==null; }
function effDeal(){
  const d={...deal};
  if (scen.kp) d.kp=(num(deal.kp)||0)*(1+scen.kp/100);
  if (scen.miete) d.miete=(num(deal.miete)||0)*(1+scen.miete/100);
  if (scen.zins!==null) d.zins=scen.zins;
  if (scen.ek!==null) d.ek=scen.ek;
  return d;
}
function resetScen(){ scen={kp:0, zins:null, miete:0, ek:null}; }

/* ---------- Formulare ---------- */
const blOptions = empty => (empty?`<option value="">${empty}</option>`:"")+Object.keys(BLN).map(k=>`<option value="${k}">${BLN[k]} (${nf1.format(GREST[k])} %)</option>`).join("");
const OBJ = [
  {k:"titel",l:"Bezeichnung",t:"text",wide:true},
  {k:"adresse",l:"Lage / Adresse",t:"text",wide:true},
  {k:"kp",l:"Kaufpreis",u:"€"},
  {k:"flaeche",l:"Wohnfläche",u:"m²"},
  {k:"miete",l:"Kaltmiete",u:"€/Mon."},
  {k:"baujahr",l:"Baujahr"},
  {k:"hg_nu",l:"Hausgeld n. umlagef.",u:"€/Mon."},
  {k:"ruecklage",l:"davon Rücklage",u:"€/Mon."},
  {k:"zimmer",l:"Zimmer"},
  {k:"makler",l:"Makler",u:"%",ph:()=>show(profile.makler)},
  {k:"bl",l:"Bundesland",t:"select",opts:()=>blOptions("Wie im Profil"),wide:true},
];
const FIN = [
  {k:"ek",l:"Eigenkapital",u:"€",ph:c=>nf0.format(Math.round(c.ekAuto))},
  {k:"zins",l:"Sollzins",u:"%",ph:()=>show(profile.zins)},
  {k:"tilgung",l:"Tilgung",u:"%",ph:()=>show(profile.tilgung)},
  {k:"notar",l:"Notar & Grundbuch",u:"%",ph:()=>show(profile.notar)},
  {k:"gebanteil",l:"Gebäudeanteil",u:"%",ph:()=>show(profile.gebanteil)},
  {k:"afa",l:"AfA-Satz",u:"%",ph:()=>nf1.format(autoAfa(deal.baujahr))+" auto"},
  {k:"mietausfall",l:"Mietausfall",u:"%",ph:()=>show(profile.mietausfall)},
  {k:"verwaltung",l:"SE-Verwaltung",u:"€/Mon.",ph:()=>show(profile.verwaltung)},
  {k:"sonst",l:"Sonstige Kosten",u:"€/Jahr",ph:()=>"0"},
  {k:"instand",l:"Instandhaltung Wohnung",u:"€/m² Jahr",ph:()=>show(profile.instand)},
  {k:"zinsbindung",l:"Zinsbindung",u:"Jahre",ph:()=>show(profile.zinsbindung)},
  {k:"anschlusszins",l:"Anschlusszins",u:"%",ph:()=>show(profile.anschlusszins)},
];
const TAX = [
  {k:"name",l:"Dein Name",t:"text",wide:true},
  {k:"zve",l:"Zu versteuerndes Einkommen",u:"€/Jahr",wide:true},
  {k:"veranl",l:"Veranlagung",t:"select",opts:()=>`<option value="einzel">Einzeln</option><option value="zusammen">Zusammen</option>`},
  {k:"kist",l:"Kirchensteuer",t:"select",opts:()=>`<option value="0">keine</option><option value="8">8 % (BY, BW)</option><option value="9">9 %</option>`},
  {k:"grenz",l:"Grenzsteuersatz manuell",u:"%",ph:()=>"aus Einkommen",wide:true},
];
const DEF = [
  {k:"bl",l:"Standard-Bundesland",t:"select",opts:()=>blOptions(),wide:true},
  {k:"zins",l:"Sollzins",u:"%"},
  {k:"tilgung",l:"Tilgung",u:"%"},
  {k:"ekquote",l:"EK zusätzl. zu NK",u:"% KP"},
  {k:"notar",l:"Notar & Grundbuch",u:"%"},
  {k:"makler",l:"Makler",u:"%"},
  {k:"gebanteil",l:"Gebäudeanteil",u:"%"},
  {k:"mietausfall",l:"Mietausfall",u:"%"},
  {k:"verwaltung",l:"SE-Verwaltung",u:"€/Mon."},
  {k:"instand",l:"Instandhaltung Wohnung",u:"€/m² Jahr"},
  {k:"zinsbindung",l:"Zinsbindung",u:"Jahre"},
  {k:"anschlusszins",l:"Anschlusszins",u:"%"},
  {k:"mietsteig",l:"Mietsteigerung",u:"%/J."},
  {k:"wertsteig",l:"Wertsteigerung",u:"%/J."},
  {k:"kostensteig",l:"Kostensteigerung",u:"%/J."},
  {k:"inflation",l:"Inflation",u:"%/J."},
  {k:"verkauf",l:"Verkaufskosten",u:"%"},
  {k:"jahre",l:"Zeitraum",u:"Jahre"},
];
function buildFields(el,defs,prefix,getObj,onChange){
  el.innerHTML = defs.map(f=>{
    const id=prefix+f.k;
    const lab=`<label for="${id}"><span>${f.l}</span>${f.u?`<em>${f.u}</em>`:""}</label>`;
    let ctl;
    if (f.t==="select") ctl=`<select id="${id}">${f.opts()}</select>`;
    else if (f.t==="text") ctl=`<input id="${id}" type="text" autocomplete="off">`;
    else ctl=`<input id="${id}" class="num" type="text" inputmode="decimal" autocomplete="off">`;
    return `<div class="f${f.wide?" wide":""}" id="w_${id}">${lab}${ctl}</div>`;
  }).join("");
  defs.forEach(f=>{ const i=$(prefix+f.k);
    i.addEventListener(f.t==="select"?"change":"input",()=>{ getObj()[f.k]=i.value; onChange(f.k); }); });
}
function fillFields(defs,prefix,o,c){
  defs.forEach(f=>{ const i=$(prefix+f.k); if(!i) return;
    if (document.activeElement!==i) i.value=show(o[f.k]);
    if (f.ph) i.placeholder=f.ph(c); });
}

/* ---------- Rendering: Ergebnis ---------- */
function render(){
  const base = calc(deal,profile);
  const c = scenActive() ? calc(effDeal(),profile) : base;
  fillFields(OBJ,"o_",deal,base); fillFields(FIN,"d_",deal,base);
  $("exampleTag").hidden = !deal._example;
  $("scenTag").hidden = !scenActive();
  $("dealTitle").textContent = deal.titel || "Objekt";
  $("exLink").hidden = !deal.link; if (deal.link) $("exLink").href = deal.link;

  $("renoTag").hidden = !c.R.aktiv;
  renderScore(c);
  const r=c.rLauf, cfM=r.cfNach/12;
  tween($("k_cfn"), cfM, eurS, true);
  $("k_cfn_d").textContent = scenActive() ? `Exposé: ${eurS(base.rLauf.cfNach/12)}` : (c.R.aktiv?"pro Monat, Jahr 2":"pro Monat");
  tween($("k_st"), r.st/12, eurS, true);
  $("k_gs").textContent = pct(c.grenz);
  tween($("k_cfv"), r.cfVor/12, eurS, true);
  $("k_yr").textContent = c.R.aktiv ? "laufend, nach Sanierung" : "";
  tween($("k_br"), c.brutto, v=>pct(v,2));
  $("k_fak").textContent = isFinite(c.faktor) ? `Faktor ${nf1.format(c.faktor)}` : "";
  tween($("k_nr"), c.netto, v=>pct(v,2));
  tween($("k_ek"), c.ek, eur);
  $("k_ekr").textContent = isFinite(c.ekRendite) ? `EK-Rendite ${pct(c.ekRendite)}` : "";

  renderWaterfall(c);
  renderScenario(base,c);
  renderReno(c);
  renderTables(c);
  renderStrategy(c);
  renderAnalyse();
  renderProfile();
  LS.set("er_current", deal);
}

function renderScore(c){
  const s=c.score, ring=$("ring"), arc=$("ringArc"), C=314.16;
  ring.classList.remove("good","warn","bad");
  const pill=$("gradePill"); pill.className="pill";
  if (!s){
    arc.style.strokeDashoffset=C; $("scoreNum").textContent="–"; $("scoreNum")._v=undefined;
    pill.textContent="offen"; $("verdict").textContent="Kaufpreis und Miete eintragen, dann wird gerechnet.";
    $("subs").innerHTML=""; return;
  }
  ring.classList.add(s.tone); pill.classList.add(s.tone); pill.textContent=s.grade;
  nextFrame(()=>{ arc.style.strokeDashoffset = C*(1-s.total/100); });
  tween($("scoreNum"), s.total, v=>String(Math.round(v)));
  const cfM=c.rLauf.cfNach/12;
  $("verdict").textContent = cfM>=0
    ? `Trägt sich selbst: ${eurS(cfM)} im Monat nach Steuern.`
    : `Du legst ${eur(-cfM)} im Monat dazu, nach Steuern.`;
  const subs=$("subs");
  if (!subs.children.length){
    subs.innerHTML = Object.entries(s.parts).map(([k,x])=>`<div class="sub"><span>${x.l}</span><span class="bar"><i id="sb_${k}"></i></span><b id="sbv_${k}">0</b></div>`).join("");
  }
  nextFrame(()=>Object.entries(s.parts).forEach(([k,x])=>{
    $("sb_"+k).style.width = x.v.toFixed(1)+"%";
    tween($("sbv_"+k), x.v, v=>String(Math.round(v)));
  }));
}

/* Wasserfall: Monatswerte Jahr 1 */
function renderWaterfall(c){
  const r=c.rLauf;
  $("wfYear").textContent = c.R.aktiv ? "pro Monat, Jahr 2" : "pro Monat, Jahr 1";
  const steps=[
    {l:"Kaltmiete", v:r.mieteJ/12, t:"in"},
    {l:"Mietausfall", v:-r.ausfallJ/12, t:"out"},
    {l:"Hausgeld & Verwaltung", v:-r.kostenCash/12, t:"out"},
    {l:"Zinsen", v:-r.zinsJ/12, t:"out"},
    {l:"Tilgung (Vermögen)", v:-r.tilgJ/12, t:"out"},
    {l:r.st>=0?"Steuererstattung":"Steuerlast", v:r.st/12, t:r.st>=0?"in":"out"},
  ];
  let run=0; const spans=[];
  steps.forEach(s=>{ const a=run; run+=s.v; spans.push([a,run]); });
  spans.push([0,run]);
  steps.push({l:"Cashflow nach Steuern", v:run, t:"res"});
  const all=spans.flat(); let lo=Math.min(0,...all), hi=Math.max(0,...all);
  if (hi-lo<1) hi=lo+1;
  const sc=v=>(v-lo)/(hi-lo)*100;
  const wf=$("wf");
  if (wf.children.length!==8){
    wf.innerHTML = steps.map((_,i)=>`<div class="col"><div class="bar" data-i="${i}" style="bottom:${sc(0)}%;height:0"></div><div class="val" style="bottom:${sc(0)}%"></div></div>`).join("")+`<div class="zero" style="bottom:0"></div>`;
  }
  const cols=wf.querySelectorAll(".col");
  nextFrame(()=>{
    steps.forEach((s,i)=>{
      const [a,b]=spans[i], bot=sc(Math.min(a,b)), h=Math.max(sc(Math.max(a,b))-bot, 0.6);
      const bar=cols[i].querySelector(".bar"), val=cols[i].querySelector(".val");
      bar.className="bar "+s.t; bar.style.bottom=bot+"%"; bar.style.height=h+"%";
      bar.dataset.l=s.l; bar.dataset.v=s.v;
      val.textContent=(s.t==="res"?eurS(s.v):nf0.format(Math.round(Math.abs(s.v))));
      val.style.bottom = s.v<0 ? `calc(${bot}% - 16px)` : `calc(${bot+h}% + 3px)`;
    });
    wf.querySelector(".zero").style.bottom=sc(0)+"%";
  });
}
function wfTip(e){
  const bar=e.target.closest(".bar"), tip=$("wfTip");
  if (!bar){ tip.hidden=true; return; }
  const box=$("wf").getBoundingClientRect(), b=bar.getBoundingClientRect();
  tip.innerHTML=`${esc(bar.dataset.l)}<br><b>${eurS(+bar.dataset.v)}</b> / Monat`;
  tip.style.left=clamp(b.left-box.left+b.width/2,60,box.width-60)+"px";
  tip.style.top=(b.top-box.top-6)+"px"; tip.hidden=false;
}

/* Szenario-Regler */
function setRange(el,v){ el.value=v; const p=(v-el.min)/(el.max-el.min)*100; el.style.setProperty("--p",clamp(p,0,100)+"%"); }
function renderScenario(base,c){
  const kp0=num(deal.kp)||0, m0=num(deal.miete)||0;
  const ek0=base.ek, zins0=base.zins*100;
  const ekMax=Math.max(10000,Math.ceil((kp0+base.nk)/5000)*5000);
  const sEk=$("s_ek"); sEk.max=ekMax;
  if (document.activeElement!==$("s_kp")) setRange($("s_kp"),scen.kp);
  if (document.activeElement!==$("s_miete")) setRange($("s_miete"),scen.miete);
  if (document.activeElement!==$("s_zins")) setRange($("s_zins"),scen.zins??zins0);
  if (document.activeElement!==sEk) setRange(sEk,scen.ek??Math.round(ek0/1000)*1000);
  $("sv_kp").textContent = (scen.kp?`${scen.kp>0?"+":"−"}${Math.abs(scen.kp)} % · `:"")+eur(kp0*(1+scen.kp/100));
  $("sv_miete").textContent = (scen.miete?`${scen.miete>0?"+":"−"}${Math.abs(scen.miete)} % · `:"")+eur(m0*(1+scen.miete/100));
  $("sv_zins").textContent = nf2.format(scen.zins??zins0)+" %";
  $("sv_ek").textContent = eur(scen.ek??ek0);
  const dlt=(c.rLauf.cfNach-base.rLauf.cfNach)/12;
  tween($("scenDelta"), dlt, v=>eurS(v), true);
  $("scenReset").hidden=!scenActive(); $("scenApply").hidden=!scenActive();
  // Zielpreis
  const t=$("target");
  if (!(kp0>0)||!(m0>0)){ t.innerHTML=`<span class="note">Sobald Kaufpreis und Miete feststehen, berechne ich deinen Verhandlungs-Zielpreis.</span>`; return; }
  const zp=zielpreis({...deal, zins:scen.zins??deal.zins, ek:scen.ek??deal.ek, miete:m0*(1+scen.miete/100)},profile);
  const p5=m0*(1+scen.miete/100)*12/0.05;
  let html=`<h3>Verhandlungsziel</h3>`;
  if (zp===null) html+=`<div class="t"><span>Schwarze Null nach Steuern</span><b>nicht erreichbar</b></div>`;
  else {
    const d=(zp/kp0-1)*100;
    html+=`<div class="t"><span>Schwarze Null nach Steuern bei</span><b>${eur(zp)} <small class="${d<0?"neg":"pos"}">(${d>=0?"+":"−"}${nf0.format(Math.abs(d))} %)</small></b></div>`;
  }
  html+=`<div class="t"><span>5 % Bruttomietrendite bei</span><b>${eur(p5)}</b></div>`;
  if (zp!==null && zp<kp0) html+=`<button class="btn small" id="tryZp" data-p="${Math.max(-30,Math.round((zp/kp0-1)*100))}">Zielpreis im Szenario testen</button>`;
  t.innerHTML=html;
}

/* Vermögensaufbau-Chart */
function niceStep(raw){ const p=Math.pow(10,Math.floor(Math.log10(raw||1))), n=raw/p; return (n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*p; }
let wData=null;
function renderWealth(c){
  const svg=$("wSvg"), W=340, H=200, L=50, R=58, T=12, B=24;
  if (!(c.kp>0)){ svg.innerHTML=""; wData=null; $("wNote").textContent=""; return; }
  const pts=[{y:0,wert:c.kp,rest:c.darlehen,cum:0}].concat(c.rows.map(r=>({y:r.y,wert:r.wert,rest:r.rest,cum:r.cumCF})));
  const maxV=Math.max(...pts.map(p=>Math.max(p.wert,p.rest)))*1.05;
  const st=niceStep(maxV/3), top=Math.ceil(maxV/st)*st;
  const x=i=>L+(W-L-R)*i/(pts.length-1), y=v=>T+(H-T-B)*(1-v/top);
  let g="";
  for (let v=0; v<=top+1; v+=st) g+=`<line class="grid" x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${L-6}" y="${y(v)+3.5}" text-anchor="end">${nf0.format(v/1000)} T€</text>`;
  const n=pts.length-1, every=n<=10?(n<=5?1:2):Math.ceil(n/5);
  pts.forEach((p,i)=>{ if(i%every===0||i===n) g+=`<text class="axis" x="${x(i)}" y="${H-6}" text-anchor="middle">${p.y}</text>`; });
  const pl=k=>pts.map((p,i)=>`${i?"L":"M"}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join("");
  const area=pl("wert")+pts.slice().reverse().map((p,j)=>`L${x(n-j).toFixed(1)},${y(p.rest).toFixed(1)}`).join("")+"Z";
  const anim=drawWealth&&!RM; drawWealth=false;
  const lw=pts[n], ly1=y(lw.wert), ly2=y(lw.rest), sep=Math.abs(ly1-ly2)<14?(ly1<ly2?-7:7):0;
  svg.innerHTML=g+
    `<path class="gap${anim?" fade":""}" d="${area}"/>`+
    `<path class="l2${anim?" draw":""}" pathLength="1" d="${pl("rest")}"/>`+
    `<path class="l1${anim?" draw":""}" pathLength="1" d="${pl("wert")}"/>`+
    `<text class="lab" x="${W-R+6}" y="${ly1+4+sep}">${tEur(lw.wert)}</text>`+
    `<text class="lab" x="${W-R+6}" y="${ly2+4-sep}">${tEur(lw.rest)}</text>`+
    `<g id="xh" visibility="hidden"><line class="xh" y1="${T}" y2="${H-B}"/><circle class="dot1" r="4.5"/><circle class="dot2" r="4.5"/></g>`+
    `<rect x="${L}" y="${T}" width="${W-L-R}" height="${H-T-B}" fill="transparent" id="wHit"/>`;
  wData={pts,x,y,L,R,W};
  $("wTitle").textContent=`Vermögensaufbau über ${c.jahre} Jahre`;
  $("wNote").innerHTML=`Nach ${c.jahre} Jahren gehören dir <b>${eur(lw.wert-lw.rest)}</b> der Immobilie. Zusammen mit allen Cashflows und abzüglich deines Eigenkapitals ist dein Vermögen um <b class="${cls(c.rows[n-1].netto)}">${eurS(c.rows[n-1].netto)}</b> gewachsen.`+(c.jahre>=10?" Ein Verkauf nach 10 Jahren ist steuerfrei.":"");
}
function wMove(e){
  if (!wData) return;
  const svg=$("wSvg"), box=svg.getBoundingClientRect(), {pts,x,y}=wData;
  const sx=(e.clientX-box.left)/box.width*340;
  const n=pts.length-1;
  let i=Math.round((sx-x(0))/(x(n)-x(0))*n); i=clamp(i,0,n);
  const p=pts[i], g=svg.querySelector("#xh"); if(!g) return;
  g.setAttribute("visibility","visible");
  const ln=g.querySelector("line"); ln.setAttribute("x1",x(i)); ln.setAttribute("x2",x(i));
  const d1=g.querySelector(".dot1"), d2=g.querySelector(".dot2");
  d1.setAttribute("cx",x(i)); d1.setAttribute("cy",y(p.wert)); d2.setAttribute("cx",x(i)); d2.setAttribute("cy",y(p.rest));
  const tip=$("wTip"), k=box.width/340;
  tip.innerHTML=`<b>Jahr ${p.y}</b><br>Wert <b>${eur(p.wert)}</b><br>Restschuld <b>${eur(p.rest)}</b><br>Dein Anteil <b>${eur(p.wert-p.rest)}</b>`+(p.y?`<br>Cashflow kum. <b>${eurS(p.cum)}</b>`:"");
  tip.style.left=clamp(x(i)*k,70,box.width-70)+"px"; tip.style.top=(Math.min(y(p.wert),y(p.rest))*k-10)+"px"; tip.hidden=false;
}
function wLeave(){ const g=$("wSvg").querySelector("#xh"); if(g) g.setAttribute("visibility","hidden"); $("wTip").hidden=true; }

function renderTables(c){
  const r=c.r1, R=c.R;
  $("tables").innerHTML=`
    <details><summary>Kaufnebenkosten &amp; Finanzierung</summary>
      <table class="calc">
        <tr><td>Kaufpreis</td><td>${eur(c.kp)}</td></tr>
        <tr><td>Grunderwerbsteuer ${nf1.format(c.grest*100)} % (${BLN[c.bl]||"–"})</td><td>${eur(c.kp*c.grest)}</td></tr>
        <tr><td>Makler ${nf2.format(c.makler*100)} %</td><td>${eur(c.kp*c.makler)}</td></tr>
        <tr><td>Notar &amp; Grundbuch ${nf1.format(c.notar*100)} %</td><td>${eur(c.kp*c.notar)}</td></tr>
        ${R.aktiv?`<tr><td>Sanierung (${R.fin==="ek"?"aus Eigenkapital":"mitfinanziert"})</td><td>${eur(R.total)}</td></tr>`:""}
        <tr class="sum"><td>Gesamtinvestition</td><td>${eur(c.invest)}</td></tr>
        <tr><td>− Eigenkapital</td><td>${eur(c.ek)}</td></tr>
        <tr class="sum"><td>Darlehen (${nf2.format(c.zins*100)} % Zins, ${nf2.format(c.tilg*100)} % Tilgung)</td><td>${eur(c.darlehen)}</td></tr>
        <tr><td>Monatliche Rate</td><td>${eur(c.rateM)}</td></tr>
        <tr><td>Zinsbindung, danach Annahme</td><td>${c.zb} J. · ${nf2.format(c.az*100)} %</td></tr>
      </table></details>
    <details><summary>Steuerrechnung Jahr 1 (Anlage V)</summary>
      <table class="calc">
        <tr><td>Miete abzgl. ${nf1.format(c.ausfall*100)} % Ausfall${R.leer?`, ${nf0.format(R.leer)} Mon. Leerstand`:""}</td><td>${eur(r.mieteJ-r.ausfallJ)}</td></tr>
        <tr><td>− Schuldzinsen</td><td>${eurS(-r.zinsJ)}</td></tr>
        <tr><td>− AfA ${nf1.format(c.afaSatz*100)} % auf Gebäude${c.anschaffungsnah?" inkl. Sanierung":""}</td><td>${eurS(-r.afaY)}</td></tr>
        ${r.kAfa?`<tr><td>− AfA Einbauküche (10 Jahre)</td><td>${eurS(-r.kAfa)}</td></tr>`:""}
        ${r.erh?`<tr><td>− Sanierung als Erhaltungsaufwand</td><td>${eurS(-r.erh)}</td></tr>`:""}
        <tr><td>− Hausgeld ohne Rücklage, Verwaltung, Instandhaltung, Sonstiges</td><td>${eurS(-r.kostenAbz)}</td></tr>
        <tr class="sum"><td>Einkünfte aus Vermietung</td><td class="${cls(r.vuv)}">${eurS(r.vuv)}</td></tr>
        <tr><td>Dein Grenzsteuersatz${isNaN(num(profile.grenz))?` bei ${eur(num(profile.zve))} zvE`:" (manuell)"}</td><td>${pct(c.grenz)}</td></tr>
        <tr class="sum"><td>${r.st>=0?"Steuererstattung":"Steuerlast"} pro Jahr</td><td class="${cls(r.st)}">${eurS(r.st)}</td></tr>
      </table>
      <p class="note">Die Instandhaltungsrücklage ist erst absetzbar, wenn sie ausgegeben wird. Sie zählt beim Cashflow, nicht in der Steuer. Verluste werden mit deinem übrigen Einkommen verrechnet.</p>
    </details>`;
}

/* ---------- Renovierungsrechner ---------- */
function ensureReno(){ if (!deal.reno) deal.reno = renoDefault(deal); return deal.reno; }
function renderReno(c){
  const r = deal.reno || renoDefault(deal);
  const rc = renoCost(deal), wf=rc.wf, zi=num(deal.zimmer)||Math.max(1,Math.round(wf/25));
  document.querySelectorAll("#renoMode button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.v===r.mode));
  document.querySelectorAll("#renoStd button").forEach(b=>b.setAttribute("aria-pressed", +b.dataset.v===(+r.std)));
  const list=$("renoItems");
  const items=RENO.filter(it=>!it.mode||it.mode===r.mode);
  const sig=r.mode+"|"+items.map(i=>i.k).join(",");
  if (list.dataset.sig!==sig){
    list.dataset.sig=sig;
    list.innerHTML=items.map(it=>`<div class="ritem" id="ri_${it.k}">
      <input type="checkbox" id="rc_${it.k}" aria-label="${it.l}">
      <label class="rl" for="rc_${it.k}">${it.l}${it.h?`<small>${it.h}</small>`:""}</label>
      <span class="rv" id="rv_${it.k}"></span>
      <div class="rq"><input id="rq_${it.k}" class="num" inputmode="decimal" type="text"><span>${it.u}</span><span id="rp_${it.k}"></span></div>
    </div>`).join("");
  }
  const std=clamp(+r.std||0,0,2);
  items.forEach(it=>{
    const st=r.items[it.k]||{}, on=!!st.on, q=Math.max(0,pick(st.qty,it.q(wf,zi)));
    $("ri_"+it.k).classList.toggle("on",on);
    $("rc_"+it.k).checked=on;
    const qi=$("rq_"+it.k); if (document.activeElement!==qi){ qi.value = st.qty!==undefined&&st.qty!=="" ? show(st.qty) : ""; } qi.placeholder=show(Math.round(it.q(wf,zi)*10)/10);
    $("rp_"+it.k).textContent=`× ${nf0.format(it.p[std])} €`;
    $("rv_"+it.k).textContent = on ? eur(q*it.p[std]) : `${nf0.format(it.p[0])}–${nf0.format(it.p[2])} €/${it.u.startsWith("m²")?"m²":"Stk."}`;
  });
  $("suBox").hidden = r.mode!=="wohnung";
  ["gesamt","mea","rl"].forEach(k=>{ const i=$("su_"+k); if(document.activeElement!==i) i.value=show(r.su[k]); });
  $("suOut").textContent = rc.su>0 ? `Dein Anteil: ${eur(rc.su)}` : "";
  const setv=(id,v)=>{ const i=$(id); if(document.activeElement!==i) i.value=show(v); };
  setv("r_puffer", r.puffer); setv("r_leer", r.leer); setv("r_mehr", r.mehr);
  $("r_fin").value=r.fin; $("r_aktiv").checked=!!r.aktiv;
  const t=rc.tot, has=t[2].total>0;
  const pill=$("renoPill"); pill.className="pill "+(r.aktiv&&has?"good":"warn"); pill.textContent = !has?"keine Posten":r.aktiv?"in Kalkulation":"nicht berücksichtigt";
  if (!has){ $("renoSum").innerHTML=`<span class="note">Wähle die Bauteile, die erneuert werden müssen. Mengen werden aus der Wohnfläche geschätzt und lassen sich anpassen.</span>`; return; }
  const lo=t[0].total, hi=t[2].total, plan=t[std].total;
  const pos = hi>lo ? (plan-lo)/(hi-lo)*100 : 50;
  // Steuer: 15-%-Grenze für anschaffungsnahe Herstellungskosten
  const akGeb=c.akGeb, otherNet=t[std].other/1.19, grenze=0.15*akGeb;
  let tax;
  if (!(akGeb>0)) tax="Für die steuerliche Einordnung fehlt der Kaufpreis.";
  else if (otherNet>grenze) tax=`<b>Über der 15-%-Grenze</b> (${eur(otherNet)} netto > ${eur(grenze)}): Die Kosten gelten als anschaffungsnahe Herstellungskosten und werden mit ${nf1.format(c.afaSatz*100)} % pro Jahr abgeschrieben, also rund ${eur(t[std].other*c.afaSatz)} zusätzliche AfA im Jahr.`;
  else {
    const now = steuerWirkung(c.r1.vuv, profile), without = steuerWirkung(c.r1.vuv + t[std].other, profile);
    tax=`<b>Unter der 15-%-Grenze</b> (${eur(otherNet)} netto ≤ ${eur(grenze)}): sofort als Erhaltungsaufwand absetzbar.`+(r.aktiv?` Das bringt dir im ersten Jahr rund <b>${eur(now-without)}</b> Steuerersparnis.`:"");
  }
  $("renoSum").innerHTML=`
    <div class="row between"><span>Planwert (${["einfach","mittel","gehoben"][std]}, inkl. ${nf0.format(Math.max(0,pick(r.puffer,15)))} % Puffer${rc.su>0?" und Sonderumlage":""})</span><span class="note">${wf>0?nf0.format(plan/wf)+" €/m² Wohnfl.":""}</span></div>
    <div class="big2" id="renoBig"></div>
    <div class="rangebar"><i style="left:calc(${pos.toFixed(1)}% - 2px)"></i></div>
    <div class="rr"><span>einfach ${eur(lo)}</span><span>gehoben ${eur(hi)}</span></div>
    ${t[std].kueche>0?`<p class="note">davon Einbauküche ${eur(t[std].kueche)} (10 Jahre AfA)</p>`:""}
    <p class="tax">${tax}</p>
    <p class="note">Die 15-%-Grenze gilt für Arbeiten innerhalb von 3 Jahren nach dem Kauf (§ 6 Abs. 1 Nr. 1a EStG). Lass die Einordnung vor dem Kauf von einem Steuerberater prüfen. Eine Wertsteigerung durch die Sanierung ist bewusst nicht eingerechnet.</p>`;
  tween($("renoBig"), plan, eur);
}
function renoEvents(){
  $("renoMode").addEventListener("click",e=>{ const b=e.target.closest("[data-v]"); if(!b) return; ensureReno().mode=b.dataset.v; edited(); render(); });
  $("renoStd").addEventListener("click",e=>{ const b=e.target.closest("[data-v]"); if(!b) return; ensureReno().std=+b.dataset.v; edited(); render(); });
  $("renoItems").addEventListener("change",e=>{
    const cb=e.target.closest("input[type=checkbox]"); if(!cb) return;
    const k=cb.id.slice(3), r=ensureReno(); r.items[k]={...(r.items[k]||{}), on:cb.checked};
    if (cb.checked && !r.aktiv && !r._touched){ r.aktiv=true; }
    edited(); render();
  });
  $("renoItems").addEventListener("input",e=>{
    const qi=e.target.closest("input[id^=rq_]"); if(!qi) return;
    const k=qi.id.slice(3), r=ensureReno(); r.items[k]={...(r.items[k]||{on:true}), qty:qi.value}; edited(); render();
  });
  ["gesamt","mea","rl"].forEach(k=>$("su_"+k).addEventListener("input",e=>{ const r=ensureReno(); r.su={...r.su,[k]:e.target.value}; if(!r._touched) r.aktiv=true; edited(); render(); }));
  [["r_puffer","puffer"],["r_leer","leer"],["r_mehr","mehr"]].forEach(([id,k])=>$(id).addEventListener("input",e=>{ ensureReno()[k]=e.target.value; edited(); render(); }));
  $("r_fin").addEventListener("change",e=>{ ensureReno().fin=e.target.value; edited(); render(); });
  $("r_aktiv").addEventListener("change",e=>{ const r=ensureReno(); r.aktiv=e.target.checked; r._touched=true; edited(); render(); toast(r.aktiv?"Sanierung wird berücksichtigt":"Sanierung ausgeblendet"); });
}

/* ---------- Strategie (10–40 Jahre) ---------- */
function renderStrategy(c){
  if (document.activeElement!==$("s_jahre")) setRange($("s_jahre"), c.jahre);
  $("sv_jahre").textContent = `${c.jahre} Jahre`;
  $("stratReno").hidden = !c.R.aktiv;
  $("stratObj").textContent = c.kp>0 ? `${deal.titel||"Objekt"} · ${eur(c.kp)} · Darlehen ${eur(c.darlehen)}` : "Trag zuerst Kaufpreis und Miete ein.";
  const a=(l,v)=>`<span>${l} <b>${v}</b></span>`;
  $("assume").innerHTML = a("Zinsbindung",`${c.zb} J.`)+a("danach",`${nf2.format(c.az*100)} %`)+a("Miete",`+${nf1.format(num(profile.mietsteig)||0)} %/J.`)+a("Wert",`+${nf1.format(num(profile.wertsteig)||0)} %/J.`)+a("Kosten",`+${nf1.format(num(profile.kostensteig)||0)} %/J.`)+a("Inflation",`${nf1.format(c.infl*100)} %`)+`<span><a href="#" id="goAssume">Annahmen ändern</a></span>`;
  if (!(c.kp>0)){ ["timeline","renteCard","exitTable","tipCard"].forEach(id=>$(id).innerHTML=""); $("exitNote").textContent=""; renderWealth(c); renderProjection(c); return; }
  // Meilensteine
  const ms=[];
  ms.push({y:0,t:"Kauf",d:`Eigenkapital ${eur(c.ek)}, Darlehen ${eur(c.darlehen)}, Rate ${eur(c.rateM)} im Monat.`,cls:"done"});
  if (c.R.aktiv) ms.push({y:1,t:"Sanierung",d:`${eur(c.R.total)} ${c.anschaffungsnah?"über die AfA abgeschrieben":"als Erhaltungsaufwand sofort absetzbar"}.`});
  if (c.cfPositiv) ms.push({y:c.cfPositiv,t:"Cashflow nach Steuern positiv",d:`Ab hier trägt sich die Immobilie selbst: ${eurS(c.all[c.cfPositiv-1].cfNach/12)} im Monat.`});
  else ms.push({y:null,t:"Cashflow bleibt negativ",d:"In 60 Jahren wird der Cashflow nach Steuern nicht positiv. Annahmen prüfen.",cls:"warn"});
  ms.push({y:10,t:"Spekulationsfrist endet",d:"Ein Verkauf ist ab jetzt einkommensteuerfrei (§ 23 EStG)."});
  if (c.darlehen>0 && c.zb<SIM_YEARS) {
    const before=c.all[c.zb-1], after=c.all[c.zb];
    if (before.rest>0 && c.rateAnschluss) ms.push({y:c.zb+1,t:"Anschlussfinanzierung",d:`Restschuld ${eur(before.rest)} zu angenommenen ${nf2.format(c.az*100)} %. ${c.rateAnschluss>c.rateM+1?`Die Rate steigt auf ca. ${eur(c.rateAnschluss)} (bisher ${eur(c.rateM)}).`:`Die Rate von ${eur(c.rateM)} bleibt, dadurch wird schneller getilgt.`}`,cls:c.az>c.zins?"warn":""});
  }
  if (c.afaEnde) ms.push({y:c.afaEnde,t:"Abschreibung läuft aus",d:"Ohne AfA steigt die Steuerlast, der Cashflow nach Steuern sinkt."});
  if (c.schuldenfrei) ms.push({y:c.schuldenfrei,t:"Schuldenfrei",d:`Die Immobilie ist voraussichtlich ${eur(c.all[c.schuldenfrei-1].wert)} wert und gehört dir ganz.`});
  else if (c.darlehen>0) ms.push({y:null,t:"Nicht schuldenfrei in 60 Jahren",d:"Die Rate reicht nach der Zinsbindung kaum zur Tilgung. Tilgung erhöhen.",cls:"warn"});
  ms.sort((x,y)=>(x.y??999)-(y.y??999));
  $("timeline").innerHTML = ms.map((m,i)=>`<li class="${m.cls||""}" style="animation-delay:${i*70}ms"><div class="y">${m.y===null?"–":m.y===0?"Heute":"Jahr "+m.y}${m.y>c.jahre?" · außerhalb Zeitraum":""}</div><div class="t">${m.t}</div><div class="d">${m.d}</div></li>`).join("");
  // Rente
  const sf=c.schuldenfrei, rc=$("renteCard");
  if (sf!==null && sf!==undefined && c.all[sf]){
    const nxt=c.all[sf], mon=nxt.cfNach/12, real=mon/Math.pow(1+c.infl,sf);
    rc.innerHTML=`<h2>Deine Zusatzrente</h2><p class="note">Nach Schuldenfreiheit (Jahr ${sf}) bleibt dir monatlich, nach Steuern:</p>
      <div class="big3" id="renteBig"></div>
      <p class="note">Das entspricht heute rund <b>${eur(real)}</b> Kaufkraft (bei ${nf1.format(c.infl*100)} % Inflation). ${sf>c.jahre?"Der Zeitpunkt liegt nach deinem gewählten Zeitraum.":""}</p>`;
    tween($("renteBig"), mon, v=>eur(v)+" / Monat");
  } else rc.innerHTML=`<h2>Deine Zusatzrente</h2><p class="note">Mit den aktuellen Annahmen wird das Darlehen nicht getilgt. Erhöhe die Tilgung, dann siehst du hier deine spätere Monatsrente aus dem Objekt.</p>`;
  // Exit
  const ys=[10,15,20,25,30,35,40].filter(y=>y<=c.jahre);
  $("exitNote").textContent=`Verkauf zum angenommenen Wert abzüglich ${nf2.format(c.vk*100)} % Verkaufskosten und Restschuld. Nach 10 Jahren steuerfrei. Erlös = Verkaufspreis minus Kosten und Restschuld. Gewinn = Erlös plus alle Cashflows minus Eigenkapital. p. a. = jährliche Rendite auf dein Eigenkapital.`;
  const ex=ys.map(y=>exitAt(c,y)).filter(Boolean);
  const best=ex.reduce((b,x)=>isFinite(x.irr)&&(!b||x.irr>b.irr)?x:b,null);
  $("exitTable").innerHTML=`<tr><th>Verkauf</th><th>Erlös</th><th>Gewinn</th><th>p. a.</th></tr>`+
    ex.map(x=>`<tr${best&&x.Y===best.Y?' class="bestrow"':""}><td>nach ${x.Y} J.</td><td>${eur(x.erloes)}</td><td class="${cls(x.gewinn)}">${eurS(x.gewinn)}</td><td>${isFinite(x.irr)?pct(x.irr):"–"}${best&&x.Y===best.Y?" ★":""}</td></tr>`).join("");
  // Tipps
  const tips=[];
  const tNow=c.tilg*100;
  if (c.darlehen>0){
    const alt=calc({...effDeal(), tilgung:tNow+1},profile);
    if (alt.schuldenfrei && (!c.schuldenfrei || alt.schuldenfrei<c.schuldenfrei))
      tips.push(`<b>Tilgung ${nf1.format(tNow+1)} % statt ${nf1.format(tNow)} %:</b> schuldenfrei in Jahr ${alt.schuldenfrei}${c.schuldenfrei?` statt ${c.schuldenfrei}`:""}. Kostet dich ${eur((c.rLauf.cfNach-alt.rLauf.cfNach)/12)} mehr im Monat.`);
    const zinsRisk=calc({...effDeal(), anschlusszins:c.az*100+1.5},profile);
    const row=c.all[c.zb], rowR=zinsRisk.all[c.zb];
    if (row&&rowR) tips.push(`<b>Zinsrisiko:</b> Liegt der Anschlusszins 1,5 Punkte höher (${nf2.format(c.az*100+1.5)} %), steigt die Rate ab Jahr ${c.zb+1} auf ca. ${eur(zinsRisk.rateAnschluss||c.rateM)}. Vor Steuern sind das ${eurS((rowR.cfVor-row.cfVor)/12)} im Monat, nach Steuern ${eurS((rowR.cfNach-row.cfNach)/12)}, weil die höheren Zinsen absetzbar sind. Dafür tilgst du im ersten Jahr danach ${eur(row.tilgJ-rowR.tilgJ)} weniger.`);
  }
  if (c.afaEnde && c.afaEnde<=c.jahre) tips.push(`<b>AfA-Ende in Jahr ${c.afaEnde}:</b> Danach fällt die Abschreibung weg. Plane den höheren Steueranteil ein.`);
  $("tipCard").innerHTML=`<h2>Hinweise zur Strategie</h2>`+(tips.length?tips.map(t=>`<div class="tipbox">${t}</div>`).join(""):`<p class="note">Keine besonderen Hinweise.</p>`)+`<p class="note">Modellrechnung mit festen Annahmen. Zinsen, Mieten und Preise können sich anders entwickeln.</p>`;
  renderWealth(c); renderProjection(c);
}

/* ---------- Exposé-Analyse ---------- */
const URTEIL = {"günstig":"good","marktüblich":"neutral","teuer":"bad","unter Markt":"good","über Markt":"warn","unklar":"neutral"};
function rangeViz(label, value, von, bis, unit, fmtv){
  if (!(von>0) || !(bis>0)) return `<div class="mrange"><b>${label}</b><span class="note">Keine Vergleichsspanne verfügbar.</span></div>`;
  const lo=Math.min(von, value||von)*0.85, hi=Math.max(bis, value||bis)*1.12, sc=v=>(v-lo)/(hi-lo)*100;
  return `<div class="mrange"><div class="row between"><b>${label}</b><span class="note">Markt ${fmtv(von)}–${fmtv(bis)} ${unit}</span></div>
    <div class="bar"><div class="band" style="left:${sc(von)}%;width:${sc(bis)-sc(von)}%"></div>${value>0?`<span class="mk" style="left:${clamp(sc(value),3,97)}%">${fmtv(value)} ${unit}</span>`:""}</div></div>`;
}
const stars = n => `<div class="stars" aria-label="${n||0} von 5">${[1,2,3,4,5].map(i=>`<i class="${i<=(n||0)?"on":""}"></i>`).join("")}</div>`;
function renderAnalyse(){
  const a=deal.analyse, body=$("anaBody");
  $("anaEmpty").hidden=!!a; body.hidden=!a;
  if (!a){ body.innerHTML=""; return; }
  const sig=JSON.stringify(a)+"|"+deal.kp+"|"+deal.flaeche+"|"+deal.miete;
  if (body.dataset.sig===sig) return;
  body.dataset.sig=sig;
  const m=a.markt||{}, l=a.lage||{}, dt=a.details||{};
  const qm=(num(deal.kp)>0&&num(deal.flaeche)>0)?num(deal.kp)/num(deal.flaeche):NaN;
  const mqm=(num(deal.miete)>0&&num(deal.flaeche)>0)?num(deal.miete)/num(deal.flaeche):NaN;
  const pill=(t)=>`<span class="pill ${URTEIL[t]==="neutral"?"":URTEIL[t]||""}">${esc(t||"unklar")}</span>`;
  const ort=(deal.adresse||deal.titel||"").trim();
  const q=encodeURIComponent(ort);
  const links=ort?`<div class="links">
      <a href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener">Karte</a>
      <a href="https://www.bodenrichtwerte-boris.de" target="_blank" rel="noopener">Bodenrichtwert (BORIS)</a>
      <a href="https://www.google.com/search?q=${encodeURIComponent("Mietspiegel "+ort)}" target="_blank" rel="noopener">Mietspiegel</a>
      <a href="https://www.google.com/search?q=${encodeURIComponent("Hochwassergefahrenkarte "+ort)}" target="_blank" rel="noopener">Hochwasserkarte</a>
    </div>`:"";
  const yesno=v=>v===true?"ja":v===false?"nein":"–";
  const det=[["Objektart",{wohnung:"Eigentumswohnung",haus:"Haus",mehrfamilienhaus:"Mehrfamilienhaus"}[a.objektart]||"–"],["Etage",dt.etage],["Baujahr",deal.baujahr],["Zustand",dt.zustand],["Heizung",dt.heizung],
    ["Energie",[dt.energie_kennwert?nf0.format(dt.energie_kennwert)+" kWh/(m²·a)":"",dt.energieklasse?"Klasse "+dt.energieklasse:""].filter(Boolean).join(", ")],
    ["Modernisiert",dt.modernisierungen],["Vermietet",yesno(dt.vermietet)],["Einheiten im Haus",dt.wohneinheiten],["Erbbaurecht",yesno(dt.erbbaurecht)],["Denkmalschutz",yesno(dt.denkmalschutz)],
    ["Ausstattung",(dt.ausstattung||[]).join(", ")]].filter(([,v])=>v!==undefined&&v!==null&&v!==""&&v!=="–");
  const rk=(a.risiken||[]).slice().sort((x,y)=>({hoch:0,mittel:1,niedrig:2}[x.schwere]??3)-({hoch:0,mittel:1,niedrig:2}[y.schwere]??3));
  const sn=(a.sanierung||[]).filter(s=>RENO_KEYS.includes(s.bauteil));
  const stand = m.stand==="web" ? `Websuche vom ${esc(m.datum||"")}` : "Einschätzung aus Claudes Marktwissen, ohne aktuelle Websuche";
  body.innerHTML=`
    <div class="card">
      <div class="row between"><h2>${esc(deal.titel||"Objekt")}</h2>${a.beispiel?'<span class="tag">Beispieldaten</span>':""}</div>
      <p class="note">${esc(deal.adresse||"Adresse nicht angegeben")}</p>
      ${links}
    </div>
    <div class="card">
      <div class="row between"><h2>Markteinschätzung</h2><span class="row">${pill(m.preis_urteil)}</span></div>
      ${rangeViz("Kaufpreis", qm, num(m.kaufpreis_qm_von), num(m.kaufpreis_qm_bis), "€/m²", v=>nf0.format(v))}
      <div class="row between"><span class="note">Mietniveau</span>${pill(m.miete_urteil)}</div>
      ${rangeViz("Kaltmiete", mqm, num(m.miete_qm_von), num(m.miete_qm_bis), "€/m²", v=>nf2.format(v))}
      ${m.begruendung?`<p>${esc(m.begruendung)}</p>`:""}
      <p class="note">Mietpreisbremse: ${m.mietpreisbremse===true?"gilt hier voraussichtlich":m.mietpreisbremse===false?"gilt hier voraussichtlich nicht":"bitte prüfen"}.</p>
      <p class="src">${stand}</p>
      ${(m.quellen||[]).length?`<div class="src">Quellen: ${(m.quellen||[]).slice(0,6).map(u=>`<a href="${esc(u.url||u)}" target="_blank" rel="noopener">${esc(u.titel||(u.url||u).replace(/^https?:\/\/(www\.)?/,"").split("/")[0])}</a>`).join(" · ")}</div>`:""}
      ${ART?`<p class="note">Tipp: Gleiche die Spannen mit dem Mietspiegel der Stadt ab (Link oben).</p>`:`<button class="btn" id="btnMarket">${m.stand==="web"?"Marktdaten erneut prüfen":"Mit aktueller Websuche prüfen"}</button>`}
      <span class="status" id="marketStatus" role="status"></span>
    </div>
    <div class="card">
      <h2>Lage</h2>
      <div class="lscore"><div><h3>Makrolage</h3>${stars(l.makro_note)}</div><p class="note" style="margin-top:14px">${esc(l.makro_text||"–")}</p></div>
      <div class="lscore"><div><h3>Mikrolage</h3>${stars(l.mikro_note)}</div><p class="note" style="margin-top:14px">${esc(l.mikro_text||"–")}</p></div>
      ${(l.plus||[]).length?`<h3>Pluspunkte</h3><ul class="list">${l.plus.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}
      ${(l.minus||[]).length?`<h3>Schwächen</h3><ul class="list">${l.minus.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}
    </div>
    ${rk.length?`<div class="card"><h2>Risiken</h2>${rk.map((r,i)=>`<div class="risk ${esc(r.schwere)}" style="animation-delay:${i*60}ms"><div class="row between"><b>${esc(r.titel)}</b><span class="pill ${r.schwere==="hoch"?"bad":r.schwere==="mittel"?"warn":"good"}">${esc(r.schwere)}</span></div><span class="note">${esc(r.text)}</span></div>`).join("")}</div>`:""}
    ${sn.length?`<div class="card"><h2>Sanierungsbedarf</h2><ul class="list">${sn.map(s=>`<li><b>${esc(RENO.find(r=>r.k===s.bauteil).l)}</b>: ${esc(s.grund)}</li>`).join("")}</ul><button class="btn primary" id="btnSnToReno">In den Renovierungsrechner übernehmen</button></div>`:""}
    ${det.length?`<div class="card"><h2>Details aus dem Exposé</h2><dl class="kv">${det.map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl></div>`:""}
    ${(a.fragen||[]).length?`<div class="card"><div class="row between"><h2>Fragen an den Makler</h2><button class="btn small" id="btnCopyQ">Kopieren</button></div><ol class="list">${a.fragen.map(x=>`<li>${esc(x)}</li>`).join("")}</ol></div>`:""}
    <p class="note" style="padding-inline:4px">KI-Einschätzung auf Basis des Exposés, keine Wertermittlung oder Rechtsberatung. Wichtige Angaben bitte mit Unterlagen (Teilungserklärung, Protokolle, Energieausweis, Mietvertrag) prüfen.</p>`;
}
function analyseEvents(){
  $("anaBody").addEventListener("click",async e=>{
    if (e.target.closest("#btnSnToReno")){
      const r=ensureReno(); const a=deal.analyse||{};
      r.mode = a.objektart==="haus"||a.objektart==="mehrfamilienhaus" ? "haus" : "wohnung";
      (a.sanierung||[]).forEach(s=>{ if (!RENO_KEYS.includes(s.bauteil)) return; const it=RENO.find(x=>x.k===s.bauteil); if (it.mode && it.mode!==r.mode) return; r.items[s.bauteil]={...(r.items[s.bauteil]||{}),on:true}; });
      r.aktiv=true; edited(); render(); setView("calc");
      setTimeout(()=>$("renoCard").scrollIntoView({behavior:RM?"auto":"smooth",block:"start"}),60);
      toast("In den Renovierungsrechner übernommen");
    }
    if (e.target.closest("#btnCopyQ")){
      const txt=(deal.analyse.fragen||[]).map((x,i)=>`${i+1}. ${x}`).join("\n");
      try { await navigator.clipboard.writeText(txt); toast("Fragen kopiert ✓"); } catch(err){ toast("Kopieren nicht möglich"); }
    }
    if (e.target.closest("#btnMarket")) runMarketCheck();
  });
  $("anaGoImport").addEventListener("click",()=>{ setView("calc"); $("link").focus(); });
  $("anaDemo").addEventListener("click",()=>{ setView("calc"); runDemo(); });
}

function renderProjection(c){
  $("projTitle").textContent=`Jahr für Jahr (${c.jahre} Jahre)`;
  $("proj").innerHTML=`<tr><th>Jahr</th><th>CF n. St.</th><th>Steuer</th><th>Zinsen</th><th>Restschuld</th><th>Vermögen</th></tr>`+
    c.rows.map(x=>`<tr><td>${x.y}</td><td class="${cls(x.cfNach)}">${eurS(x.cfNach)}</td><td class="${cls(x.st)}">${eurS(x.st)}</td><td>${eur(x.zinsJ)}</td><td>${eur(x.rest)}</td><td class="${cls(x.netto)}">${eurS(x.netto)}</td></tr>`).join("");
}
function renderProfile(){
  const g=grenzsatz(profile), zve=num(profile.zve)||0;
  if (!$("ps_g")) $("profSum").innerHTML=`<div><span>Grenzsteuersatz</span><b id="ps_g"></b></div><div><span>Steuer heute</span><b id="ps_s"></b></div><div><span>Ersparnis je 1.000 € Verlust</span><b id="ps_e"></b></div>`;
  tween($("ps_g"),g,v=>pct(v)); tween($("ps_s"),steuerGesamt(zve,profile),eur); tween($("ps_e"),steuerWirkung(-1000,profile),eur);
  fillFields(TAX,"p_",profile,null); fillFields(DEF,"q_",profile,null);
  $("profBanner").hidden = !profile._example;
  $("hello").textContent = (profile.name?profile.name+" · ":"")+"Grenzsteuersatz "+pct(g);
}

/* ---------- Objekte & Vergleich ---------- */
function miniRing(s){
  const C=2*Math.PI*22, v=s?s.total:0, tone=s?s.tone:"";
  return `<div class="mini"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="22" fill="none" stroke="var(--line)" stroke-width="5"/><circle cx="26" cy="26" r="22" fill="none" stroke="var(--${tone||"line"})" stroke-width="5" stroke-linecap="round" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${(C*(1-v/100)).toFixed(2)}"/></svg><b>${s?s.total:"–"}</b></div>`;
}
function renderDeals(){
  $("dealCount").textContent = deals.length?`(${deals.length})`:"";
  cmpSel = cmpSel.filter(id=>deals.some(d=>d._id===id));
  const el=$("dealList");
  if (!deals.length){ el.innerHTML=`<p class="note">Noch nichts gespeichert. Lies ein Exposé ein und tippe auf „Objekt speichern“.</p>`; updateCmpBar(); return; }
  const list=deals.map(d=>({d,c:calc(d,profile)})).sort((a,b)=>(b.c.score?.total??-1)-(a.c.score?.total??-1));
  el.innerHTML = list.map(({d,c},i)=>`<div class="deal${cmpSel.includes(d._id)?" sel":""}" style="animation-delay:${i*50}ms">
      ${miniRing(c.score)}
      <div style="min-width:0"><div class="t">${esc(d.titel||"Ohne Titel")}</div>
        <div class="m">${eur(c.kp)} · ${pct(c.brutto,2)} brutto</div>
        <div class="m">CF n. St. <b class="${cls(c.rLauf.cfNach)}">${eurS(c.rLauf.cfNach/12)}/Monat</b></div></div>
      <div class="acts"><button class="btn small" data-open="${d._id}">Öffnen</button><button class="btn small" data-cmp="${d._id}">${cmpSel.includes(d._id)?"Ausgewählt ✓":"Vergleichen"}</button><button class="btn ghost small" data-del="${d._id}">Löschen</button></div>
    </div>`).join("");
  updateCmpBar();
}
function updateCmpBar(){
  const onDeals=!$("view-deals").hidden;
  $("cmpBar").hidden = !(onDeals && cmpSel.length>=1 && $("cmpCard").hidden);
  $("cmpCount").textContent = cmpSel.length===1 ? "1 Objekt gewählt – noch eins" : `${cmpSel.length} Objekte gewählt`;
  $("cmpGo").disabled = cmpSel.length<2;
}
function renderCompare(){
  const items=cmpSel.map(id=>deals.find(d=>d._id===id)).filter(Boolean).map(d=>({d,c:calc(d,profile)}));
  const rows=[
    ["Deal-Score", x=>x.c.score?.total??NaN, v=>isFinite(v)?String(v):"–", 1],
    ["Kaufpreis", x=>x.c.kp, eur, -1],
    ["Kaufpreisfaktor", x=>x.c.faktor, v=>isFinite(v)?nf1.format(v):"–", -1],
    ["Bruttomietrendite", x=>x.c.brutto, v=>pct(v,2), 1],
    ["CF n. St. / Monat", x=>x.c.rLauf.cfNach/12, eurS, 1],
    ["Steuer / Monat", x=>x.c.rLauf.st/12, eurS, 1],
    ["Eigenkapital", x=>x.c.ek, eur, -1],
    ["EK-Rendite", x=>x.c.ekRendite, v=>pct(v), 1],
    [`Vermögen nach ${items[0]?.c.jahre??10} J.`, x=>x.c.rows[x.c.rows.length-1].netto, eurS, 1],
  ];
  $("cmpTable").innerHTML=`<tr><th></th>${items.map(x=>{const t=x.d.titel||"Ohne Titel";return `<th title="${esc(t)}">${esc(t.length>26?t.slice(0,24)+"…":t)}</th>`;}).join("")}</tr>`+
    rows.map(([l,f,fmt,dir])=>{
      const vals=items.map(f), fin=vals.filter(isFinite);
      const best=fin.length>1?(dir>0?Math.max(...fin):Math.min(...fin)):NaN;
      return `<tr><td>${l}</td>${vals.map(v=>`<td class="${v===best?"best":""}">${fmt(v)}</td>`).join("")}</tr>`;
    }).join("");
}

/* ---------- Ansichten ---------- */
function setView(v){
  ["calc","analyse","strat","deals","profile"].forEach(k=>{ $("view-"+k).hidden = k!==v; $("tab-"+k).setAttribute("aria-selected", k===v); });
  window.scrollTo(0,0); updateCmpBar();
  if (v==="strat"){ drawWealth=true; render(); }
}

/* ---------- Toast ---------- */
let toastT;
function toast(t){ const el=$("toast"); el.textContent=t; el.classList.add("show"); clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove("show"),2200); }

/* ---------- Import: Scan-Animation ---------- */
function setStatus(t,err){ const s=$("status"); s.textContent=t; s.className="status"+(err?" err":""); }
function stepState(i,state){ const el=$("st"+i); el.classList.remove("active","ok"); if(state) el.classList.add(state); }
function scanStart(hasLink){
  const sc=$("scan"); sc.hidden=false; sc.classList.remove("done");
  [1,2,3].forEach(i=>stepState(i,null));
  $("st1").querySelector("span").textContent = hasLink ? "Exposé abrufen" : "Unterlagen lesen";
  stepState(1,"active");
  return setTimeout(()=>{ stepState(1,"ok"); stepState(2,"active"); }, hasLink?2600:1200);
}
const wait = ms => new Promise(r=>setTimeout(r, RM?0:ms));
async function scanFinish(timer){
  clearTimeout(timer);
  stepState(1,"ok"); stepState(2,"ok"); stepState(3,"active");
  await wait(650);
  stepState(3,"ok"); $("scan").classList.add("done");
  await wait(500);
  $("scan").hidden=true;
}
function scanFail(timer){ clearTimeout(timer); $("scan").hidden=true; }
/* Ergebnis nach Import mit Animation aufbauen */
function revealDeal(d, notes){
  deal=d; currentId=null; resetScen(); drawWealth=true;
  // Anzeige auf null setzen, damit alles sichtbar „einläuft“
  $("ringArc").style.strokeDashoffset=314.16; $("scoreNum")._v=0;
  ["k_cfn","k_st","k_cfv","k_br","k_nr","k_ek"].forEach(id=>{ $(id)._v=0; });
  $("subs").innerHTML=""; $("wf").innerHTML="";
  $("importNotes").innerHTML=notes.map(t=>`<li>${esc(t)}</li>`).join(""); $("importNotes").hidden=!notes.length;
  $("btnToAnalyse").hidden=!d.analyse;
  render();
  OBJ.forEach((f,i)=>{ const w=$("w_o_"+f.k); if(!w||d[f.k]===""||d[f.k]==null) return;
    w.classList.remove("flash"); void w.offsetWidth; w.style.setProperty("animation-delay","");
    const inp=w.querySelector("input,select"); if(inp) inp.style.animationDelay=(i*70)+"ms";
    w.classList.add("flash"); setTimeout(()=>w.classList.remove("flash"),1600+i*70); });
  $("resultCard").scrollIntoView({behavior:RM?"auto":"smooth",block:"start"});
}

/* ---------- Claude: Exposé lesen, analysieren, Markt prüfen ---------- */
const N = t => ({type:[t,"null"]});
const obj = (props) => ({type:"object", additionalProperties:false, required:Object.keys(props), properties:props});
const SCHEMA = obj({
  titel:{type:"string",description:"Kurz, z. B. '3-Zimmer-Wohnung, Köln-Ehrenfeld'"},
  adresse:{...N("string"),description:"Straße, PLZ, Ort und Stadtteil, soweit genannt"},
  objektart:{type:"string",enum:["wohnung","haus","mehrfamilienhaus","unklar"]},
  kaufpreis:{...N("number"),description:"Euro"},
  wohnflaeche:{...N("number"),description:"m²"},
  zimmer:N("number"),
  baujahr:N("integer"),
  kaltmiete:{...N("number"),description:"Aktuelle Netto-Kaltmiete €/Monat, falls vermietet"},
  kaltmiete_schaetzung:{...N("number"),description:"Nur wenn kaltmiete null: realistische Marktmiete €/Monat"},
  hausgeld_nicht_umlagefaehig:{...N("number"),description:"€/Monat"},
  ruecklage:{...N("number"),description:"Instandhaltungsrücklage €/Monat"},
  maklerprovision_prozent:{...N("number"),description:"Käuferanteil inkl. MwSt., 0 wenn provisionsfrei"},
  bundesland:{...N("string"),description:"Kürzel: "+Object.keys(BLN).join(", ")},
  quelle_gelesen:{type:"boolean"},
  hinweise:{type:"array",items:{type:"string"},description:"Max. 3 kurze Punkte zu Annahmen beim Auslesen"},
  details:obj({etage:N("string"),zustand:N("string"),heizung:N("string"),energie_kennwert:{...N("number"),description:"kWh/(m²·a)"},energieklasse:N("string"),
    modernisierungen:N("string"),vermietet:N("boolean"),wohneinheiten:N("integer"),ausstattung:{type:"array",items:{type:"string"}},erbbaurecht:N("boolean"),denkmalschutz:N("boolean")}),
  markt:obj({kaufpreis_qm_von:N("number"),kaufpreis_qm_bis:N("number"),miete_qm_von:N("number"),miete_qm_bis:N("number"),
    preis_urteil:{type:"string",enum:["günstig","marktüblich","teuer","unklar"]},
    miete_urteil:{type:"string",enum:["unter Markt","marktüblich","über Markt","unklar"]},
    mietpreisbremse:N("boolean"),begruendung:{type:"string"}}),
  lage:obj({makro_note:{...N("integer"),description:"1 schwach bis 5 sehr gut"},makro_text:{type:"string"},mikro_note:{...N("integer"),description:"1 schwach bis 5 sehr gut"},mikro_text:{type:"string"},
    plus:{type:"array",items:{type:"string"}},minus:{type:"array",items:{type:"string"}}}),
  risiken:{type:"array",items:obj({titel:{type:"string"},schwere:{type:"string",enum:["hoch","mittel","niedrig"]},text:{type:"string"}})},
  fragen:{type:"array",items:{type:"string"},description:"5–8 konkrete Fragen an den Makler"},
  sanierung:{type:"array",items:obj({bauteil:{type:"string",enum:RENO_KEYS},grund:{type:"string"}})}
});
function buildPrompt(link,text,hasFiles){
  return `Du bist erfahrener Immobilien-Analyst in Deutschland und prüfst ein Kauf-Exposé für einen Kapitalanleger.${link?`

Exposé-Link: ${link}
Rufe diesen Link mit dem web_fetch-Werkzeug ab. Wenn die Seite blockiert ist oder keinen Exposé-Inhalt liefert, nutze nur die übrigen Quellen.`:""}${text?`

Eingefügter Exposé-Text:
${text.slice(0,80000)}`:""}${hasFiles?`

Die angehängten Bilder bzw. PDFs sind Screenshots oder Unterlagen dieses Exposés.`:""}

Aufgaben:
1. Lies das Exposé vollständig und übernimm alle Fakten genau. Erfinde nichts: Was nicht im Exposé steht, ist null. Einzige Ausnahme: kaltmiete_schaetzung, wenn keine Ist-Miete genannt ist. Ist nur das Gesamt-Hausgeld bekannt, setze für den nicht umlagefähigen Teil etwa 40 % davon an und nenne das in hinweise.
2. markt: Gib aus deinem Wissen realistische Spannen für Angebotspreise (€/m²) vergleichbarer Bestandsobjekte (Baujahr, Zustand, Lage) und für die ortsübliche Kaltmiete bei Neuvermietung (€/m²) an. Sei vorsichtig: Wenn du die Lage nicht sicher kennst, setze die Spannen auf null und das Urteil auf "unklar". mietpreisbremse nur true/false, wenn du dir sicher bist, sonst null. Begründe in 2–3 Sätzen.
3. lage: Bewerte Makrolage (Stadt/Region: Bevölkerung, Wirtschaft, Nachfrage) und Mikrolage (Viertel: ÖPNV, Nahversorgung, Image, Lärm) jeweils 1–5. Ohne genaue Lageangabe: null und das im Text sagen.
4. risiken: die wichtigsten Risiken für einen Vermieter (z. B. Sanierungsstau, Energieklasse, Sonderumlagen, Erbbaurecht, Nießbrauch, Leerstand, Miete über Markt, kleine WEG, Denkmalschutz). Schwere ehrlich einstufen.
5. sanierung: nur Bauteile, für die das Exposé oder die Fotos konkreten Erneuerungsbedarf erkennen lassen (z. B. Originalbad, alte Fenster, alte Heizung). Leere Liste, wenn nichts erkennbar ist.
6. fragen: konkrete Fragen an den Makler, die für die Kaufentscheidung fehlen.
Leite das Bundesland aus Ort oder PLZ ab. Schreibe alle Texte auf Deutsch, sachlich und knapp. Liegt kein Exposé-Inhalt vor, setze quelle_gelesen auf false.`;
}
function apiHeaders(isHaiku){
  const h = {"content-type":"application/json","x-api-key":keyOf(),"anthropic-version":"2026-10-21","anthropic-dangerous-direct-browser-access":"true"};
  if (!isHaiku) h["anthropic-beta"]="server-side-fallback-2026-07-01";
  return h;
}
/** Führt eine Anfrage aus und setzt sie bei "pause_turn" fort. Gibt die letzte Antwort zurück. */
async function apiRun(body){
  const model=LS.get("er_model")||"claude-opus-5-5", isHaiku=model.startsWith("claude-haiku");
  body={...body, model};
  if (!isHaiku) body.fallbacks="default";
  body.tools=(body.tools||[]).map(t=>({...t, type: isHaiku ? t.type.replace("_20260209", t.name==="web_fetch"?"_20250910":"_20250305") : t.type}));
  for (let round=0; round<5; round++){
    const res = await fetch(API_URL,{method:"POST",headers:apiHeaders(isHaiku),body:JSON.stringify(body)});
    if (!res.ok){
      let msg=""; try { msg=(await res.json()).error?.message||""; } catch(e){}
      throw {status:res.status, message:msg};
    }
    const msg = await res.json();
    if (msg.stop_reason==="refusal") throw {status:"refusal"};
    if (msg.stop_reason==="pause_turn"){ body.messages=[...body.messages,{role:"assistant",content:msg.content}]; continue; }
    if (msg.stop_reason==="max_tokens") throw {status:"max_tokens"};
    return msg;
  }
  throw {status:"rounds"};
}
async function callClaude(content){
  const msg = await apiRun({
    max_tokens:16000,
    output_config:{effort:"medium", format:{type:"json_schema", schema:SCHEMA}},
    tools:[{type:"web_fetch_20260209", name:"web_fetch", max_uses:3}],
    messages:[{role:"user", content}]
  });
  const texts = msg.content.filter(b=>b.type==="text").map(b=>b.text);
  try { return JSON.parse(texts[texts.length-1]||""); } catch(e){ throw {status:"json"}; }
}
function errText(e, ctx){
  const m = {
    401:"Dein API-Schlüssel wird abgelehnt. Tippe im Profil bei „Claude-Verbindung“ auf „Ändern“.",
    403:"Der API-Schlüssel hat keine Berechtigung. Prüfe ihn in der Anthropic-Konsole.",
    429:"Zu viele Anfragen oder Ausgabenlimit erreicht. Versuche es gleich noch einmal oder prüfe dein Limit in der Konsole.",
    413:"Die Anhänge sind zu groß. Nimm weniger Screenshots.",
    529:"Claude ist gerade überlastet. Versuche es in einer Minute erneut.",
    credit:"Dein Guthaben bei Anthropic ist aufgebraucht. Lade es in der Konsole unter „Plans & Billing“ auf.",
    refusal:"Claude hat diese Anfrage abgelehnt.",
    json:"Die Antwort ließ sich nicht auswerten. Versuche es erneut.",
    max_tokens:"Die Antwort war zu lang. Nimm weniger Anhänge.",
    rounds:"Das hat zu lange gedauert. Versuche es erneut."
  };
  if (e && (e.status===401||e.status===403)){ LS.set("er_key_ok",false); renderKey(false); }
  if (e && e.status===400 && /credit|balance/i.test(e.message||"")) return m.credit;
  if (e && e.status===400 && ctx==="market" && /web.?search/i.test(e.message||"")) return "Die Websuche ist für deinen API-Schlüssel nicht freigeschaltet. Aktiviere sie in der Anthropic-Konsole in den Einstellungen deiner Organisation.";
  if (m[e && e.status]) return m[e.status];
  if (e && e.status===400) return "Anfrage abgelehnt: "+(e.message||"unbekannter Fehler");
  if (e instanceof TypeError) return PREVIEW ? "In dieser Vorschau kann die App Claude nicht erreichen. Tippe auf „Beispiel ansehen“." : "Keine Verbindung zu Claude. Prüfe das Internet.";
  return "Das hat nicht geklappt. Versuche es erneut.";
}
function cleanAnalyse(x){
  const arr = v => Array.isArray(v) ? v.filter(s=>typeof s==="string"&&s.trim()).map(String) : [];
  const note = v => { const n=Math.round(num(v)); return n>=1&&n<=5 ? n : null; };
  const d=x.details||{}, m=x.markt||{}, l=x.lage||{};
  return {
    objektart: ["wohnung","haus","mehrfamilienhaus"].includes(x.objektart) ? x.objektart : "unklar",
    details:{...d, ausstattung:arr(d.ausstattung)},
    markt:{kaufpreis_qm_von:num(m.kaufpreis_qm_von)||null,kaufpreis_qm_bis:num(m.kaufpreis_qm_bis)||null,miete_qm_von:num(m.miete_qm_von)||null,miete_qm_bis:num(m.miete_qm_bis)||null,
      preis_urteil:m.preis_urteil||"unklar",miete_urteil:m.miete_urteil||"unklar",mietpreisbremse:typeof m.mietpreisbremse==="boolean"?m.mietpreisbremse:null,begruendung:String(m.begruendung||""),stand:"wissen"},
    lage:{makro_note:note(l.makro_note),makro_text:String(l.makro_text||""),mikro_note:note(l.mikro_note),mikro_text:String(l.mikro_text||""),plus:arr(l.plus),minus:arr(l.minus)},
    risiken:(Array.isArray(x.risiken)?x.risiken:[]).filter(r=>r&&r.titel).map(r=>({titel:String(r.titel),schwere:["hoch","mittel","niedrig"].includes(r.schwere)?r.schwere:"mittel",text:String(r.text||"")})),
    fragen:arr(x.fragen).slice(0,10),
    sanierung:(Array.isArray(x.sanierung)?x.sanierung:[]).filter(s=>s&&RENO_KEYS.includes(s.bauteil)).map(s=>({bauteil:s.bauteil,grund:String(s.grund||"")}))
  };
}
const b64ToBlob = (b64,type) => { const bin=atob(b64), u=new Uint8Array(bin.length); for (let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); return new Blob([u],{type}); };
let sampleFn=null;
async function runImportArtifact(link,text,btn){
  const imgs=attachments.filter(a=>a.type==="image");
  if (attachments.some(a=>a.type==="pdf")) { setStatus("PDFs kann diese Version nicht lesen. Mach Screenshots der wichtigen Seiten und lade sie hoch.",true); btn.disabled=false; return; }
  if (!text && !imgs.length){ setStatus("Diese Version öffnet keine Webseiten. Mach 2–3 Screenshots vom Exposé oder kopiere den Exposé-Text hinein. Das ist auch der rechtlich sichere Weg.",true); btn.disabled=false; $("moreSrc")&&($("moreSrc").open=true); return; }
  sampleFn = sampleFn || await window.claude.use("sample");
  if (!sampleFn){ setStatus("Claude ist in dieser Ansicht nicht verfügbar. Öffne die App in der Claude-App oder auf claude.ai.",true); btn.disabled=false; return; }
  const timer=scanStart(false);
  const prompt = buildPrompt(null,text,imgs.length>0) + "\n\nAntworte ausschließlich mit einem JSON-Objekt genau nach diesem JSON-Schema (alle Felder angeben, unbekannte Werte null):\n" + JSON.stringify(SCHEMA);
  try {
    let lim=null; try { lim=await sampleFn.limits(); } catch(e){}
    const maxImg = lim&&lim.images ? lim.images.maxCount : 0;
    const opts = imgs.length && maxImg ? { images: imgs.slice(0,maxImg).map(a=>b64ToBlob(a.data,"image/jpeg")) } : {};
    if (imgs.length && !maxImg && !text){ scanFail(timer); setStatus("Bilder werden in dieser Ansicht nicht unterstützt. Kopiere bitte den Exposé-Text hinein.",true); return; }
    const x = await sampleFn.json(prompt, opts);
    if (!x || typeof x!=="object") throw {status:"json"};
    await finishImport(x, link, text, timer);
  } catch(e){
    scanFail(timer);
    const m={not_granted:"Du hast der App die Nutzung von Claude nicht erlaubt. Lade die Seite neu, um erneut gefragt zu werden.",rate_limited:"Gerade zu viele Anfragen oder dein Nutzungslimit ist erreicht. Versuche es später erneut.",invalid_json:"Die Antwort ließ sich nicht auswerten. Versuche es erneut.",image_rejected:"Ein Bild konnte nicht gelesen werden. Nimm PNG oder JPG.",prompt_too_large:"Der Text ist zu lang. Kopiere nur den Exposé-Bereich.",refused:"Claude hat diese Anfrage abgelehnt."};
    setStatus(m[e&&e.code]||"Das Auslesen ist fehlgeschlagen. Versuche es erneut.",true);
  } finally { btn.disabled=false; }
}
async function finishImport(x, link, text, timer){
  const n = v => { const k=num(v); return isNaN(k)?"":k; };
  const d = {...DEAL_EMPTY, link,
    titel:x.titel||"", adresse:x.adresse||"", kp:n(x.kaufpreis), flaeche:n(x.wohnflaeche), zimmer:n(x.zimmer), baujahr:n(x.baujahr),
    miete: n(x.kaltmiete)!=="" ? n(x.kaltmiete) : n(x.kaltmiete_schaetzung),
    hg_nu:n(x.hausgeld_nicht_umlagefaehig), ruecklage:n(x.ruecklage), makler:n(x.maklerprovision_prozent),
    bl: BLN[String(x.bundesland||"").toUpperCase()] ? String(x.bundesland).toUpperCase() : ""};
  if (d.kp===""){
    scanFail(timer);
    setStatus(link&&!text&&!attachments.length
      ? "Das Portal lässt den Abruf nicht zu. Mach 2–3 Screenshots vom Exposé und füge sie über „Screenshots / PDF“ hinzu."
      : "Im Exposé wurde kein Kaufpreis gefunden. Ergänze die Werte unten von Hand.", true);
    return;
  }
  d.analyse = cleanAnalyse(x);
  d.reno = {...renoDefault(d), mode: d.analyse.objektart==="haus"||d.analyse.objektart==="mehrfamilienhaus" ? "haus" : "wohnung"};
  if (d.reno.mode==="haus") d.instand = 12;   // Haus: Dach, Fassade, Technik selbst tragen (kein Hausgeld)
  await scanFinish(timer);
  const notes=[];
  if (num(x.kaltmiete)>0) notes.push("Ist-Miete aus dem Exposé übernommen.");
  else if (num(x.kaltmiete_schaetzung)>0) notes.push(`Miete ist eine Schätzung von Claude (${eur(num(x.kaltmiete_schaetzung))}). Bitte prüfen.`);
  (Array.isArray(x.hinweise)?x.hinweise:[]).slice(0,3).forEach(h=>notes.push(String(h)));
  const hi=d.analyse.risiken.filter(r=>r.schwere==="hoch").length;
  if (hi) notes.push(`${hi} Risiko${hi>1?"s":""} mit hoher Schwere gefunden. Details unter „Analyse“.`);
  revealDeal(d,notes);
}

/* ---------- Kostenloser Exposé-Leser: wertet kopierten Text direkt auf dem Gerät aus ---------- */
const CITY_BL = {berlin:"BE",hamburg:"HH",bremen:"HB",bremerhaven:"HB",münchen:"BY",muenchen:"BY",nürnberg:"BY",nuernberg:"BY",augsburg:"BY",regensburg:"BY",würzburg:"BY",ingolstadt:"BY",
  köln:"NW",koeln:"NW",düsseldorf:"NW",duesseldorf:"NW",dortmund:"NW",essen:"NW",duisburg:"NW",bochum:"NW",wuppertal:"NW",bielefeld:"NW",bonn:"NW",münster:"NW",gelsenkirchen:"NW",mönchengladbach:"NW",aachen:"NW",krefeld:"NW",oberhausen:"NW",hagen:"NW",hamm:"NW",
  frankfurt:"HE",wiesbaden:"HE",kassel:"HE",darmstadt:"HE",offenbach:"HE",stuttgart:"BW",karlsruhe:"BW",mannheim:"BW",freiburg:"BW",heidelberg:"BW",ulm:"BW",heilbronn:"BW",pforzheim:"BW",
  leipzig:"SN",dresden:"SN",chemnitz:"SN",zwickau:"SN",hannover:"NI",braunschweig:"NI",oldenburg:"NI",osnabrück:"NI",wolfsburg:"NI",göttingen:"NI",magdeburg:"ST",halle:"ST",
  erfurt:"TH",jena:"TH",gera:"TH",weimar:"TH",potsdam:"BB",cottbus:"BB",rostock:"MV",schwerin:"MV",kiel:"SH",lübeck:"SH",flensburg:"SH",mainz:"RP",ludwigshafen:"RP",koblenz:"RP",trier:"RP",saarbrücken:"SL"};
function parseExpose(raw){
  const t = raw.replace(/ /g," ").replace(/[ \t]+/g," ");
  const N = "(\\d{1,3}(?:\\.\\d{3})+(?:,\\d+)?|\\d+(?:,\\d+)?)";
  const grab = (labels, gap=40, unit="") => {
    for (const l of labels){
      const m = t.match(new RegExp("(?:"+l+")[^\\d\\n]{0,"+gap+"}\\n?[^\\d\\n]{0,"+gap+"}"+N+"\\s*"+unit, "i"));
      if (m){ const v=num(m[1]); if (isFinite(v)) return {v, ctx:t.slice(m.index, m.index+m[0].length+30)}; }
    }
    return null;
  };
  const r = {}; const found=[]; const notes=[];
  // Kaufpreis
  let kp = grab(["Kaufpreis","Preis"],30);
  if (!kp || kp.v<10000){ const all=[...t.matchAll(new RegExp(N+"\\s*(?:€|EUR|Euro)","gi"))].map(m=>num(m[1])).filter(v=>v>=20000&&v<=50000000); if (all.length) kp={v:Math.max(...all)}; }
  if (kp && kp.v>=10000) { r.kp=kp.v; found.push("Kaufpreis"); }
  const wf = grab(["Wohnfläche","Wohnflaeche","Wfl\\.?"],25,"m");
  if (wf && wf.v>5 && wf.v<5000){ r.flaeche=wf.v; found.push("Wohnfläche"); }
  let zi = grab(["Zimmer(?:anzahl)?"],15);
  if (!zi || !(zi.v>0 && zi.v<50)){ const m=t.match(/(\d+(?:,5)?)\s*[- ]?(?:Zimmer|Zi\.)/i); zi = m ? {v:num(m[1])} : null; }
  if (zi && zi.v>0 && zi.v<50){ r.zimmer=zi.v; found.push("Zimmer"); }
  const bj = t.match(/(?:Baujahr|Bj\.?)[^\d\n]{0,15}((?:1[6-9]|20)\d\d)/i);
  if (bj){ r.baujahr=+bj[1]; found.push("Baujahr"); }
  // Miete (monatlich; Jahreswerte werden umgerechnet)
  const mi = grab(["Nettokaltmiete","Kaltmiete","Ist-?Miete","Mieteinnahmen","Mietertrag","Miete \\(kalt\\)","Netto-?Miete"],40);
  if (mi && mi.v>0){
    let v=mi.v; const yearly=/p\.\s?a\.|jährlich|jaehrlich|pro Jahr|im Jahr|Jahres/i.test(mi.ctx||"") || v>8000;
    if (yearly) v=Math.round(v/12);
    if (v>50 && v<100000){ r.miete=v; found.push(yearly?"Miete (aus Jahreswert)":"Miete"); }
  }
  // Hausgeld
  const nu = grab(["nicht umlagef(?:ä|ae)hig(?:es)?(?: Hausgeld)?","nicht umlegbar"],30);
  const hg = grab(["Hausgeld","Wohngeld \\(WEG\\)"],30);
  if (nu && nu.v>0 && nu.v<5000){ r.hg_nu=nu.v; found.push("Hausgeld nicht umlagefähig"); }
  else if (hg && hg.v>0 && hg.v<5000){ r.hg_nu=Math.round(hg.v*0.4); found.push("Hausgeld"); notes.push(`Nur das Gesamt-Hausgeld (${eur(hg.v)}) gefunden: 40 % davon als nicht umlagefähig angesetzt. Bitte prüfen.`); }
  const rl = grab(["Instandhaltungsr(?:ü|ue)cklage","R(?:ü|ue)cklage"],30);
  if (rl && rl.v>0 && rl.v<2000){ r.ruecklage=rl.v; found.push("Rücklage"); }
  // Provision
  if (/provisionsfrei|keine (?:Käufer)?provision|provision\s*:?\s*(?:entfällt|keine)/i.test(t)){ r.makler=0; found.push("provisionsfrei"); }
  else { const pv=t.match(/(?:Provision|Courtage|Käuferprovision)[^%\n]{0,120}?(\d+(?:,\d+)?)\s*%/i); if (pv){ const v=num(pv[1]); if (v>=0&&v<=10){ r.makler=v; found.push("Provision"); } } }
  // Lage, Bundesland, Titel
  const lines = raw.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const adr = lines.find(x=>/\b\d{5}\s+[A-ZÄÖÜ][\wäöüß\-]+/.test(x) && x.length<=140);
  if (adr){ r.adresse=adr.replace(/\s+/g," "); found.push("Adresse"); }
  for (const [code,name] of Object.entries(BLN)) if (new RegExp("\\b"+name+"\\b","i").test(t)) { r.bl=code; break; }
  if (!r.bl){ const low=t.toLowerCase(); for (const [c,code] of Object.entries(CITY_BL)) if (new RegExp("(^|[^a-zäöüß])"+c+"([^a-zäöüß]|$)").test(low)) { r.bl=code; break; } }
  if (r.bl) found.push("Bundesland");
  r.titel = (lines.find(x=>/wohnung|haus|apartment|maisonette|penthouse|loft|zimmer/i.test(x) && x.length<=120 && !/€|m²/.test(x)) || lines[0] || "").slice(0,120);
  return {r, found, notes};
}
async function runLocalImport(link, text){
  if (!text){
    setStatus(attachments.length
      ? "Ohne KI kann die App keine Bilder lesen. Kostenloser Weg: Screenshot in Fotos öffnen, lange auf den Text tippen, „Alles auswählen“ → „Kopieren“ und hier unter „Text einfügen“ einsetzen."
      : "Kostenloser Modus: Kopiere den Exposé-Text (Strg/Cmd + A, C oder in Fotos per Live Text) und füge ihn über „Text einfügen“ ein. Links öffnet die App nur mit KI.", true);
    $("exText").hidden=false; return;
  }
  const {r, found, notes} = parseExpose(text);
  if (!r.kp && !r.miete && !r.flaeche){ setStatus("Im Text wurden keine Zahlen zu Kaufpreis, Fläche oder Miete gefunden. Trag die Werte unten von Hand ein.", true); return; }
  const btn=$("btnImport"); btn.disabled=true; $("importNotes").hidden=true; $("btnToAnalyse").hidden=true; setStatus("");
  const timer=scanStart(false);
  await wait(900);
  await scanFinish(timer);
  const d={...DEAL_EMPTY, link, titel:r.titel||"", adresse:r.adresse||"", kp:r.kp??"", flaeche:r.flaeche??"", zimmer:r.zimmer??"", baujahr:r.baujahr??"", miete:r.miete??"", hg_nu:r.hg_nu??"", ruecklage:r.ruecklage??"", makler:r.makler??"", bl:r.bl||""};
  d.reno=renoDefault(d);
  const miss=["Kaufpreis","Wohnfläche","Miete"].filter((k,i)=>[r.kp,r.flaeche,r.miete][i]===undefined);
  const out=[`Kostenlos ausgelesen: ${found.join(", ")}.`, ...notes];
  if (miss.length) out.push(`Nicht gefunden: ${miss.join(", ")}. Bitte unten ergänzen.`);
  out.push("Alle Werte bitte kurz mit dem Exposé abgleichen.");
  revealDeal(d, out);
  btn.disabled=false;
}
async function runImport(){
  let link=$("link").value.trim(); const text=$("exText").value.trim();
  if (link && !/^https?:\/\//i.test(link)) link="https://"+link;
  if (!link && !text && !attachments.length){ setStatus(keyOf() ? "Füge einen Link ein oder wähle Screenshots bzw. ein PDF aus. Oder tippe auf „Beispiel ansehen“." : "Füge den Exposé-Text ein (siehe Anleitung oben) oder trag die Werte unten von Hand ein.",true); return; }
  if (!keyOf()) return runLocalImport(link, text);
  if (!navigator.onLine){ setStatus("Keine Internetverbindung. Werte kannst du unten von Hand eintragen.",true); return; }
  const btn=$("btnImport"); btn.disabled=true; $("importNotes").hidden=true; $("btnToAnalyse").hidden=true; setStatus("");
  if (ART){ return runImportArtifact(link,text,btn); }
  const timer=scanStart(!!link);
  const content=[];
  for (const a of attachments){
    if (a.type==="pdf") content.push({type:"document",source:{type:"base64",media_type:"application/pdf",data:a.data}});
    else content.push({type:"image",source:{type:"base64",media_type:"image/jpeg",data:a.data}});
  }
  content.push({type:"text",text:buildPrompt(link,text,attachments.length>0)});
  try {
    const x = await callClaude(content);
    await finishImport(x, link, text, timer);
  } catch(e){
    scanFail(timer);
    setStatus(errText(e,"import"),true);
  } finally { btn.disabled=false; }
}
/** Sucht in einem Text von hinten das letzte gültige JSON-Objekt mit dem erwarteten Feld */
function lastJson(str, key){
  const end=str.lastIndexOf("}");
  for (let i=str.lastIndexOf("{"); i>=0; i=i>0?str.lastIndexOf("{",i-1):-1){
    try { const o=JSON.parse(str.slice(i,end+1)); if (o && typeof o==="object" && key in o) return o; } catch(e){}
    if (i===0) break;
  }
  return null;
}
async function runMarketCheck(){
  const st=$("marketStatus"), btn=$("btnMarket");
  if (!keyOf()){ st.textContent = PREVIEW ? "In der Vorschau ist keine Websuche möglich." : "Der Marktcheck nutzt die optionale KI-Analyse (Profil → Claude-Verbindung)."; st.className="status err"; return; }
  const c=calc(deal,profile), a=deal.analyse||{};
  btn.disabled=true; st.textContent="Claude recherchiert aktuelle Marktdaten …"; st.className="status";
  const prompt=`Recherchiere mit der Websuche aktuelle Marktdaten für diese Immobilie in Deutschland:
Lage: ${deal.adresse||deal.titel||"unbekannt"}
Objektart: ${a.objektart||"wohnung"}, Wohnfläche ${num(deal.flaeche)||"?"} m², Baujahr ${num(deal.baujahr)||"?"}, Zustand: ${(a.details&&a.details.zustand)||"unbekannt"}
Angebotspreis: ${eur(c.kp)} (${isFinite(c.qm)?nf0.format(c.qm)+" €/m²":"?"}), Kaltmiete: ${eur(c.miete)} (${isFinite(c.mqm)?nf2.format(c.mqm)+" €/m²":"?"})

Suche nach: Kaufpreisen pro m² für vergleichbare Bestandsobjekte im Ort bzw. Stadtteil, dem aktuellen Mietspiegel oder Angebotsmieten pro m², und ob dort die Mietpreisbremse gilt. Bevorzuge seriöse Quellen (Mietspiegel der Stadt, Gutachterausschuss, große Marktberichte).
Antworte am Ende ausschließlich mit einem JSON-Objekt ohne weiteren Text, genau in dieser Form:
{"kaufpreis_qm_von": Zahl oder null, "kaufpreis_qm_bis": Zahl oder null, "miete_qm_von": Zahl oder null, "miete_qm_bis": Zahl oder null, "preis_urteil": "günstig"|"marktüblich"|"teuer"|"unklar", "miete_urteil": "unter Markt"|"marktüblich"|"über Markt"|"unklar", "mietpreisbremse": true|false|null, "begruendung": "2–3 Sätze auf Deutsch", "quellen": [{"titel": "...", "url": "https://..."}]}`;
  try {
    const msg = await apiRun({max_tokens:16000, output_config:{effort:"low"},
      tools:[{type:"web_search_20260209", name:"web_search", max_uses:5}],
      messages:[{role:"user", content:prompt}]});
    const texts = msg.content.filter(b=>b.type==="text");
    const o = lastJson(texts.map(b=>b.text).join(""), "kaufpreis_qm_von");
    if (!o) throw {status:"json"};
    let quellen = Array.isArray(o.quellen) ? o.quellen.filter(q=>q&&/^https?:\/\//.test(q.url||"")).map(q=>({titel:String(q.titel||""),url:q.url})) : [];
    if (!quellen.length){
      const seen=new Set();
      texts.forEach(b=>(b.citations||[]).forEach(ci=>{ if (ci.url && !seen.has(ci.url)){ seen.add(ci.url); quellen.push({titel:String(ci.title||""),url:ci.url}); } }));
    }
    const cleaned = cleanAnalyse({markt:o}).markt;
    deal.analyse = {...(deal.analyse||cleanAnalyse({})), markt:{...cleaned, stand:"web", datum:new Date().toLocaleDateString("de-DE"), quellen:quellen.slice(0,8)}};
    edited(); render(); toast("Marktdaten aktualisiert ✓");
  } catch(e){
    const s2=$("marketStatus"); if (s2){ s2.textContent=errText(e,"market"); s2.className="status err"; }
  } finally { const b2=$("btnMarket"); if (b2) b2.disabled=false; }
}
async function runDemo(){
  const btn=$("btnDemo"); btn.disabled=true; $("importNotes").hidden=true; $("btnToAnalyse").hidden=true; setStatus("");
  $("link").value="https://www.beispiel-portal.de/expose/demo-dortmund";
  const timer=scanStart(true);
  await wait(3600);
  await scanFinish(timer);
  const d={...DEAL_EMPTY,...DEMO.deal, analyse:JSON.parse(JSON.stringify(DEMO.analyse))};
  d.reno=renoDefault(d);
  revealDeal(d, DEMO.notes);
  btn.disabled=false;
}

/* ---------- Anhänge ---------- */
function renderChips(){
  $("chips").innerHTML = attachments.map((a,i)=>`<span class="chip">${esc(a.name)}<button aria-label="Entfernen" data-rm="${i}">×</button></span>`).join("");
}
function shrinkImage(file){
  return new Promise((res,rej)=>{
    const url=URL.createObjectURL(file), img=new Image();
    img.onload=()=>{ const max=1600, s=Math.min(1,max/Math.max(img.width,img.height));
      const cv=document.createElement("canvas"); cv.width=Math.round(img.width*s); cv.height=Math.round(img.height*s);
      cv.getContext("2d").drawImage(img,0,0,cv.width,cv.height); URL.revokeObjectURL(url);
      res(cv.toDataURL("image/jpeg",0.85).split(",")[1]); };
    img.onerror=()=>{ URL.revokeObjectURL(url); rej(new Error("Bild nicht lesbar")); };
    img.src=url;
  });
}
const fileToB64 = f => new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(String(r.result).split(",")[1]); r.onerror=rej; r.readAsDataURL(f); });

/* ---------- Onboarding ---------- */
const ICONS = {
  scan:`<svg viewBox="0 0 24 24"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/></svg>`,
  tax:`<svg viewBox="0 0 24 24"><path d="M5 19L19 5"/><circle cx="7" cy="7" r="2"/><circle cx="17" cy="17" r="2"/></svg>`,
  slide:`<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>`
};
let onbStep=0;
function openOnb(){ onbStep=0; $("onb").hidden=false; drawOnb(); }
function closeOnb(){ $("onb").hidden=true; LS.set("er_onboarded",true); }
function drawOnb(){
  let html="";
  if (onbStep===0) html=`<div class="slide"><h2>Willkommen beim Exposé-Rechner</h2>
    <div class="feat"><i>${ICONS.scan}</i><span><b>Link rein, Analyse raus.</b><br>Claude liest das Exposé, bewertet Lage, Markt und Risiken und füllt alle Werte aus.</span></div>
    <div class="feat"><i>${ICONS.tax}</i><span><b>Dein Steuervorteil, exakt.</b><br>Gerechnet mit deinem Einkommen nach dem Tarif 2026.</span></div>
    <div class="feat"><i>${ICONS.slide}</i><span><b>Verhandeln, sanieren, planen.</b><br>Zielpreis, Renovierungsrechner und eine Strategie über bis zu 40 Jahre.</span></div>
    <button class="btn primary block" data-onb="next">Los geht's</button><button class="btn ghost block" data-onb="skip">Überspringen</button></div>`;
  if (onbStep===1) html=`<div class="slide"><h2>Dein Einkommen</h2>
    <p class="note">Daraus berechne ich, wie viel Steuern du mit jeder Immobilie sparst. Die Angabe bleibt auf deinem Gerät.</p>
    <div class="f"><label for="onbZve"><span>Zu versteuerndes Einkommen</span><em>€/Jahr</em></label><input id="onbZve" class="num" inputmode="decimal" type="text" value="${esc(show(profile.zve))}"></div>
    <div class="fields"><div class="f"><label for="onbVer">Veranlagung</label><select id="onbVer"><option value="einzel">Einzeln</option><option value="zusammen">Zusammen</option></select></div>
    <div class="f"><label for="onbKi">Kirchensteuer</label><select id="onbKi"><option value="0">keine</option><option value="8">8 %</option><option value="9">9 %</option></select></div></div>
    <div><p class="note" style="text-align:center">Dein Grenzsteuersatz</p><div class="big" id="onbG">–</div><p class="note" style="text-align:center" id="onbE"></p></div>
    <button class="btn primary block" data-onb="next">Weiter</button></div>`;
  if (onbStep===2) html= (keyOf()||PREVIEW) ? "" : `<div class="slide"><h2>KI-Analyse (optional)</h2>
    <p class="note"><b>Die App ist kostenlos nutzbar.</b> Kopierten Exposé-Text liest sie direkt auf deinem iPhone aus. Wer zusätzlich Screenshots, PDFs, Lage und Risiken per KI auswerten lassen möchte, kann hier einen eigenen API-Schlüssel hinterlegen (wenige Cent pro Exposé).</p>
    <p class="note">Damit die App Exposés auslesen kann, brauchst du einmalig einen persönlichen API-Schlüssel von <a href="https://console.anthropic.com" target="_blank" rel="noopener">console.anthropic.com</a>. Setz dort am besten ein Ausgabenlimit von z. B. 5 $ im Monat. Eine Anleitung findest du später auch im Profil.</p>
    <div class="f"><label for="onbKey">API-Schlüssel</label><input id="onbKey" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="sk-ant-…"></div>
    <span class="status" id="onbKeySt"></span>
    <button class="btn primary block" data-onb="key">Speichern &amp; testen</button><button class="btn ghost block" data-onb="next">Später</button></div>`;
  if (onbStep===2 && !html){ onbStep=3; }
  if (onbStep===3) html=`<div class="slide"><h2>Alles bereit</h2>
    <p class="note">Dein Profil ist gespeichert${keyOf()?" und Claude ist verbunden":""}. Füge jetzt einen Exposé-Link ein oder sieh dir zuerst ein Beispiel an.</p>
    <button class="btn primary block" data-onb="demo">Beispiel ansehen</button><button class="btn block" data-onb="done">Eigenes Exposé einlesen</button></div>`;
  const dots=`<div class="dots">${[0,1,2,3].map(i=>`<i class="${i===onbStep?"on":""}"></i>`).join("")}</div>`;
  $("sheet").innerHTML=dots+html;
  if (onbStep===1){
    $("onbVer").value=profile.veranl; $("onbKi").value=String(profile.kist);
    const upd=()=>{ const p={...profile,zve:$("onbZve").value,veranl:$("onbVer").value,kist:$("onbKi").value,grenz:""};
      tween($("onbG"),grenzsatz(p),v=>pct(v));
      $("onbE").textContent=`Je 1.000 € Verlust aus Vermietung sparst du ${eur(steuerWirkung(-1000,p))}.`; };
    ["onbZve","onbVer","onbKi"].forEach(id=>$(id).addEventListener("input",upd)); $("onbVer").addEventListener("change",upd); $("onbKi").addEventListener("change",upd);
    $("onbG")._v=0; upd();
  }
}
$("sheet").addEventListener("click",e=>{
  const b=e.target.closest("[data-onb]"); if(!b) return;
  const a=b.dataset.onb;
  if (a==="skip"){ closeOnb(); return; }
  if (a==="next"){
    if (onbStep===1){
      profile.zve=$("onbZve").value; profile.veranl=$("onbVer").value; profile.kist=$("onbKi").value;
      delete profile._example; LS.set("er_profile",profile); render(); renderDeals();
    }
    onbStep++; drawOnb(); return;
  }
  if (a==="key"){ b.disabled=true; saveKey($("onbKey").value,$("onbKeySt")).then(ok=>{ b.disabled=false; if(ok){ renderKey(false); onbStep++; drawOnb(); } }); return; }
  if (a==="demo"){ closeOnb(); setView("calc"); runDemo(); return; }
  if (a==="done"){ closeOnb(); setView("calc"); $("link").focus(); }
});

/* ---------- Ereignisse ---------- */
document.querySelector(".tabbar").addEventListener("click",e=>{ const b=e.target.closest("[data-view]"); if(b) setView(b.dataset.view); });
$("btnImport").addEventListener("click",runImport);
$("btnToAnalyse").addEventListener("click",()=>setView("analyse"));
$("s_jahre").addEventListener("input",e=>{ profile.jahre=+e.target.value; setRange(e.target,profile.jahre); if(!profile._example) LS.set("er_profile",profile); render(); });
document.addEventListener("click",e=>{ if (e.target.closest("#goAssume")){ e.preventDefault(); setView("profile"); setTimeout(()=>$("fDef").scrollIntoView({behavior:RM?"auto":"smooth",block:"start"}),60); } });
renoEvents(); analyseEvents();
$("btnDemo").addEventListener("click",runDemo);
$("chips").addEventListener("click",e=>{ const b=e.target.closest("[data-rm]"); if(b){ attachments.splice(+b.dataset.rm,1); renderChips(); } });
$("btnText").addEventListener("click",()=>{ const t=$("exText"); t.hidden=!t.hidden; if(!t.hidden) t.focus(); });
$("btnPaste").addEventListener("click",async()=>{
  try { const t=(await navigator.clipboard.readText()).trim();
    const m=t.match(/https?:\/\/\S+/); if(m) $("link").value=m[0]; else if(t){ $("exText").hidden=false; $("exText").value=t; }
  } catch(e){ $("link").focus(); setStatus("Tippe lange auf das Feld und wähle „Einfügen“."); }
});
$("files").addEventListener("change",async e=>{
  for (const f of e.target.files){
    if (attachments.length>=8) break;
    try {
      if (f.type==="application/pdf"){ if (f.size>25e6){ setStatus("PDF ist zu groß (max. 25 MB).",true); continue; }
        attachments.push({name:f.name,type:"pdf",data:await fileToB64(f)}); }
      else if (f.type.startsWith("image/")) attachments.push({name:f.name||"Foto",type:"image",data:await shrinkImage(f)});
    } catch(err){ setStatus(`„${f.name}“ konnte nicht gelesen werden.`,true); }
  }
  e.target.value=""; renderChips();
});
// Wasserfall-Tooltip
$("wf").addEventListener("pointerover",wfTip); $("wf").addEventListener("pointerdown",wfTip);
$("wf").addEventListener("pointerleave",()=>$("wfTip").hidden=true);
// Vermögens-Chart
$("wSvg").addEventListener("pointermove",wMove); $("wSvg").addEventListener("pointerdown",wMove);
$("wSvg").addEventListener("pointerleave",wLeave);
// Szenario
$("s_kp").addEventListener("input",e=>{ scen.kp=+e.target.value; setRange(e.target,scen.kp); render(); });
$("s_miete").addEventListener("input",e=>{ scen.miete=+e.target.value; setRange(e.target,scen.miete); render(); });
$("s_zins").addEventListener("input",e=>{ scen.zins=+e.target.value; setRange(e.target,scen.zins); render(); });
$("s_ek").addEventListener("input",e=>{ scen.ek=+e.target.value; setRange(e.target,scen.ek); render(); });
$("scenReset").addEventListener("click",()=>{ resetScen(); render(); });
$("scenApply").addEventListener("click",()=>{
  const d=effDeal();
  deal={...deal, kp:Math.round(num(d.kp)||0), miete:Math.round(num(d.miete)||0), zins:scen.zins??deal.zins, ek:scen.ek??deal.ek};
  delete deal._example; resetScen(); render(); toast("Szenario übernommen");
});
$("target").addEventListener("click",e=>{ const b=e.target.closest("#tryZp"); if(!b) return; scen.kp=+b.dataset.p; render(); toast("Zielpreis im Szenario"); });
// Speichern / Neu
$("btnSave").addEventListener("click",()=>{
  const d={...deal}; delete d._example;
  d._id = currentId || ("d"+Date.now().toString(36));
  d._t = Date.now(); currentId=d._id; deal=d;
  const i=deals.findIndex(z=>z._id===d._id); if(i>=0) deals[i]=d; else deals.push(d);
  toast(LS.set("er_deals",deals) ? "Objekt gespeichert ✓" : "Speichern nicht möglich");
  renderDeals(); render();
});
$("btnNew").addEventListener("click",()=>{
  deal={...DEAL_EMPTY}; currentId=null; resetScen(); $("link").value=""; $("exText").value="";
  attachments=[]; renderChips(); setStatus(""); $("importNotes").hidden=true; render(); window.scrollTo(0,0);
});
// Objekte
$("dealList").addEventListener("click",e=>{
  const o=e.target.closest("[data-open]"), d=e.target.closest("[data-del]"), c=e.target.closest("[data-cmp]");
  if (o){ const x=deals.find(z=>z._id===o.dataset.open); if(x){ deal={...x}; currentId=x._id; resetScen(); drawWealth=true; setView("calc"); render(); } }
  if (c){ const id=c.dataset.cmp; if (cmpSel.includes(id)) cmpSel=cmpSel.filter(z=>z!==id); else { if(cmpSel.length>=3) cmpSel.shift(); cmpSel.push(id); } renderDeals(); }
  if (d){
    if (d.dataset.armed!=="1"){ d.dataset.armed="1"; d.textContent="Wirklich löschen?"; return; }
    deals=deals.filter(z=>z._id!==d.dataset.del); if(currentId===d.dataset.del) currentId=null;
    LS.set("er_deals",deals); renderDeals(); toast("Gelöscht");
  }
});
$("cmpGo").addEventListener("click",()=>{ if(cmpSel.length<2) return; renderCompare(); $("cmpCard").hidden=false; updateCmpBar(); window.scrollTo({top:0,behavior:RM?"auto":"smooth"}); });
$("cmpClose").addEventListener("click",()=>{ $("cmpCard").hidden=true; updateCmpBar(); });
// Profil, Schlüssel, Sicherung
$("btnProf").addEventListener("click",()=>{
  delete profile._example;
  toast(LS.set("er_profile",profile) ? "Profil gespeichert ✓" : "Speichern nicht möglich");
  render(); renderDeals();
});
/* ---------- Claude-Verbindung (persönlicher Schlüssel) ---------- */
const keyOf = () => ART ? "claude" : (LS.get("er_key")||"");
const mask = k => k.length>16 ? k.slice(0,10)+"••••••"+k.slice(-4) : "••••";
function renderKey(editing){
  const k=keyOf(), ok=LS.get("er_key_ok");
  const pill=$("keyPill"); pill.className="pill";
  if (!k){ pill.textContent="nicht verbunden"; pill.classList.add("warn"); }
  else if (ok===false){ pill.textContent="Schlüssel ungültig"; pill.classList.add("bad"); }
  else { pill.textContent="verbunden"; pill.classList.add("good"); }
  const edit = editing || !k;
  $("keyEdit").hidden=!edit; $("keyShow").hidden=edit;
  $("btnKeyCancel").hidden=!(editing && k);
  $("keyMask").textContent=mask(k);
  $("keyHowto").open = !k;
  $("keyHint").hidden = !!k;
}
/* Prüft den Schlüssel mit einer kostenlosen Abfrage der Modellliste */
async function testKey(k){
  try {
    const r=await fetch("https://api.anthropic.com/v1/models?limit=1",{headers:{
      "x-api-key":k,"anthropic-version":"2026-10-21","anthropic-dangerous-direct-browser-access":"true"}});
    if (r.ok) return "ok";
    if (r.status===401||r.status===403) return "invalid";
    return "unknown";
  } catch(e){ return "offline"; }
}
async function saveKey(raw, statusEl){
  const k=raw.trim();
  if (!/^sk-ant-[\w-]{20,}$/.test(k)){ statusEl.textContent="Das sieht nicht wie ein Claude-API-Schlüssel aus. Er beginnt mit „sk-ant-“."; statusEl.className="status err"; return false; }
  statusEl.textContent="Verbindung wird geprüft …"; statusEl.className="status";
  const res=await testKey(k);
  if (res==="invalid"){ statusEl.textContent="Anthropic lehnt diesen Schlüssel ab. Prüfe, ob er vollständig kopiert ist und noch aktiv ist."; statusEl.className="status err"; return false; }
  LS.set("er_key",k); LS.set("er_key_ok", res==="ok" ? true : null);
  statusEl.textContent = res==="ok" ? "Verbunden. Du kannst jetzt Exposés auslesen." : "Gespeichert. Die Verbindung konnte gerade nicht geprüft werden (offline?).";
  statusEl.className="status";
  return true;
}
$("model").value = LS.get("er_model")||"claude-opus-5-5";
$("model").addEventListener("change",()=>{ LS.set("er_model",$("model").value); toast("Modell gespeichert ✓"); });
$("btnKey").addEventListener("click",async()=>{
  const b=$("btnKey"); b.disabled=true;
  if (await saveKey($("apiKey").value,$("keyStatus"))){ $("apiKey").value=""; renderKey(false); toast("Claude verbunden ✓"); }
  else renderKey(true);
  b.disabled=false;
});
$("btnKeyCancel").addEventListener("click",()=>{ $("apiKey").value=""; $("keyStatus").textContent=""; renderKey(false); });
$("btnKeyChange").addEventListener("click",()=>{ renderKey(true); $("apiKey").focus(); });
$("btnKeyTest").addEventListener("click",async()=>{
  const st=$("keyStatus"); st.textContent="Verbindung wird geprüft …"; st.className="status";
  const res=await testKey(keyOf());
  LS.set("er_key_ok", res==="ok"?true:res==="invalid"?false:null);
  st.textContent={ok:"Alles in Ordnung, die Verbindung steht.",invalid:"Der Schlüssel wird abgelehnt. Lege in der Konsole einen neuen an und tippe auf „Ändern“.",offline:"Keine Verbindung zu Anthropic. Prüfe das Internet.",unknown:"Anthropic antwortet gerade nicht. Versuche es später erneut."}[res];
  st.className="status"+(res==="ok"?"":" err"); renderKey(false);
});
$("btnKeyDel").addEventListener("click",e=>{
  const b=e.currentTarget;
  if (b.dataset.armed!=="1"){ b.dataset.armed="1"; b.textContent="Wirklich?"; setTimeout(()=>{ b.dataset.armed=""; b.textContent="Entfernen"; },3000); return; }
  try { localStorage.removeItem("er_key"); localStorage.removeItem("er_key_ok"); } catch(err){}
  b.dataset.armed=""; b.textContent="Entfernen"; $("keyStatus").textContent="Schlüssel von diesem Gerät entfernt."; renderKey(false); toast("Schlüssel entfernt");
});
$("btnGoKey").addEventListener("click",()=>{ setView("profile"); setTimeout(()=>{ $("keyCard").scrollIntoView({behavior:RM?"auto":"smooth",block:"start"}); $("apiKey").focus({preventScroll:true}); },60); });
$("btnExport").addEventListener("click",async()=>{
  const data=JSON.stringify({v:1,profile,deals});
  const ta=$("backup"); ta.hidden=false; ta.value=data;
  try { await navigator.clipboard.writeText(data); $("bkStatus").textContent="In die Zwischenablage kopiert."; }
  catch(e){ ta.select(); $("bkStatus").textContent="Text markiert – bitte kopieren."; }
});
$("btnImportBk").addEventListener("click",()=>{
  const ta=$("backup");
  if (ta.hidden||!ta.value.trim()){ ta.hidden=false; ta.value=""; ta.focus(); $("bkStatus").textContent="Sicherung einfügen und erneut tippen."; return; }
  try {
    const x=JSON.parse(ta.value);
    if (x.profile) profile={...PROFILE_DEFAULT,...x.profile,_example:false};
    if (Array.isArray(x.deals)) deals=x.deals;
    LS.set("er_profile",profile); LS.set("er_deals",deals);
    $("bkStatus").textContent=`Eingespielt: Profil und ${deals.length} Objekte.`; render(); renderDeals();
  } catch(e){ $("bkStatus").textContent="Das ist keine gültige Sicherung."; }
});
$("btnOnb").addEventListener("click",openOnb);
$("hideInstall").addEventListener("click",()=>{ $("installHint").hidden=true; LS.set("er_hideInstall",true); });

/* ---------- Start ---------- */
const edited = () => { if (deal._example) delete deal._example; };
buildFields($("fObj"),OBJ,"o_",()=>deal,()=>{ edited(); render(); });
buildFields($("fFin"),FIN,"d_",()=>deal,()=>{ edited(); render(); });
buildFields($("fTax"),TAX,"p_",()=>profile,()=>{ render(); renderDeals(); });
buildFields($("fDef"),DEF,"q_",()=>profile,()=>{ render(); renderDeals(); });
// Erster Aufbau: Ring und Balken laufen sichtbar ein
$("scoreNum")._v=0; ["k_cfn","k_st","k_cfv","k_br","k_nr","k_ek"].forEach(id=>{ $(id)._v=0; });
render(); renderDeals(); renderKey(false);
if (PREVIEW||ART) $("keyHint").hidden=true;
if (ART){
  $("keyCard").hidden=true;
  $("importHint").textContent="Lade 2–3 Screenshots hoch oder füge den Exposé-Text ein. Der Link wird nur als Notiz gespeichert, Webseiten öffnet diese Version nicht.";
  $("bkHint").textContent="Profil und Objekte werden privat in deinem Claude-Konto gespeichert und sind auf allen Geräten verfügbar. Die Sicherung ist zusätzlich möglich.";
  cloud.init().then(ok=>{ render(); renderDeals(); if (ok) toast("Mit deinem Claude-Konto verbunden ✓"); });
} else if (!keyOf()) {
  $("exText").hidden=false;
  $("importHint").innerHTML="So geht's kostenlos: Im Exposé den Text markieren und kopieren, dann oben einfügen. Bei Screenshots: Bild in <b>Fotos</b> öffnen, lange auf den Text tippen, „Alles auswählen“ → „Kopieren“.";
} else {
  $("importHint").textContent="Tipp: Screenshots oder kopierter Text sind zuverlässiger und rechtlich sauberer als der automatische Abruf von Portalseiten.";
}

const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
if (!PREVIEW && !ART && !standalone && /iPhone|iPad/.test(navigator.userAgent) && !LS.get("er_hideInstall")) $("installHint").hidden=false;
if (!LS.get("er_onboarded")) openOnb();
if (!PREVIEW && !ART && "serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
