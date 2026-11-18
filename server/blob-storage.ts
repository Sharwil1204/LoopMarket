import {put, head, del} from '@vercel/blob';
import {localBucket} from './local-db';
import type {Env} from './types';

export type Bucket = Env['BUCKET'];

export async function createBlobStorage(uploadDir = '.data/uploads'): Promise<Bucket> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (!token) {
    // Local development mode: use local filesystem bucket
    return await localBucket(uploadDir);
  }

  // Vercel Blob storage mode
  return {
    async put(key: string, value: ArrayBuffer | Uint8Array, options?: any) {
      const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
      const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const contentType = options?.httpMetadata?.contentType || 'image/jpeg';

      const blob = await put(`uploads/${key}`, buffer, {
        access: 'public',
        contentType,
        addRandomSuffix: false,
        token,
      });

      return blob;
    },

    async get(key: string) {
      try {
        const metadata = await head(`uploads/${key}`, {token});
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
