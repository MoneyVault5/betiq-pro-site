// NFL scoreboard preview — not a sportsbook settlement feed.
const root = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const dashboard = document.getElementById('view-dashboard');
if (dashboard) {
 const panel = document.createElement('div');
 panel.className='panel';
 panel.style.marginBottom='18px';
 panel.innerHTML='<h3>🏈 NFL Live Game Results</h3><p class="small muted">Public scoreboard preview. Player prop settlement is not yet automated.</p><button type="button" class="btn secondary" id="nfl-refresh">Refresh games</button><p class="small muted" id="nfl-message">Waiting for results…</p><div id="nfl-games"></div>';
 dashboard.insertBefore(panel, dashboard.querySelector('.grid') || dashboard.firstChild);
 const btn=panel.querySelector('#nfl-refresh'), message=panel.querySelector('#nfl-message'), out=panel.querySelector('#nfl-games');
 const escapeText=s=>String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
 async function refresh(){
  btn.disabled=true; message.textContent='Fetching games…';
  try{
   const d=new Date(), day=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('');
   const r=await fetch(root+'/scoreboard?dates='+day,{cache:'no-store'});
   if(!r.ok)throw Error('HTTP '+r.status);
   const json=await r.json();
   const games=json.events||[];
   out.innerHTML=games.length?games.map(g=>{
    const c=g.competitions?.[0],teams=c?.competitors||[];
    return '<div class="ticket"><strong>'+teams.map(t=>escapeText(t.team?.abbreviation)+' '+escapeText(t.score??'—')).join(' · ')+'</strong><div class="small muted">'+escapeText(g.status?.type?.shortDetail||'Scheduled')+'</div></div>';
   }).join(''):'<p class="small muted">No NFL games listed for today.</p>';
   message.textContent='Updated '+new Date().toLocaleTimeString()+' · ESPN scoreboard, not official settlement';
  }catch(e){message.textContent='Scoreboard unavailable ('+e.message+'). No bets changed.';}
  finally{btn.disabled=false;}
 }
 btn.addEventListener('click',refresh);
 refresh();
}
