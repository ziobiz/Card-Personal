/**
 * 파트너 API 인증 - X-API-Key 또는 Authorization: Bearer
 */

import { Request, Response, NextFunction } from 'express';
import { partnerStore } from '../data/partnerStore.js';
import type { Partner } from '../data/partnerStore.js';
import { partnerRateLimit } from './rateLimit.js';

declare global {
  namespace Express {
    interface Request {
      partner?: Partner;
      partnerUserId?: string;
      partnerUserEmail?: string;
    }
  }
}

export function requirePartnerAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey =
    (req.headers['x-api-key'] as string | undefined) ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined);
  if (!apiKey) {
    res.status(401).json({ error: 'API key required', hint: 'X-API-Key or Authorization: Bearer <api_key>' });
    return;
  }
  const partner = partnerStore.getByApiKey(apiKey);
  if (!partner) {
    res.status(401).json({ error: 'Invalid or inactive API key' });
    return;
  }
  req.partner = partner;
  req.partnerUserId = (req.headers['x-partner-user-id'] as string) || req.body?.partner_user_id;
  req.partnerUserEmail = (req.headers['x-partner-user-email'] as string) || req.body?.email;
  partnerRateLimit(req, res, next);
}
