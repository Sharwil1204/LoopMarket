import {put, head, del} from '@vercel/blob';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {Env} from './types';

export type Bucket = Env['BUCKET'];

export async function localBucket(directory: string): Promise<Bucket> {
  await mkdir(directory, {recursive: true});
  return {
    async put(key: string, value: ArrayBuffer | Uint8Array) {
      const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
      await writeFile(join(directory, key), new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    },
    async get(key: string) {
      try {
        const data = await readFile(join(directory, key));
        return {body: new Uint8Array(data)};
      } catch {
        return null;
      }
    },
  };
}

export async function createBlobStorage(uploadDir = '.data/uploads'): Promise<Bucket> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const storeId = process.env.BLOB_STORE_ID;
  const isVercel = !!(process.env.VERCEL || process.env.VERCEL_ENV);
  const isBlobConfigured = !!(token || storeId || process.env.VERCEL_OIDC_TOKEN);

  // In local development (or test runner when not running on Vercel), fall back to local disk bucket
  if (!isBlobConfigured && !isVercel) {
    return await localBucket(uploadDir);
  }

  // Vercel Blob storage mode (supports both traditional BLOB_READ_WRITE_TOKEN and Vercel OIDC)
  return {
    async put(key: string, value: ArrayBuffer | Uint8Array, options?: any) {
      const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
      const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const contentType = options?.httpMetadata?.contentType || 'image/jpeg';

      const putOptions: any = {
        access: 'public',
        contentType,
        addRandomSuffix: false,
      };
      if (token) putOptions.token = token;
      if (storeId) putOptions.storeId = storeId;

      return await put(`uploads/${key}`, buffer, putOptions);
    },

    async get(key: string) {
      try {
        const headOptions: any = {};
        if (token) headOptions.token = token;
        if (storeId) headOptions.storeId = storeId;

        const metadata = await head(`uploads/${key}`, headOptions);
        if (!metadata || !metadata.url) return null;

        const res = await fetch(metadata.url);
        if (!res.ok) return null;

        const arrayBuf = await res.arrayBuffer();
        return {
          body: new Uint8Array(arrayBuf),
        };
      } catch {
        return null;
      }
    },
  };
}
