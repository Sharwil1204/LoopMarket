import https from 'node:https';

const target = (process.argv[2] || 'https://loopmarket-smoky.vercel.app').replace(/\/$/, '');
console.log(`\n========================================================`);
console.log(`LoopMarket Production Verification Suite`);
console.log(`Target: ${target}`);
console.log(`========================================================\n`);

function request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(target + path);
    const reqHeaders = {
      'User-Agent': 'LoopMarket-Verifier/1.0',
      'Accept': 'application/json, text/plain, */*',
      ...headers
    };
    if (body && !reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json';
    }

    const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    if (payload) {
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = https.request(url, {
      method,
      headers: reqHeaders,
      timeout: 10000
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8');
        let data = null;
        try {
          data = JSON.parse(raw);
        } catch {
          data = raw;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out after 10000ms'));
    });

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function run() {
  let passed = 0;
  let failed = 0;

  async function check(name, fn) {
    try {
      const result = await fn();
      if (result.ok) {
        console.log(` [PASS] ${name}`);
        if (result.detail) console.log(`        Detail: ${result.detail}`);
        passed++;
      } else {
        console.log(` [FAIL] ${name}`);
        console.log(`        Reason: ${result.reason}`);
        failed++;
      }
    } catch (e) {
      console.log(` [FAIL] ${name}`);
      console.log(`        Error: ${e.message}`);
      failed++;
    }
  }

  // Check 1: Frontend Homepage
  await check('Frontend Assets & HTML', async () => {
    const res = await request('GET', '/');
    if (res.status === 200 && typeof res.data === 'string' && res.data.includes('LoopMarket')) {
      return {ok: true, detail: 'HTML document served with LoopMarket branding'};
    }
    return {ok: false, reason: `Expected 200 HTML, got status ${res.status}`};
  });

  // Check 2: API Config Endpoint
  await check('System Configuration Endpoint (/api/config)', async () => {
    const res = await request('GET', '/api/config');
    if (res.status === 200 && typeof res.data === 'object') {
      const isDemoFalse = res.data.demo === false;
      const isDemoAdminFalse = res.data.demoAdmin === false;
      return {
        ok: true,
        detail: `Status 200. DEMO_MODE=${res.data.demo}, DEMO_ADMIN_ENABLED=${res.data.demoAdmin}`
      };
    }
    if (res.status === 503) {
      return {
        ok: false,
        reason: 'HTTP 503: Production database is not configured (POSTGRES_URL missing in Vercel).'
      };
    }
    if (res.status === 500 && typeof res.data === 'string' && res.data.includes('FUNCTION_INVOCATION_FAILED')) {
      return {
        ok: false,
        reason: 'HTTP 500 FUNCTION_INVOCATION_FAILED: Older commit is currently deployed.'
      };
    }
    return {ok: false, reason: `Unexpected response status ${res.status}: ${JSON.stringify(res.data)}`};
  });

  // Check 3: Demo Authentication Lockdown
  await check('Demo Authentication Locked Down (/api/auth/demo)', async () => {
    const res = await request('POST', '/api/auth/demo', {'Origin': target}, {role: 'admin'});
    if (res.status === 404) {
      return {ok: true, detail: 'Demo auth returned 404 (Strictly disabled in production)'};
    }
    return {ok: false, reason: `Expected 404, got status ${res.status}`};
  });

  // Check 4: Owner Setup Route Protection
  await check('Owner Setup Route Protection (/api/auth/owner-setup)', async () => {
    const res = await request('GET', '/api/auth/owner-setup');
    if (res.status === 403) {
      return {ok: true, detail: 'Unauthenticated owner setup request correctly blocked (403)'};
    }
    return {ok: false, reason: `Expected 403, got status ${res.status}`};
  });

  // Check 5: Admin Panel Security
  await check('Admin API Protection (/api/admin)', async () => {
    const res = await request('GET', '/api/admin');
    if (res.status === 401 || res.status === 403) {
      return {ok: true, detail: `Unauthenticated admin access blocked (${res.status})`};
    }
    return {ok: false, reason: `Expected 401 or 403, got status ${res.status}`};
  });

  // Check 6: Database Listings Query
  await check('Marketplace Listings Database Query (/api/listings)', async () => {
    const res = await request('GET', '/api/listings');
    if (res.status === 200 && Array.isArray(res.data?.listings)) {
      return {ok: true, detail: `Retrieved ${res.data.listings.length} listings from database`};
    }
    return {ok: false, reason: `Status ${res.status}: ${JSON.stringify(res.data)}`};
  });

  console.log(`\n--------------------------------------------------------`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`--------------------------------------------------------\n`);
}

run().catch(err => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
