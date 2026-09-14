/**
 * 파트너 API 인증 — 우리가 발급한 MID / API Key / Secret (Wirex 키 아님)
 * PG 패턴: X-API-Key + 선택 X-API-Secret + 선택 HMAC
 */

import { Request, Response, NextFunction } from 'express';
import { partnerStore, type Partner } from '../data/partnerStore.js';
import { partnerRateLimit } from './rateLimit.js';
import { decryptSecret, secretsEqual, verifyHmac } from '../lib/partnerCredentials.js';

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
    res.status(401).json({ error: 'API key required', hint: 'Use ICOCARD X-API-Key (not Wirex credentials)' });
    return;
  }
  const partner = partnerStore.getByApiKey(apiKey);
  if (!partner) {
    res.status(401).json({ error: 'Invalid or inactive API key' });
    return;
  }
  const midHdr = String(req.headers['x-ico-mid'] || '');
  if (midHdr && partner.mid && midHdr !== partner.mid) {
    res.status(401).json({ error: 'MID mismatch' });
    return;
  }
  const ips = partner.allowedIps || [];
  if (ips.length) {
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    if (ip && !ips.includes(ip)) {
      res.status(403).json({ error: 'IP not allowed' });
      return;
    }
  }
  const secret = String(req.headers['x-api-secret'] || '');
  if (partner.apiSecretHash) {
    if (!secret || !secretsEqual(secret, partner.apiSecretHash)) {
      res.status(401).json({ error: 'API secret required', hint: 'X-API-Secret from ICOCARD merchant kit' });
      return;
    }
  }
  const sig = String(req.headers['x-ico-signature'] || '');
  if (sig && partner.hmacSecretEnc) {
    try {
      const hmacPlain = decryptSecret(partner.hmacSecretEnc);
      const raw = (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body || '');
      const ok = verifyHmac({
        secretPlain: hmacPlain,
        signature: sig,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        timestamp: String(req.headers['x-ico-timestamp'] || ''),
        rawBody: raw,
      });
      if (!ok) {
        res.status(401).json({ error: 'Invalid HMAC signature' });
        return;
      }
    } catch {
      res.status(401).json({ error: 'HMAC verification failed' });
      return;
    }
  }
  req.partner = partner;
  req.partnerUserId = (req.headers['x-partner-user-id'] as string) || req.body?.partner_user_id;
  req.partnerUserEmail = (req.headers['x-partner-user-email'] as string) || req.body?.email;
  partnerRateLimit(req, res, next);
}
