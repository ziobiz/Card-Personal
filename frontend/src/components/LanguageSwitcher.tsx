import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, ADMIN_LANGUAGES, type LanguageCode } from '../i18n';
import { useBrand } from '../brand/BrandContext';

type Props = { admin?: boolean };

const DEFAULT_ENABLED = ['ko', 'en', 'ja', 'zh', 'th'];

export default function LanguageSwitcher({ admin = false }: Props) {
  const { i18n } = useTranslation();
  const { brand } = useBrand();

  const list = useMemo(() => {
    if (admin) return [...ADMIN_LANGUAGES];
    const enabled = new Set(
      (brand.enabledLocales?.length ? brand.enabledLocales : DEFAULT_ENABLED) as string[]
    );
    const filtered = SUPPORTED_LANGUAGES.filter((l) => enabled.has(l.code));
    return filtered.length ? filtered : SUPPORTED_LANGUAGES.filter((l) => DEFAULT_ENABLED.includes(l.code));
  }, [admin, brand.enabledLocales]);

  const preferredDefault = (brand.defaultLocale || 'en') as LanguageCode;
  const current = list.some((l) => l.code === i18n.language)
    ? i18n.language
    : list.some((l) => l.code === preferredDefault)
      ? preferredDefault
      : list[0]?.code || 'en';

  useEffect(() => {
    if (admin) return;
    if (i18n.language !== current) {
      void i18n.changeLanguage(current);
    }
  }, [admin, current, i18n]);

  return (
    <select
      value={current}
      onChange={(e) => i18n.changeLanguage(e.target.value as LanguageCode)}
      className="lang-switcher"
      aria-label="Language"
    >
      {list.map(({ code, name }) => (
        <option key={code} value={code}>
          {name}
        </option>
      ))}
    </select>
  );
}
