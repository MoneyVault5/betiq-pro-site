/* Bet Lab: read-only visual shell. No write access to ticket or cloud data. */
(function () {
  "use strict";
  const STORAGE_KEY = "betlab_clean_real_bets_v1";
  const $ = id => document.getElementById(id);
  const money = amount => (amount < 0 ? "−" : "+") + "$" + Math.abs(amount).toLocaleString("en-US", {minimumFractionDigits:2,maximumFractionDigits:2});
  const towers = [42,65,49,79,53,72,92,64,82,58,88,56,76,43];
  let queued = false;

  function createHero(hero) {
    if (hero.querySelector(".vibe-hero-art")) return;
    const art = document.createElement("div");
    art.className = "vibe-hero-art";
    art.setAttribute("aria-hidden", "true");
    function skyline(side) {
      const div = document.createElement("div");
      div.className = "vibe-skyline " + side;
      for (const n of towers) {
        const span = document.createElement("span");
        span.className = "vibe-tower";
        span.style.setProperty("--tower-h", n + "%");
        div.appendChild(span);
      }
      return div;
    }
    art.append(skyline("left"),skyline("right"));
    const glow = document.createElement("div");glow.className="vibe-flame-sheen";art.appendChild(glow);
    const flask = document.createElement("div");
    flask.className = "vibe-flask";
    flask.innerHTML = '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><defs><linearGradient id="vibe-flask-rim" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#00e5ff"/><stop offset="1" stop-color="#ff2ea6"/></linearGradient><linearGradient id="vibe-flask-liquid" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffb300"/><stop offset="1" stop-color="#ff5e00"/></linearGradient></defs><path d="M20 5h8M24 5v9.2c0 1-.3 1.9-.9 2.7L10.6 38.1A3.4 3.4 0 0 0 13.5 43h21a3.4 3.4 0 0 0 2.9-4.9L24.9 16.9c-.6-.8-.9-1.7-.9-2.7V5Z" stroke="url(#vibe-flask-rim)" stroke-width="2.6" stroke-linejoin="round"/><path d="M15.4 33.5h17.2l3.1 5.5a1.7 1.7 0 0 1-1.5 2.5H13.8a1.7 1.7 0 0 1-1.5-2.5l3.1-5.5Z" fill="url(#vibe-flask-liquid)" opacity=".92"/><circle cx="20.5" cy="37.6" r="1.7" fill="#ffe9b0"/><circle cx="27.8" cy="35.4" r="1.2" fill="#ffe9b0" opacity=".85"/></svg>';
    art.appendChild(flask);
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", "vibe-flame-ribbons");
    svg.setAttribute("viewBox", "0 0 1440 240");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.innerHTML = '<defs><linearGradient id="vibe-fire-a" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#00e5ff" stop-opacity="0"/><stop offset=".17" stop-color="#00e5ff"/><stop offset=".43" stop-color="#b537f2"/><stop offset=".65" stop-color="#ff2ea6"/><stop offset=".84" stop-color="#7b5cff"/><stop offset="1" stop-color="#ff2ea6" stop-opacity="0"/></linearGradient><linearGradient id="vibe-fire-b" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#ff2ea6" stop-opacity="0"/><stop offset=".3" stop-color="#ff8a00"/><stop offset=".5" stop-color="#ff2ea6"/><stop offset=".75" stop-color="#ffb300"/><stop offset="1" stop-color="#ff8a00" stop-opacity="0"/></linearGradient></defs><path d="M-50 112 C125 103 190 58 325 91 S550 137 697 90 S950 53 1090 101 S1326 94 1500 58" stroke="url(#vibe-fire-a)" stroke-width="3.5"/><path d="M-45 137 C135 98 220 113 356 78 S600 70 748 110 S1062 130 1222 90 S1402 97 1490 83" stroke="url(#vibe-fire-b)" stroke-width="2.5" opacity=".55"/><path d="M-50 154 C150 128 225 160 375 130 S605 109 760 133 S1015 92 1188 126 S1350 144 1490 103" stroke="url(#vibe-fire-a)" stroke-width="2" opacity=".28"/>';
    art.appendChild(svg);
    const brand = document.createElement("div");
    brand.className = "vibe-brand-block";
    const wordmark = document.createElement("div");
    wordmark.className = "vibe-wordmark";
    wordmark.textContent = "BET LAB";
    const sub = document.createElement("div");
    sub.className = "vibe-subtitle";
    sub.textContent = "POTENTIAL PLAYS  •  LIVE TRACKING  •  ANALYTICS";
    brand.append(wordmark,sub);
    art.appendChild(brand);
    hero.prepend(art);
  }
  function moveMetrics(dashboard) {
    if (dashboard.querySelector(".vibe-metrics")) return;
    const kpis = dashboard.querySelector(".kpis");
    const records = dashboard.querySelector(".record-breakdown");
    if (!kpis || !records) return;
    const cards = [
      records.querySelector(".record-breakdown-item.overall"),
      records.querySelector(".record-breakdown-item.pregame"),
      records.querySelector(".record-breakdown-item.live"),
      ...Array.from(kpis.querySelectorAll(":scope > .kpi"))
    ].filter(Boolean);
    const metrics = document.createElement("section");
    metrics.className = "vibe-metrics";
    metrics.setAttribute("aria-label","Live dashboard metrics");
    dashboard.insertBefore(metrics,kpis);
    for(const card of cards) metrics.appendChild(card);
    kpis.remove();
    records.remove();
  }
  function createPanel(cls,title,tag) {
    const panel = document.createElement("section");panel.className = "vibe-panel " + cls;
    const heading = document.createElement("div");heading.className="vibe-panel-heading";
    const h = document.createElement("h2");h.textContent=title;heading.appendChild(h);
    if(tag){const right=document.createElement("span");right.className="vibe-panel-tag";right.textContent=tag;heading.appendChild(right);}
    panel.appendChild(heading);return panel;
  }
  function createOverview(dashboard) {
    if (dashboard.querySelector(".vibe-panels")) return;
    const grid = dashboard.querySelector(".main-grid");
    if(!grid)return;
    const panels=document.createElement("div");panels.className="vibe-panels";
    const trend=createPanel("vibe-profit","✦  PROFIT TREND","SETTLED BETS");
    const graph=document.createElement("div");graph.id="vibeProfitGraph";graph.setAttribute("role","img");graph.setAttribute("aria-label","Profit trend from saved settled bets");
    trend.appendChild(graph);
    const breakdown=createPanel("vibe-breakdown","◉  WIN BREAKDOWN","YOUR RESULTS");
    const area=document.createElement("div");area.className="vibe-donut-area";
    const ring=document.createElement("div");ring.className="vibe-donut";ring.id="vibeDonut";
    const inner=document.createElement("div");inner.className="vibe-donut-inner";
    const rate=document.createElement("strong");rate.id="vibeRate";rate.textContent="—";
    const subtitle=document.createElement("small");subtitle.textContent="Win Rate";inner.append(rate,subtitle);ring.append(inner);
    const counts=document.createElement("div");counts.className="vibe-counts";
    for(const [key,label,emoji] of [["Wins","Wins","✓"],["Losses","Losses","×"],["Push","Void / Push","−"],["Total","Settled",""]]){
      const row=document.createElement("div"),labelEl=document.createElement("span"),value=document.createElement("strong");
      if(emoji){const span=document.createElement("b");span.textContent=emoji+" ";span.className=key==="Wins"?"vibe-win-icon":key==="Losses"?"vibe-loss-icon":"vibe-push-icon";labelEl.append(span);}
      labelEl.append(document.createTextNode(label));value.id="vibeCount"+key;value.textContent="0";row.append(labelEl,value);counts.appendChild(row);
    }
    area.append(ring,counts);breakdown.append(area);panels.append(trend,breakdown);
    dashboard.insertBefore(panels,grid);
    const right = dashboard.querySelector(".right-panels");
    if(right){
      const week=createPanel("vibe-weekly","▥  WEEKLY P&L","RECENT WEEKS");
      const plot=document.createElement("div");plot.id="vibeWeekChart";plot.className="vibe-weekly-chart";week.appendChild(plot);
      right.prepend(week);
    }
  }
  function readBets() {
    try {
      const data=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");
      return Array.isArray(data)?data.filter(b=>b&&typeof b==="object"):[];
    } catch {return [];}
  }
  function payout(b) {
    try { if(typeof payoutFor==="function"){const result=Number(payoutFor(b));if(Number.isFinite(result))return result;}}catch{}
    const p=Number(b.payout||0);if(p>0)return p;
    const stake=Number(b.stake||0),odds=Number(b.odds||0);
    return stake>0&&odds>0?stake*(1+odds/100):stake>0&&odds<0?stake*(1+100/Math.abs(odds)):0;
  }
  function pnl(b) { const stake=Number(b.stake||0);return b.status==="Won"?payout(b)-stake:-stake; }
  function chartTrend(settled){
    const root=$("vibeProfitGraph");if(!root)return;
    if(!settled.length){root.innerHTML='<div class="vibe-trend-zero">Settle a ticket to see your profit trend.</div>';return;}
    const values=[0];for(const bet of settled)values.push(values.at(-1)+pnl(bet));
    let low=Math.min(...values,0),high=Math.max(...values,0);
    if(high===low){high+=1;low-=1;}
    const w=800,h=220,px=38,py=18,plotW=w-px*2,plotH=h-py*2;
    const at=(n,i)=>[px+(i/Math.max(1,values.length-1))*plotW, h-py-(n-low)/(high-low)*plotH];
    const pts=values.map(at),path=pts.map(([x,y],i)=>(i?"L":"M")+x.toFixed(1)+" "+y.toFixed(1)).join(" ");
    const first=pts[0],last=pts[pts.length-1];const baseline=h-py;
    const area=path+" L "+last[0].toFixed(1)+" "+baseline+" L "+first[0].toFixed(1)+" "+baseline+" Z";
    const grid=[0,.25,.5,.75,1].map(p=>'<line x1="'+px+'" x2="'+(w-px)+'" y1="'+(py+p*plotH).toFixed(1)+'" y2="'+(py+p*plotH).toFixed(1)+'" stroke="#46589e4d" stroke-width="1"/>').join("");
    const endVal=values.at(-1);
    /* Neon Fusion hero chart: cyan→violet→magenta glowing gradient line, soft
       gradient area fill, dashed cyan zero baseline, glowing peak dot with
       a semantic callout chip (bright green positive / red negative). */
    const zeroY=at(0,0)[1];
    const peakIdx=values.indexOf(Math.max(...values));
    const peak=pts[peakIdx];
    const semColor=endVal>=0?"#39ff88":"#ff3b5c";
    const chipText=money(endVal)+" NET";
    const chipW=chipText.length*8.4+22, chipH=25;
    let chipX=Math.min(Math.max(peak[0]-chipW/2,px),w-px-chipW);
    let chipY=peak[1]-chipH-14; if(chipY<4)chipY=peak[1]+14;
    const chip='<g><rect x="'+chipX.toFixed(1)+'" y="'+chipY.toFixed(1)+'" width="'+chipW.toFixed(1)+'" height="'+chipH+'" rx="7" fill="rgba(4,6,20,.92)" stroke="#ff2ea6" stroke-width="1.2"/><text x="'+(chipX+chipW/2).toFixed(1)+'" y="'+(chipY+17).toFixed(1)+'" text-anchor="middle" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="13.5" font-weight="800" fill="'+semColor+'">'+chipText+'</text></g>';
    const peakDot='<circle cx="'+peak[0].toFixed(1)+'" cy="'+peak[1].toFixed(1)+'" r="11" fill="#ff2ea6" opacity=".32"/><circle cx="'+peak[0].toFixed(1)+'" cy="'+peak[1].toFixed(1)+'" r="5.2" fill="#fff0fa" stroke="#ffffff" stroke-width="1.6" vector-effect="non-scaling-stroke"/>';
    const lastDot=peakIdx===pts.length-1?"":'<circle cx="'+last[0].toFixed(1)+'" cy="'+last[1].toFixed(1)+'" r="4" fill="#00e5ff" stroke="#eafcff" stroke-width="1.3" vector-effect="non-scaling-stroke"/>';
    root.innerHTML='<svg class="vibe-trend-svg sf-chart-breathe" viewBox="0 0 800 220" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="sf-line-grad" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#00e5ff"/><stop offset=".52" stop-color="#b537f2"/><stop offset="1" stop-color="#ff2ea6"/></linearGradient><linearGradient id="sf-area-grad" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ff2ea6" stop-opacity=".30"/><stop offset=".55" stop-color="#b537f2" stop-opacity=".12"/><stop offset="1" stop-color="#00e5ff" stop-opacity="0"/></linearGradient></defs>'+grid+'<line x1="'+px+'" x2="'+(w-px)+'" y1="'+zeroY.toFixed(1)+'" y2="'+zeroY.toFixed(1)+'" stroke="#00e5ff" stroke-width="1.4" stroke-dasharray="7 6" opacity=".55"/><path d="'+area+'" fill="url(#sf-area-grad)"/><path d="'+path+'" fill="none" stroke="url(#sf-line-grad)" stroke-width="9" stroke-linejoin="round" stroke-linecap="round" opacity=".28" vector-effect="non-scaling-stroke"/><path d="'+path+'" fill="none" stroke="url(#sf-line-grad)" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>'+lastDot+peakDot+chip+'</svg>';
    const headline=root.previousElementSibling?.querySelector(".vibe-panel-tag");
    if(headline)headline.textContent=money(endVal)+" NET";
  }
  function updateBreakdown(bets) {
    const won=bets.filter(x=>x.status==="Won").length,lost=bets.filter(x=>x.status==="Lost").length;
    const push=bets.filter(x=>x.status==="Void"||x.status==="Push").length,total=won+lost,rate=total?won/total*100:0;
    if($("vibeRate"))$("vibeRate").textContent=total?rate.toFixed(1)+"%":"—";
    if($("vibeCountWins"))$("vibeCountWins").textContent=String(won);
    if($("vibeCountLosses"))$("vibeCountLosses").textContent=String(lost);
    if($("vibeCountPush"))$("vibeCountPush").textContent=String(push);
    if($("vibeCountTotal"))$("vibeCountTotal").textContent=String(total);
    if($("vibeDonut"))$("vibeDonut").style.background=total?"conic-gradient(#ff2ea6 0 "+rate+"%,#00e5ff "+rate+"% 100%)":"conic-gradient(#3a2b5e 0 50%,#274b63 50% 100%)";
  }
  function updateWeeks(settled){
    const root=$("vibeWeekChart");if(!root)return;
    root.replaceChildren();
    const groups=new Map();
    for(const b of settled){
      const raw=b.placedAt||b.createdAt||b.date||"";
      const d=new Date(raw);if(!Number.isFinite(d.getTime()))continue;
      const mon=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));
      mon.setUTCDate(mon.getUTCDate() - ((mon.getUTCDay()+6)%7));
      const key=mon.toISOString().slice(0,10);
      groups.set(key,(groups.get(key)||0)+pnl(b));
    }
    const recent=[...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0])).slice(-9);
    if(!recent.length){const empty=document.createElement("div");empty.className="vibe-trend-zero";empty.textContent="Weekly P&L appears after tickets settle.";root.append(empty);return;}
    const max=Math.max(...recent.map(x=>Math.abs(x[1])),1);
    recent.forEach(([date,value],i)=>{
      const column=document.createElement("div");column.className="vibe-week-column"+(i%3===2?" alt":"")+(value<0?" negative":"");
      const bar=document.createElement("b");bar.style.height=Math.max(4,Math.abs(value)/max*100)+"%";
      bar.title=date+": "+money(value);
      const label=document.createElement("small");const d=new Date(date+"T00:00:00Z");label.textContent=(d.getUTCMonth()+1)+"/"+d.getUTCDate();
      column.append(bar,label);root.appendChild(column);
    });
  }
  function update(){
    const data=readBets();
    const settled=data.filter(b=>b.status==="Won"||b.status==="Lost").sort((a,b)=>String(a.placedAt||"").localeCompare(String(b.placedAt||"")));
    chartTrend(settled);updateBreakdown(data);updateWeeks(settled);
  }
  function scheduleUpdate(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;update();});}
  function mount(){
    const dashboard=$("dashboard"),hero=document.querySelector(".hero");
    if(!dashboard||!hero||document.body.classList.contains("betlab-vibe"))return;
    try {
      createHero(hero);moveMetrics(dashboard);createOverview(dashboard);
      document.body.classList.add("betlab-vibe");
      document.body.dataset.design="neon-fusion-v1";
      update();
      document.addEventListener("betlab-board-rendered",scheduleUpdate);
      window.addEventListener("storage",event=>{if(event.key===STORAGE_KEY)scheduleUpdate();});
      const observed=$("kpiProfit");if(observed){new MutationObserver(scheduleUpdate).observe(observed,{characterData:true,childList:true,subtree:true});}
      window.setInterval(()=>{if(!document.hidden)scheduleUpdate();},15000);
    } catch (error) {
      console.error("Bet Lab visual shell could not initialize; tickets unchanged.",error);
      document.body.classList.remove("betlab-vibe");
    }
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount,{once:true});else mount();
})();