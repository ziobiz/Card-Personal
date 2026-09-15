import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import { useBrand } from '../brand/BrandContext';
import { resolveAdminLoginHero } from '../api';
import './AdminAuthChrome.css';

type Props = {
  children: ReactNode;
  /** When false, hide notice (rare). Default true — Crypto OTP also shows notice. */
  showNotice?: boolean;
};

export default function AdminAuthChrome({ children, showNotice = true }: Props) {
  const { t } = useTranslation();
  const { brand } = useBrand();
  const hero = resolveAdminLoginHero(brand);
  const noticeOn = showNotice && brand.loginNoticeEnabled !== false;
  const logo = brand.logoAdmin;
  const mainText = (brand.loginMainText || '').trim();
  const noticeTitle = (brand.loginNoticeTitle || '').trim() || t('partner.scamTitle');
  const noticeBody = (brand.loginNoticeBody || '').trim() || t('partner.scamBody');

  return (
    <div className="ac-chrome is-admin" style={{ background: brand.loginPanelBg || undefined }}>
      <div className="ac-hero" style={{ backgroundImage: `url(${hero})` }} aria-hidden={!mainText}>
        <div className="ac-hero-shade" />
        {mainText ? <p className="ac-hero-text">{mainText}</p> : null}
      </div>
      <div className="ac-panel" style={{ background: brand.loginPanelBg || undefined }}>
        <div className="ac-panel-inner">
          <div className="ac-lang">
            <LanguageSwitcher admin />
          </div>
          {logo ? (
            <div className="ac-logo">
              <img src={logo} alt={brand.productName} />
            </div>
          ) : (
            <p className="ac-brand-name">{brand.productName}</p>
          )}
          {noticeOn ? (
            <section className="ac-notice" role="note">
              <h3>{noticeTitle}</h3>
              <p>{noticeBody}</p>
            </section>
          ) : null}
          <div className="ac-body">{children}</div>
          <p className="ac-copy">{brand.copyright}</p>
        </div>
      </div>
    </div>
  );
}
