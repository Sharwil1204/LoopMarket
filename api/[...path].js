// server/seed.ts
var demoUsers = [{ id: "demo-student", name: "Sharwil Rajurwar", email: "student@demo.loopmarket.test", role: "student" }, { id: "demo-seller", name: "Aarav \xB7 Demo seller", email: "seller@demo.loopmarket.test", role: "student" }, { id: "demo-admin", name: "Campus moderator", email: "admin@demo.loopmarket.test", role: "admin" }];
async function seed(env) {
  if (await env.DB.prepare("SELECT value FROM settings WHERE key='seeded'").first()) return;
  const now2 = (/* @__PURE__ */ new Date()).toISOString();
  const start = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const end = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10);
  const items = [
    ["maths", "Engineering Mathematics \xB7 B.S. Grewal", "Books", "sell", 300, "Like New", "Library entrance", "book.jpg", "A helpful companion for your first-year engineering courses. Clean pages with a few pencil notes. Illustrative demonstration listing.", "Original textbook", "active", "demo-seller"],
    ["macbook", "MacBook Air M1 \xB7 256 GB", "Electronics", "sell", 35e3, "Good", "SOC main building", "laptop.jpg", "Lightweight laptop with an M1 chip, 8 GB memory and 256 GB SSD. Includes its charger. Product photograph is illustrative; this is a demonstration listing.", "Laptop, charger and sleeve", "active", "demo-seller"],
    ["chair", "Your new favourite study chair", "Furniture", "sell", 800, "Good", "Hostel A lobby", "chair.jpg", "Comfortable desk chair for late-night assignments. Adjust the seat height and settle into your study corner. Demo listing.", "Study chair", "active", "demo-student"],
    ["calculator", "Scientific calculator", "Stationery", "sell", 600, "Like New", "SOC main building", "calculator.jpg", "Scientific calculator for engineering classes and exam preparation. Buttons and display in good working condition. Demo listing.", "Calculator and protective cover", "active", "demo-seller"],
    ["headphones", "Over-ear headphones", "Electronics", "sell", 1200, "Like New", "Library entrance", "headphones.jpg", "A little focus for your next study session. Comfortable ear cushions and a clear sound. Illustrative demo listing.", "Headphones", "active", "demo-seller"],
    ["coat", "Lab coat \xB7 Size M", "Clothing", "sell", 400, "Like New", "Engineering block", "labcoat.jpg", "Clean white laboratory coat in medium. Ready for practical sessions. Illustrative demonstration listing.", "One lab coat", "active", "demo-student"],
    ["backpack", "Everyday campus backpack", "Hostel Items", "sell", 700, "Good", "Hostel B lobby", "backpack.jpg", "Room for your laptop, books and all the little campus essentials. Illustrative demonstration listing.", "Backpack", "active", "demo-seller"],
    ["racket", "Badminton racket", "Sports", "sell", 900, "Good", "Sports complex", "racket.jpg", "Get a game going after lectures. Lightweight racket for casual campus matches. Illustrative demo listing.", "Racket and cover", "active", "demo-seller"],
    ["arduino", "Arduino starter kit", "Lab Equipment", "sell", 950, "Like New", "SOC innovation lab", "arduino.jpg", "Start building your next project with an Arduino-compatible starter kit. Includes basic prototyping components. Illustrative demo listing.", "Board, breadboard, jumpers and USB cable", "active", "demo-student"],
    ["camera", "Camera for your next campus story", "Electronics", "rent", 350, "Good", "SOC main building", "camera.jpg", "Borrow a camera for a club event, a short film or a weekend photo walk. Illustrative demonstration listing.", "Camera, kit lens, battery and carry bag", "active", "demo-seller"],
    ["lamp", "A little light for your desk", "Hostel Items", "giveaway", 0, "Good", "Hostel A lobby", "lamp.jpg", "Moving out and passing this desk lamp on to someone who can use it. A small second life for a useful everyday item. Demo listing.", "Desk lamp", "active", "demo-seller"],
    ["notes", "Notebooks for a fresh semester", "Stationery", "giveaway", 0, "New", "Library entrance", "notebooks.jpg", "A small stack of unused notebooks looking for a new desk. Free for a fellow student. Illustrative demo listing.", "Three notebooks", "active", "demo-student"],
    ["table", "Compact study table", "Furniture", "sell", 1800, "Good", "Hostel A lobby", "table.jpg", "Compact wooden study table. This demonstration record is saved as a draft.", "Study table", "draft", "demo-student"],
    ["old-book", "First-year physics textbook", "Books", "sell", 250, "Good", "Library entrance", "book.jpg", "A completed demonstration sale.", "Textbook", "sold", "demo-student"],
    ["old-notes", "Semester stationery bundle", "Stationery", "giveaway", 0, "Good", "SOC main building", "notebooks.jpg", "A completed demonstration giveaway.", "Stationery", "given_away", "demo-student"]
  ];
  const stmts = demoUsers.map((u) => env.DB.prepare("INSERT OR IGNORE INTO users(id,name,email,student_id,role,status,demo,created_at) VALUES(?,?,?,?,?,?,1,?)").bind(u.id, u.name, u.email, "DEMO-" + u.id, u.role, "approved", now2));
  items.forEach((i, n) => {
    const [id, title, category, type, price, condition, location, photo, description, included, status, owner] = i;
    const created = new Date(Date.now() - (n + 1) * 6 * 36e5).toISOString();
    stmts.push(env.DB.prepare("INSERT OR IGNORE INTO listings(id,owner_id,title,description,category,type,price,condition,location,status,rental_unit,deposit,available_from,available_to,terms,included,demo,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)").bind(id, owner, title, description, category, type, price, condition, location, status, "day", type === "rent" ? 1500 : 0, type === "rent" ? start : null, type === "rent" ? end : null, type === "rent" ? "Campus pickup only. Keep equipment dry and return with all included accessories. Refundable deposit is coordinated in person." : "", included, created, created));
    stmts.push(env.DB.prepare("INSERT OR IGNORE INTO listing_images(id,listing_id,url,position) VALUES(?,?,?,0)").bind("img-" + id, id, "/images/" + photo));
  });
  stmts.push(env.DB.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('seeded',?)").bind(now2));
  await env.DB.batch(stmts);
}

