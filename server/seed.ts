import type {Env} from './types';
export const demoUsers=[{id:'demo-student',name:'Sharwil Rajurwar',email:'student@demo.loopmarket.test',role:'student'}, {id:'demo-seller',name:'Aarav · Demo seller',email:'seller@demo.loopmarket.test',role:'student'}, {id:'demo-admin',name:'Campus moderator',email:'admin@demo.loopmarket.test',role:'admin'}];
export async function seed(env:Env){
 if(await env.DB.prepare("SELECT value FROM settings WHERE key='seeded'").first()) return;
 const now=new Date().toISOString();
 const start=new Date().toISOString().slice(0,10); const end=new Date(Date.now()+365*86400000).toISOString().slice(0,10);
 const items=[
 ['maths','Engineering Mathematics · B.S. Grewal','Books','sell',300,'Like New','Library entrance','book.jpg','A helpful companion for your first-year engineering courses. Clean pages with a few pencil notes. Illustrative demonstration listing.','Original textbook','active','demo-seller'],
 ['macbook','MacBook Air M1 · 256 GB','Electronics','sell',35000,'Good','SOC main building','laptop.jpg','Lightweight laptop with an M1 chip, 8 GB memory and 256 GB SSD. Includes its charger. Product photograph is illustrative; this is a demonstration listing.','Laptop, charger and sleeve','active','demo-seller'],
 ['chair','Your new favourite study chair','Furniture','sell',800,'Good','Hostel A lobby','chair.jpg','Comfortable desk chair for late-night assignments. Adjust the seat height and settle into your study corner. Demo listing.','Study chair','active','demo-student'],
 ['calculator','Scientific calculator','Stationery','sell',600,'Like New','SOC main building','calculator.jpg','Scientific calculator for engineering classes and exam preparation. Buttons and display in good working condition. Demo listing.','Calculator and protective cover','active','demo-seller'],
 ['headphones','Over-ear headphones','Electronics','sell',1200,'Like New','Library entrance','headphones.jpg','A little focus for your next study session. Comfortable ear cushions and a clear sound. Illustrative demo listing.','Headphones','active','demo-seller'],
 ['coat','Lab coat · Size M','Clothing','sell',400,'Like New','Engineering block','labcoat.jpg','Clean white laboratory coat in medium. Ready for practical sessions. Illustrative demonstration listing.','One lab coat','active','demo-student'],
 ['backpack','Everyday campus backpack','Hostel Items','sell',700,'Good','Hostel B lobby','backpack.jpg','Room for your laptop, books and all the little campus essentials. Illustrative demonstration listing.','Backpack','active','demo-seller'],
 ['racket','Badminton racket','Sports','sell',900,'Good','Sports complex','racket.jpg','Get a game going after lectures. Lightweight racket for casual campus matches. Illustrative demo listing.','Racket and cover','active','demo-seller'],
 ['arduino','Arduino starter kit','Lab Equipment','sell',950,'Like New','SOC innovation lab','arduino.jpg','Start building your next project with an Arduino-compatible starter kit. Includes basic prototyping components. Illustrative demo listing.','Board, breadboard, jumpers and USB cable','active','demo-student'],
 ['camera','Camera for your next campus story','Electronics','rent',350,'Good','SOC main building','camera.jpg','Borrow a camera for a club event, a short film or a weekend photo walk. Illustrative demonstration listing.','Camera, kit lens, battery and carry bag','active','demo-seller'],
 ['lamp','A little light for your desk','Hostel Items','giveaway',0,'Good','Hostel A lobby','lamp.jpg','Moving out and passing this desk lamp on to someone who can use it. A small second life for a useful everyday item. Demo listing.','Desk lamp','active','demo-seller'],
 ['notes','Notebooks for a fresh semester','Stationery','giveaway',0,'New','Library entrance','notebooks.jpg','A small stack of unused notebooks looking for a new desk. Free for a fellow student. Illustrative demo listing.','Three notebooks','active','demo-student'],
 ['table','Compact study table','Furniture','sell',1800,'Good','Hostel A lobby','table.jpg','Compact wooden study table. This demonstration record is saved as a draft.','Study table','draft','demo-student'],
 ['old-book','First-year physics textbook','Books','sell',250,'Good','Library entrance','book.jpg','A completed demonstration sale.','Textbook','sold','demo-student'],
 ['old-notes','Semester stationery bundle','Stationery','giveaway',0,'Good','SOC main building','notebooks.jpg','A completed demonstration giveaway.','Stationery','given_away','demo-student']
 ];
 const stmts=demoUsers.map(u=>env.DB.prepare('INSERT OR IGNORE INTO users(id,name,email,student_id,role,status,demo,created_at) VALUES(?,?,?,?,?,?,1,?)').bind(u.id,u.name,u.email,'DEMO-'+u.id,u.role,'approved',now));
 items.forEach((i,n)=>{
  const [id,title,category,type,price,condition,location,photo,description,included,status,owner]=i;
  const created=new Date(Date.now()-(n+1)*6*3600000).toISOString();
  stmts.push(env.DB.prepare('INSERT OR IGNORE INTO listings(id,owner_id,title,description,category,type,price,condition,location,status,rental_unit,deposit,available_from,available_to,terms,included,demo,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)').bind(id,owner,title,description,category,type,price,condition,location,status,'day',type==='rent'?1500:0,type==='rent'?start:null,type==='rent'?end:null,type==='rent'?'Campus pickup only. Keep equipment dry and return with all included accessories. Refundable deposit is coordinated in person.':'',included,created,created));
  stmts.push(env.DB.prepare('INSERT OR IGNORE INTO listing_images(id,listing_id,url,position) VALUES(?,?,?,0)').bind('img-'+id,id,'/images/'+photo));
 });
 stmts.push(env.DB.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('seeded',?)").bind(now));
 await env.DB.batch(stmts);
}
