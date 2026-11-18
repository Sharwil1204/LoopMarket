import {build} from 'esbuild';
import {mkdir,readFile,writeFile,cp} from 'node:fs/promises';
await mkdir('dist/server',{recursive:true});
await build({entryPoints:['server/worker.ts'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true});
const hosting=JSON.parse(await readFile('.openai/hosting.json','utf8'));
await mkdir('dist/.openai',{recursive:true});await writeFile('dist/.openai/hosting.json',JSON.stringify(hosting,null,2));
await cp('drizzle','dist/drizzle',{recursive:true});
await writeFile('dist/server/wrangler.json',JSON.stringify({name:'loopmarket',main:'index.js',compatibility_date:'2026-01-01',compatibility_flags:['nodejs_compat'],assets:{directory:'../client',binding:'ASSETS',not_found_handling:'single-page-application',run_worker_first:true},d1_databases:[{binding:'DB',database_name:'loopmarket',database_id:'local-loopmarket',migrations_dir:'../drizzle'}],r2_buckets:[{binding:'BUCKET',bucket_name:'loopmarket-uploads'}]},null,2));
console.log('Built React client and Worker API, SQL schema and storage bindings.');
