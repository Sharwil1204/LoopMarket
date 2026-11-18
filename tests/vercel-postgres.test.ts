import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {convertSqliteToPostgres} from '../server/pg-db';
import {createBlobStorage} from '../server/blob-storage';
import {handleVercelRequest, getEnv, closeEnv} from '../server/vercel-handler';
import {openDatabase} from '../server/local-db';
import {handleApi} from '../server/api';
import type {Env} from '../server/types';

console.log('--- Starting Vercel & PostgreSQL Integration Tests ---');
let checks = 0;
const expect = (condition: any, msg: string) => {
  assert.ok(condition, msg);
  checks++;
};

// 1. SQL Converter Tests
console.log('Testing convertSqliteToPostgres...');
const q1 = convertSqliteToPostgres('SELECT * FROM users WHERE email = ? AND role = ?');
expect(q1 === 'SELECT * FROM users WHERE email = $1 AND role = $2', 'Placeholders ? convert to $1, $2');

const q2 = convertSqliteToPostgres("SELECT * FROM items WHERE status = 'draft' AND name = ?");
expect(q2 === "SELECT * FROM items WHERE status = 'draft' AND name = $1", 'Preserves single-quoted literals');

const q3 = convertSqliteToPostgres("INSERT OR IGNORE INTO favourites(user_id, listing_id) VALUES(?, ?)");
expect(q3.includes('INSERT INTO favourites(user_id, listing_id) VALUES($1, $2) ON CONFLICT DO NOTHING'), 'Converts INSERT OR IGNORE to ON CONFLICT DO NOTHING');

const q4 = convertSqliteToPostgres("INSERT INTO auth_attempts(key,attempts,window_start) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1");
expect(q4.includes('VALUES($1,1,$2)') && q4.includes('ON CONFLICT(key) DO UPDATE SET attempts=attempts+1'), 'Preserves ON CONFLICT DO UPDATE clause');

const q5 = convertSqliteToPostgres("SELECT * FROM t WHERE str = 'What? Why?' AND id = ?");
expect(q5 === "SELECT * FROM t WHERE str = 'What? Why?' AND id = $1", 'Does not convert question marks inside quoted strings');

// 2. Blob Storage fallback test
console.log('Testing Blob Storage fallback to local bucket...');
const tempDir = await mkdtemp(join(tmpdir(), 'loopmarket-blob-test-'));
try {
  const bucket = await createBlobStorage(tempDir);
  const testBytes = new TextEncoder().encode('loopmarket test image content');
  await bucket.put('test-img', testBytes, {httpMetadata: {contentType: 'image/jpeg'}});
  const retrieved = await bucket.get('test-img');
  expect(retrieved !== null, 'Bucket retrieves stored content');
  expect(new TextDecoder().decode(retrieved!.body) === 'loopmarket test image content', 'Bucket data matches written bytes');
  const missing = await bucket.get('non-existent');
  expect(missing === null, 'Missing bucket key returns null');
} finally {
  await rm(tempDir, {recursive: true, force: true});
}

// 3. Mock Node.js IncomingMessage and ServerResponse for handleVercelRequest
class MockIncomingMessage extends Readable {
  headers: Record<string, string>;
  method: string;
  url: string;
  private pushed = false;
  private payload: Buffer;

  constructor(method: string, url: string, headers: Record<string, string> = {}, body?: string | Buffer) {
    super();
    this.method = method;
    this.url = url;
    this.headers = {'host': 'localhost', ...headers};
    this.payload = body ? (Buffer.isBuffer(body) ? body : Buffer.from(body)) : Buffer.alloc(0);
  }

  _read() {
    if (!this.pushed) {
      this.pushed = true;
      if (this.payload.length > 0) {
        this.push(this.payload);
      }
      this.push(null);
    }
  }
}

class MockServerResponse extends EventEmitter {
  statusCode = 200;
  headers: Record<string, string | string[]> = {};
  bodyChunks: Buffer[] = [];
  headersSent = false;

