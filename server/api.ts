import type {Env,Statement} from './types';
import {seed,demoUsers} from './seed';
const CATEGORIES=['Books','Electronics','Hostel Items','Stationery','Clothing','Sports','Lab Equipment','Furniture','Others'];
const CONDITIONS=['New','Like New','Good','Used'];
const uuid=()=>crypto.randomUUID(); const now=()=>new Date().toISOString(); const today=()=>new Date(Date.now()+19800000).toISOString().slice(0,10);
const clientIp=(req:Request)=>req.headers.get('x-forwarded-for')?.split(',')[0].trim()||req.headers.get('x-real-ip')||req.headers.get('cf-connecting-ip')||'local';
class HttpError extends Error {constructor(public status:number,message:string){super(message)}}
function fail(status:number,message:string):never{throw new HttpError(status,message)}
const json=(data:any,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const text=(v:any,name:string,min=1,max=2000)=>{if(typeof v!=='string'||v.trim().length<min||v.trim().length>max)fail(400,`${name} must contain ${min}–${max} characters.`);return v.trim()};
const choice=(v:any,options:string[],label:string)=>{if(!options.includes(v))fail(400,`Choose a valid ${label}.`);return v as string};
const money=(v:any,label:string,min=0)=>{const n=Number(v);if(v===''||v==null||!Number.isFinite(n)||n<min||n>10000000)fail(400,`Enter a valid ${label}${min?' greater than zero':''}.`);return Math.round(n*100)/100};
const date=(v:any)=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v+'T00:00:00Z'))||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)fail(400,'Choose a valid date.');return v as string};
async function body(req:Request){try{return await req.json() as any}catch{fail(400,'Send a valid request.')}}
const publicUser=(u:any)=>u?{id:u.id,name:u.name,email:u.email,studentId:u.student_id,role:u.role,status:u.status,reason:u.reason,bio:u.bio,campus:u.campus,demo:!!u.demo}:null;
async function hash(value:string,salt:string){const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(value),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},material,256);return [...new Uint8Array(bits)].map(b=>b.toString(16).padStart(2,'0')).join('')}
function equal(a:string,b:string){let result=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)result|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return result===0}
async function demoAdminAllowed(env:Env){return env.DEMO_MODE==='true'&&env.DEMO_ADMIN_ENABLED==='true'&&!await env.DB.prepare("SELECT value FROM settings WHERE key='owner_setup'").first()}
async function user(req:Request,env:Env,required=true,approved=false,admin=false){
 const token=req.headers.get('cookie')?.match(/(?:^|;\s*)lm_session=([a-f0-9-]+)/)?.[1];
 const u=token?await env.DB.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires_at>?').bind(token,now()).first():null;
 if(u?.demo&&(env.DEMO_MODE!=='true'||u.role==='admin'&&!await demoAdminAllowed(env))){if(required)fail(401,'This demo session is no longer available. Please log in.');return null;}
 if(!u&&required)fail(401,'Please log in to continue.');
 if(required&&u?.status==='suspended')fail(403,'Your account is suspended. Contact your campus moderator for help.');
 if(approved&&u?.status!=='approved')fail(403,'Campus access is awaiting manual approval. You can browse while your request is reviewed.');
 if(admin&&u?.role!=='admin')fail(403,'Administrator access is required.');
 return u;
}
async function session(req:Request,env:Env,u:any){const id=uuid();await env.DB.prepare('INSERT INTO sessions(id,user_id,expires_at) VALUES(?,?,?)').bind(id,u.id,new Date(Date.now()+7*86400000).toISOString()).run();return json({user:publicUser(u)},200,{'Set-Cookie':`lm_session=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${new URL(req.url).protocol==='https:'?'; Secure':''}`})}
const notify=(env:Env,userId:string,title:string,message:string,href:string)=>env.DB.prepare('INSERT INTO notifications(id,user_id,title,body,href,created_at) VALUES(?,?,?,?,?,?)').bind(uuid(),userId,title,message,href,now());
const audit=(env:Env,actor:string,action:string,target:string,reason:string)=>env.DB.prepare('INSERT INTO audit_records(id,actor_id,action,target_id,reason,created_at) VALUES(?,?,?,?,?,?)').bind(uuid(),actor,action,target,reason,now());
async function listing(env:Env,id:string){const l=await env.DB.prepare('SELECT l.*,u.name seller_name,u.status seller_status,u.demo seller_demo FROM listings l JOIN users u ON u.id=l.owner_id WHERE l.id=?').bind(id).first();if(!l)fail(404,'This listing could not be found.');return l}
async function images(env:Env,items:any[],uid?:string){if(!items.length)return items;const ids=items.map(i=>i.id);const marks=ids.map(()=>'?').join(',');const photos=(await env.DB.prepare(`SELECT * FROM listing_images WHERE listing_id IN (${marks}) ORDER BY position`).bind(...ids).all()).results;const favs=uid?(await env.DB.prepare('SELECT listing_id FROM favourites WHERE user_id=?').bind(uid).all()).results:[];return items.map(l=>({...l,images:photos.filter(p=>p.listing_id===l.id).map(p=>p.url),saved:favs.some(f=>f.listing_id===l.id)}))}
async function conversation(env:Env,id:string,uid:string){const c=await env.DB.prepare('SELECT c.*,l.title,l.type,l.price,l.rental_unit,l.status listing_status,l.owner_id,l.demo,bu.name buyer_name,su.name seller_name FROM conversations c JOIN listings l ON l.id=c.listing_id JOIN users bu ON bu.id=c.buyer_id JOIN users su ON su.id=c.seller_id WHERE c.id=?').bind(id).first();if(!c||c.buyer_id!==uid&&c.seller_id!==uid)fail(404,'Conversation not found.');return c}
async function listingInput(b:any,u:any,env:Env,old?:any){
 const type=choice(b.type,['sell','rent','giveaway'],'listing type');
 const result:any={title:text(b.title,'Title',1,100),description:text(b.description,'Description',1,2000),category:choice(b.category,CATEGORIES,'category'),type,price:type==='giveaway'?0:money(b.price,'price',0.01),condition:choice(b.condition,CONDITIONS,'condition'),location:text(b.location,'Pickup location',2,120),status:choice(b.status,['draft','active'],'publication status'),rental_unit:'day',deposit:0,available_from:null,available_to:null,terms:'',included:typeof b.included==='string'?b.included.trim().slice(0,500):''};
 if(type==='rent'){result.rental_unit=choice(b.rental_unit,['day','week','month'],'rental unit');result.deposit=money(b.deposit,'deposit');result.available_from=date(b.available_from);result.available_to=date(b.available_to);if(result.available_from>result.available_to||result.available_to<today())fail(400,'Rental availability must end on or after its start and today.');result.terms=text(b.terms,'Rental terms',5,1000)}
 if(!Array.isArray(b.images)||b.images.length>5)fail(400,'Add up to five photos.');
 if(result.status==='active'&&!b.images.length)fail(400,'Add at least one product photo before publishing.');
 for(const url of b.images){if(typeof url!=='string')fail(400,'Invalid image.');if(old?.images.includes(url))continue;const id=url.match(/^\/api\/images\/([a-f0-9-]+)$/)?.[1];if(!id||!await env.DB.prepare('SELECT id FROM uploads WHERE id=? AND owner_id=?').bind(id,u.id).first())fail(400,'Only your uploaded photos can be attached.');}
 return {...result,images:b.images};
}
async function rateLimit(env:Env,key:string){
 const start=new Date(Date.now()-15*60*1000).toISOString();
 await env.DB.prepare('DELETE FROM auth_attempts WHERE window_start<?').bind(start).run();
 await env.DB.prepare('INSERT INTO auth_attempts(key,attempts,window_start) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1').bind(key,now()).run();
 const attempt=await env.DB.prepare('SELECT attempts FROM auth_attempts WHERE key=?').bind(key).first();if(attempt.attempts>20)fail(429,'Too many attempts. Please try again in 15 minutes.');
}
async function ownerInvitation(req:Request,env:Env){
 const token=req.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
 const expiry=Date.parse(env.OWNER_SETUP_EXPIRES_AT||'');
 if(!token||!env.OWNER_SETUP_TOKEN_HASH||!Number.isFinite(expiry)||expiry<=Date.now())fail(403,'This owner setup link is missing, invalid or expired.');
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))].map(n=>n.toString(16).padStart(2,'0')).join('');
 if(!equal(digest,env.OWNER_SETUP_TOKEN_HASH))fail(403,'This owner setup link is missing, invalid or expired.');
 if(await env.DB.prepare("SELECT value FROM settings WHERE key='owner_setup'").first())fail(409,'Owner setup is already complete. Sign in with your owner account.');
}
export async function handleApi(req:Request,env:Env):Promise<Response>{
 try{
 const url=new URL(req.url),p=url.pathname.replace(/\/$/,''),method=req.method;
 if(!['GET','HEAD','OPTIONS'].includes(method)){
  const origin=req.headers.get('origin');if(origin&&origin!==url.origin)fail(403,'Cross-site requests are not allowed.');
  if(req.headers.get('sec-fetch-site')==='cross-site')fail(403,'Cross-site requests are not allowed.');
  const len=Number(req.headers.get('content-length')||0);if(len>6*1024*1024)fail(413,'Upload one photo at a time, up to 5 MB.');
 }
 if(env.DEMO_MODE==='true')await seed(env);
 if(p==='/api/auth/owner-setup'&&method==='GET'){await ownerInvitation(req,env);return json({available:true});}
 if(p==='/api/auth/owner-setup'&&method==='POST'){
  await rateLimit(env,'owner-setup:'+clientIp(req));
  await ownerInvitation(req,env);
  const b=await body(req),name=text(b.name,'Full name',2,80),email=text(b.email,'Email',5,254).toLowerCase(),password=text(b.password,'Password',10,128);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,'Enter a valid email address.');
  if(!/[A-Za-z]/.test(password)||!/[0-9]/.test(password))fail(400,'Use at least 10 characters including a letter and a number.');
  if(password!==b.confirmPassword)fail(400,'Passwords do not match.');
  if(b.terms!==true)fail(400,'Accept the platform terms to continue.');
  const existing=await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
  if(existing?.demo)fail(400,'Choose your own email, not a demonstration profile.');
  if(existing&&existing.id!==(await user(req,env,false))?.id)fail(409,'This email already has an account. Log into it, then reopen your owner setup link.');
  const id=existing?.id||uuid(),salt=uuid(),passwordHash=await hash(password,salt);
  const statements=[env.DB.prepare("INSERT INTO settings(key,value) VALUES('owner_setup',?)").bind(id)];
  if(existing)statements.push(env.DB.prepare("UPDATE users SET name=?,password_hash=?,salt=?,role='admin',status='approved',reason='Owner access established through a private setup link' WHERE id=?").bind(name,passwordHash,salt,id));
  else statements.push(env.DB.prepare("INSERT INTO users(id,name,email,student_id,password_hash,salt,role,status,demo,reason,created_at) VALUES(?,?,?,'OWNER',?,?,'admin','approved',0,'Owner access established through a private setup link',?)").bind(id,name,email,passwordHash,salt,now()));
  statements.push(env.DB.prepare("UPDATE access_requests SET status='approved',reason='Owner setup completed',reviewed_by=?,reviewed_at=? WHERE user_id=?").bind(id,now(),id),env.DB.prepare("DELETE FROM sessions WHERE user_id=? OR user_id IN (SELECT id FROM users WHERE demo=1 AND role='admin')").bind(id),audit(env,id,'owner.created',id,'Owner claimed a private one-time setup link'));
  await env.DB.batch(statements);
  return session(req,env,await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first());
 }
 if(p==='/api/config'&&method==='GET')return json({demo:env.DEMO_MODE==='true',demoAdmin:await demoAdminAllowed(env),domains:(env.UNIVERSITY_EMAIL_DOMAINS||'').split(',').map(s=>s.trim()).filter(Boolean),verification:'manual',categories:CATEGORIES,conditions:CONDITIONS});
 if(p==='/api/auth/register'&&method==='POST'){
  const b=await body(req);if(b.role&&b.role!=='student')fail(403,'Administrator roles cannot be requested through registration.');
  const name=text(b.name,'Full name',2,80),email=text(b.email,'Email',5,254).toLowerCase(),studentId=text(b.studentId,'Student ID',3,60),password=text(b.password,'Password',10,128);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,'Enter a valid email address.');
  if(!/[A-Za-z]/.test(password)||!/[0-9]/.test(password))fail(400,'Use at least 10 characters including a letter and a number.');
  if(password!==b.confirmPassword)fail(400,'Passwords do not match.');if(b.terms!==true)fail(400,'Accept the platform terms to continue.');
  const domains=(env.UNIVERSITY_EMAIL_DOMAINS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);if(domains.length&&!domains.includes(email.split('@')[1]))fail(400,'Use an email from an approved campus domain.');
  await rateLimit(env,'register:'+(clientIp(req)||email));
  if(await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first())fail(409,'An account already exists with this email. Please log in.');
  const id=uuid(),salt=uuid(),passwordHash=await hash(password,salt);
  await env.DB.batch([env.DB.prepare('INSERT INTO users(id,name,email,student_id,password_hash,salt,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,name,email,studentId,passwordHash,salt,now()),env.DB.prepare('INSERT INTO access_requests(id,user_id,created_at) VALUES(?,?,?)').bind(uuid(),id,now())]);
  const u=await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first();return session(req,env,u);
 }
 if(p==='/api/auth/login'&&method==='POST'){
  const b=await body(req),email=text(b.email,'Email',3,254).toLowerCase();await rateLimit(env,'login:'+email);
  const u=await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
  const candidate=await hash(typeof b.password==='string'?b.password:'',u?.salt||'invalid-account-timing-salt');
  if(!u?.password_hash||!equal(candidate,u.password_hash)){
   if(u)await audit(env,u.id,'auth.failed',u.id,'Failed sign-in attempt: incorrect password').run();
   fail(401,'Unable to log in with these details.');
  }
  if(u.status==='suspended'){
   await audit(env,u.id,'auth.blocked',u.id,'Blocked sign-in attempt: account is suspended').run();
   fail(403,'This account is suspended. Contact your campus moderator.');
  }
  await env.DB.prepare('DELETE FROM auth_attempts WHERE key=?').bind('login:'+email).run();
  await audit(env,u.id,'auth.login',u.id,'Signed in successfully').run();
  return session(req,env,u);
 }
 if(p==='/api/auth/demo'&&method==='POST'){
  if(env.DEMO_MODE!=='true')fail(404,'Demo access is disabled.');const b=await body(req);const role=choice(b.role,['student','seller','admin'],'demo account');
  if(role==='admin'&&!await demoAdminAllowed(env))fail(403,'Demo administration is disabled. Use your owner email and password.');
  const u=await env.DB.prepare('SELECT * FROM users WHERE id=?').bind('demo-'+role).first();if(u.status!=='approved')fail(403,'This demo account is not active.');return session(req,env,u);
 }
 if(p==='/api/auth/logout'&&method==='POST'){const token=req.headers.get('cookie')?.match(/lm_session=([a-f0-9-]+)/)?.[1];if(token)await env.DB.prepare('DELETE FROM sessions WHERE id=?').bind(token).run();return json({ok:true},200,{'Set-Cookie':'lm_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'})}
 if(p==='/api/me'&&method==='GET')return json({user:publicUser(await user(req,env,false))});
 if(p==='/api/me'&&method==='PATCH'){const u=await user(req,env),b=await body(req);await env.DB.prepare('UPDATE users SET name=?,bio=? WHERE id=?').bind(text(b.name,'Name',2,80),typeof b.bio==='string'?b.bio.trim().slice(0,500):'',u.id).run();return json({user:publicUser(await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(u.id).first())})}
 if(p==='/api/listings'&&method==='GET'){
  const u=await user(req,env,false),q=url.searchParams,where=['l.status!=\'draft\'','l.status!=\'archived\'','u.status=\'approved\''],params:any[]=[];
  const status=q.get('availability')||'active';if(status!=='all'){choice(status,['active','reserved','sold','given_away'],'availability');where.push('l.status=?');params.push(status)}
  const keyword=(q.get('q')||'').trim().slice(0,120);if(keyword){where.push('(l.title LIKE ? ESCAPE \'\\\' OR l.description LIKE ? ESCAPE \'\\\')');const pat='%'+keyword.replace(/[\\%_]/g,'\\$&')+'%';params.push(pat,pat)}
  for(const [key,options] of [['category',CATEGORIES],['type',['sell','rent','giveaway']],['condition',CONDITIONS]] as [string,string[]][]){const v=q.get(key);if(v){choice(v,options,key);where.push(`l.${key}=?`);params.push(v)}}
  const min=q.has('min')?money(q.get('min'),'minimum price'):0,max=q.has('max')?money(q.get('max'),'maximum price'):10000000;if(min>max)fail(400,'Minimum price cannot exceed maximum price.');where.push('l.price>=? AND l.price<=?');params.push(min,max);
  const sort=q.get('sort')==='price-asc'?'l.price ASC':q.get('sort')==='price-desc'?'l.price DESC':'l.created_at DESC';
  const rows=(await env.DB.prepare(`SELECT l.*,u.name seller_name,u.demo seller_demo FROM listings l JOIN users u ON u.id=l.owner_id WHERE ${where.join(' AND ')} ORDER BY ${sort} LIMIT 200`).bind(...params).all()).results;
  return json({listings:await images(env,rows,u?.id),total:rows.length});
 }
 if(p==='/api/my-listings'&&method==='GET'){const u=await user(req,env);const rows=(await env.DB.prepare('SELECT * FROM listings WHERE owner_id=? ORDER BY created_at DESC').bind(u.id).all()).results;return json({listings:await images(env,rows,u.id)})}
 if(p==='/api/listings'&&method==='POST'){
  const u=await user(req,env,true,true),b=await body(req),data=await listingInput(b,u,env),id=uuid();
  const fields=Object.keys(data).filter(k=>k!=='images');const stmts=[env.DB.prepare(`INSERT INTO listings(id,owner_id,${fields.join(',')},created_at,updated_at) VALUES(${Array(fields.length+4).fill('?').join(',')})`).bind(id,u.id,...fields.map(k=>data[k]),now(),now())];
  data.images.forEach((photo:string,i:number)=>stmts.push(env.DB.prepare('INSERT INTO listing_images(id,listing_id,url,position) VALUES(?,?,?,?)').bind(uuid(),id,photo,i)));stmts.push(audit(env,u.id,'listing.created',id,data.status));await env.DB.batch(stmts);return json({id},201);
 }
 let m=p.match(/^\/api\/listings\/([^/]+)$/);
 if(m&&method==='GET'){const u=await user(req,env,false),l=await listing(env,m[1]);if((['draft','archived'].includes(l.status)||l.seller_status!=='approved')&&u?.id!==l.owner_id&&u?.role!=='admin')fail(404,'This listing is not available.');const [item]=await images(env,[l],u?.id);const bookings=(await env.DB.prepare("SELECT start_date,end_date,status FROM rental_bookings WHERE listing_id=? AND status IN ('booked','on_loan') ORDER BY start_date").bind(l.id).all()).results;return json({listing:{...item,bookings}})}
 if(m&&method==='PUT'){
  const u=await user(req,env,true,true),old=await listing(env,m[1]);if(old.owner_id!==u.id)fail(403,'You can only edit your own listings.');if(!['draft','active'].includes(old.status))fail(409,'Only active listings and drafts can be edited.');
  const [existing]=await images(env,[old]);const data=await listingInput(await body(req),u,env,existing);
  if(data.type!==old.type&&await env.DB.prepare('SELECT id FROM exchange_requests WHERE listing_id=? LIMIT 1').bind(old.id).first())fail(409,'Keep the listing type unchanged once requests exist.');
  const fields=Object.keys(data).filter(k=>k!=='images');const stmts=[env.DB.prepare(`UPDATE listings SET ${fields.map(k=>`${k}=?`).join(',')},updated_at=? WHERE id=? AND owner_id=?`).bind(...fields.map(k=>data[k]),now(),old.id,u.id),env.DB.prepare('DELETE FROM listing_images WHERE listing_id=?').bind(old.id)];
  data.images.forEach((photo:string,i:number)=>stmts.push(env.DB.prepare('INSERT INTO listing_images(id,listing_id,url,position) VALUES(?,?,?,?)').bind(uuid(),old.id,photo,i)));stmts.push(audit(env,u.id,'listing.edited',old.id,data.status));await env.DB.batch(stmts);return json({id:old.id});
 }
 m=p.match(/^\/api\/listings\/([^/]+)\/status$/);
 if(m&&method==='POST'){
  const u=await user(req,env,true,true),l=await listing(env,m[1]),b=await body(req);if(l.owner_id!==u.id)fail(403,'You can only manage your own listings.');
  const status=choice(b.status,['active','archived','sold','given_away'],'status');
  if(await env.DB.prepare("SELECT id FROM exchange_requests WHERE listing_id=? AND status IN ('accepted','handed_over')").bind(l.id).first())fail(409,'Complete or cancel the accepted request in your inbox first.');
  if(status==='active'&&!['draft','archived'].includes(l.status))fail(409,'This listing cannot be republished.');
  if(status==='active'){const [item]=await images(env,[l]);await listingInput({...l,images:item.images,status},u,env,item)}
  if(status==='sold'&&(l.type!=='sell'||l.status!=='active')||status==='given_away'&&(l.type!=='giveaway'||l.status!=='active'))fail(409,'That status does not apply to this listing.');
  await env.DB.batch([env.DB.prepare('UPDATE listings SET status=?,updated_at=? WHERE id=?').bind(status,now(),l.id),audit(env,u.id,'listing.'+status,l.id,'Owner updated availability')]);return json({ok:true});
 }
 if(p==='/api/uploads'&&method==='POST'){
  const u=await user(req,env,true,true),form=await req.formData(),file=form.get('file');if(!(file instanceof File))fail(400,'Choose a product photo.');if(file.size>5*1024*1024)fail(400,'Each photo must be 5 MB or smaller.');
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))fail(400,'Use JPG, PNG or WebP photos.');const bytes=new Uint8Array(await file.arrayBuffer());
  const sig=file.type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:file.type==='image/png'?bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10':String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';if(!sig)fail(400,'The file contents are not a supported photo.');
  const id=uuid();await env.BUCKET.put(id,bytes,{httpMetadata:{contentType:file.type}});await env.DB.prepare('INSERT INTO uploads(id,owner_id,mime,size,created_at) VALUES(?,?,?,?,?)').bind(id,u.id,file.type,file.size,now()).run();return json({url:'/api/images/'+id},201);
 }
 m=p.match(/^\/api\/images\/([a-f0-9-]+)$/);
 if(m&&method==='GET'){
  const img=await env.DB.prepare('SELECT * FROM uploads WHERE id=?').bind(m[1]).first();if(!img)fail(404,'Photo not found.');const object=await env.BUCKET.get(m[1]);if(!object)fail(404,'Photo not found.');return new Response(object.body,{headers:{'Content-Type':img.mime,'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=86400'}});
 }
 if(p==='/api/saved'&&method==='GET'){const u=await user(req,env);const rows=(await env.DB.prepare("SELECT l.*,u.name seller_name FROM favourites f JOIN listings l ON l.id=f.listing_id JOIN users u ON u.id=l.owner_id WHERE f.user_id=? AND l.status NOT IN ('archived','draft') AND u.status='approved' ORDER BY l.created_at DESC").bind(u.id).all()).results;return json({listings:await images(env,rows,u.id)})}
 m=p.match(/^\/api\/saved\/([^/]+)$/);
 if(m&&['POST','DELETE'].includes(method)){const u=await user(req,env);const l=await listing(env,m[1]);if(['draft','archived'].includes(l.status)||l.seller_status!=='approved')fail(404,'Listing unavailable.');if(method==='POST')await env.DB.prepare('INSERT OR IGNORE INTO favourites(user_id,listing_id) VALUES(?,?)').bind(u.id,l.id).run();else await env.DB.prepare('DELETE FROM favourites WHERE user_id=? AND listing_id=?').bind(u.id,l.id).run();return json({saved:method==='POST'})}
 if(p==='/api/conversations'&&method==='POST'){
  const u=await user(req,env,true,true),b=await body(req),l=await listing(env,text(b.listingId,'Listing',1,100));if(l.owner_id===u.id)fail(400,'You cannot enquire about your own listing.');if(l.status!=='active'||l.seller_status!=='approved')fail(409,'This listing is no longer available for new enquiries.');
  const message=text(b.message,'Message',1,2000),nonce=text(b.nonce,'Request identifier',8,100);const existing=await env.DB.prepare('SELECT id FROM conversations WHERE listing_id=? AND buyer_id=?').bind(l.id,u.id).first();if(existing)return json({id:existing.id,existing:true});
  const id=uuid();await env.DB.batch([env.DB.prepare('INSERT INTO conversations(id,listing_id,buyer_id,seller_id,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(id,l.id,u.id,l.owner_id,now(),now()),env.DB.prepare('INSERT INTO messages(id,conversation_id,sender_id,body,nonce,created_at) VALUES(?,?,?,?,?,?)').bind(uuid(),id,u.id,message,nonce,now()),notify(env,l.owner_id,'New enquiry',`${u.name} asked about ${l.title}.`,'/inbox/'+id)]);return json({id},201);
 }
 if(p==='/api/conversations'&&method==='GET'){const u=await user(req,env);const list=(await env.DB.prepare('SELECT c.*,l.title,l.type,l.status listing_status,b.name buyer_name,s.name seller_name,(SELECT url FROM listing_images WHERE listing_id=l.id ORDER BY position LIMIT 1) image,(SELECT body FROM messages WHERE conversation_id=c.id ORDER BY created_at DESC LIMIT 1) last_message FROM conversations c JOIN listings l ON l.id=c.listing_id JOIN users b ON b.id=c.buyer_id JOIN users s ON s.id=c.seller_id WHERE c.buyer_id=? OR c.seller_id=? ORDER BY c.updated_at DESC').bind(u.id,u.id).all()).results;return json({conversations:list})}
 m=p.match(/^\/api\/conversations\/([^/]+)$/);
 if(m&&method==='GET'){const u=await user(req,env),c=await conversation(env,m[1],u.id);const msgs=(await env.DB.prepare('SELECT m.*,u.name sender_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE conversation_id=? ORDER BY m.created_at').bind(c.id).all()).results;const requests=(await env.DB.prepare('SELECT * FROM exchange_requests WHERE conversation_id=? ORDER BY created_at DESC').bind(c.id).all()).results;return json({conversation:c,messages:msgs,requests})}
 m=p.match(/^\/api\/conversations\/([^/]+)\/messages$/);
 if(m&&method==='POST'){const u=await user(req,env,true,true),c=await conversation(env,m[1],u.id),b=await body(req);const nonce=text(b.nonce,'Message identifier',8,100);if(await env.DB.prepare('SELECT id FROM messages WHERE sender_id=? AND nonce=?').bind(u.id,nonce).first())return json({ok:true});const message=text(b.message,'Message',1,2000);await env.DB.batch([env.DB.prepare('INSERT INTO messages(id,conversation_id,sender_id,body,nonce,created_at) VALUES(?,?,?,?,?,?)').bind(uuid(),c.id,u.id,message,nonce,now()),env.DB.prepare('UPDATE conversations SET updated_at=? WHERE id=?').bind(now(),c.id),notify(env,u.id===c.buyer_id?c.seller_id:c.buyer_id,'New message',`${u.name} replied about ${c.title}.`,'/inbox/'+c.id)]);return json({ok:true})}
 m=p.match(/^\/api\/conversations\/([^/]+)\/requests$/);
 if(m&&method==='POST'){
  const u=await user(req,env,true,true),c=await conversation(env,m[1],u.id);if(c.buyer_id!==u.id)fail(403,'Only the interested buyer or renter can send a request.');const l=await listing(env,c.listing_id);if(l.status!=='active'||l.seller_status!=='approved')fail(409,'This listing is unavailable.');
  const existing=await env.DB.prepare("SELECT id FROM exchange_requests WHERE conversation_id=? AND status IN ('pending','accepted','handed_over')").bind(c.id).first();if(existing)return json({id:existing.id,existing:true});
  const b=await body(req);let start=null,end=null,total=l.price;
  if(l.type==='rent'){start=date(b.start_date);end=date(b.end_date);if(start<today()||start>end||start<l.available_from||end>l.available_to)fail(400,'Choose future dates within the available range, with the end on or after the start.');if(await env.DB.prepare("SELECT id FROM rental_bookings WHERE listing_id=? AND status IN ('booked','on_loan') AND start_date<=? AND end_date>=?").bind(l.id,end,start).first())fail(409,'Those dates overlap an accepted rental. Choose another period.');const days=Math.round((Date.parse(end)-Date.parse(start))/86400000)+1;total=l.price*Math.ceil(days/(l.rental_unit==='week'?7:l.rental_unit==='month'?30:1));}
  const id=uuid();await env.DB.batch([env.DB.prepare('INSERT INTO exchange_requests(id,conversation_id,listing_id,requester_id,start_date,end_date,estimated_total,deposit,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,c.id,l.id,u.id,start,end,total,l.deposit,now(),now()),notify(env,c.seller_id,'New '+(l.type==='rent'?'rental':l.type==='giveaway'?'giveaway':'purchase')+' request',`${u.name} requested ${l.title}.`,'/inbox/'+c.id)]);return json({id},201);
 }
 m=p.match(/^\/api\/requests\/([^/]+)$/);
 if(m&&method==='POST'){
  const u=await user(req,env,true,true),b=await body(req),r=await env.DB.prepare('SELECT * FROM exchange_requests WHERE id=?').bind(m[1]).first();if(!r)fail(404,'Request not found.');const c=await conversation(env,r.conversation_id,u.id),l=await listing(env,r.listing_id);const action=choice(b.action,['accept','decline','cancel','handover','complete'],'action');
  const owner=c.seller_id===u.id;if(action!=='cancel'&&!owner)fail(403,'Only the listing owner can do that.');
  const transitions:any={accept:['pending','accepted'],decline:['pending','declined'],handover:['accepted','handed_over'],complete:[l.type==='rent'?'handed_over':'accepted','completed']};
  let target:string;
  if(action==='cancel'){if(!['pending','accepted'].includes(r.status))fail(409,'This request cannot be cancelled now.');target='cancelled'}else{const [from,to]=transitions[action];if(r.status!==from)fail(409,'This request has already changed. Refresh to see its current status.');if(action==='handover'&&l.type!=='rent')fail(400,'Handover tracking is for rentals.');if(action==='accept'&&l.type==='rent'&&r.start_date<today())fail(409,'The requested start date has passed. Ask for a new request.');target=to;}
  const stmts=[env.DB.prepare('UPDATE exchange_requests SET status=?,updated_at=? WHERE id=? AND status=?').bind(target,now(),r.id,r.status),env.DB.prepare('INSERT INTO notifications(id,user_id,title,body,href,created_at) SELECT ?,?,?,?,?,? WHERE changes()>0').bind(uuid(),owner?c.buyer_id:c.seller_id,'Request '+target,`${l.title}: ${target.replace('_',' ')}.`,'/inbox/'+c.id,now()),env.DB.prepare('INSERT INTO audit_records(id,actor_id,action,target_id,reason,created_at) SELECT ?,?,?,?,?,? WHERE changes()>0').bind(uuid(),u.id,'request.'+target,r.id,'Campus exchange status updated',now()),env.DB.prepare('UPDATE conversations SET updated_at=? WHERE id=? AND changes()>0').bind(now(),c.id)];
  const result=await env.DB.batch(stmts);if(!result[0].meta.changes)fail(409,'This request has already changed. Refresh to see its current status.');return json({ok:true,status:target});
 }
 if(p==='/api/notifications'&&method==='GET'){const u=await user(req,env);return json({notifications:(await env.DB.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 80').bind(u.id).all()).results})}
 if(p==='/api/notifications/read'&&method==='POST'){const u=await user(req,env);await env.DB.prepare('UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL').bind(now(),u.id).run();return json({ok:true})}
 m=p.match(/^\/api\/listings\/([^/]+)\/report$/);
 if(m&&method==='POST'){const u=await user(req,env,true,true),l=await listing(env,m[1]),b=await body(req);const reason=text(b.reason,'Report reason',10,1000);await env.DB.prepare('INSERT INTO reports(id,listing_id,reporter_id,reason,created_at) VALUES(?,?,?,?,?)').bind(uuid(),l.id,u.id,reason,now()).run();return json({ok:true},201)}
 if(p==='/api/admin'&&method==='GET'){
  await user(req,env,true,true,true);
  const users=(await env.DB.prepare('SELECT id,name,email,student_id,role,status,reason,demo,created_at FROM users ORDER BY created_at DESC').all()).results;
  const list=(await env.DB.prepare('SELECT l.*,u.name seller_name FROM listings l JOIN users u ON u.id=l.owner_id ORDER BY l.created_at DESC').all()).results;
  const reports=(await env.DB.prepare('SELECT r.*,l.title,u.name reporter_name FROM reports r JOIN listings l ON l.id=r.listing_id JOIN users u ON u.id=r.reporter_id ORDER BY r.created_at DESC').all()).results;
  const logs=(await env.DB.prepare('SELECT a.*,COALESCE(u.name,a.actor_id) actor_name FROM audit_records a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 100').all()).results;
  return json({users,listings:await images(env,list),reports,audit:logs});
 }
 m=p.match(/^\/api\/admin\/users\/([^/]+)$/);
 if(m&&method==='POST'){
  const u=await user(req,env,true,true,true),b=await body(req),status=choice(b.status,['approved','rejected','suspended'],'account status'),reason=text(b.reason,'Decision reason',5,500);const target=await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(m[1]).first();if(!target)fail(404,'Account not found.');if(target.role==='admin')fail(400,'Administrator accounts cannot be changed here.');
  await env.DB.batch([env.DB.prepare('UPDATE users SET status=?,reason=? WHERE id=?').bind(status,reason,target.id),env.DB.prepare('UPDATE access_requests SET status=?,reason=?,reviewed_by=?,reviewed_at=? WHERE user_id=?').bind(status,reason,u.id,now(),target.id),notify(env,target.id,'Campus access '+status,reason,'/profile'),audit(env,u.id,'account.'+status,target.id,reason)]);return json({ok:true});
 }
 m=p.match(/^\/api\/admin\/listings\/([^/]+)$/);
 if(m&&method==='POST'){const u=await user(req,env,true,true,true),b=await body(req),l=await listing(env,m[1]),reason=text(b.reason,'Moderation reason',5,500);await env.DB.batch([env.DB.prepare("UPDATE listings SET status='archived',updated_at=? WHERE id=?").bind(now(),l.id),notify(env,l.owner_id,'Listing archived',reason,'/my-listings'),audit(env,u.id,'moderation.archive',l.id,reason)]);return json({ok:true})}
 m=p.match(/^\/api\/admin\/reports\/([^/]+)$/);
 if(m&&method==='POST'){const u=await user(req,env,true,true,true),b=await body(req),reason=text(b.reason,'Resolution',5,500);if(!await env.DB.prepare('SELECT id FROM reports WHERE id=?').bind(m[1]).first())fail(404,'Report not found.');await env.DB.batch([env.DB.prepare("UPDATE reports SET status='resolved',resolution=? WHERE id=?").bind(reason,m[1]),audit(env,u.id,'report.resolved',m[1],reason)]);return json({ok:true})}
 fail(404,'This page or action could not be found.');
 }catch(e:any){
  if(e instanceof HttpError)return json({error:e.message},e.status);
  const msg=String(e?.message||'');
  if(/overlap|already has an accepted|outside availability|participant is unavailable|agreed terms/.test(msg))return json({error:msg.replace(/^.*?: /,'')},409);
  if(/UNIQUE constraint|unique constraint/i.test(msg))return json({error:'This record already exists or the request has already been submitted. Refresh to see the latest state.'},409);
  console.error('LoopMarket API error',msg);return json({error:'Unable to complete the request. Your changes were not confirmed; please try again.'},500);
 }
}
