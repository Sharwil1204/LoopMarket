import type {IncomingMessage, ServerResponse} from 'node:http';
import {handleApi} from './api';
import {openDatabase} from './local-db';
import {openPostgresDatabase} from './pg-db';
import {createBlobStorage} from './blob-storage';
import {seed} from './seed';
import type {Env} from './types';

let cachedEnv: Env | null = null;
let initPromise: Promise<Env> | null = null;
let closeDbFn: (() => Promise<void> | void) | null = null;

export async function closeEnv(): Promise<void> {
  if (closeDbFn) {
    await closeDbFn();
    closeDbFn = null;
  }
  cachedEnv = null;
  initPromise = null;
}

export async function getEnv(): Promise<Env> {
  if (cachedEnv) return cachedEnv;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const isPostgres = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL);
    let db: Env['DB'];

    if (isPostgres) {
      const pg = await openPostgresDatabase();
      db = pg.db;
      closeDbFn = () => pg.close();
    } else {
      // Fallback for local development or testing
      const sqlite = await openDatabase(process.env.DATABASE_PATH || '.data/loopmarket.sqlite');
      db = sqlite.db;
      closeDbFn = () => sqlite.close();
    }

    const bucket = await createBlobStorage(process.env.UPLOAD_DIRECTORY || '.data/uploads');

    const env: Env = {
      DB: db,
      BUCKET: bucket,
      DEMO_MODE: process.env.DEMO_MODE ?? 'false',
      DEMO_ADMIN_ENABLED: process.env.DEMO_ADMIN_ENABLED ?? 'false',
      UNIVERSITY_EMAIL_DOMAINS: process.env.UNIVERSITY_EMAIL_DOMAINS || '',
      OWNER_SETUP_TOKEN_HASH: process.env.OWNER_SETUP_TOKEN_HASH,
      OWNER_SETUP_EXPIRES_AT: process.env.OWNER_SETUP_EXPIRES_AT,
      LOCAL: !isPostgres && process.env.NODE_ENV !== 'production',
    };

    if (env.DEMO_MODE === 'true') {
      await seed(env);
    }

    cachedEnv = env;
    return env;
  })();

  return initPromise;
}

async function getRawBody(req: IncomingMessage): Promise<Buffer> {
  if ((req as any).rawBody && Buffer.isBuffer((req as any).rawBody)) {
    return (req as any).rawBody;
  }
  if (Buffer.isBuffer((req as any).body)) {
    return (req as any).body;
  }
  if (typeof (req as any).body === 'string') {
    return Buffer.from((req as any).body);
  }
  if ((req as any).body && typeof (req as any).body === 'object') {
    return Buffer.from(JSON.stringify((req as any).body));
  }

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: any) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

export async function handleVercelRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const env = await getEnv();

    const proto = (req.headers['x-forwarded-proto'] as string) || (req.headers.origin ? new URL(req.headers.origin as string).protocol.replace(':', '') : 'https');
    const host = (req.headers['x-forwarded-host'] as string) || (req.headers['host'] as string) || 'localhost';
    const origin = `${proto}://${host}`;

    let pathname = (req.headers['x-forwarded-url'] as string) || (req.headers['x-matched-path'] as string) || req.url || '/api';
    if ((pathname === '/api' || pathname === '/api/') && (req as any).query?.path) {
      const sub = Array.isArray((req as any).query.path)
        ? (req as any).query.path.join('/')
        : (req as any).query.path;
      pathname = '/api/' + sub;
    }
    if (!pathname.startsWith('/api')) {
      pathname = '/api' + (pathname.startsWith('/') ? pathname : '/' + pathname);
    }

    const queryIndex = (req.url || '').indexOf('?');
    const queryString = queryIndex !== -1 ? req.url!.slice(queryIndex) : '';
    if (!pathname.includes('?') && queryString) {
      pathname += queryString;
    }

    const fullUrl = `${origin}${pathname}`;

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) {
        headers.set(key, Array.isArray(value) ? value.join(',') : value);
      }
    }

    const method = req.method || 'GET';
    const hasBody = !['GET', 'HEAD'].includes(method);
    let bodyBuffer: Buffer | undefined;

    if (hasBody) {
      bodyBuffer = await getRawBody(req);
    }

    const webRequest = new Request(fullUrl, {
      method,
      headers,
      body: bodyBuffer && bodyBuffer.length > 0 ? new Uint8Array(bodyBuffer) : undefined,
    });

    const webResponse = await handleApi(webRequest, env);

    res.statusCode = webResponse.status;

    webResponse.headers.forEach((val, key) => {
      const lower = key.toLowerCase();
      if (lower === 'set-cookie') {
        const rawCookies = (webResponse.headers as any).getSetCookie?.() || [val];
        res.setHeader('Set-Cookie', rawCookies);
      } else {
        res.setHeader(key, val);
      }
    });

    const responseBytes = Buffer.from(await webResponse.arrayBuffer());
    res.end(responseBytes);
  } catch (error) {
    console.error('Vercel API error:', error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({error: 'The server could not process this request.'}));
    }
  }
}
