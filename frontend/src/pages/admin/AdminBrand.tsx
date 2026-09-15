import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, type BrandConfig } from '../../api';
import { useBrand } from '../../brand/BrandContext';
import { normalizeHex } from '../../lib/colorHex';
import type { AdminOutletContext } from '../../components/AdminLayout';

const LOCALE_OPTIONS = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
  { code: 'th', label: 'ไทย' },
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'ms', label: 'Bahasa Melayu' },
  { code: 'fil', label: 'Filipino' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'my', label: 'မြန်မာ' },
  { code: 'km', label: 'ខ្មែរ' },
  { code: 'lo', label: 'ລາວ' },
] as const;

const COLOR_KEYS = ['headerBg', 'sidebarBg', 'accentColor', 'logoBg', 'loginPanelBg'] as const;

function fileToDataUrl(file: File, maxBytes = 350_000): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > maxBytes) {
      reject(new Error('max350'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function fileToHeroDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > 4_000_000) {
      reject(new Error('maxHero'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const maxW = 1920;
        const scale = Math.min(1, maxW / img.width);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('canvas'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const data = canvas.toDataURL('image/jpeg', 0.82);
        URL.revokeObjectURL(url);
        if (data.length > 2_400_000) {
          reject(new Error('maxHero'));
          return;
        }
        resolve(data);
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('img'));
    };
    img.src = url;
  });
}

export default function AdminBrand() {
  const { t } = useTranslation();
  const { reload } = useBrand();
  const { setPageActions } = useOutletContext<AdminOutletContext>();
  const [form, setForm] = useState<BrandConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);
  const [hexDraft, setHexDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    api.admin
      .getBrand()
      .then((b) =>
        setForm({
          ...b,
          enabledLocales: b.enabledLocales?.length ? b.enabledLocales : ['ko', 'en', 'ja', 'zh', 'th'],
          defaultLocale: b.defaultLocale || 'en',
          loginPanelBg: b.loginPanelBg || '#e2e5ea',
        })
      )
      .catch(() => setForm(null));
  }, []);

  const set = (k: keyof BrandConfig, v: string) => {
    setForm((s) => (s ? { ...s, [k]: v } : s));
  };

  const setColor = (key: (typeof COLOR_KEYS)[number], raw: string) => {
    setHexDraft((d) => ({ ...d, [key]: raw }));
    const hex = normalizeHex(raw);
    if (hex) set(key, hex);
  };

  const commitColor = (key: (typeof COLOR_KEYS)[number]) => {
    const raw = hexDraft[key] ?? form?.[key] ?? '';
    const hex = normalizeHex(String(raw));
    if (hex) {
      set(key, hex);
      setHexDraft((d) => ({ ...d, [key]: hex }));
    } else if (form) {
      setHexDraft((d) => ({ ...d, [key]: form[key] || '' }));
    }
  };

  const onFile = async (k: 'logoAdmin' | 'logoLogin' | 'favicon', file?: File) => {
    if (!file) return;
    try {
      const url = await fileToDataUrl(file);
      set(k, url);
    } catch {
      setOk(false);
      setMsg(t('admin.brandFileTooBig'));
    }
  };

  const onHeroFile = async (kind: 'admin' | 'member', file?: File) => {
    if (!file || !form) return;
    try {
      const url = await fileToHeroDataUrl(file);
      setForm((s) =>
        s
          ? kind === 'admin'
            ? { ...s, loginHeroImage: url }
            : { ...s, memberLoginHeroImage: url }
          : s
      );
    } catch {
      setOk(false);
      setMsg(t('admin.brandHeroTooBig'));
    }
  };

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!form) return;
    setSaving(true);
    setMsg('');
    try {
      const next = await api.admin.updateBrand(form);
      setForm({
        ...next,
        enabledLocales: next.enabledLocales?.length ? next.enabledLocales : form.enabledLocales,
        defaultLocale: next.defaultLocale || form.defaultLocale,
        loginPanelBg: next.loginPanelBg || form.loginPanelBg || '#e2e5ea',
      });
      reload();
      setOk(true);
      setMsg(t('admin.brandSaved'));
    } catch (err) {
      setOk(false);
      setMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    setPageActions(
      <button type="submit" form="hq-brand-form" className="btn-primary" disabled={saving || !form}>
        {saving ? t('common.loading') : t('admin.brandSave')}
      </button>
    );
    return () => setPageActions(null);
  }, [setPageActions, saving, form, t]);

  if (!form) return <p className="muted-text">{t('common.loading')}</p>;

  const noticeTitlePreview = (form.loginNoticeTitle || '').trim() || t('partner.scamTitle');
  const noticeBodyPreview = (form.loginNoticeBody || '').trim() || t('partner.scamBody');
  const panelBg = normalizeHex(form.loginPanelBg || '') || form.loginPanelBg || '#e2e5ea';

  const colorLabels: Record<(typeof COLOR_KEYS)[number], string> = {
    headerBg: t('admin.brandHeader'),
    sidebarBg: t('admin.brandSidebar'),
    accentColor: t('admin.brandAccent'),
    logoBg: t('admin.brandLogoBg'),
    loginPanelBg: t('admin.brandLoginPanelBg'),
  };

  return (
    <form id="hq-brand-form" className="hq-brand" onSubmit={save}>
      <p className="hq-card-hint hq-brand-lead">{t('admin.brandLead')}</p>

      <section className="card-surface hq-brand-card">
        <h3>{t('admin.brandIdentity')}</h3>
        <div className="hq-brand-grid">
          <label>
            {t('admin.brandProduct')}
            <input className="input" value={form.productName} onChange={(e) => set('productName', e.target.value)} />
          </label>
          <label>
            {t('admin.brandOperator')}
            <input className="input" value={form.operatorName} onChange={(e) => set('operatorName', e.target.value)} />
          </label>
          <label>
            {t('admin.brandCardName')}
            <input className="input" value={form.cardBrandName} onChange={(e) => set('cardBrandName', e.target.value)} />
          </label>
          <label>
            {t('admin.brandSupport')}
            <input className="input" value={form.supportEmail} onChange={(e) => set('supportEmail', e.target.value)} />
          </label>
          <label className="hq-brand-span">
            {t('admin.brandCopyright')}
            <input className="input" value={form.copyright} onChange={(e) => set('copyright', e.target.value)} />
          </label>
        </div>
      </section>

      <section className="card-surface hq-brand-card">
        <h3>{t('admin.brandLogos')}</h3>
        <p className="hq-card-hint hq-brand-locale-hint">{t('admin.brandLogosSplitHint')}</p>
        <div className="hq-brand-logos">
          <label className="hq-logo-slot">
            <span>{t('admin.brandLogoLogin')}</span>
            <div className="hq-logo-preview" style={{ background: form.logoBg }}>
              {form.logoLogin ? <img src={form.logoLogin} alt="" /> : <em>{form.productName}</em>}
            </div>
            <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={(e) => onFile('logoLogin', e.target.files?.[0])} />
            {form.logoLogin && (
              <button type="button" className="btn-outline" onClick={() => set('logoLogin', '')}>
                {t('admin.brandClear')}
              </button>
            )}
          </label>
          <label className="hq-logo-slot">
            <span>{t('admin.brandLogoAdmin')}</span>
            <div className="hq-logo-preview" style={{ background: form.logoBg }}>
              {form.logoAdmin ? <img src={form.logoAdmin} alt="" /> : <em>{form.productName}</em>}
            </div>
            <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={(e) => onFile('logoAdmin', e.target.files?.[0])} />
            {form.logoAdmin && (
              <button type="button" className="btn-outline" onClick={() => set('logoAdmin', '')}>
                {t('admin.brandClear')}
              </button>
            )}
          </label>
          <label className="hq-logo-slot">
            <span>{t('admin.brandFavicon')}</span>
            <div className="hq-logo-preview" style={{ background: form.logoBg }}>
              {form.favicon ? <img src={form.favicon} alt="" /> : <em>{form.productName}</em>}
            </div>
            <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={(e) => onFile('favicon', e.target.files?.[0])} />
            {form.favicon && (
              <button type="button" className="btn-outline" onClick={() => set('favicon', '')}>
                {t('admin.brandClear')}
              </button>
            )}
          </label>
        </div>
      </section>

      <section className="card-surface hq-brand-card">
        <h3>{t('admin.brandMemberLoginScreen')}</h3>
        <p className="hq-card-hint hq-brand-locale-hint">{t('admin.brandMemberLoginHint')}</p>
        <div className="hq-login-setup-block">
          <h4>{t('admin.brandMemberLoginBg')}</h4>
          <label className="hq-logo-slot hq-hero-slot">
            <span>{t('admin.brandMemberLoginHeroImage')}</span>
            <div
              className="hq-logo-preview hq-hero-preview"
              style={{
                backgroundImage: `url(${form.memberLoginHeroImage || '/user-hero-bg.png'})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void onHeroFile('member', e.target.files?.[0])} />
            {form.memberLoginHeroImage ? (
              <button type="button" className="btn-outline" onClick={() => set('memberLoginHeroImage', '')}>
                {t('admin.brandResetDefault')}
              </button>
            ) : (
              <em className="muted-text">{t('admin.brandUsingDefaultMember')}</em>
            )}
          </label>
        </div>
      </section>

      <section className="card-surface hq-brand-card">
        <h3>{t('admin.brandLoginHero')}</h3>
        <p className="hq-card-hint hq-brand-locale-hint">{t('admin.brandLoginHeroHint')}</p>

        <div className="hq-login-setup">
          <div className="hq-login-setup-edit">
            <div className="hq-login-setup-block">
              <h4>{t('admin.brandLoginBgBlock')}</h4>
              <label className="hq-logo-slot hq-hero-slot">
                <span>{t('admin.brandLoginHeroImage')}</span>
                <div
                  className="hq-logo-preview hq-hero-preview"
                  style={{
                    backgroundImage: `url(${form.loginHeroImage || '/user-hero-bg.png'})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void onHeroFile('admin', e.target.files?.[0])} />
                {form.loginHeroImage ? (
                  <button type="button" className="btn-outline" onClick={() => set('loginHeroImage', '')}>
                    {t('admin.brandResetDefault')}
                  </button>
                ) : (
                  <em className="muted-text">{t('admin.brandUsingDefaultAdmin')}</em>
                )}
              </label>
              <label className="hq-brand-span hq-login-field">
                {t('admin.brandLoginMainText')}
                <input
                  className="input"
                  value={form.loginMainText || ''}
                  onChange={(e) => set('loginMainText', e.target.value)}
                  placeholder={t('admin.brandLoginMainTextPh')}
                />
              </label>
            </div>

            <div className="hq-login-setup-block">
              <h4>{t('admin.brandLoginNoticeBlock')}</h4>
              <label className="hq-login-check">
                <input
                  type="checkbox"
                  checked={form.loginNoticeEnabled !== false}
                  onChange={(e) => setForm((s) => (s ? { ...s, loginNoticeEnabled: e.target.checked } : s))}
                />
                <span>{t('admin.brandLoginNotice')}</span>
              </label>
              <label className="hq-login-field">
                {t('admin.brandLoginNoticeTitle')}
                <input
                  className="input hq-login-title-input"
                  value={form.loginNoticeTitle || ''}
                  onChange={(e) => set('loginNoticeTitle', e.target.value)}
                  placeholder={t('partner.scamTitle')}
                />
              </label>
              <label className="hq-login-field">
                {t('admin.brandLoginNoticeBody')}
                <textarea
                  className="input hq-login-body-input"
                  rows={8}
                  value={form.loginNoticeBody || ''}
                  onChange={(e) => set('loginNoticeBody', e.target.value)}
                  placeholder={t('partner.scamBody')}
                />
              </label>
              <p className="muted-text hq-login-empty-hint">{t('admin.brandLoginNoticeEmptyHint')}</p>
            </div>
          </div>

          <aside className="hq-login-setup-preview" aria-label={t('admin.brandLoginPreview')}>
            <h4>{t('admin.brandLoginPreview')}</h4>
            <div className="hq-login-preview-panel" style={{ background: panelBg }}>
              {form.loginNoticeEnabled !== false ? (
                <section className="hq-login-preview-notice">
                  <strong>{noticeTitlePreview}</strong>
                  <p>{noticeBodyPreview}</p>
                </section>
              ) : (
                <p className="muted-text">{t('admin.brandLoginNoticeOff')}</p>
              )}
            </div>
          </aside>
        </div>
      </section>

      <section className="card-surface hq-brand-card">
        <h3>{t('admin.brandLocales')}</h3>
        <p className="hq-card-hint hq-brand-locale-hint">{t('admin.brandLocalesHint')}</p>
        <div className="hq-locale-grid">
          {LOCALE_OPTIONS.map(({ code, label }) => {
            const on = (form.enabledLocales || []).includes(code);
            return (
              <button
                key={code}
                type="button"
                className={`hq-locale-chip${on ? ' on' : ''}`}
                onClick={() => {
                  setForm((s) => {
                    if (!s) return s;
                    const cur = new Set(s.enabledLocales || []);
                    if (cur.has(code)) {
                      if (cur.size <= 1) return s;
                      cur.delete(code);
                    } else cur.add(code);
                    const enabledLocales: string[] = LOCALE_OPTIONS.map((o) => o.code).filter((c) => cur.has(c));
                    const prev = s.defaultLocale || enabledLocales[0];
                    const defaultLocale = enabledLocales.includes(prev) ? prev : enabledLocales[0];
                    return { ...s, enabledLocales, defaultLocale };
                  });
                }}
              >
                <span className="hq-locale-code">{code.toUpperCase()}</span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>
        <label className="hq-brand-default-locale">
          {t('admin.brandDefaultLocale')}
          <select className="input" value={form.defaultLocale || 'en'} onChange={(e) => set('defaultLocale', e.target.value)}>
            {(form.enabledLocales || []).map((code) => {
              const opt = LOCALE_OPTIONS.find((o) => o.code === code);
              return (
                <option key={code} value={code}>
                  {opt?.label || code}
                </option>
              );
            })}
          </select>
        </label>
      </section>

      <section className="card-surface hq-brand-card">
        <h3>{t('admin.brandColors')}</h3>
        <p className="hq-card-hint hq-brand-locale-hint">{t('admin.brandColorsHint')}</p>
        <div className="hq-brand-colors">
          {COLOR_KEYS.map((key) => {
            const value = normalizeHex(form[key] || '') || form[key] || '#000000';
            const draft = hexDraft[key] ?? value;
            return (
              <label key={key}>
                {colorLabels[key]}
                <span className="hq-color-row">
                  <input
                    type="color"
                    value={normalizeHex(value) || '#000000'}
                    onChange={(e) => setColor(key, e.target.value)}
                    title={value}
                  />
                  <input
                    className="input hq-hex-input"
                    value={draft}
                    placeholder="#000000"
                    spellCheck={false}
                    onChange={(e) => setColor(key, e.target.value)}
                    onBlur={() => commitColor(key)}
                  />
                </span>
              </label>
            );
          })}
        </div>
        <div
          className="hq-brand-swatch"
          style={{
            background: form.headerBg,
            borderColor: form.accentColor,
          }}
        >
          <span style={{ background: form.logoBg }}>{form.productName}</span>
          <span style={{ background: form.sidebarBg }}>{t('admin.menuMerchant')}</span>
          <span style={{ background: form.accentColor }}>{t('admin.navFeePolicy')}</span>
          <span style={{ background: panelBg, color: '#333' }}>{t('admin.brandLoginPanelBg')}</span>
        </div>
      </section>

      {msg && <p className={ok ? 'muted-text' : 'auth-error'}>{msg}</p>}
    </form>
  );
}
