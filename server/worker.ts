import {handleApi} from './api';
import type {Env} from './types';
export default {async fetch(req:Request,env:Env){
 const url=new URL(req.url);
 if(url.pathname==='/api'||url.pathname.startsWith('/api/'))return handleApi(req,env);
 const asset=await env.ASSETS!.fetch(req);
 // The hosting adapter does not always carry through SPA fallback settings.
 // Route document requests explicitly; missing files must remain real 404s.
 if(asset.status===404&&['GET','HEAD'].includes(req.method)&&!url.pathname.split('/').at(-1)?.includes('.')){
  url.pathname='/';url.search='';
  return env.ASSETS!.fetch(new Request(url,{method:req.method,headers:req.headers}));
 }
 return asset;
}};