// server/api.ts
var CATEGORIES = ["Books", "Electronics", "Hostel Items", "Stationery", "Clothing", "Sports", "Lab Equipment", "Furniture", "Others"];
var CONDITIONS = ["New", "Like New", "Good", "Used"];
var uuid = () => crypto.randomUUID();
var now = () => (/* @__PURE__ */ new Date()).toISOString();
var today = () => new Date(Date.now() + 198e5).toISOString().slice(0, 10);
var clientIp = (req) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || req.headers.get("cf-connecting-ip") || "local";
var HttpError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
function fail(status, message) {
  throw new HttpError(status, message);
}
var json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers } });
var text = (v, name, min = 1, max = 2e3) => {
  if (typeof v !== "string" || v.trim().length < min || v.trim().length > max) fail(400, `${name} must contain ${min}\u2013${max} characters.`);
  return v.trim();
};
var choice = (v, options, label) => {
  if (!options.includes(v)) fail(400, `Choose a valid ${label}.`);
  return v;
};
var money = (v, label, min = 0) => {
  const n = Number(v);
  if (v === "" || v == null || !Number.isFinite(n) || n < min || n > 1e7) fail(400, `Enter a valid ${label}${min ? " greater than zero" : ""}.`);
  return Math.round(n * 100) / 100;
};
var date = (v) => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v + "T00:00:00Z")) || (/* @__PURE__ */ new Date(v + "T00:00:00Z")).toISOString().slice(0, 10) !== v) fail(400, "Choose a valid date.");
  return v;
};
async function body(req) {
  try {
    return await req.json();
  } catch {
    fail(400, "Send a valid request.");
  }
}
var publicUser = (u) => u ? { id: u.id, name: u.name, email: u.email, studentId: u.student_id, role: u.role, status: u.status, reason: u.reason, bio: u.bio, campus: u.campus, demo: !!u.demo } : null;
async function hash(value, salt) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(value), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: 1e5, hash: "SHA-256" }, material, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function equal(a, b) {
  let result = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return result === 0;
}
async function demoAdminAllowed(env) {
  return env.DEMO_MODE === "true" && env.DEMO_ADMIN_ENABLED === "true" && !await env.DB.prepare("SELECT value FROM settings WHERE key='owner_setup'").first();
}
async function user(req, env, required = true, approved = false, admin = false) {
  const token = req.headers.get("cookie")?.match(/(?:^|;\s*)lm_session=([a-f0-9-]+)/)?.[1];
  const u = token ? await env.DB.prepare("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires_at>?").bind(token, now()).first() : null;
  if (u?.demo && (env.DEMO_MODE !== "true" || u.role === "admin" && !await demoAdminAllowed(env))) {
    if (required) fail(401, "This demo session is no longer available. Please log in.");
    return null;
  }
  if (!u && required) fail(401, "Please log in to continue.");
  if (required && u?.status === "suspended") fail(403, "Your account is suspended. Contact your campus moderator for help.");
  if (approved && u?.status !== "approved") fail(403, "Campus access is awaiting manual approval. You can browse while your request is reviewed.");
  if (admin && u?.role !== "admin") fail(403, "Administrator access is required.");
  return u;
}
async function session(req, env, u) {
  const id = uuid();
  await env.DB.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES(?,?,?)").bind(id, u.id, new Date(Date.now() + 7 * 864e5).toISOString()).run();
  return json({ user: publicUser(u) }, 200, { "Set-Cookie": `lm_session=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${new URL(req.url).protocol === "https:" ? "; Secure" : ""}` });
}
var notify = (env, userId, title, message, href) => env.DB.prepare("INSERT INTO notifications(id,user_id,title,body,href,created_at) VALUES(?,?,?,?,?,?)").bind(uuid(), userId, title, message, href, now());
var audit = (env, actor, action, target, reason) => env.DB.prepare("INSERT INTO audit_records(id,actor_id,action,target_id,reason,created_at) VALUES(?,?,?,?,?,?)").bind(uuid(), actor, action, target, reason, now());
async function listing(env, id) {
  const l = await env.DB.prepare("SELECT l.*,u.name seller_name,u.status seller_status,u.demo seller_demo FROM listings l JOIN users u ON u.id=l.owner_id WHERE l.id=?").bind(id).first();
  if (!l) fail(404, "This listing could not be found.");
  return l;
}
async function images(env, items, uid) {
  if (!items.length) return items;
  const ids = items.map((i) => i.id);
  const marks = ids.map(() => "?").join(",");
  const photos = (await env.DB.prepare(`SELECT * FROM listing_images WHERE listing_id IN (${marks}) ORDER BY position`).bind(...ids).all()).results;
  const favs = uid ? (await env.DB.prepare("SELECT listing_id FROM favourites WHERE user_id=?").bind(uid).all()).results : [];
  return items.map((l) => ({ ...l, images: photos.filter((p) => p.listing_id === l.id).map((p) => p.url), saved: favs.some((f) => f.listing_id === l.id) }));
}
async function conversation(env, id, uid) {
  const c = await env.DB.prepare("SELECT c.*,l.title,l.type,l.price,l.rental_unit,l.status listing_status,l.owner_id,l.demo,bu.name buyer_name,su.name seller_name FROM conversations c JOIN listings l ON l.id=c.listing_id JOIN users bu ON bu.id=c.buyer_id JOIN users su ON su.id=c.seller_id WHERE c.id=?").bind(id).first();
  if (!c || c.buyer_id !== uid && c.seller_id !== uid) fail(404, "Conversation not found.");
  return c;
}
async function listingInput(b, u, env, old) {
  const type = choice(b.type, ["sell", "rent", "giveaway"], "listing type");
  const result = { title: text(b.title, "Title", 1, 100), description: text(b.description, "Description", 1, 2e3), category: choice(b.category, CATEGORIES, "category"), type, price: type === "giveaway" ? 0 : money(b.price, "price", 0.01), condition: choice(b.condition, CONDITIONS, "condition"), location: text(b.location, "Pickup location", 2, 120), status: choice(b.status, ["draft", "active"], "publication status"), rental_unit: "day", deposit: 0, available_from: null, available_to: null, terms: "", included: typeof b.included === "string" ? b.included.trim().slice(0, 500) : "" };
  if (type === "rent") {
    result.rental_unit = choice(b.rental_unit, ["day", "week", "month"], "rental unit");
    result.deposit = money(b.deposit, "deposit");
    result.available_from = date(b.available_from);
    result.available_to = date(b.available_to);
    if (result.available_from > result.available_to || result.available_to < today()) fail(400, "Rental availability must end on or after its start and today.");
    result.terms = text(b.terms, "Rental terms", 5, 1e3);
  }
  if (!Array.isArray(b.images) || b.images.length > 5) fail(400, "Add up to five photos.");
  if (result.status === "active" && !b.images.length) fail(400, "Add at least one product photo before publishing.");
  for (const url of b.images) {
    if (typeof url !== "string") fail(400, "Invalid image.");
    if (old?.images.includes(url)) continue;
    const id = url.match(/^\/api\/images\/([a-f0-9-]+)$/)?.[1];
    if (!id || !await env.DB.prepare("SELECT id FROM uploads WHERE id=? AND owner_id=?").bind(id, u.id).first()) fail(400, "Only your uploaded photos can be attached.");
  }
  return { ...result, images: b.images };
}
async function rateLimit(env, key) {
  const start = new Date(Date.now() - 15 * 60 * 1e3).toISOString();
  await env.DB.prepare("DELETE FROM auth_attempts WHERE window_start<?").bind(start).run();
  await env.DB.prepare("INSERT INTO auth_attempts(key,attempts,window_start) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=auth_attempts.attempts+1").bind(key, now()).run();
  const attempt = await env.DB.prepare("SELECT attempts FROM auth_attempts WHERE key=?").bind(key).first();
  if (attempt.attempts > 20) fail(429, "Too many attempts. Please try again in 15 minutes.");
}
async function ownerInvitation(req, env) {
  const token = req.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  const expiry = Date.parse(env.OWNER_SETUP_EXPIRES_AT || "");
  if (!token || !env.OWNER_SETUP_TOKEN_HASH || !Number.isFinite(expiry) || expiry <= Date.now()) fail(403, "This owner setup link is missing, invalid or expired.");
  const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)))].map((n) => n.toString(16).padStart(2, "0")).join("");
  if (!equal(digest, env.OWNER_SETUP_TOKEN_HASH)) fail(403, "This owner setup link is missing, invalid or expired.");
  if (await env.DB.prepare("SELECT value FROM settings WHERE key='owner_setup'").first()) fail(409, "Owner setup is already complete. Sign in with your owner account.");
}
async function handleApi(req, env) {
  try {
    const url = new URL(req.url), p = url.pathname.replace(/\/$/, ""), method = req.method;
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      const origin = req.headers.get("origin");
      if (origin && origin !== url.origin) fail(403, "Cross-site requests are not allowed.");
      if (req.headers.get("sec-fetch-site") === "cross-site") fail(403, "Cross-site requests are not allowed.");
      const len = Number(req.headers.get("content-length") || 0);
      if (len > 6 * 1024 * 1024) fail(413, "Upload one photo at a time, up to 5 MB.");
    }
    if (env.DEMO_MODE === "true") await seed(env);
    if ((p === "/api/seed" || p === "/api/admin/seed") && ["GET", "POST"].includes(method)) {
      await seed(env);
      return json({ seeded: true, message: "Sample campus listings seeded successfully." });
    }
    if (p === "/api/auth/owner-setup" && method === "GET") {
      await ownerInvitation(req, env);
      return json({ available: true });
    }
    if (p === "/api/auth/owner-setup" && method === "POST") {
      await rateLimit(env, "owner-setup:" + clientIp(req));
      await ownerInvitation(req, env);
      const b = await body(req), name = text(b.name, "Full name", 2, 80), email = text(b.email, "Email", 5, 254).toLowerCase(), password = text(b.password, "Password", 10, 128);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, "Enter a valid email address.");
      if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) fail(400, "Use at least 10 characters including a letter and a number.");
      if (password !== b.confirmPassword) fail(400, "Passwords do not match.");
      if (b.terms !== true) fail(400, "Accept the platform terms to continue.");
      const existing = await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(email).first();
      if (existing?.demo) fail(400, "Choose your own email, not a demonstration profile.");
      if (existing && existing.id !== (await user(req, env, false))?.id) fail(409, "This email already has an account. Log into it, then reopen your owner setup link.");
      const id = existing?.id || uuid(), salt = uuid(), passwordHash = await hash(password, salt);
      const statements = [env.DB.prepare("INSERT INTO settings(key,value) VALUES('owner_setup',?)").bind(id)];
      if (existing) statements.push(env.DB.prepare("UPDATE users SET name=?,password_hash=?,salt=?,role='admin',status='approved',reason='Owner access established through a private setup link' WHERE id=?").bind(name, passwordHash, salt, id));
      else statements.push(env.DB.prepare("INSERT INTO users(id,name,email,student_id,password_hash,salt,role,status,demo,reason,created_at) VALUES(?,?,?,'OWNER',?,?,'admin','approved',0,'Owner access established through a private setup link',?)").bind(id, name, email, passwordHash, salt, now()));
      statements.push(env.DB.prepare("UPDATE access_requests SET status='approved',reason='Owner setup completed',reviewed_by=?,reviewed_at=? WHERE user_id=?").bind(id, now(), id), env.DB.prepare("DELETE FROM sessions WHERE user_id=? OR user_id IN (SELECT id FROM users WHERE demo=1 AND role='admin')").bind(id), audit(env, id, "owner.created", id, "Owner claimed a private one-time setup link"));
      await env.DB.batch(statements);
      return session(req, env, await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(id).first());
    }
    if (p === "/api/config" && method === "GET") return json({ demo: env.DEMO_MODE === "true", demoAdmin: await demoAdminAllowed(env), domains: (env.UNIVERSITY_EMAIL_DOMAINS || "").split(",").map((s) => s.trim()).filter(Boolean), verification: "manual", categories: CATEGORIES, conditions: CONDITIONS });
    if (p === "/api/auth/register" && method === "POST") {
      const b = await body(req);
      if (b.role && b.role !== "student") fail(403, "Administrator roles cannot be requested through registration.");
      const name = text(b.name, "Full name", 2, 80), email = text(b.email, "Email", 5, 254).toLowerCase(), studentId = text(b.studentId, "Student ID", 3, 60), password = text(b.password, "Password", 10, 128);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, "Enter a valid email address.");
      if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) fail(400, "Use at least 10 characters including a letter and a number.");
      if (password !== b.confirmPassword) fail(400, "Passwords do not match.");
      if (b.terms !== true) fail(400, "Accept the platform terms to continue.");
      const domains = (env.UNIVERSITY_EMAIL_DOMAINS || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
      if (domains.length && !domains.includes(email.split("@")[1])) fail(400, "Use an email from an approved campus domain.");
      await rateLimit(env, "register:" + (clientIp(req) || email));
      if (await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first()) fail(409, "An account already exists with this email. Please log in.");
      const id = uuid(), salt = uuid(), passwordHash = await hash(password, salt);
      await env.DB.batch([env.DB.prepare("INSERT INTO users(id,name,email,student_id,password_hash,salt,created_at) VALUES(?,?,?,?,?,?,?)").bind(id, name, email, studentId, passwordHash, salt, now()), env.DB.prepare("INSERT INTO access_requests(id,user_id,created_at) VALUES(?,?,?)").bind(uuid(), id, now())]);
      const u = await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(id).first();
      return session(req, env, u);
    }
    if (p === "/api/auth/login" && method === "POST") {
      const b = await body(req), email = text(b.email, "Email", 3, 254).toLowerCase();
      await rateLimit(env, "login:" + email);
      const u = await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(email).first();
      const candidate = await hash(typeof b.password === "string" ? b.password : "", u?.salt || "invalid-account-timing-salt");
      if (!u?.password_hash || !equal(candidate, u.password_hash)) {
        if (u) await audit(env, u.id, "auth.failed", u.id, "Failed sign-in attempt: incorrect password").run();
        fail(401, "Unable to log in with these details.");
      }
      if (u.status === "suspended") {
        await audit(env, u.id, "auth.blocked", u.id, "Blocked sign-in attempt: account is suspended").run();
        fail(403, "This account is suspended. Contact your campus moderator.");
      }
      await env.DB.prepare("DELETE FROM auth_attempts WHERE key=?").bind("login:" + email).run();
      await audit(env, u.id, "auth.login", u.id, "Signed in successfully").run();
      return session(req, env, u);
    }
    if (p === "/api/auth/demo" && method === "POST") {
      if (env.DEMO_MODE !== "true") fail(404, "Demo access is disabled.");
      const b = await body(req);
      const role = choice(b.role, ["student", "seller", "admin"], "demo account");
      if (role === "admin" && !await demoAdminAllowed(env)) fail(403, "Demo administration is disabled. Use your owner email and password.");
      const u = await env.DB.prepare("SELECT * FROM users WHERE id=?").bind("demo-" + role).first();
      if (u.status !== "approved") fail(403, "This demo account is not active.");
      return session(req, env, u);
    }
    if (p === "/api/auth/logout" && method === "POST") {
      const token = req.headers.get("cookie")?.match(/lm_session=([a-f0-9-]+)/)?.[1];
      if (token) await env.DB.prepare("DELETE FROM sessions WHERE id=?").bind(token).run();
      return json({ ok: true }, 200, { "Set-Cookie": "lm_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" });
    }
    if (p === "/api/me" && method === "GET") return json({ user: publicUser(await user(req, env, false)) });
    if (p === "/api/me" && method === "PATCH") {
      const u = await user(req, env), b = await body(req);
      await env.DB.prepare("UPDATE users SET name=?,bio=? WHERE id=?").bind(text(b.name, "Name", 2, 80), typeof b.bio === "string" ? b.bio.trim().slice(0, 500) : "", u.id).run();
      return json({ user: publicUser(await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(u.id).first()) });
    }
    if (p === "/api/listings" && method === "GET") {
      const u = await user(req, env, false), q = url.searchParams, where = ["l.status!='draft'", "l.status!='archived'", "u.status='approved'"], params = [];
      const status = q.get("availability") || "active";
      if (status !== "all") {
        choice(status, ["active", "reserved", "sold", "given_away"], "availability");
        where.push("l.status=?");
        params.push(status);
      }
      const keyword = (q.get("q") || "").trim().slice(0, 120);
      if (keyword) {
        where.push("(l.title LIKE ? ESCAPE '\\' OR l.description LIKE ? ESCAPE '\\')");
        const pat = "%" + keyword.replace(/[\\%_]/g, "\\$&") + "%";
        params.push(pat, pat);
      }
      for (const [key, options] of [["category", CATEGORIES], ["type", ["sell", "rent", "giveaway"]], ["condition", CONDITIONS]]) {
        const v = q.get(key);
        if (v) {
          choice(v, options, key);
          where.push(`l.${key}=?`);
          params.push(v);
        }
      }
      const min = q.has("min") ? money(q.get("min"), "minimum price") : 0, max = q.has("max") ? money(q.get("max"), "maximum price") : 1e7;
      if (min > max) fail(400, "Minimum price cannot exceed maximum price.");
      where.push("l.price>=? AND l.price<=?");
      params.push(min, max);
      const sort = q.get("sort") === "price-asc" ? "l.price ASC" : q.get("sort") === "price-desc" ? "l.price DESC" : "l.created_at DESC";
      const rows = (await env.DB.prepare(`SELECT l.*,u.name seller_name,u.demo seller_demo FROM listings l JOIN users u ON u.id=l.owner_id WHERE ${where.join(" AND ")} ORDER BY ${sort} LIMIT 200`).bind(...params).all()).results;
      return json({ listings: await images(env, rows, u?.id), total: rows.length });
    }
    if (p === "/api/my-listings" && method === "GET") {
      const u = await user(req, env);
      const rows = (await env.DB.prepare("SELECT * FROM listings WHERE owner_id=? ORDER BY created_at DESC").bind(u.id).all()).results;
      return json({ listings: await images(env, rows, u.id) });
    }
    if (p === "/api/listings" && method === "POST") {
      const u = await user(req, env, true, true), b = await body(req), data = await listingInput(b, u, env), id = uuid();
      const fields = Object.keys(data).filter((k) => k !== "images");
      const stmts = [env.DB.prepare(`INSERT INTO listings(id,owner_id,${fields.join(",")},created_at,updated_at) VALUES(${Array(fields.length + 4).fill("?").join(",")})`).bind(id, u.id, ...fields.map((k) => data[k]), now(), now())];
      data.images.forEach((photo, i) => stmts.push(env.DB.prepare("INSERT INTO listing_images(id,listing_id,url,position) VALUES(?,?,?,?)").bind(uuid(), id, photo, i)));
      stmts.push(audit(env, u.id, "listing.created", id, data.status));
      await env.DB.batch(stmts);
      return json({ id }, 201);
    }
    let m = p.match(/^\/api\/listings\/([^/]+)$/);
    if (m && method === "GET") {
      const u = await user(req, env, false), l = await listing(env, m[1]);
      if ((["draft", "archived"].includes(l.status) || l.seller_status !== "approved") && u?.id !== l.owner_id && u?.role !== "admin") fail(404, "This listing is not available.");
      const [item] = await images(env, [l], u?.id);
      const bookings = (await env.DB.prepare("SELECT start_date,end_date,status FROM rental_bookings WHERE listing_id=? AND status IN ('booked','on_loan') ORDER BY start_date").bind(l.id).all()).results;
      return json({ listing: { ...item, bookings } });
    }
    if (m && method === "PUT") {
      const u = await user(req, env, true, true), old = await listing(env, m[1]);
      if (old.owner_id !== u.id) fail(403, "You can only edit your own listings.");
      if (!["draft", "active"].includes(old.status)) fail(409, "Only active listings and drafts can be edited.");
      const [existing] = await images(env, [old]);
      const data = await listingInput(await body(req), u, env, existing);
      if (data.type !== old.type && await env.DB.prepare("SELECT id FROM exchange_requests WHERE listing_id=? LIMIT 1").bind(old.id).first()) fail(409, "Keep the listing type unchanged once requests exist.");
      const fields = Object.keys(data).filter((k) => k !== "images");
      const stmts = [env.DB.prepare(`UPDATE listings SET ${fields.map((k) => `${k}=?`).join(",")},updated_at=? WHERE id=? AND owner_id=?`).bind(...fields.map((k) => data[k]), now(), old.id, u.id), env.DB.prepare("DELETE FROM listing_images WHERE listing_id=?").bind(old.id)];
      data.images.forEach((photo, i) => stmts.push(env.DB.prepare("INSERT INTO listing_images(id,listing_id,url,position) VALUES(?,?,?,?)").bind(uuid(), old.id, photo, i)));
      stmts.push(audit(env, u.id, "listing.edited", old.id, data.status));
      await env.DB.batch(stmts);
      return json({ id: old.id });
    }
    m = p.match(/^\/api\/listings\/([^/]+)\/status$/);
    if (m && method === "POST") {
      const u = await user(req, env, true, true), l = await listing(env, m[1]), b = await body(req);
      if (l.owner_id !== u.id) fail(403, "You can only manage your own listings.");
      const status = choice(b.status, ["active", "archived", "sold", "given_away"], "status");
      if (await env.DB.prepare("SELECT id FROM exchange_requests WHERE listing_id=? AND status IN ('accepted','handed_over')").bind(l.id).first()) fail(409, "Complete or cancel the accepted request in your inbox first.");
      if (status === "active" && !["draft", "archived"].includes(l.status)) fail(409, "This listing cannot be republished.");
      if (status === "active") {
        const [item] = await images(env, [l]);
        await listingInput({ ...l, images: item.images, status }, u, env, item);
      }
      if (status === "sold" && (l.type !== "sell" || l.status !== "active") || status === "given_away" && (l.type !== "giveaway" || l.status !== "active")) fail(409, "That status does not apply to this listing.");
      await env.DB.batch([env.DB.prepare("UPDATE listings SET status=?,updated_at=? WHERE id=?").bind(status, now(), l.id), audit(env, u.id, "listing." + status, l.id, "Owner updated availability")]);
      return json({ ok: true });
    }
    if (p === "/api/uploads" && method === "POST") {
      const u = await user(req, env, true, true), form = await req.formData(), file = form.get("file");
      if (!(file instanceof File)) fail(400, "Choose a product photo.");
      if (file.size > 5 * 1024 * 1024) fail(400, "Each photo must be 5 MB or smaller.");
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) fail(400, "Use JPG, PNG or WebP photos.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const sig = file.type === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : file.type === "image/png" ? bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10" : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
      if (!sig) fail(400, "The file contents are not a supported photo.");
      const id = uuid();
      await env.BUCKET.put(id, bytes, { httpMetadata: { contentType: file.type } });
      await env.DB.prepare("INSERT INTO uploads(id,owner_id,mime,size,created_at) VALUES(?,?,?,?,?)").bind(id, u.id, file.type, file.size, now()).run();
      return json({ url: "/api/images/" + id }, 201);
    }
    m = p.match(/^\/api\/images\/([a-f0-9-]+)$/);
    if (m && method === "GET") {
      const img = await env.DB.prepare("SELECT * FROM uploads WHERE id=?").bind(m[1]).first();
      if (!img) fail(404, "Photo not found.");
      const object = await env.BUCKET.get(m[1]);
      if (!object) fail(404, "Photo not found.");
      return new Response(object.body, { headers: { "Content-Type": img.mime, "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=86400" } });
    }
    if (p === "/api/saved" && method === "GET") {
      const u = await user(req, env);
      const rows = (await env.DB.prepare("SELECT l.*,u.name seller_name FROM favourites f JOIN listings l ON l.id=f.listing_id JOIN users u ON u.id=l.owner_id WHERE f.user_id=? AND l.status NOT IN ('archived','draft') AND u.status='approved' ORDER BY l.created_at DESC").bind(u.id).all()).results;
      return json({ listings: await images(env, rows, u.id) });
    }
    m = p.match(/^\/api\/saved\/([^/]+)$/);
    if (m && ["POST", "DELETE"].includes(method)) {
      const u = await user(req, env);
      const l = await listing(env, m[1]);
      if (["draft", "archived"].includes(l.status) || l.seller_status !== "approved") fail(404, "Listing unavailable.");
      if (method === "POST") await env.DB.prepare("INSERT OR IGNORE INTO favourites(user_id,listing_id) VALUES(?,?)").bind(u.id, l.id).run();
      else await env.DB.prepare("DELETE FROM favourites WHERE user_id=? AND listing_id=?").bind(u.id, l.id).run();
      return json({ saved: method === "POST" });
    }
    if (p === "/api/conversations" && method === "POST") {
      const u = await user(req, env, true, true), b = await body(req), l = await listing(env, text(b.listingId, "Listing", 1, 100));
      if (l.owner_id === u.id) fail(400, "You cannot enquire about your own listing.");
      if (l.status !== "active" || l.seller_status !== "approved") fail(409, "This listing is no longer available for new enquiries.");
      const message = text(b.message, "Message", 1, 2e3), nonce = text(b.nonce, "Request identifier", 8, 100);
      const existing = await env.DB.prepare("SELECT id FROM conversations WHERE listing_id=? AND buyer_id=?").bind(l.id, u.id).first();
      if (existing) return json({ id: existing.id, existing: true });
      const id = uuid();
      await env.DB.batch([env.DB.prepare("INSERT INTO conversations(id,listing_id,buyer_id,seller_id,created_at,updated_at) VALUES(?,?,?,?,?,?)").bind(id, l.id, u.id, l.owner_id, now(), now()), env.DB.prepare("INSERT INTO messages(id,conversation_id,sender_id,body,nonce,created_at) VALUES(?,?,?,?,?,?)").bind(uuid(), id, u.id, message, nonce, now()), notify(env, l.owner_id, "New enquiry", `${u.name} asked about ${l.title}.`, "/inbox/" + id)]);
      return json({ id }, 201);
    }
    if (p === "/api/conversations" && method === "GET") {
      const u = await user(req, env);
      const list = (await env.DB.prepare("SELECT c.*,l.title,l.type,l.status listing_status,b.name buyer_name,s.name seller_name,(SELECT url FROM listing_images WHERE listing_id=l.id ORDER BY position LIMIT 1) image,(SELECT body FROM messages WHERE conversation_id=c.id ORDER BY created_at DESC LIMIT 1) last_message FROM conversations c JOIN listings l ON l.id=c.listing_id JOIN users b ON b.id=c.buyer_id JOIN users s ON s.id=c.seller_id WHERE c.buyer_id=? OR c.seller_id=? ORDER BY c.updated_at DESC").bind(u.id, u.id).all()).results;
      return json({ conversations: list });
    }
    m = p.match(/^\/api\/conversations\/([^/]+)$/);
    if (m && method === "GET") {
      const u = await user(req, env), c = await conversation(env, m[1], u.id);
      const msgs = (await env.DB.prepare("SELECT m.*,u.name sender_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE conversation_id=? ORDER BY m.created_at").bind(c.id).all()).results;
      const requests = (await env.DB.prepare("SELECT * FROM exchange_requests WHERE conversation_id=? ORDER BY created_at DESC").bind(c.id).all()).results;
      return json({ conversation: c, messages: msgs, requests });
    }
    m = p.match(/^\/api\/conversations\/([^/]+)\/messages$/);
    if (m && method === "POST") {
      const u = await user(req, env, true, true), c = await conversation(env, m[1], u.id), b = await body(req);
      const nonce = text(b.nonce, "Message identifier", 8, 100);
      if (await env.DB.prepare("SELECT id FROM messages WHERE sender_id=? AND nonce=?").bind(u.id, nonce).first()) return json({ ok: true });
      const message = text(b.message, "Message", 1, 2e3);
      await env.DB.batch([env.DB.prepare("INSERT INTO messages(id,conversation_id,sender_id,body,nonce,created_at) VALUES(?,?,?,?,?,?)").bind(uuid(), c.id, u.id, message, nonce, now()), env.DB.prepare("UPDATE conversations SET updated_at=? WHERE id=?").bind(now(), c.id), notify(env, u.id === c.buyer_id ? c.seller_id : c.buyer_id, "New message", `${u.name} replied about ${c.title}.`, "/inbox/" + c.id)]);
      return json({ ok: true });
    }
    m = p.match(/^\/api\/conversations\/([^/]+)\/requests$/);
    if (m && method === "POST") {
      const u = await user(req, env, true, true), c = await conversation(env, m[1], u.id);
      if (c.buyer_id !== u.id) fail(403, "Only the interested buyer or renter can send a request.");
      const l = await listing(env, c.listing_id);
      if (l.status !== "active" || l.seller_status !== "approved") fail(409, "This listing is unavailable.");
      const existing = await env.DB.prepare("SELECT id FROM exchange_requests WHERE conversation_id=? AND status IN ('pending','accepted','handed_over')").bind(c.id).first();
      if (existing) return json({ id: existing.id, existing: true });
      const b = await body(req);
      let start = null, end = null, total = l.price;
      if (l.type === "rent") {
        start = date(b.start_date);
        end = date(b.end_date);
        if (start < today() || start > end || start < l.available_from || end > l.available_to) fail(400, "Choose future dates within the available range, with the end on or after the start.");
        if (await env.DB.prepare("SELECT id FROM rental_bookings WHERE listing_id=? AND status IN ('booked','on_loan') AND start_date<=? AND end_date>=?").bind(l.id, end, start).first()) fail(409, "Those dates overlap an accepted rental. Choose another period.");
        const days = Math.round((Date.parse(end) - Date.parse(start)) / 864e5) + 1;
        total = l.price * Math.ceil(days / (l.rental_unit === "week" ? 7 : l.rental_unit === "month" ? 30 : 1));
      }
      const id = uuid();
      await env.DB.batch([env.DB.prepare("INSERT INTO exchange_requests(id,conversation_id,listing_id,requester_id,start_date,end_date,estimated_total,deposit,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(id, c.id, l.id, u.id, start, end, total, l.deposit, now(), now()), notify(env, c.seller_id, "New " + (l.type === "rent" ? "rental" : l.type === "giveaway" ? "giveaway" : "purchase") + " request", `${u.name} requested ${l.title}.`, "/inbox/" + c.id)]);
      return json({ id }, 201);
    }
    m = p.match(/^\/api\/requests\/([^/]+)$/);
    if (m && method === "POST") {
      const u = await user(req, env, true, true), b = await body(req), r = await env.DB.prepare("SELECT * FROM exchange_requests WHERE id=?").bind(m[1]).first();
      if (!r) fail(404, "Request not found.");
      const c = await conversation(env, r.conversation_id, u.id), l = await listing(env, r.listing_id);
      const action = choice(b.action, ["accept", "decline", "cancel", "handover", "complete"], "action");
      const owner = c.seller_id === u.id;
      if (action !== "cancel" && !owner) fail(403, "Only the listing owner can do that.");
      const transitions = { accept: ["pending", "accepted"], decline: ["pending", "declined"], handover: ["accepted", "handed_over"], complete: [l.type === "rent" ? "handed_over" : "accepted", "completed"] };
      let target;
      if (action === "cancel") {
        if (!["pending", "accepted"].includes(r.status)) fail(409, "This request cannot be cancelled now.");
        target = "cancelled";
      } else {
        const [from, to] = transitions[action];
        if (r.status !== from) fail(409, "This request has already changed. Refresh to see its current status.");
        if (action === "handover" && l.type !== "rent") fail(400, "Handover tracking is for rentals.");
        if (action === "accept" && l.type === "rent" && r.start_date < today()) fail(409, "The requested start date has passed. Ask for a new request.");
        target = to;
      }
      const stmts = [env.DB.prepare("UPDATE exchange_requests SET status=?,updated_at=? WHERE id=? AND status=?").bind(target, now(), r.id, r.status), env.DB.prepare("INSERT INTO notifications(id,user_id,title,body,href,created_at) SELECT ?,?,?,?,?,? WHERE changes()>0").bind(uuid(), owner ? c.buyer_id : c.seller_id, "Request " + target, `${l.title}: ${target.replace("_", " ")}.`, "/inbox/" + c.id, now()), env.DB.prepare("INSERT INTO audit_records(id,actor_id,action,target_id,reason,created_at) SELECT ?,?,?,?,?,? WHERE changes()>0").bind(uuid(), u.id, "request." + target, r.id, "Campus exchange status updated", now()), env.DB.prepare("UPDATE conversations SET updated_at=? WHERE id=? AND changes()>0").bind(now(), c.id)];
      const result = await env.DB.batch(stmts);
      if (!result[0].meta.changes) fail(409, "This request has already changed. Refresh to see its current status.");
      return json({ ok: true, status: target });
    }
    if (p === "/api/notifications" && method === "GET") {
      const u = await user(req, env);
      return json({ notifications: (await env.DB.prepare("SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 80").bind(u.id).all()).results });
    }
    if (p === "/api/notifications/read" && method === "POST") {
      const u = await user(req, env);
      await env.DB.prepare("UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL").bind(now(), u.id).run();
      return json({ ok: true });
    }
    m = p.match(/^\/api\/listings\/([^/]+)\/report$/);
    if (m && method === "POST") {
      const u = await user(req, env, true, true), l = await listing(env, m[1]), b = await body(req);
      const reason = text(b.reason, "Report reason", 10, 1e3);
      await env.DB.prepare("INSERT INTO reports(id,listing_id,reporter_id,reason,created_at) VALUES(?,?,?,?,?)").bind(uuid(), l.id, u.id, reason, now()).run();
      return json({ ok: true }, 201);
    }
    if (p === "/api/admin" && method === "GET") {
      await user(req, env, true, true, true);
      const users = (await env.DB.prepare("SELECT id,name,email,student_id,role,status,reason,demo,created_at FROM users ORDER BY created_at DESC").all()).results;
      const list = (await env.DB.prepare("SELECT l.*,u.name seller_name FROM listings l JOIN users u ON u.id=l.owner_id ORDER BY l.created_at DESC").all()).results;
      const reports = (await env.DB.prepare("SELECT r.*,l.title,u.name reporter_name FROM reports r JOIN listings l ON l.id=r.listing_id JOIN users u ON u.id=r.reporter_id ORDER BY r.created_at DESC").all()).results;
      const logs = (await env.DB.prepare("SELECT a.*,COALESCE(u.name,a.actor_id) actor_name FROM audit_records a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 100").all()).results;
      return json({ users, listings: await images(env, list), reports, audit: logs });
    }
    m = p.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (m && method === "POST") {
      const u = await user(req, env, true, true, true), b = await body(req), status = choice(b.status, ["approved", "rejected", "suspended"], "account status"), reason = text(b.reason, "Decision reason", 5, 500);
      const target = await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(m[1]).first();
      if (!target) fail(404, "Account not found.");
      if (target.role === "admin") fail(400, "Administrator accounts cannot be changed here.");
      await env.DB.batch([env.DB.prepare("UPDATE users SET status=?,reason=? WHERE id=?").bind(status, reason, target.id), env.DB.prepare("UPDATE access_requests SET status=?,reason=?,reviewed_by=?,reviewed_at=? WHERE user_id=?").bind(status, reason, u.id, now(), target.id), notify(env, target.id, "Campus access " + status, reason, "/profile"), audit(env, u.id, "account." + status, target.id, reason)]);
      return json({ ok: true });
    }
    m = p.match(/^\/api\/admin\/listings\/([^/]+)$/);
    if (m && method === "POST") {
      const u = await user(req, env, true, true, true), b = await body(req), l = await listing(env, m[1]), reason = text(b.reason, "Moderation reason", 5, 500);
      await env.DB.batch([env.DB.prepare("UPDATE listings SET status='archived',updated_at=? WHERE id=?").bind(now(), l.id), notify(env, l.owner_id, "Listing archived", reason, "/my-listings"), audit(env, u.id, "moderation.archive", l.id, reason)]);
      return json({ ok: true });
    }
    m = p.match(/^\/api\/admin\/reports\/([^/]+)$/);
    if (m && method === "POST") {
      const u = await user(req, env, true, true, true), b = await body(req), reason = text(b.reason, "Resolution", 5, 500);
      if (!await env.DB.prepare("SELECT id FROM reports WHERE id=?").bind(m[1]).first()) fail(404, "Report not found.");
      await env.DB.batch([env.DB.prepare("UPDATE reports SET status='resolved',resolution=? WHERE id=?").bind(reason, m[1]), audit(env, u.id, "report.resolved", m[1], reason)]);
      return json({ ok: true });
    }
    fail(404, "This page or action could not be found.");
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    const msg = String(e?.message || "");
    if (/overlap|already has an accepted|outside availability|participant is unavailable|agreed terms/.test(msg)) return json({ error: msg.replace(/^.*?: /, "") }, 409);
    if (/UNIQUE constraint|unique constraint/i.test(msg)) return json({ error: "This record already exists or the request has already been submitted. Refresh to see the latest state." }, 409);
    console.error("LoopMarket API error", msg);
    return json({ error: msg || "Unable to complete the request. Your changes were not confirmed; please try again." }, 500);
  }
}

// server/pg-db.ts
import pg from "pg";

// server/postgres-schema-sql.ts
var POSTGRES_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  student_id TEXT NOT NULL,
  password_hash TEXT,
  salt TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('student','admin')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','suspended')),
  reason TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  campus TEXT NOT NULL DEFAULT 'MIT-ADT University',
  demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS access_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT NOT NULL DEFAULT '',
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_expires ON sessions (id, expires_at);

CREATE TABLE IF NOT EXISTS auth_attempts (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 100),
  description TEXT NOT NULL CHECK(length(description) <= 2000),
  category TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('sell','rent','giveaway')),
  price INTEGER NOT NULL CHECK(price >= 0),
  condition TEXT NOT NULL,
  location TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('draft','active','reserved','sold','given_away','archived')),
  rental_unit TEXT NOT NULL DEFAULT 'day',
  deposit INTEGER NOT NULL DEFAULT 0 CHECK(deposit >= 0),
  available_from TEXT,
  available_to TEXT,
  terms TEXT NOT NULL DEFAULT '',
  included TEXT NOT NULL DEFAULT '',
  demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK((type='giveaway' AND price=0) OR (type='rent' AND price>0) OR (type='sell' AND price>0))
);

