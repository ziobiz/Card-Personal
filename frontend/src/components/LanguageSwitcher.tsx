import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, ADMIN_LANGUAGES, type LanguageCode } from '../i18n';

type Props = { admin?: boolean };

export default function LanguageSwitcher({ admin = false }: Props) {
  const { i18n } = useTranslation();
  const list = admin ? ADMIN_LANGUAGES : SUPPORTED_LANGUAGES;
  const current = list.some((l) => l.code === i18n.language) ? i18n.language : list[0].code;

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
