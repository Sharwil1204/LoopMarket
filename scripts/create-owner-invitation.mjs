import {randomBytes,createHash} from 'node:crypto';
const origin=(process.argv[2]||'http://127.0.0.1:5173').replace(/\/$/,'');
const parsed=new URL(origin);
if(!['https:','http:'].includes(parsed.protocol))throw new Error('Use an HTTP or HTTPS application origin.');
const token=randomBytes(32).toString('hex');
console.log(JSON.stringify({
  OWNER_SETUP_TOKEN_HASH:createHash('sha256').update(token).digest('hex'),
  OWNER_SETUP_EXPIRES_AT:new Date(Date.now()+7*24*60*60*1000).toISOString(),
  private_setup_url:origin+'/owner-setup#key='+token
},null,2));
