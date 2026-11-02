/* Bet Lab cloud backup: additive sync, never deletes local or remote tickets. */
(async function(){
const status=document.createElement('div');status.id='betlab-cloud-status';status.style.cssText='position:fixed;bottom:14px;right:14px;z-index:99999;background:#101a31;color:#eaf4ff;border:1px solid #4ca9ef;border-radius:12px;padding:10px 14px;font:13px system-ui;max-width:290px;box-shadow:0 8px 30px #0008';
status.innerHTML='<span id="betlab-cloud-text">Cloud backup: sign in required</span> <button id="betlab-cloud-login" style="margin-left:8px;background:#1976da;color:white;border:0;border-radius:6px;padding:6px;cursor:pointer">Sign in</button>';document.body.append(status);
const label=document.getElementById('betlab-cloud-text'),btn=document.getElementById('betlab-cloud-login');
const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.79.0');
const client=createClient('https://shnnefxhunroluelghbv.supabase.co',"sb_publishable_RoFhq3z2j5rJQjUUrTEIkg_Gm4fkaG4",{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let user=null,queue=Promise.resolve(),synced=false;
function local(){try{return JSON.parse(localStorage.getItem('betlab_clean_real_bets_v1')||'[]')}catch{return []}}
function notice(t){label.textContent=t}
function signature(b){return [String(b.book||'').toLowerCase(),String(b.selection||'').toLowerCase(),String(b.game||'').toLowerCase(),Number(b.stake)||0,Number(b.payout)||0].join('|')}
async function sync(){
if(!user)return;
const localBets=local().filter(b=>b&&b.id);
const {data:remote,error}=await client.from('tickets').select('id,payload,updated_at').eq('user_id',user.id);
if(error)throw error;
const byId=new Map(remote.map(r=>[r.id,r.payload]));const bySignature=new Map(remote.map(r=>[signature(r.payload),r.id]));
let duplicates=0;const additions=[];
for(const b of localBets){
if(byId.has(b.id)){const prior=byId.get(b.id);if(JSON.stringify(prior)!==JSON.stringify(b)){const {error:e}=await client.from('tickets').upsert({id:String(b.id),user_id:user.id,payload:b,status:String(b.status||'Open'),placed_at:b.placedAt||null,updated_at:new Date().toISOString()},{onConflict:'id'});if(e)throw e}continue}
if(bySignature.has(signature(b))){duplicates++;continue}
const {error:e}=await client.from('tickets').upsert({id:String(b.id),user_id:user.id,payload:b,status:String(b.status||'Open'),placed_at:b.placedAt||null,updated_at:new Date().toISOString()},{onConflict:'id'});if(e)throw e;byId.set(b.id,b);bySignature.set(signature(b),b.id)
}
const existing=new Set(localBets.map(b=>b.id));const fingerprints=new Set(localBets.map(signature));
for(const r of remote){if(existing.has(r.id))continue;if(fingerprints.has(signature(r.payload))){duplicates++;continue}additions.push(r.payload);fingerprints.add(signature(r.payload))}
if(additions.length){const merged=[...localBets,...additions];localStorage.setItem('betlab_clean_real_bets_v1',JSON.stringify(merged));try{bets=merged;renderBets()}catch(e){console.warn('Dashboard refresh deferred',e)}}
synced=true;notice('Cloud saved · '+(remote.length+localBets.filter(b=>!byId.has(b.id)).length)+' records'+(duplicates?' · '+duplicates+' duplicate(s) skipped':''));
}
function schedule(){if(!user)return;queue=queue.then(sync).catch(e=>{notice('Cloud sync error — local records retained');console.error('Bet Lab cloud sync',e)})}
try{const original=persist;persist=function(){const ok=original();if(ok)schedule();return ok}}catch(e){console.warn('Could not hook ticket persistence',e)}
btn.onclick=async()=>{if(user){await client.auth.signOut();user=null;synced=false;btn.textContent='Sign in';notice('Cloud backup: sign in required');return}
const email=prompt('Enter your email for Bet Lab cloud backup:');if(!email)return;
const {error}=await client.auth.signInWithOtp({email:email.trim(),options:{shouldCreateUser:true,emailRedirectTo:location.origin+location.pathname}});if(error){notice('Sign-in failed: '+error.message);return}notice('Check your email for the Bet Lab sign-in link')};
client.auth.onAuthStateChange((_event,session)=>{user=session?.user||null;btn.textContent=user?'Sign out':'Sign in';if(user){notice('Cloud syncing…');setTimeout(schedule,0)}else notice('Cloud backup: sign in required')});
const {data:{session}}=await client.auth.getSession();user=session?.user||null;if(user){btn.textContent='Sign out';schedule()}
window.addEventListener('online',schedule);
})();
