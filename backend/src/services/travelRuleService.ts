/**
 * FATF Travel Rule 사전 검증
 * Wirex 송금 시 수취인 개인정보가 recipient 에 실리며,
 * 임계금액 이상은 originator/beneficiary 식별 데이터가 필수.
 */

import { config } from '../config.js';
import { wirexClient } from '../clients/wirex/WirexClient.js';

export interface TravelParty {
  name?: string;
  account?: string;
  country?: string;
  address?: string;
  nationalId?: string;
}

export interface TravelRuleRequest {
  direction: 'outbound' | 'inbound';
  amount: number;
  currency?: string;
  asset?: string;
  originator: TravelParty;
  beneficiary: TravelParty;
}

const THRESHOLD_USD = Number(process.env.TRAVEL_RULE_THRESHOLD_USD ?? 1000);

function missing(party: TravelParty, role: string): string[] {
  const errs: string[] = [];
  if (!party.name?.trim()) errs.push(`${role}.name`);
  if (!party.account?.trim()) errs.push(`${role}.account`);
  if (!party.country?.trim() || party.country.trim().length !== 2) errs.push(`${role}.country (ISO 3166-1 alpha-2)`);
  return errs;
}

export const travelRuleService = {
  thresholdUsd: THRESHOLD_USD,

  async validate(req: TravelRuleRequest): Promise<{
    ok: boolean;
    required: boolean;
    errors: string[];
    thresholdUsd: number;
    source: 'local' | 'wirex';
    wirexRules?: unknown;
  }> {
    const required = req.amount >= THRESHOLD_USD;
    const errors: string[] = [];
    if (!req.originator || !req.beneficiary) {
      errors.push('originator and beneficiary required');
    } else if (required) {
      errors.push(...missing(req.originator, 'originator'));
      errors.push(...missing(req.beneficiary, 'beneficiary'));
    } else {
      if (!req.beneficiary.account?.trim()) errors.push('beneficiary.account');
    }

    let wirexRules: unknown;
    let source: 'local' | 'wirex' = 'local';
    if (!config.useMockWirex) {
      try {
        wirexRules = await wirexClient.getValidationRules();
        source = 'wirex';
      } catch {
        source = 'local';
      }
    }

    return {
      ok: errors.length === 0,
      required,
      errors,
      thresholdUsd: THRESHOLD_USD,
      source,
      wirexRules,
    };
  },
};
