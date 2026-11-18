import {useEffect,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {ShieldCheck,ArrowRight,LockKeyhole} from 'lucide-react';
import {api} from './api';
import {useApp,Spinner,ErrorNote} from './main';

export function OwnerSetup(){
 const {user,refresh,toast}=useApp(),navigate=useNavigate();
 const [token,setToken]=useState(()=>new URLSearchParams(window.location.hash.slice(1)).get('key')||'');
 const [ready,setReady]=useState(false),[checking,setChecking]=useState(!!token),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{
  if(!token)return;
  // Keep the private invitation out of the address bar and browser referrers.
  window.history.replaceState(window.history.state,'',window.location.pathname);
  let active=true;
  api('/auth/owner-setup',{headers:{Authorization:'Bearer '+token}}).then(()=>{if(active)setReady(true)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setChecking(false)});
  return()=>{active=false};
 },[token]);
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError('');
  const fields=Object.fromEntries(new FormData(event.currentTarget));
  try{
   await api('/auth/owner-setup',{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify({...fields,terms:fields.terms==='on'})});
   await refresh();navigate('/admin',{replace:true});toast('Your owner account is ready. Welcome to your admin panel.');
  }catch(e:any){setError(e.message)}finally{setBusy(false)}
 }
 if(checking)return <Spinner/>;
 if(!ready)return <div className="owner-setup container"><section className="panel"><span className="form-icon"><ShieldCheck size={29}/></span><h1>Your owner invitation.</h1><p>Enter the private one-time setup code shared with the website owner. It unlocks the form where you choose your own admin email and password.</p><ErrorNote error={error}/><form className="form-stack" onSubmit={e=>{e.preventDefault();const next=String(new FormData(e.currentTarget).get('setupCode')||'').trim();if(next!==token){setError('');setChecking(true);setToken(next)}}}><label className="field">Private owner setup code<input name="setupCode" type="password" autoComplete="off" spellCheck={false} required minLength={64} maxLength={64} placeholder="Paste your 64-character invitation code"/></label><button className="button primary full">Continue to owner setup <ArrowRight size={18}/></button></form><p className="fine-print">Already set up your owner account? <Link to="/login?next=/admin">Log in here</Link>. This code is private and cannot be reused after setup.</p></section></div>;
 return <div className="owner-setup container"><section className="panel"><span className="form-icon"><ShieldCheck size={29}/></span><span className="eyebrow">YOUR WEBSITE. YOUR CONTROLS.</span><h1>Set up your owner account.</h1><p>Choose the email and password you’ll use to manage registrations, listings and reports. This private invitation can be used once.</p><ErrorNote error={error}/><form onSubmit={submit} className="form-stack"><label className="field">Your name<input name="name" autoComplete="name" required minLength={2} maxLength={80} defaultValue={!user?.demo?user?.name:''}/></label><label className="field">Owner email<input name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={!user?.demo?user?.email:''}/></label><label className="field">Choose a password<input name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={128}/><small className="muted">At least 10 characters, including a letter and a number.</small></label><label className="field">Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={10} maxLength={128}/></label><label className="check-field terms-check"><input name="terms" type="checkbox" required/><span>I agree to the <Link to="/terms" target="_blank" rel="noreferrer">Terms</Link> and <Link to="/privacy" target="_blank" rel="noreferrer">Privacy notice</Link>.</span></label><button className="button primary large full" disabled={busy}><LockKeyhole size={18}/>{busy?'Setting up your account…':'Create owner account'}</button></form><p className="fine-print">If this email already has a student account, log into that account in another tab and reopen your setup link. Never share the invitation. Your password is securely hashed and cannot be read by moderators.</p></section></div>;
}
