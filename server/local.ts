import express from 'express';
import {createServer as createViteServer} from 'vite';
import {resolve} from 'node:path';
import {openDatabase,localBucket} from './local-db';
import {handleApi} from './api';
import {seed} from './seed';
import type {Env} from './types';
const cli=process.argv.slice(2);const portIndex=cli.indexOf('--port');const port=Number(portIndex>=0?cli[portIndex+1]:process.env.PORT||5173);const hostIndex=cli.indexOf('--host');const host=hostIndex>=0?cli[hostIndex+1]:'127.0.0.1';
const {db}=await openDatabase(process.env.DATABASE_PATH||'.data/loopmarket.sqlite');
const env:Env={DB:db,BUCKET:await localBucket(process.env.UPLOAD_DIRECTORY||'.data/uploads'),LOCAL:true,DEMO_MODE:process.env.DEMO_MODE??'true',DEMO_ADMIN_ENABLED:process.env.DEMO_ADMIN_ENABLED??'true',UNIVERSITY_EMAIL_DOMAINS:process.env.UNIVERSITY_EMAIL_DOMAINS||'',OWNER_SETUP_TOKEN_HASH:process.env.OWNER_SETUP_TOKEN_HASH,OWNER_SETUP_EXPIRES_AT:process.env.OWNER_SETUP_EXPIRES_AT};
if(env.DEMO_MODE==='true')await seed(env);
const app=express();app.disable('x-powered-by');
app.use('/api',express.raw({type:()=>true,limit:'6mb'}),async(req,res)=>{
 try{const headers=new Headers();for(const [key,value] of Object.entries(req.headers)){if(value)headers.set(key,Array.isArray(value)?value.join(','):value)}
 const proto=req.headers['x-forwarded-proto']||req.protocol;const origin=`${proto}://${req.headers.host}`;
 const request=new Request(origin+req.originalUrl,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined: req.body?.length?new Uint8Array(req.body):undefined});
 const response=await handleApi(request,env);res.status(response.status);response.headers.forEach((v,k)=>res.setHeader(k,v));res.send(Buffer.from(await response.arrayBuffer()));
 }catch(e){console.error(e);res.status(500).json({error:'The server could not process this request.'})}
});
if(process.env.NODE_ENV==='production'||cli.includes('--production')){app.use(express.static(resolve('dist/client')));app.get('/{*path}',(_req,res)=>res.sendFile(resolve('dist/client/index.html')))}else{const vite=await createViteServer({server:{middlewareMode:true,host},appType:'spa'});app.use(vite.middlewares)}
app.listen(port,host,()=>console.log(`LoopMarket running at http://${host}:${port}`));
