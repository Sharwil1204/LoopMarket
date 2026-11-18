import type {IncomingMessage, ServerResponse} from 'node:http';
import {handleVercelRequest} from '../server/vercel-handler';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  return handleVercelRequest(req, res);
}