  setHeader(key: string, val: string | string[]) {
    this.headers[key.toLowerCase()] = val;
  }
  getHeader(key: string) {
    return this.headers[key.toLowerCase()];
  }
  end(chunk?: any) {
    if (chunk) this.bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    this.headersSent = true;
    this.emit('finish');
  }
  json() {
    return JSON.parse(Buffer.concat(this.bodyChunks).toString('utf8'));
  }
}

async function dispatchVercel(method: string, path: string, headers: Record<string, string> = {}, data?: any) {
  const body = data ? JSON.stringify(data) : undefined;
  const reqHeaders: Record<string, string> = {
    'content-type': 'application/json',
    'origin': 'http://localhost',
    ...headers,
  };
  if (body) {
    reqHeaders['content-length'] = String(Buffer.byteLength(body));
  }
  const req = new MockIncomingMessage(method, path, reqHeaders, body) as any;
  const res = new MockServerResponse() as any;

  await handleVercelRequest(req, res);
  return {
    status: res.statusCode,
    headers: res.headers,
    data: res.json(),
  };
}

// 4. Test Vercel handler with simulated requests
console.log('Testing handleVercelRequest...');
const testDbDir = await mkdtemp(join(tmpdir(), 'loopmarket-vercel-test-'));
process.env.DATABASE_PATH = join(testDbDir, 'test-vercel.sqlite');
process.env.UPLOAD_DIRECTORY = join(testDbDir, 'uploads');
process.env.DEMO_MODE = 'true';
process.env.DEMO_ADMIN_ENABLED = 'true';

