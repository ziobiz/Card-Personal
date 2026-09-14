/**
 * Official Wirex BaaS SDK factory (per embedded EOA).
 * env: sandbox → 'dev', production → 'prod'
 * https://docs.wirexapp.com/docs/sdk
 */

import { createSDK, type WirexPaySDK } from '@wirexapp/wpay-baas-sdk';
import type { Hex } from 'viem';
import { getWirexBaaSConfig } from '../../config.js';
import { mainWalletFromPrivateKey } from '../../lib/embeddedWallet.js';
import { partnerStore } from '../../data/partnerStore.js';
import { wirexConfigForPartner } from '../../lib/wirexScope.js';

export async function createWirexSdk(privateKey: Hex, partnerId?: string): Promise<WirexPaySDK> {
  const partner = partnerId ? partnerStore.getById(partnerId) : undefined;
  const w = partner ? wirexConfigForPartner(partner) : getWirexBaaSConfig();
  const wallet = mainWalletFromPrivateKey(privateKey);
  const sdk = await createSDK({
    env: w.environment === 'production' ? 'prod' : 'dev',
    companyId: w.partnerId,
    chainId: w.chainId,
    enableLogging: process.env.WIREX_SDK_LOG === 'true',
    getMainWalletClient: () => wallet,
  });
  return sdk;
}
