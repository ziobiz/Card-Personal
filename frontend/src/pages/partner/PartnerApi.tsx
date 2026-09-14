import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';

export default function PartnerApi() {
  const { t } = useTranslation();
  const [data, setData] = useState<Awaited<ReturnType<typeof api.partnerPortal.overview>> | null>(null);

  useEffect(() => {
    api.partnerPortal.overview().then(setData).catch(() => setData(null));
  }, []);

  const c = data?.credentials;
  const ep = c?.endpoints || {};

  return (
    <div className="pp-card">
      <h1>{t('partner.navApi')}</h1>
      <p className="muted-text">{t('partner.apiHint')}</p>
      <p className="muted-text">{t('partner.ourKeysNotWirex')}</p>
      {c ? (
        <>
          <p>MID: <code>{c.mid}</code></p>
          <p>{t('admin.deliveryMode')}: {c.deliveryMode === 'sub_solution' ? t('admin.deliverySub') : t('admin.deliveryApi')}</p>
          {c.solutionUrl ? <p>URL: <code>{c.solutionUrl}</code></p> : null}
          <p>{t('admin.colApiKey')}: <code>{c.apiKeyPrefix}</code></p>
        </>
      ) : null}
      <h2>Headers</h2>
      <pre>{`X-API-Key: <ICOCARD api_key>
X-API-Secret: <ICOCARD api_secret>
X-ICO-Mid: <MID>
X-ICO-Timestamp: <unix_ms>
X-ICO-Signature: <hmac_sha256>
X-Partner-User-Id: <partner_user_id>`}</pre>
      <p className="muted-text">{t('partner.hmacHint')}</p>
      <h2>{t('admin.sectionCards')}</h2>
      <pre>{`GET  ${ep.cards || '/api/partner/v1/cards'}
POST /api/partner/v1/cards/virtual
POST /api/partner/v1/cards/plastic
PUT  /api/partner/v1/cards/:id/block
PUT  /api/partner/v1/cards/:id/unblock
PUT  /api/partner/v1/cards/:id/limit`}</pre>
      <h2>{t('admin.sectionWallet')}</h2>
      <pre>{`GET  /api/partner/v1/wallet/balance
GET  /api/partner/v1/wallet/challenge
POST /api/partner/v1/wallet/connect
POST /api/partner/v1/wallet/embedded
GET  /api/partner/v1/wallet/tokens
POST /api/partner/v1/bridge/credit
POST /api/partner/v1/bridge/debit-request`}</pre>
      <h2>{t('walletMode.title')}</h2>
      <ol>
        <li>{t('walletMode.embeddedDesc')}</li>
        <li>{t('walletMode.externalDesc')}</li>
        <li>{t('walletMode.bridgeDesc')}</li>
      </ol>
    </div>
  );
}