try {
  // Test /api/config
  const configRes = await dispatchVercel('GET', '/api/config');
  expect(configRes.status === 200, '/api/config returns 200');
  expect(configRes.data.demo === true, '/api/config has demo property');
  expect(Array.isArray(configRes.data.categories), '/api/config has categories list');

  // Test /api/auth/register with invalid data
  const badReg = await dispatchVercel('POST', '/api/auth/register', {}, {
    name: 'Vercel Tester',
    email: 'invalid-email',
    studentId: 'VRC-101',
    password: 'short',
    confirmPassword: 'short',
    terms: true,
  });
  expect(badReg.status === 400, 'Invalid registration rejected with 400');

  // Test valid registration
  const regUser = {
    name: 'Vercel Student',
    email: 'student.vercel@campus.test',
    studentId: 'VRC-2026',
    password: 'PasswordVercel2026',
    confirmPassword: 'PasswordVercel2026',
    terms: true,
  };
  const regRes = await dispatchVercel('POST', '/api/auth/register', {}, regUser);
  expect(regRes.status === 200, 'Registration succeeded with 200');
  expect(regRes.data.user.email === regUser.email, 'Returns registered user');
  expect(regRes.data.user.status === 'pending', 'New registration is pending approval');
  expect(regRes.headers['set-cookie'] !== undefined, 'Sets session cookie via Set-Cookie header');

  const cookieHeader = Array.isArray(regRes.headers['set-cookie'])
    ? regRes.headers['set-cookie'][0]
    : regRes.headers['set-cookie'];
  const sessionCookie = cookieHeader.split(';')[0];

  // Test authenticated /api/me
  const meRes = await dispatchVercel('GET', '/api/me', {cookie: sessionCookie});
  expect(meRes.status === 200, '/api/me with session returns 200');
  expect(meRes.data.user.email === regUser.email, 'Authenticated user matches session');

  // Test that pending user cannot publish a listing
  const listingAttempt = await dispatchVercel('POST', '/api/listings', {cookie: sessionCookie}, {
    title: 'Test book',
    description: 'A test book',
    category: 'Books',
    type: 'sell',
    price: 100,
    condition: 'Good',
    location: 'Library',
    images: [],
    status: 'active',
  });
  expect(listingAttempt.status === 403, 'Pending user cannot publish listing (403)');

  // Test that regular user cannot access /api/admin
  const adminAttempt = await dispatchVercel('GET', '/api/admin', {cookie: sessionCookie});
  expect(adminAttempt.status === 403, 'Regular student cannot access admin API (403)');

  // Test /api/auth/logout
  const logoutRes = await dispatchVercel('POST', '/api/auth/logout', {cookie: sessionCookie});
  expect(logoutRes.status === 200, 'Logout returns 200');

  // Test that session is cleared
  const meAfterLogout = await dispatchVercel('GET', '/api/me', {cookie: sessionCookie});
  expect(meAfterLogout.data.user === null, 'Session invalidated after logout');

  // 5. Query string preservation and search through Vercel handler
  console.log('Testing query string preservation through Vercel handler...');
  const searchRes = await dispatchVercel('GET', '/api/listings?q=Engineering&category=Books&sort=price-asc');
  expect(searchRes.status === 200, 'Search with query params returns 200');
  expect(Array.isArray(searchRes.data.listings), 'Returns listings array');

  // 6. Vercel catch-all emulation via req.query.path
  console.log('Testing Vercel [...path] catch-all routing...');
  const catchAllReq = new MockIncomingMessage('GET', '/api', {'origin': 'http://localhost'}) as any;
  catchAllReq.query = {path: ['config']};
  const catchAllRes = new MockServerResponse() as any;
  await handleVercelRequest(catchAllReq, catchAllRes);
  expect(catchAllRes.statusCode === 200, 'Catch-all query.path correctly routes to /api/config');
  expect(catchAllRes.json().categories !== undefined, 'Returns config data via catch-all');

  // 7. Single-use Owner Invitation verification through Vercel handler
  console.log('Testing single-use owner setup through Vercel handler...');
  const setupToken = 'c'.repeat(64);
  const tokenHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(setupToken)))].map(n => n.toString(16).padStart(2, '0')).join('');
  process.env.OWNER_SETUP_TOKEN_HASH = tokenHash;
  process.env.OWNER_SETUP_EXPIRES_AT = new Date(Date.now() + 3600000).toISOString();

  // Reset env to pick up owner setup variables
  await closeEnv();

  const ownerInviteHeader = {authorization: 'Bearer ' + setupToken};
  const ownerCheckRes = await dispatchVercel('GET', '/api/auth/owner-setup', ownerInviteHeader);
  expect(ownerCheckRes.status === 200 && ownerCheckRes.data.available === true, 'Valid owner invitation returns available');

  const ownerClaimRes = await dispatchVercel('POST', '/api/auth/owner-setup', ownerInviteHeader, {
    name: 'Real Owner',
    email: 'site-owner@campus.test',
    password: 'OwnerPassword2026',
    confirmPassword: 'OwnerPassword2026',
    terms: true,
  });
  expect(ownerClaimRes.status === 200, 'Owner setup succeeds with 200');
  expect(ownerClaimRes.data.user.role === 'admin', 'Owner account receives admin role');
  expect(ownerClaimRes.data.user.demo === false, 'Owner account is a real non-demo admin');

  // Second claim attempt MUST fail with 409
  const secondClaimRes = await dispatchVercel('POST', '/api/auth/owner-setup', ownerInviteHeader, {
    name: 'Imposter',
    email: 'imposter@campus.test',
    password: 'OwnerPassword2026',
    confirmPassword: 'OwnerPassword2026',
    terms: true,
  });
  expect(secondClaimRes.status === 409, 'Re-claiming owner setup rejected with 409');

  const secondCheckRes = await dispatchVercel('GET', '/api/auth/owner-setup', ownerInviteHeader);
  expect(secondCheckRes.status === 409, 'Owner setup verification after claim returns 409');

  // 8. Admin privileges and user suspension verification
  console.log('Testing Admin moderation and user suspension...');
  const ownerCookie = (Array.isArray(ownerClaimRes.headers['set-cookie']) ? ownerClaimRes.headers['set-cookie'][0] : ownerClaimRes.headers['set-cookie']).split(';')[0];
  const adminPanelRes = await dispatchVercel('GET', '/api/admin', {cookie: ownerCookie});
  expect(adminPanelRes.status === 200, 'Owner can access /api/admin');
  expect(Array.isArray(adminPanelRes.data.users), 'Admin data includes user list');

  // Approve student registration
  const studentUser = adminPanelRes.data.users.find((u: any) => u.email === regUser.email);
  expect(studentUser !== undefined, 'Registered student found in admin list');
  const approveRes = await dispatchVercel('POST', '/api/admin/users/' + studentUser.id, {cookie: ownerCookie}, {
    status: 'approved',
    reason: 'Verified campus credentials',
  });
  expect(approveRes.status === 200, 'Owner approved student registration');

  // Now student logs in and can publish listing
  const studentLoginRes = await dispatchVercel('POST', '/api/auth/login', {}, {
    email: regUser.email,
    password: regUser.password,
  });
  expect(studentLoginRes.status === 200, 'Student logs in successfully');
  expect(studentLoginRes.data.user.status === 'approved', 'Student status is now approved');

  // Now suspend student
  const suspendRes = await dispatchVercel('POST', '/api/admin/users/' + studentUser.id, {cookie: ownerCookie}, {
    status: 'suspended',
    reason: 'Policy violation audit test',
  });
  expect(suspendRes.status === 200, 'Admin suspended user');

  // Suspended student login fails with 403
  const suspendedLogin = await dispatchVercel('POST', '/api/auth/login', {}, {
    email: regUser.email,
    password: regUser.password,
  });
  expect(suspendedLogin.status === 403, 'Suspended user login rejected with 403');

  // 9. Rate limiting verification
  console.log('Testing Rate Limiting on authentication...');
  const spamIp = '198.51.100.42';
  let rateLimited = false;
  for (let i = 0; i < 22; i++) {
    const attemptRes = await dispatchVercel('POST', '/api/auth/login', {'x-forwarded-for': spamIp}, {
      email: 'nonexistent@campus.test',
      password: 'bad-password',
    });
    if (attemptRes.status === 429) {
      rateLimited = true;
      break;
    }
  }
  expect(rateLimited, 'Rate limiter triggers 429 after exceeding attempt limit');

  // 10. Production Security Verification (DEMO_MODE=false)
  console.log('Testing Production mode (DEMO_MODE=false)...');
  const prodDbDir = await mkdtemp(join(tmpdir(), 'loopmarket-prod-test-'));
  const prodStorage = await openDatabase(join(prodDbDir, 'prod.sqlite'));
  const prodEnv: Env = {
    DB: prodStorage.db,
    BUCKET: await createBlobStorage(join(prodDbDir, 'uploads')),
    DEMO_MODE: 'false',
    DEMO_ADMIN_ENABLED: 'false',
    LOCAL: false,
  };

  // Demo endpoint must return 404
  const demoReq = new Request('http://localhost/api/auth/demo', {
    method: 'POST',
    headers: {Origin: 'http://localhost', 'Content-Type': 'application/json'},
    body: JSON.stringify({role: 'admin'}),
  });
  const demoRes = await handleApi(demoReq, prodEnv);
  expect(demoRes.status === 404, 'Demo login disabled in production (404)');

  // Config must report demo: false and demoAdmin: false
  const prodConfigReq = new Request('http://localhost/api/config', {
    method: 'GET',
    headers: {Origin: 'http://localhost'},
  });
  const prodConfigRes = await (await handleApi(prodConfigReq, prodEnv)).json();
  expect(prodConfigRes.demo === false, 'Production config reports demo=false');
  expect(prodConfigRes.demoAdmin === false, 'Production config reports demoAdmin=false');

  // Verify demo users are NOT seeded
  const demoUsersCheck = await prodEnv.DB.prepare('SELECT COUNT(*) count FROM users WHERE demo=1').first();
  expect((demoUsersCheck?.count ?? 0) === 0, 'No demo users seeded when DEMO_MODE=false');

  // 11. Test missing PostgreSQL credentials on Vercel (clean 503 JSON)
  console.log('Testing missing PostgreSQL credentials on Vercel...');
  await closeEnv();
  process.env.VERCEL = '1';
  delete process.env.POSTGRES_URL;
  delete process.env.DATABASE_URL;

  const vclMissingDbRes = await dispatchVercel('GET', '/api/config');
  expect(vclMissingDbRes.status === 503, 'Missing DB credentials on Vercel returns HTTP 503');
  expect(vclMissingDbRes.data.error.includes('Production database is not configured'), 'Error message instructs setting POSTGRES_URL');
  expect(vclMissingDbRes.headers['content-type'] === 'application/json', 'Returns clean JSON content-type, not plain text');

  delete process.env.VERCEL;
  await closeEnv();

  // 12. Verify PostgreSQL schema is bundled in code (zero-disk-read guarantee)
  console.log('Testing embedded PostgreSQL schema bundle...');
  const {POSTGRES_SCHEMA_SQL} = await import('../server/postgres-schema-sql');
  expect(typeof POSTGRES_SCHEMA_SQL === 'string' && POSTGRES_SCHEMA_SQL.length > 2000, 'Embedded schema string is present and complete');
  expect(POSTGRES_SCHEMA_SQL.includes('CREATE TABLE IF NOT EXISTS users'), 'Schema includes users table');
  expect(POSTGRES_SCHEMA_SQL.includes('CREATE TABLE IF NOT EXISTS listings'), 'Schema includes listings table');
  expect(POSTGRES_SCHEMA_SQL.includes('prevent_conflicting_acceptance'), 'Schema includes rental conflict trigger');

  // 13. Test frontend api() resilience to non-JSON responses
  console.log('Testing frontend api() error parsing resilience...');
  const {api} = await import('../src/api');
  const originalFetch = globalThis.fetch;

  try {
    // 500 plain text error (reproducing Vercel FUNCTION_INVOCATION_FAILED)
    globalThis.fetch = async () => new Response('A server error has occurred\nFUNCTION_INVOCATION_FAILED', {
      status: 500,
      headers: {'Content-Type': 'text/plain'},
    });
    await assert.rejects(
      async () => api('/test-500'),
      /A server error occurred \(500\)/,
      'api() cleanly handles Vercel plain text 500 error instead of throwing JSON parse error'
    );
    checks++;

    // 503 service unavailable
    globalThis.fetch = async () => new Response('Service Unavailable', {
      status: 503,
      headers: {'Content-Type': 'text/plain'},
    });
    await assert.rejects(
      async () => api('/test-503'),
      /Service temporarily unavailable \(503\)/,
      'api() cleanly handles 503 service unavailable'
    );
    checks++;

    // 404 HTML response
    globalThis.fetch = async () => new Response('<html>404 Not Found</html>', {
      status: 404,
      headers: {'Content-Type': 'text/html'},
    });
    await assert.rejects(
      async () => api('/test-404'),
      /Request failed \(404\)/,
      'api() cleanly handles HTML 404 error'
    );
    checks++;

    // Standard JSON error response
    globalThis.fetch = async () => new Response(JSON.stringify({error: 'Invalid email address'}), {
      status: 400,
      headers: {'Content-Type': 'application/json'},
    });
    await assert.rejects(
      async () => api('/test-json-error'),
      /Invalid email address/,
      'api() preserves existing JSON error parsing'
    );
    checks++;

    // Successful JSON response
    globalThis.fetch = async () => new Response(JSON.stringify({success: true}), {
      status: 200,
      headers: {'Content-Type': 'application/json'},
    });
    const successRes = await api('/test-success');
    expect(successRes.success === true, 'api() returns parsed JSON on 200');
  } finally {
    globalThis.fetch = originalFetch;
  }

  prodStorage.close();
  await rm(prodDbDir, {recursive: true, force: true});

  console.log(`PASS: All ${checks} Vercel and PostgreSQL adapter checks passed successfully!`);
} finally {
  await closeEnv();
  await rm(testDbDir, {recursive: true, force: true});
}