CREATE INDEX IF NOT EXISTS listings_browse ON listings(status, type, category, created_at);

CREATE TABLE IF NOT EXISTS listing_images (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_listing_images_lid ON listing_images(listing_id, position);

CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS favourites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id, listing_id)
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(listing_id, buyer_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
  nonce TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(sender_id, nonce)
);

CREATE TABLE IF NOT EXISTS exchange_requests (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','cancelled','handed_over','completed')),
  start_date TEXT,
  end_date TEXT,
  estimated_total INTEGER NOT NULL DEFAULT 0,
  deposit INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS one_open_request ON exchange_requests(conversation_id) WHERE status IN ('pending','accepted','handed_over');

CREATE TABLE IF NOT EXISTS rental_bookings (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE REFERENCES exchange_requests(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked' CHECK(status IN ('booked','on_loan','returned','cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_rental_bookings_lid ON rental_bookings(listing_id, status, start_date, end_date);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  resolution TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  href TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_records (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Function supporting changes() from batch operations
CREATE OR REPLACE FUNCTION changes() RETURNS integer AS $$
BEGIN
  RETURN NULLIF(current_setting('loopmarket.changes', true), '')::integer;
EXCEPTION WHEN OTHERS THEN
  RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- Trigger 1: prevent conflicting acceptance
CREATE OR REPLACE FUNCTION trg_prevent_conflicting_acceptance() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    IF NOT EXISTS (
      SELECT 1 FROM listings l
      JOIN users u ON u.id = l.owner_id
      JOIN users buyer ON buyer.id = NEW.requester_id
      WHERE l.id = NEW.listing_id AND l.status = 'active' AND u.status = 'approved' AND buyer.status = 'approved'
    ) THEN
      RAISE EXCEPTION 'Listing or participant is unavailable';
    END IF;

    IF (SELECT type FROM listings WHERE id = NEW.listing_id) != 'rent' AND EXISTS (
      SELECT 1 FROM exchange_requests WHERE listing_id = NEW.listing_id AND id != NEW.id AND status IN ('accepted', 'handed_over', 'completed')
    ) THEN
      RAISE EXCEPTION 'This item already has an accepted request';
    END IF;

    IF (SELECT type FROM listings WHERE id = NEW.listing_id) = 'rent' AND (
      NEW.start_date IS NULL OR NEW.end_date IS NULL OR NEW.start_date > NEW.end_date
      OR NEW.start_date < (SELECT available_from FROM listings WHERE id = NEW.listing_id)
      OR NEW.end_date > (SELECT available_to FROM listings WHERE id = NEW.listing_id)
    ) THEN
      RAISE EXCEPTION 'Rental dates are outside availability';
    END IF;

    IF (SELECT type FROM listings WHERE id = NEW.listing_id) = 'rent' AND EXISTS (
      SELECT 1 FROM rental_bookings WHERE listing_id = NEW.listing_id AND status IN ('booked', 'on_loan') AND start_date <= NEW.end_date AND end_date >= NEW.start_date
    ) THEN
      RAISE EXCEPTION 'These dates overlap an accepted rental';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_conflicting_acceptance ON exchange_requests;
CREATE TRIGGER prevent_conflicting_acceptance
BEFORE UPDATE OF status ON exchange_requests
FOR EACH ROW EXECUTE FUNCTION trg_prevent_conflicting_acceptance();

-- Trigger 2: apply acceptance
CREATE OR REPLACE FUNCTION trg_apply_acceptance() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    UPDATE listings SET status = 'reserved', updated_at = NEW.updated_at WHERE id = NEW.listing_id AND type != 'rent';
    IF (SELECT type FROM listings WHERE id = NEW.listing_id) = 'rent' THEN
      INSERT INTO rental_bookings(id, request_id, listing_id, start_date, end_date)
      VALUES (NEW.id, NEW.id, NEW.listing_id, NEW.start_date, NEW.end_date)
      ON CONFLICT (request_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS apply_acceptance ON exchange_requests;
CREATE TRIGGER apply_acceptance
AFTER UPDATE OF status ON exchange_requests
FOR EACH ROW EXECUTE FUNCTION trg_apply_acceptance();

-- Trigger 3: apply handover
CREATE OR REPLACE FUNCTION trg_apply_handover() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'handed_over' THEN
    UPDATE rental_bookings SET status = 'on_loan' WHERE request_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS apply_handover ON exchange_requests;
CREATE TRIGGER apply_handover
AFTER UPDATE OF status ON exchange_requests
FOR EACH ROW EXECUTE FUNCTION trg_apply_handover();

-- Trigger 4: apply completion
CREATE OR REPLACE FUNCTION trg_apply_completion() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    UPDATE listings SET status = CASE WHEN type = 'sell' THEN 'sold' ELSE 'given_away' END, updated_at = NEW.updated_at WHERE id = NEW.listing_id AND type != 'rent';
    UPDATE rental_bookings SET status = 'returned' WHERE request_id = NEW.id;
    UPDATE exchange_requests SET status = 'declined', updated_at = NEW.updated_at WHERE listing_id = NEW.listing_id AND id != NEW.id AND status = 'pending' AND (SELECT type FROM listings WHERE id = NEW.listing_id) != 'rent';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS apply_completion ON exchange_requests;
CREATE TRIGGER apply_completion
AFTER UPDATE OF status ON exchange_requests
FOR EACH ROW EXECUTE FUNCTION trg_apply_completion();

-- Trigger 5: apply cancellation
CREATE OR REPLACE FUNCTION trg_apply_cancellation() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' THEN
    UPDATE listings SET status = 'active', updated_at = NEW.updated_at WHERE id = NEW.listing_id AND type != 'rent' AND status = 'reserved' AND OLD.status = 'accepted';
    UPDATE rental_bookings SET status = 'cancelled' WHERE request_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS apply_cancellation ON exchange_requests;
CREATE TRIGGER apply_cancellation
AFTER UPDATE OF status ON exchange_requests
FOR EACH ROW EXECUTE FUNCTION trg_apply_cancellation();

-- Trigger 6: protect booked listing
CREATE OR REPLACE FUNCTION trg_protect_booked_listing() RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM exchange_requests WHERE listing_id = OLD.id AND status IN ('accepted', 'handed_over'))
    AND (
      NEW.type != OLD.type
      OR NEW.price != OLD.price
      OR NEW.deposit != OLD.deposit
      OR NEW.rental_unit != OLD.rental_unit
      OR NEW.available_from IS DISTINCT FROM OLD.available_from
      OR NEW.available_to IS DISTINCT FROM OLD.available_to
    ) THEN
    RAISE EXCEPTION 'Keep agreed terms unchanged until open exchanges are completed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_booked_listing ON listings;
CREATE TRIGGER protect_booked_listing
BEFORE UPDATE ON listings
FOR EACH ROW EXECUTE FUNCTION trg_protect_booked_listing();
`;

// server/pg-db.ts
var { Pool } = pg;
function convertSqliteToPostgres(sql) {
  let paramIndex = 1;
  let inString = false;
  let out = "";
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    if (char === "'") {
      if (inString && sql[i + 1] === "'") {
        out += "''";
        i++;
        continue;
      }
      inString = !inString;
      out += char;
    } else if (char === "?" && !inString) {
      out += "$" + paramIndex++;
    } else {
      out += char;
    }
  }
  if (/INSERT\s+OR\s+IGNORE\s+INTO\s+/i.test(out)) {
    out = out.replace(/INSERT\s+OR\s+IGNORE\s+INTO\s+/gi, "INSERT INTO ");
    if (!/ON\s+CONFLICT/i.test(out)) {
      out += " ON CONFLICT DO NOTHING";
    }
  }
  out = out.replace(/SET\s+attempts\s*=\s*attempts\s*\+\s*1/gi, "SET attempts = auth_attempts.attempts + 1");
  return out;
}
var PgQuery = class {
  constructor(sql, pool) {
    this.sql = sql;
    this.pool = pool;
  }
  values = [];
  bind(...values) {
    this.values = values.map((v) => v === void 0 ? null : v);
    return this;
  }
  async first() {
    const pgSql = convertSqliteToPostgres(this.sql);
    const res = await this.pool.query(pgSql, this.values);
    return res.rows[0] || null;
  }
  async all() {
    const pgSql = convertSqliteToPostgres(this.sql);
    const res = await this.pool.query(pgSql, this.values);
    return { results: res.rows };
  }
  async run() {
    const pgSql = convertSqliteToPostgres(this.sql);
    const res = await this.pool.query(pgSql, this.values);
    return { meta: { changes: res.rowCount ?? 0 } };
  }
  async executeOnClient(client) {
    const pgSql = convertSqliteToPostgres(this.sql);
    const res = await client.query(pgSql, this.values);
    return { meta: { changes: res.rowCount ?? 0 }, results: res.rows };
  }
};
async function openPostgresDatabase(connectionString) {
  const connStr = connectionString || process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connStr) {
    throw new Error("Database connection string is required (POSTGRES_URL or DATABASE_URL).");
  }
  const isLocal = connStr.includes("localhost") || connStr.includes("127.0.0.1");
  const pool = new Pool({
    connectionString: connStr,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 3e4,
    connectionTimeoutMillis: 5e3
  });
  const initClient = await pool.connect();
  try {
    await initClient.query(POSTGRES_SCHEMA_SQL);
  } finally {
    initClient.release();
  }
  const db = {
    prepare: (sql) => new PgQuery(sql, pool),
    batch: async (stmts) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        let lastChanges = 0;
        const results = [];
        for (const s of stmts) {
          await client.query("SELECT set_config('loopmarket.changes', $1, true)", [String(lastChanges)]);
          const q = s;
          const res = await q.executeOnClient(client);
          lastChanges = res.meta.changes;
          results.push(res);
        }
        await client.query("COMMIT");
        return results;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    }
  };
  return {
    db,
    pool,
    close: () => pool.end()
  };
}

// server/blob-storage.ts
import { put, head } from "@vercel/blob";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
async function localBucket(directory) {
  await mkdir(directory, { recursive: true });
  return {
    async put(key, value) {
      const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
      await writeFile(join(directory, key), new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    },
    async get(key) {
      try {
        const data = await readFile(join(directory, key));
        return { body: new Uint8Array(data) };
      } catch {
        return null;
      }
    }
  };
}
async function createBlobStorage(uploadDir = ".data/uploads") {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const storeId = process.env.BLOB_STORE_ID;
  const isVercel = !!(process.env.VERCEL || process.env.VERCEL_ENV);
  const isBlobConfigured = !!(token || storeId || process.env.VERCEL_OIDC_TOKEN);
  if (!isBlobConfigured && !isVercel) {
    return await localBucket(uploadDir);
  }
  return {
    async put(key, value, options) {
      const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
      const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const contentType = options?.httpMetadata?.contentType || "image/jpeg";
      const putOptions = {
        access: "public",
        contentType,
        addRandomSuffix: false
      };
      if (token) putOptions.token = token;
      if (storeId) putOptions.storeId = storeId;
      return await put(`uploads/${key}`, buffer, putOptions);
    },
    async get(key) {
      try {
        const headOptions = {};
        if (token) headOptions.token = token;
        if (storeId) headOptions.storeId = storeId;
        const metadata = await head(`uploads/${key}`, headOptions);
        if (!metadata || !metadata.url) return null;
        const res = await fetch(metadata.url);
        if (!res.ok) return null;
        const arrayBuf = await res.arrayBuffer();
        return {
          body: new Uint8Array(arrayBuf)
        };
      } catch {
        return null;
      }
    }
  };
}

// server/vercel-handler.ts
var cachedEnv = null;
var initPromise = null;
var closeDbFn = null;
var DatabaseConfigurationError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "DatabaseConfigurationError";
  }
};
async function getEnv() {
  if (cachedEnv) return cachedEnv;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const isPostgres = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL);
    const isVercel = !!(process.env.VERCEL || process.env.VERCEL_ENV);
    let db;
    if (isPostgres) {
      const pg2 = await openPostgresDatabase();
      db = pg2.db;
      closeDbFn = () => pg2.close();
    } else if (isVercel) {
      throw new DatabaseConfigurationError(
        "Production database is not configured. Please connect Neon PostgreSQL (or configure POSTGRES_URL) in your Vercel project settings."
      );
    } else {
      const localDbMod = "./local-db";
      const { openDatabase } = await import(
        /* @vite-ignore */
        localDbMod
      );
      const sqlite = await openDatabase(process.env.DATABASE_PATH || ".data/loopmarket.sqlite");
      db = sqlite.db;
      closeDbFn = () => sqlite.close();
    }
    const bucket = await createBlobStorage(process.env.UPLOAD_DIRECTORY || ".data/uploads");
    const env = {
      DB: db,
      BUCKET: bucket,
      DEMO_MODE: process.env.DEMO_MODE ?? "false",
      DEMO_ADMIN_ENABLED: process.env.DEMO_ADMIN_ENABLED ?? "false",
      UNIVERSITY_EMAIL_DOMAINS: process.env.UNIVERSITY_EMAIL_DOMAINS || "",
      OWNER_SETUP_TOKEN_HASH: process.env.OWNER_SETUP_TOKEN_HASH,
      OWNER_SETUP_EXPIRES_AT: process.env.OWNER_SETUP_EXPIRES_AT,
      LOCAL: !isPostgres && process.env.NODE_ENV !== "production" && !isVercel
    };
    if (env.DEMO_MODE === "true") {
      await seed(env);
    }
    cachedEnv = env;
    return env;
  })().catch((err) => {
    initPromise = null;
    throw err;
  });
  return initPromise;
}
async function getRawBody(req) {
  if (req.rawBody && Buffer.isBuffer(req.rawBody)) {
    return req.rawBody;
  }
  if (Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req.body === "string") {
    return Buffer.from(req.body);
  }
  if (req.body && typeof req.body === "object") {
    return Buffer.from(JSON.stringify(req.body));
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    req.on("error", reject);
  });
}
async function handleVercelRequest(req, res) {
  try {
    const env = await getEnv();
    const proto = req.headers["x-forwarded-proto"] || (req.headers.origin ? new URL(req.headers.origin).protocol.replace(":", "") : "https");
    const host = req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
    const origin = `${proto}://${host}`;
    let rawPath = req.headers["x-forwarded-url"] || req.headers["x-matched-path"] || req.url || "/api";
    if (rawPath.startsWith("http://") || rawPath.startsWith("https://")) {
      try {
        const u = new URL(rawPath);
        rawPath = u.pathname + u.search;
      } catch {
      }
    }
    let pathname = rawPath;
    const queryIndex = pathname.indexOf("?");
    const queryString = queryIndex !== -1 ? pathname.slice(queryIndex) : "";
    if (queryIndex !== -1) {
      pathname = pathname.slice(0, queryIndex);
    }
    if ((pathname === "/api" || pathname === "/api/") && req.query?.path) {
      const sub = Array.isArray(req.query.path) ? req.query.path.join("/") : req.query.path;
      pathname = "/api/" + sub;
    }
    if (!pathname.startsWith("/api")) {
      pathname = "/api" + (pathname.startsWith("/") ? pathname : "/" + pathname);
    }
    const fullUrl = `${origin}${pathname}${queryString}`;
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) {
        headers.set(key, Array.isArray(value) ? value.join(",") : value);
      }
    }
    const method = req.method || "GET";
    const hasBody = !["GET", "HEAD"].includes(method);
    let bodyBuffer;
    if (hasBody) {
      bodyBuffer = await getRawBody(req);
    }
    const webRequest = new Request(fullUrl, {
      method,
      headers,
      body: bodyBuffer && bodyBuffer.length > 0 ? new Uint8Array(bodyBuffer) : void 0
    });
    const webResponse = await handleApi(webRequest, env);
    res.statusCode = webResponse.status;
    webResponse.headers.forEach((val, key) => {
      const lower = key.toLowerCase();
      if (lower === "set-cookie") {
        const rawCookies = webResponse.headers.getSetCookie?.() || [val];
        res.setHeader("Set-Cookie", rawCookies);
      } else {
        res.setHeader(key, val);
      }
    });
    const responseBytes = Buffer.from(await webResponse.arrayBuffer());
    res.end(responseBytes);
  } catch (error) {
    console.error("Vercel API error:", error);
    if (!res.headersSent) {
      const isDbConfigError = error instanceof DatabaseConfigurationError || error?.name === "DatabaseConfigurationError";
      res.statusCode = isDbConfigError ? 503 : 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: error?.message || "The server could not process this request." }));
    }
  }
}

// server/vercel-entry.ts
async function handler(req, res) {
  return handleVercelRequest(req, res);
}
export {
  handler as default
};
