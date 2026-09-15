import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import { useBrand } from '../brand/BrandContext';
import { resolveLoginHero } from '../api';
import './AdminAuthChrome.css';

type Props = {
  children: ReactNode;
  /** Hide scam notice (e.g. OTP step still shows chrome) */
  showNotice?: boolean;
};

export default function AdminAuthChrome({ children, showNotice }: Props) {
  const { t } = useTranslation();
  const { brand } = useBrand();
  const hero = resolveLoginHero(brand);
  const noticeOn = showNotice !== false && brand.loginNoticeEnabled !== false;
  const logo = brand.logoAdmin || brand.logoLogin;
  const mainText = (brand.loginMainText || '').trim();

  return (
    <div className="ac-chrome is-admin">
      <div className="ac-hero" style={{ backgroundImage: `url(${hero})` }} aria-hidden={!mainText}>
        <div className="ac-hero-shade" />
        {mainText ? <p className="ac-hero-text">{mainText}</p> : null}
      </div>
      <div className="ac-panel">
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
              <h3>{t('partner.scamTitle')}</h3>
              <p>{t('partner.scamBody')}</p>
            </section>
          ) : null}
          <div className="ac-body">{children}</div>
          <p className="ac-copy">{brand.copyright}</p>
        </div>
      </div>
    </div>
  );
}
