import { wirexClient, WirexClient } from './WirexClient.js';
import { partnerStore, type Partner } from '../../data/partnerStore.js';
import { store } from '../../data/store.js';
import { isStandalone, wirexConfigForPartner } from '../../lib/wirexScope.js';

const tenantClients = new Map<string, WirexClient>();

export function wirexClientForPartner(partner?: Partner | null): WirexClient {
  if (!partner || !isStandalone(partner)) return wirexClient;
  let c = tenantClients.get(partner.id);
  if (!c) {
    const id = partner.id;
    c = new WirexClient(() => {
      const live = partnerStore.getById(id);
      return wirexConfigForPartner(live);
    });
    tenantClients.set(partner.id, c);
  }
  return c;
}

export function invalidateWirexClient(partnerId: string): void {
  tenantClients.delete(partnerId);
}

export function wirexClientForUser(user?: { partnerId?: string } | null): WirexClient {
  if (!user?.partnerId) return wirexClient;
  return wirexClientForPartner(partnerStore.getById(user.partnerId));
}

export function wirexClientFromContext(ctx?: { userId?: string; email?: string; walletAddress?: string }): WirexClient {
  if (ctx?.userId) {
    const byWx = store.getUserByWirexUserId(ctx.userId);
    if (byWx) return wirexClientForUser(byWx);
  }
  if (ctx?.email) {
    const byEmail = store.getUserByEmail(ctx.email);
    if (byEmail) return wirexClientForUser(byEmail);
  }
  return wirexClient;
}
