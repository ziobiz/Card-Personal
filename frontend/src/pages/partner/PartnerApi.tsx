import { useTranslation } from 'react-i18next';

export default function PartnerApi() {
  const { t } = useTranslation();
  return (
    <div className="pp-card">
      <h1>{t('partner.navApi')}</h1>
      <p className="muted-text">{t('partner.apiHint')}</p>
      <h2>Headers</h2>
      <pre>{`X-API-Key: <api_key>
X-Partner-User-Id: <partner_user_id>`}</pre>
      <h2>{t('admin.sectionCards')}</h2>
      <pre>{`GET  /api/partner/v1/cards
POST /api/partner/v1/cards/virtual
POST /api/partner/v1/cards/plastic
PUT  /api/partner/v1/cards/:id/block
PUT  /api/partner/v1/cards/:id/unblock
PUT  /api/partner/v1/cards/:id/limit`}</pre>
      <h2>{t('admin.sectionWallet')}</h2>
      <pre>{`GET  /api/partner/v1/wallet/balance
GET  /api/partner/v1/wallet/tokens
GET  /api/partner/v1/wallet/card/:id/deposit-info
POST /api/partner/v1/wallet/card/:id/deposit`}</pre>
    </div>
  );
}
