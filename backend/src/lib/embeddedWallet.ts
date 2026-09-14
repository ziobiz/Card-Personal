/**
 * Per-user embedded EOA (ASP 납품용).
 * Wirex 문서 Option B: private key signer for Kernel AA 배포.
 * 개인키는 WALLET_ENC_KEY 로 AES-256-GCM 암호화 저장.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { createWalletClient, http, type Hex } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { baseSepolia, base } from 'viem/chains';
import { config } from '../config.js';
import { getWirexBaaSConfig } from '../config.js';

function encKey(): Buffer {
  return createHash('sha256').update(config.walletEncKey).digest();
}

export function generateEoaKey(): Hex {
  return generatePrivateKey();
}

export function encryptPrivateKey(pk: Hex): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encKey(), iv);
  const enc = Buffer.concat([cipher.update(pk, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}.${tag.toString('hex')}.${enc.toString('hex')}`;
}

export function decryptPrivateKey(blob: string): Hex {
  const [ivH, tagH, dataH] = blob.split('.');
  if (!ivH || !tagH || !dataH) throw new Error('Invalid encrypted key');
  const decipher = createDecipheriv('aes-256-gcm', encKey(), Buffer.from(ivH, 'hex'));
  decipher.setAuthTag(Buffer.from(tagH, 'hex'));
  const out = Buffer.concat([decipher.update(Buffer.from(dataH, 'hex')), decipher.final()]);
  return out.toString('utf8') as Hex;
}

export function eoaAddressFromKey(pk: Hex): `0x${string}` {
  return privateKeyToAccount(pk).address;
}

/** EIP-1193 adapter for @wirexapp/wpay-baas-sdk MainWalletClient */
export function mainWalletFromPrivateKey(pk: Hex) {
  const w = getWirexBaaSConfig();
  const chain = w.chainId === 8453 ? base : baseSepolia;
  const account = privateKeyToAccount(pk);
  const rpc = w.chainId === 8453 ? 'https://mainnet.base.org' : 'https://sepolia.base.org';
  const client = createWalletClient({ account, chain, transport: http(rpc) });

  return {
    address: account.address,
    getEthereumProvider: async () => ({
      request: async ({ method, params = [] }: { method: string; params?: unknown[] }) => {
        if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [account.address];
        if (method === 'eth_chainId') return `0x${chain.id.toString(16)}`;
        if (method === 'personal_sign') {
          const [data] = params as [Hex, string];
          return client.signMessage({ account, message: { raw: data } });
        }
        if (method === 'eth_signTypedData_v4') {
          const [, json] = params as [string, string];
          const parsed = JSON.parse(json) as {
            domain: Record<string, unknown>;
            types: Record<string, unknown>;
            primaryType: string;
            message: Record<string, unknown>;
          };
          const { EIP712Domain: _d, ...filteredTypes } = parsed.types as Record<string, unknown>;
          return client.signTypedData({
            account,
            domain: parsed.domain,
            types: filteredTypes,
            primaryType: parsed.primaryType,
            message: parsed.message,
          } as never);
        }
        return (client.transport as { request: (args: unknown) => Promise<unknown> }).request({ method, params });
      },
    }),
  };
}
