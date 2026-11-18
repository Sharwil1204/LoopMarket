import {DatabaseSync} from 'node:sqlite';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import type {Database,Statement} from './types';
export async function openDatabase(path:string){
 await mkdir(dirname(path),{recursive:true});const sqlite=new DatabaseSync(path);sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
 const exists=sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();if(!exists)sqlite.exec(await readFile(new URL('../drizzle/0000_loopmarket.sql',import.meta.url),'utf8'));
 class Query implements Statement {values:any[]=[];constructor(public sql:string){}bind(...values:any[]){this.values=values;return this}execute(){const result=sqlite.prepare(this.sql).run(...this.values);return {meta:{changes:Number(result.changes)}}}async run(){return this.execute()}async first<T=any>(){return sqlite.prepare(this.sql).get(...this.values) as T||null}async all<T=any>(){return {results:sqlite.prepare(this.sql).all(...this.values) as T[]}}}
 const db:Database={prepare:(sql)=>new Query(sql),batch:async(stmts)=>{sqlite.exec('BEGIN IMMEDIATE');try{const result=stmts.map(s=>(s as Query).execute());sqlite.exec('COMMIT');return result}catch(e){sqlite.exec('ROLLBACK');throw e}}};
 return {db,close:()=>sqlite.close()};
}
export async function localBucket(directory:string){await mkdir(directory,{recursive:true});return {async put(key:string,value:ArrayBuffer|Uint8Array){await writeFile(join(directory,key),new Uint8Array(value instanceof ArrayBuffer?value:value.buffer.slice(value.byteOffset,value.byteOffset+value.byteLength)))},async get(key:string){try{return {body:new Uint8Array(await readFile(join(directory,key)))}}catch{return null}}}}
