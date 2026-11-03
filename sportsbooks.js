/* Bet Lab LIVE — Sportsbooks hub (additive; loaded deferred after the app).
 * Ported from the preview build's betlab-enhance.js Sportsbooks work
 * (PREVIEW-03/05/06), adapted to the live app's own structure:
 * - Adds a "Sportsbooks" nav item (desktop #nav + #mobileNav) and a
 *   #sportsbooksPage section next to #workspace, shown via a window.go
 *   wrapper exactly the way the preview enhance wrapped go().
 * - Exactly 4 tiles: Polymarket, Kalshi, Novig, DraftKings.
 *   Polymarket + Kalshi tiles carry the API import panels (wired by
 *   polymarket-us.js and kalshi-import.js, loaded after this file).
 *   Novig has no account API to link and DraftKings is slip-upload only
 *   (a friend's tickets) — both route to the existing Slip Importer.
 * Nothing here touches the storage key, seed data, cloud sync, settling,
 * or any existing page. Minimal structural CSS for the new elements is
 * injected below so the hub lays out before any future restyle. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- minimal structural styles for the new hub ---------------- */
  function injectStyles() {
    if ($('blSportsbooksStyles')) return;
    var st = document.createElement('style');
    st.id = 'blSportsbooksStyles';
    st.textContent =
      '.bl-books-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px;margin:14px 0}' +
      '.bl-book-tile{border:1px solid #52758e;border-radius:12px;padding:14px;background:#132436}' +
      '.bl-book-tile h3{margin:2px 0 4px}' +
      '.bl-book-tile small{display:block;opacity:.78;margin:2px 0 8px}' +
      '.bl-book-tile .bl-open{font-weight:700}' +
      '.bl-book-tile .panel{margin-top:10px}' +
      '.bl-status{opacity:.85}';
    document.head.appendChild(st);
  }

  /* ---------------- page ---------------- */
  function buildPage() {
    if ($('sportsbooksPage')) return;
    var books = document.createElement('section');
    books.className = 'content-page'; books.id = 'sportsbooksPage'; books.hidden = true;
    books.innerHTML =
      '<h2 style="margin:6px 0">▣ Sportsbooks</h2>' +
      '<p class="notice">Jump straight into a book to place a bet, or link an account for automatic import. Bet Lab never places bets for you, and no book password is ever asked for here.</p>' +
      '<div class="bl-books-grid">' +

      '<div class="bl-book-tile" id="pmTile"><h3>◈ Polymarket</h3>' +
      '<small>One of your books · API import below</small>' +
      '<p><a class="bl-open" href="https://polymarket.us/" target="_blank" rel="noopener noreferrer">Open Polymarket ▸</a></p>' +
      '<div class="panel bl-module" id="pmusModule"><h3>◈ Polymarket US — API import</h3>' +
      '<p class="bl-status">Your Polymarket US app account connects through a read-only proxy: open positions are pulled straight into the tracker using your API Key ID. The Key ID (from polymarket.us/developer) is a public identifier — it is NOT your secret key, and the secret key must never be pasted into any web page. The Key ID stays in this browser only.</p>' +
      '<div class="fields"><label>Polymarket US API Key ID<input id="pmusKeyId" placeholder="Not set — paste your Key ID" autocomplete="off" spellcheck="false"></label></div>' +
      '<p><button class="primary" type="button" id="pmusSave">Save Key ID</button> <button class="primary" type="button" id="pmusImport">Import positions</button></p>' +
      '<p class="bl-status" id="pmusStatus">No Key ID saved yet, so nothing has been imported.</p>' +
      '<p class="bl-status" id="pmusBalance"></p></div></div>' +

      '<div class="bl-book-tile" id="kalshiTile"><h3>◈ Kalshi</h3>' +
      '<small>One of your books · API import below</small>' +
      '<p><a class="bl-open" href="https://kalshi.com/" target="_blank" rel="noopener noreferrer">Open Kalshi ▸</a></p>' +
      '<div class="panel bl-module" id="kalshiModule"><h3>◈ Kalshi — API import</h3>' +
      '<p class="bl-status">Your Kalshi account connects through a secure signer: requests are signed server-side with your RSA key, which never enters this page. Only your API Key ID — a public identifier — is kept, in this browser only. Open positions import as cash bets; settled history is not imported.</p>' +
      '<div class="fields"><label>Kalshi API Key ID<input id="kalshiKey" placeholder="Not set — paste your Key ID" autocomplete="off" spellcheck="false"></label></div>' +
      '<p><button class="primary" type="button" id="kalshiSave">Save Key ID</button> <button class="primary" type="button" id="kalshiImport">Import positions</button></p>' +
      '<p class="bl-status" id="kalshiStatus">No Key ID saved yet, so nothing has been imported.</p>' +
      '<p class="bl-status" id="kalshiBalance"></p></div></div>' +

      '<div class="bl-book-tile" id="novigTile"><h3>◈ Novig</h3>' +
      '<small>One of your books · slip-upload only (no API to link)</small>' +
      '<p class="bl-status">Novig offers no public API for account bets, so there is nothing to link. Your Novig tickets come in by slip photo — the importer reads stake, payout, legs and ticket ID automatically — or by share link.</p>' +
      '<p><a class="bl-open" href="https://novig.com/" target="_blank" rel="noopener noreferrer">Open Novig ▸</a></p>' +
      '<p><button class="primary" type="button" data-go="Slip Importer">Open Slip Importer</button></p></div>' +

      '<div class="bl-book-tile" id="dkTile"><h3>◈ DraftKings</h3>' +
      '<small>Slip-upload only — not a linked account (friend\'s tickets, upload-only)</small>' +
      '<p class="bl-status">DraftKings is not one of your betting accounts in Bet Lab — these are a friend\'s tickets, added from slip photos only. There is no account link and no automatic import.</p>' +
      '<p><button class="primary" type="button" data-go="Slip Importer">Upload a DraftKings slip</button></p></div>' +

      '</div>';
    var ws = $('workspace');
    if (ws && ws.parentNode) { ws.parentNode.insertBefore(books, ws.nextSibling); }
    else { (document.querySelector('main.main') || document.body).appendChild(books); }
  }

  /* ---------------- navigation ---------------- */
  function addNavButtons() {
    var nav = $('nav'), mobile = $('mobileNav');
    if (nav && ![...nav.querySelectorAll('button')].some(function (b) { return b.dataset.go === 'Sportsbooks'; })) {
      var b = document.createElement('button');
      b.innerHTML = '<span class="ico">▣</span>Sportsbooks';
      b.dataset.go = 'Sportsbooks';
      var tracker = [...nav.querySelectorAll('button')].find(function (x) { return x.dataset.go === 'Bet Tracker'; });
      if (tracker && tracker.nextSibling) nav.insertBefore(b, tracker.nextSibling); else nav.appendChild(b);
    }
    if (mobile && ![...mobile.querySelectorAll('button')].some(function (b) { return b.dataset.go === 'Sportsbooks'; })) {
      var m = document.createElement('button');
      m.textContent = 'Sportsbooks';
      m.dataset.go = 'Sportsbooks';
      var mt = [...mobile.querySelectorAll('button')].find(function (x) { return x.dataset.go === 'Bet Tracker'; });
      if (mt && mt.nextSibling) mobile.insertBefore(m, mt.nextSibling); else mobile.appendChild(m);
    }
  }

  function hideMine() { var el = $('sportsbooksPage'); if (el) { el.hidden = true; el.classList.remove('active'); } }
  function showMine() { hideMine(); var el = $('sportsbooksPage'); if (el) { el.hidden = false; el.classList.add('active'); } }

  function wireNav() {
    if (typeof window.go !== 'function') return;
    var origGo = window.go;
    window.go = function (name) {
      if (name === 'Sportsbooks') {
        origGo('Dashboard');
        var dash = $('dashboard'); if (dash) dash.classList.remove('active');
        document.querySelectorAll('[data-go]').forEach(function (x) { x.classList.toggle('active', x.dataset.go === 'Sportsbooks'); });
        showMine();
        window.scrollTo({ top: 0 });
        return;
      }
      hideMine();
      origGo(name);
    };
  }

  try { injectStyles(); } catch (e) { console.warn('Bet Lab: Sportsbooks styles skipped', e); }
  try { buildPage(); } catch (e) { console.warn('Bet Lab: Sportsbooks page build skipped', e); }
  try { addNavButtons(); } catch (e) { console.warn('Bet Lab: Sportsbooks nav skipped', e); }
  try { wireNav(); } catch (e) { console.warn('Bet Lab: Sportsbooks nav wiring skipped', e); }

  window.BetLabSportsbooks = { showPage: showMine, hidePage: hideMine };
})();
