/* Bet Lab cloud backup: additive sync, never deletes local or remote tickets. */
(async function(){
const status=document.createElement('div');status.id='betlab-cloud-status';status.style.cssText='position:fixed;bottom:14px;right:14px;z-index:99999;background:#101a31;color:#eaf4ff;border:1px solid #4ca9ef;border-radius:12px;padding:10px 14px;font:13px system-ui;max-width:300px;box-shadow:0 8px 30px #0008';
const btnStyle='margin-left:8px;background:#1976da;color:white;border:0;border-radius:6px;padding:6px;cursor:pointer';
const inputStyle='display:block;width:100%;box-sizing:border-box;margin:0 0 6px;padding:6px;border-radius:6px;border:1px solid #4ca9ef;background:#0b1425;color:#eaf4ff;font:13px system-ui';
const wideBtnStyle='display:block;width:100%;box-sizing:border-box;margin:0 0 6px;background:#1976da;color:white;border:0;border-radius:6px;padding:6px;cursor:pointer';
status.innerHTML='<span id="betlab-cloud-text">Cloud backup: sign in required</span> <button id="betlab-cloud-login" style="'+btnStyle+'">Sign in</button> <button id="betlab-cloud-setpw-btn" style="'+btnStyle+'" hidden>Set a password</button>'
+'<div id="betlab-cloud-signin" hidden style="margin-top:8px">'
+'<input id="betlab-cloud-email" type="email" autocomplete="email" placeholder="Email" style="'+inputStyle+'">'
+'<input id="betlab-cloud-password" type="password" autocomplete="current-password" placeholder="Password" style="'+inputStyle+'">'
+'<button id="betlab-cloud-pwlogin" style="'+wideBtnStyle+'">Sign in with password</button>'
+'<button id="betlab-cloud-magic" style="'+wideBtnStyle+'">Email me a sign-in link</button>'
+'</div>'
+'<div id="betlab-cloud-setpw" hidden style="margin-top:8px">'
+'<div style="color:#b8d4f5;margin-bottom:6px">Set a password once, then sign in with email + password instead of email links.</div>'
+'<input id="betlab-cloud-newpw" type="password" autocomplete="new-password" placeholder="New password" style="'+inputStyle+'">'
+'<button id="betlab-cloud-savepw" style="'+wideBtnStyle+'">Save password</button>'
+'</div>';document.body.append(status);
const label=document.getElementById('betlab-cloud-text'),btn=document.getElementById('betlab-cloud-login');
const setPwBtn=document.getElementById('betlab-cloud-setpw-btn'),signInBox=document.getElementById('betlab-cloud-signin'),emailInput=document.getElementById('betlab-cloud-email'),pwInput=document.getElementById('betlab-cloud-password'),pwLoginBtn=document.getElementById('betlab-cloud-pwlogin'),magicBtn=document.getElementById('betlab-cloud-magic'),setPwBox=document.getElementById('betlab-cloud-setpw'),newPwInput=document.getElementById('betlab-cloud-newpw'),savePwBtn=document.getElementById('betlab-cloud-savepw');
const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.79.0');
const client=createClient('https://shnnefxhunroluelghbv.supabase.co',"sb_publishable_RoFhq3z2j5rJQjUUrTEIkg_Gm4fkaG4",{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let user=null,queue=Promise.resolve(),synced=false;
function local(){try{return JSON.parse(localStorage.getItem('betlab_clean_real_bets_v1')||'[]')}catch{return []}}
function notice(t){label.textContent=t}
function renderAuth(){setPwBtn.hidden=!user;if(user){signInBox.hidden=true;setPwBox.hidden=true}else{setPwBox.hidden=true}}
function signature(b){return [String(b.book||'').toLowerCase(),String(b.selection||'').toLowerCase(),String(b.game||'').toLowerCase(),Number(b.stake)||0,Number(b.payout)||0].join('|')}
/* Merge arbitration: a result once recorded is never un-recorded by a stale
   copy. Settled (Won/Lost/Void) beats Open; if both sides are settled but
   differ, the newer payload.resultUpdatedAt wins; with no stamps on either
   side the cloud copy wins — unless the ticket was edited on this device
   during this session (tracked in sessionDirty). */
const SETTLED=new Set(['Won','Lost','Void']);
const sessionDirty=new Set();
function statusOf(b){return String((b&&b.status)||'Open')}
function stampMs(b){const v=b&&b.resultUpdatedAt;const ms=v?Date.parse(v):NaN;return Number.isFinite(ms)?ms:null}
function mergeTicket(l,r){
const ls=statusOf(l),rs=statusOf(r);
// An intentional cloud reset supersedes stale settled results on older devices.
const reset=Date.parse(r&&r.cloudResetAt||'');
const localEdit=stampMs(l);
if(Number.isFinite(reset)&&(!localEdit||reset>localEdit))return r;
if(ls===rs){
 const lt=stampMs(l),rt=stampMs(r);
 if(lt!==null&&rt!==null&&lt!==rt)return lt>rt?l:r;
 if(rt!==null&&(lt===null||rt>lt))return r;
 return l;
 }
const lSet=SETTLED.has(ls),rSet=SETTLED.has(rs);
if(lSet!==rSet)return lSet?l:r;
const lt=stampMs(l),rt=stampMs(r);
if(lt!==null&&rt!==null&&lt!==rt)return lt>rt?l:r;
if(lt!==null&&rt===null)return l;
if(rt!==null&&lt===null)return r;
if(sessionDirty.has(String(l.id)))return l;
return r;
}
let lastStatus=new Map();
function snapshotStatus(list){lastStatus=new Map();for(const b of list||[]){if(b&&b.id)lastStatus.set(String(b.id),statusOf(b))}}
function stampStatusChanges(){
const list=local();let changed=false;const now=new Date().toISOString();
for(const b of list){
if(!b||!b.id)continue;const id=String(b.id),st=statusOf(b),prev=lastStatus.get(id);
if(prev!==undefined&&prev!==st){b.resultUpdatedAt=now;sessionDirty.add(id);changed=true}
else if(prev===undefined&&SETTLED.has(st)&&!b.resultUpdatedAt){b.resultUpdatedAt=now;sessionDirty.add(id);changed=true}
}
if(changed){localStorage.setItem('betlab_clean_real_bets_v1',JSON.stringify(list));try{if(Array.isArray(bets)){const byId=new Map(list.map(x=>[String(x.id),x]));for(const g of bets){const s=g&&byId.get(String(g.id));if(s&&s.resultUpdatedAt)g.resultUpdatedAt=s.resultUpdatedAt}}}catch(e){}}
snapshotStatus(list);
}
snapshotStatus(local());
async function sync(){
if(!user)return;
/* Pull BEFORE push: fetch the cloud store first and merge it into the local
   store; the upserts below then write the merged winners, never the raw
   local snapshot, so a stale device copy cannot clobber newer cloud results. */
const localBets=local().filter(b=>b&&b.id);
const {data:remote,error}=await client.from('tickets').select('id,payload,updated_at').eq('user_id',user.id);
if(error)throw error;
const remoteById=new Map(remote.map(r=>[String(r.id),r.payload]));
const remoteBySig=new Map(remote.map(r=>[signature(r.payload),String(r.id)]));
const localIds=new Set(localBets.map(b=>String(b.id)));
let duplicates=0;const merged=[];const toUpsert=[];
for(const b of localBets){
const id=String(b.id);
if(remoteById.has(id)){const winner=mergeTicket(b,remoteById.get(id));merged.push(winner);if(JSON.stringify(winner)!==JSON.stringify(remoteById.get(id)))toUpsert.push(winner);continue}
if(remoteBySig.has(signature(b))){duplicates++;const remoteId=remoteBySig.get(signature(b));const cloud=remoteById.get(remoteId);merged.push(mergeTicket(b,cloud));continue}
merged.push(b);toUpsert.push(b);
}
const fingerprints=new Set(merged.map(signature));
for(const r of remote){
if(localIds.has(String(r.id)))continue;
if(fingerprints.has(signature(r.payload))){duplicates++;continue}
merged.push(r.payload);fingerprints.add(signature(r.payload));
}
if(JSON.stringify(merged)!==JSON.stringify(localBets)){localStorage.setItem('betlab_clean_real_bets_v1',JSON.stringify(merged));try{bets=merged;renderBets()}catch(e){console.warn('Dashboard refresh deferred',e)}}
snapshotStatus(merged);
for(const b of toUpsert){
const {error:e}=await client.from('tickets').upsert({id:String(b.id),user_id:user.id,payload:b,status:String(b.status||'Open'),placed_at:b.placedAt||null,updated_at:new Date().toISOString()},{onConflict:'id'});
if(e)throw e;
}
synced=true;notice('Cloud saved · '+merged.length+' records'+(duplicates?' · '+duplicates+' duplicate(s) skipped':''));
}
function schedule(){if(!user)return;queue=queue.then(sync).catch(e=>{notice('Cloud sync error — local records retained');console.error('Bet Lab cloud sync',e)})}
try{const original=persist;persist=function(){const ok=original();if(ok){try{stampStatusChanges()}catch(e){console.warn('Could not stamp result edits',e)}schedule()}return ok}}catch(e){console.warn('Could not hook ticket persistence',e)}
btn.onclick=async()=>{if(user){await client.auth.signOut();user=null;synced=false;btn.textContent='Sign in';notice('Cloud backup: sign in required');renderAuth();return}
signInBox.hidden=!signInBox.hidden;if(!signInBox.hidden)emailInput.focus()};
magicBtn.onclick=async()=>{const email=emailInput.value.trim();if(!email){notice('Enter your email first');return}
const {error}=await client.auth.signInWithOtp({email,options:{shouldCreateUser:true,emailRedirectTo:location.origin+location.pathname}});if(error){notice('Sign-in failed: '+error.message);return}notice('Check your email for the Bet Lab sign-in link')};
pwLoginBtn.onclick=async()=>{const email=emailInput.value.trim();const password=pwInput.value;if(!email||!password){notice('Enter your email and password');return}
pwInput.value='';const {error}=await client.auth.signInWithPassword({email,password});if(error){notice('Sign-in failed: '+error.message);return}notice('Signed in — cloud syncing…')};
setPwBtn.onclick=()=>{setPwBox.hidden=!setPwBox.hidden;if(!setPwBox.hidden)newPwInput.focus()};
savePwBtn.onclick=async()=>{const password=newPwInput.value;if(!password){notice('Enter a new password first');return}
newPwInput.value='';const {error}=await client.auth.updateUser({password});if(error){notice('Could not save password: '+error.message);return}
setPwBox.hidden=true;notice('Password saved — next time, sign in with email + password')};
client.auth.onAuthStateChange((_event,session)=>{user=session?.user||null;btn.textContent=user?'Sign out':'Sign in';renderAuth();if(user){notice('Cloud syncing…');setTimeout(schedule,0)}else notice('Cloud backup: sign in required')});
const {data:{session}}=await client.auth.getSession();user=session?.user||null;renderAuth();if(user){btn.textContent='Sign out';schedule()}
window.addEventListener('online',schedule);
})();
