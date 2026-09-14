/**
 * SIWE-lite: prove EOA ownership via personal_sign of a nonce.
 */

import { randomBytes } from 'crypto';
import { verifyMessage } from 'viem';

const challenges = new Map<string, { nonce: string; exp: number }>();

export function issueWalletChallenge(userId: string): { nonce: string; message: string; expiresAt: number } {
  const nonce = 'ico_' + randomBytes(16).toString('hex');
  const exp = Date.now() + 10 * 60 * 1000;
  challenges.set(userId, { nonce, exp });
  const message = `ICOCARD wallet bind\nnonce: ${nonce}\nuser: ${userId}`;
  return { nonce, message, expiresAt: exp };
}

export async function verifyWalletBind(opts: {
  userId: string;
  address: `0x${string}`;
  signature: `0x${string}`;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = challenges.get(opts.userId);
  if (!row || row.exp < Date.now()) return { ok: false, error: 'Challenge expired' };
  const message = `ICOCARD wallet bind\nnonce: ${row.nonce}\nuser: ${opts.userId}`;
  try {
    const valid = await verifyMessage({
      address: opts.address,
      message,
      signature: opts.signature,
    });
    if (!valid) return { ok: false, error: 'Invalid signature' };
    challenges.delete(opts.userId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
