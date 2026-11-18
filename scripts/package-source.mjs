import {readdir,readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {zipSync} from 'fflate';

// Explicit source roots keep runtime data, credentials and nested archives out.
const roots=['src','server','api','scripts','tests','drizzle','public/images','public/fonts','public/favicon.svg','vercel.json','.env.example','.gitignore','package.json','package-lock.json','index.html','tsconfig.json','vite.config.ts','README.md','TEST-REPORT.md','REVIEW-WALKTHROUGH.md'];
const files={};
async function collect(path){
  const info=await stat(path);
  if(info.isDirectory()){
    for(const name of (await readdir(path)).sort())await collect(path+'/'+name);
  }else files['LoopMarket/'+path]=new Uint8Array(await readFile(path));
}
for(const path of roots)await collect(path);
await mkdir('public/downloads',{recursive:true});
for(const name of ['README.md','TEST-REPORT.md','REVIEW-WALKTHROUGH.md'])await writeFile('public/downloads/'+name,await readFile(name));
await writeFile('public/downloads/LoopMarket-source.zip',zipSync(files,{level:6}));
console.log(`Prepared complete source download (${Object.keys(files).length} files) and review guides.`);
