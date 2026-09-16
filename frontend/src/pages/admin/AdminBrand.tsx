import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, DEFAULT_BRAND, DEFAULT_COLORS, type BrandConfig } from '../../api';
import { useBrand } from '../../brand/BrandContext';
import { normalizeHex } from '../../lib/colorHex';
import type { AdminOutletContext } from '../../components/AdminLayout';
import { useHqConfirm } from '../../components/ConfirmActionContext';

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

const COLOR_KEYS = [
  'sidebarBg',
  'sidebarHover',
  'sidebarActive',
  'accentColor',
  'sidebarSub',
  'sidebarText',
  'logoBg',
  'foldBg',
  'foldHover',
  'headerBg',
  'tabbarBg',
  'tabbarText',
  'tabbarActive',
  'loginPanelBg',
] as const;

type ColorKey = (typeof COLOR_KEYS)[number];

/** Related color fields share one pastel box background for intuitive grouping */
const COLOR_FIELD_GROUP: Record<ColorKey, string> = {
  sidebarBg: 'sidebar',
  sidebarHover: 'sidebar',
  sidebarActive: 'sidebar',
  accentColor: 'sidebar',
  sidebarSub: 'sidebar',
  sidebarText: 'sidebar',
  logoBg: 'logo',
  foldBg: 'fold',
  foldHover: 'fold',
  headerBg: 'header',
  tabbarBg: 'tabbar',
  tabbarText: 'tabbar',
  tabbarActive: 'tabbar',
  loginPanelBg: 'login',
};

function ensureColorFields(b: BrandConfig): BrandConfig {
  const presets = b.colorPresets?.length
    ? b.colorPresets
    : DEFAULT_BRAND.colorPresets || [];
  return {
    ...DEFAULT_BRAND,
    ...b,
    sidebarHover: b.sidebarHover || DEFAULT_BRAND.sidebarHover,
    sidebarActive: b.sidebarActive || DEFAULT_BRAND.sidebarActive,
    sidebarSub: b.sidebarSub || DEFAULT_BRAND.sidebarSub,
    sidebarText: b.sidebarText || DEFAULT_BRAND.sidebarText,
    tabbarBg: b.tabbarBg || DEFAULT_BRAND.tabbarBg,
    tabbarText: b.tabbarText || DEFAULT_BRAND.tabbarText,
    tabbarActive: b.tabbarActive || DEFAULT_BRAND.tabbarActive,
    foldBg: b.foldBg || DEFAULT_BRAND.foldBg,
    foldHover: b.foldHover || DEFAULT_BRAND.foldHover,
    loginPanelBg: b.loginPanelBg || DEFAULT_BRAND.loginPanelBg,
    colorPresets: presets.map((p, i) => ({
      name: p?.name ?? '',
      colors: { ...(DEFAULT_BRAND.colorPresets?.[i]?.colors || DEFAULT_COLORS), ...(p?.colors || {}) },
    })),
  };
}

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
  const { confirmSave, confirmApply } = useHqConfirm();
  const [form, setForm] = useState<BrandConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);
  const [hexDraft, setHexDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    api.admin
      .getBrand()
      .then((b) => setForm(ensureColorFields(b)))
      .catch(() => setForm(null));
  }, []);

  const set = (k: keyof BrandConfig, v: string) => {
    setForm((s) => (s ? { ...s, [k]: v } : s));
  };

  const setColor = (key: ColorKey, raw: string) => {
    setHexDraft((d) => ({ ...d, [key]: raw }));
    const hex = normalizeHex(raw);
    if (hex) set(key, hex);
  };

  const commitColor = (key: ColorKey) => {
    const raw = hexDraft[key] ?? form?.[key] ?? '';
    const hex = normalizeHex(String(raw));
    if (hex) {
      set(key, hex);
      setHexDraft((d) => ({ ...d, [key]: hex }));
    } else if (form) {
      setHexDraft((d) => ({ ...d, [key]: String(form[key] || '') }));
    }
  };

  const applyForm = (next: BrandConfig) => {
    setForm(ensureColorFields(next));
    setHexDraft({});
    reload();
  };

  const onFile = async (
    k: 'logoAdmin' | 'logoLogin' | 'logoMemberShell' | 'logoAdminShell' | 'favicon',
    file?: File
  ) => {
    if (!file) return;
    try {
      const url = await fileToDataUrl(file);
      set(k, url);
    } catch {
      setOk(false);
      setMsg(t('admin.brandFileTooBig'));
    }
  };

  const LogoSlot = ({
    field,
    label,
    hint,
  }: {
    field: 'logoAdmin' | 'logoLogin' | 'logoMemberShell' | 'logoAdminShell' | 'favicon';
    label: string;
    hint?: string;
  }) => (
    <label className="hq-logo-slot">
      <span>{label}</span>
      {hint ? <em className="hq-logo-slot-hint">{hint}</em> : null}
      <div className="hq-logo-preview hq-logo-preview-white">
        {form?.[field] ? <img src={String(form[field])} alt="" /> : <em>{form?.productName}</em>}
      </div>
      <input
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        onChange={(e) => onFile(field, e.target.files?.[0])}
      />
      {form?.[field] ? (
        <button type="button" className="btn-outline" onClick={() => set(field, '')}>
          {t('admin.brandClear')}
        </button>
      ) : null}
    </label>
  );

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
    if (!(await confirmSave())) return;
    setSaving(true);
    setMsg('');
    try {
      const next = await api.admin.updateBrand(form);
      applyForm(next);
      setOk(true);
      setMsg(t('admin.brandSaved'));
    } catch (err) {
      setOk(false);
      setMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const applyDefaultTone = async () => {
    if (!(await confirmApply())) return;
    setSaving(true);
    setMsg('');
    try {
      const next = await api.admin.applyBrandDefaultColors();
      applyForm(next);
      setOk(true);
      setMsg(t('admin.brandToneApplied'));
    } catch (err) {
      setOk(false);
      setMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const applyPreset = async (slot: number) => {
    if (!(await confirmApply())) return;
    setSaving(true);
    setMsg('');
    try {
      const next = await api.admin.applyBrandColorPreset(slot);
      applyForm(next);
      setOk(true);
      setMsg(t('admin.brandToneApplied'));
    } catch (err) {
      setOk(false);
      setMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const resetColors = async () => {
    if (!(await confirmApply(t('admin.confirmCancelChanges')))) return;
    setSaving(true);
    setMsg('');
    try {
      const next = await api.admin.resetBrandColors();
      applyForm(next);
      setOk(true);
      setMsg(t('admin.brandColorsReset'));
    } catch (err) {
      setOk(false);
      setMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const savePresetSlot = async (slot: number) => {
    if (!form) return;
    if (!(await confirmSave())) return;
    setSaving(true);
    setMsg('');
    try {
      // Persist current manual colors first, then snapshot into slot
      await api.admin.updateBrand(form);
      const name = form.colorPresets?.[slot]?.name || '';
      const next = await api.admin.saveBrandColorPreset(slot, name);
      applyForm(next);
      setOk(true);
      setMsg(t('admin.brandToneSaved'));
    } catch (err) {
      setOk(false);
      setMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const renamePreset = (slot: number, name: string) => {
    setForm((s) => {
      if (!s) return s;
      const presets = [...(s.colorPresets || ensureColorFields(s).colorPresets || [])];
      while (presets.length < 3) {
        presets.push({ name: '', colors: { ...DEFAULT_COLORS } });
      }
      presets[slot] = { ...presets[slot], name };
      return { ...s, colorPresets: presets };
    });
  };

  useEffect(() => {
    setPageActions(
      <button type="submit" form="hq-brand-form" className="btn-primary" disabled={saving || !form}>
        {saving ? t('common.loading') : t('admin.save')}
      </button>
    );
    return () => setPageActions(null);
  }, [setPageActions, saving, form, t]);

  if (!form) return <p className="muted-text">{t('common.loading')}</p>;

  const noticeTitlePreview = (form.loginNoticeTitle || '').trim() || t('partner.scamTitle');
  const noticeBodyPreview = (form.loginNoticeBody || '').trim() || t('partner.scamBody');
  const panelBg = normalizeHex(form.loginPanelBg || '') || form.loginPanelBg || '#e2e5ea';

  const colorLabels: Record<ColorKey, { title: string; hint: string }> = {
    sidebarBg: { title: t('admin.brandSidebar'), hint: t('admin.brandSidebarHint') },
    sidebarHover: { title: t('admin.brandSidebarHover'), hint: t('admin.brandSidebarHoverHint') },
    sidebarActive: { title: t('admin.brandSidebarActive'), hint: t('admin.brandSidebarActiveHint') },
    accentColor: { title: t('admin.brandAccent'), hint: t('admin.brandAccentHint') },
    sidebarSub: { title: t('admin.brandSidebarSub'), hint: t('admin.brandSidebarSubHint') },
    sidebarText: { title: t('admin.brandSidebarText'), hint: t('admin.brandSidebarTextHint') },
    logoBg: { title: t('admin.brandLogoBg'), hint: t('admin.brandLogoBgHint') },
    foldBg: { title: t('admin.brandFoldBg'), hint: t('admin.brandFoldBgHint') },
    foldHover: { title: t('admin.brandFoldHover'), hint: t('admin.brandFoldHoverHint') },
    headerBg: { title: t('admin.brandHeader'), hint: t('admin.brandHeaderHint') },
    tabbarBg: { title: t('admin.brandTabbar'), hint: t('admin.brandTabbarHint') },
    tabbarText: { title: t('admin.brandTabbarText'), hint: t('admin.brandTabbarTextHint') },
    tabbarActive: { title: t('admin.brandTabbarActive'), hint: t('admin.brandTabbarActiveHint') },
    loginPanelBg: { title: t('admin.brandLoginPanelBg'), hint: t('admin.brandLoginPanelBgHint') },
  };

  const presets = form.colorPresets?.length ? form.colorPresets : DEFAULT_BRAND.colorPresets || [];

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
            {t('admin.brandBrowserTitle')}
            <input
              className="input"
              value={form.browserTitle || ''}
              onChange={(e) => set('browserTitle', e.target.value)}
              placeholder={form.productName || 'ICOCARD'}
            />
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
          <label className="hq-brand-span hq-copyright-field">
            {t('admin.brandCopyright')}
            <input className="input" value={form.copyright} onChange={(e) => set('copyright', e.target.value)} />
          </label>
        </div>
      </section>

      <section className="card-surface hq-brand-card">
        <h3>{t('admin.brandLogosMemberCard')}</h3>
        <p className="hq-card-hint hq-brand-locale-hint">{t('admin.brandLogosMemberHint')}</p>
        <div className="hq-brand-logos">
          <LogoSlot
            field="logoLogin"
            label={t('admin.brandLogoMemberLogin')}
            hint={t('admin.brandLogoMemberLoginHint')}
          />
          <LogoSlot
            field="logoMemberShell"
            label={t('admin.brandLogoMemberShell')}
            hint={t('admin.brandLogoMemberShellHint')}
          />
        </div>
      </section>

      <section className="card-surface hq-brand-card">
        <h3>{t('admin.brandLogosAdminCard')}</h3>
        <p className="hq-card-hint hq-brand-locale-hint">{t('admin.brandLogosAdminHint')}</p>
        <div className="hq-brand-logos">
          <LogoSlot
            field="logoAdmin"
            label={t('admin.brandLogoAdminLogin')}
            hint={t('admin.brandLogoAdminLoginHint')}
          />
          <LogoSlot
            field="logoAdminShell"
            label={t('admin.brandLogoAdminShell')}
            hint={t('admin.brandLogoAdminShellHint')}
          />
        </div>
      </section>

      <section className="card-surface hq-brand-card">
        <h3>{t('admin.brandLogosOtherCard')}</h3>
        <p className="hq-card-hint hq-brand-locale-hint">{t('admin.brandLogosOtherHint')}</p>
        <div className="hq-brand-logos">
          <LogoSlot field="favicon" label={t('admin.brandFavicon')} hint={t('admin.brandFaviconHint')} />
        </div>
      </section>

      <section className="card-surface hq-brand-card">
        <h3>{t('admin.brandMemberLoginScreen')}</h3>
        <p className="hq-card-hint hq-brand-locale-hint">{t('admin.brandMemberLoginHint')}</p>
        <div className="hq-login-setup-block">
          <h4>{t('admin.brandMemberLoginBg')}</h4>
          <label className="hq-logo-slot hq-hero-slot">
            <span>{t('admin.brandMemberLoginHeroImage')}</span>
            <div className="hq-hero-preview-frame">
              <img src={form.memberLoginHeroImage || '/user-hero-bg.png'} alt="" />
            </div>
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

        <div className="hq-login-setup hq-login-setup-stack">
          <div className="hq-login-setup-block">
            <h4>{t('admin.brandLoginBgBlock')}</h4>
            <label className="hq-logo-slot hq-hero-slot">
              <span>{t('admin.brandLoginHeroImage')}</span>
              <div className="hq-hero-preview-frame">
                <img src={form.loginHeroImage || '/user-hero-bg.png'} alt="" />
              </div>
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

          <div className="hq-login-setup-block hq-login-notice-card">
            <p className="hq-card-hint hq-login-notice-hint">{t('admin.brandLoginNoticeToggleHint')}</p>
            <label className="hq-login-notice-toggle">
              <span>{t('admin.brandLoginNoticeBlock')}</span>
              <select
                className="input hq-notice-status-select"
                value={form.loginNoticeEnabled !== false ? 'on' : 'off'}
                onChange={(e) =>
                  setForm((s) => (s ? { ...s, loginNoticeEnabled: e.target.value === 'on' } : s))
                }
              >
                <option value="on">{t('admin.optionActive')}</option>
                <option value="off">{t('admin.optionInactive')}</option>
              </select>
            </label>

            <div className={`hq-notice-grid${form.loginNoticeEnabled === false ? ' is-disabled' : ''}`}>
              <label className="hq-notice-label-title">{t('admin.brandLoginNoticeTitleShort')}</label>
              <input
                className="input hq-login-title-input hq-notice-title"
                value={form.loginNoticeTitle || ''}
                onChange={(e) => set('loginNoticeTitle', e.target.value)}
                placeholder={t('partner.scamTitle')}
                disabled={form.loginNoticeEnabled === false}
              />
              <label className="hq-notice-label-body">{t('admin.brandLoginNoticeBodyShort')}</label>
              <div className="hq-notice-label-preview">{t('admin.brandLoginPreview')}</div>
              <textarea
                className="hq-login-body-input hq-notice-body"
                value={form.loginNoticeBody || ''}
                onChange={(e) => set('loginNoticeBody', e.target.value)}
                placeholder={t('partner.scamBody')}
                disabled={form.loginNoticeEnabled === false}
              />
              <aside className="hq-login-preview-panel hq-login-preview-text-only hq-notice-preview" aria-label={t('admin.brandLoginPreview')}>
                {form.loginNoticeEnabled !== false ? (
                  <section className="hq-login-preview-notice">
                    <strong>{noticeTitlePreview}</strong>
                    <p>{noticeBodyPreview}</p>
                  </section>
                ) : (
                  <p className="muted-text hq-login-preview-off-note">{t('admin.brandLoginNoticeOff')}</p>
                )}
              </aside>
            </div>
            <p className="muted-text hq-login-empty-hint">{t('admin.brandLoginNoticeEmptyHint')}</p>
          </div>
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

        <div className="hq-tone-bar">
          <div className="hq-tone-apply">
            <span className="hq-tone-label">{t('admin.brandToneApply')}</span>
            <button type="button" className="btn-outline" disabled={saving} onClick={() => void applyDefaultTone()}>
              {t('admin.brandToneDefault')}
            </button>
            {[0, 1, 2].map((slot) => (
              <button
                key={slot}
                type="button"
                className="btn-outline"
                disabled={saving}
                onClick={() => void applyPreset(slot)}
                title={presets[slot]?.name || t('admin.brandToneSlot', { n: slot + 1 })}
              >
                {presets[slot]?.name?.trim() || t('admin.brandToneSlot', { n: slot + 1 })}
              </button>
            ))}
            <button type="button" className="btn-outline hq-tone-reset" disabled={saving} onClick={() => void resetColors()}>
              {t('admin.brandColorsResetBtn')}
            </button>
          </div>
        </div>

        <div className="hq-tone-slots">
          <p className="hq-card-hint">{t('admin.brandToneSaveHint')}</p>
          {[0, 1, 2].map((slot) => (
            <div key={slot} className="hq-tone-slot">
              <label>
                {t('admin.brandToneSlot', { n: slot + 1 })}
                <input
                  className="input"
                  value={presets[slot]?.name || ''}
                  placeholder={slot === 0 ? 'Light' : slot === 1 ? 'Dark' : t('admin.brandToneNamePh')}
                  onChange={(e) => renamePreset(slot, e.target.value)}
                />
              </label>
              <div className="hq-tone-slot-swatches" aria-hidden>
                {COLOR_KEYS.slice(0, 6).map((key) => (
                  <i key={key} style={{ background: presets[slot]?.colors?.[key] || form[key] }} />
                ))}
              </div>
              <button type="button" className="btn-outline" disabled={saving} onClick={() => void savePresetSlot(slot)}>
                {t('admin.brandToneSaveCurrent')}
              </button>
            </div>
          ))}
        </div>

        <div className="hq-brand-colors hq-brand-colors-labeled">
          {COLOR_KEYS.map((key) => {
            const value = normalizeHex(String(form[key] || '')) || String(form[key] || '#000000');
            const draft = hexDraft[key] ?? value;
            return (
              <label key={key} className={`hq-color-field hq-color-group-${COLOR_FIELD_GROUP[key]}`}>
                <span className="hq-color-title">{colorLabels[key].title}</span>
                <span className="hq-color-hint">{colorLabels[key].hint}</span>
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
          <span style={{ background: form.sidebarBg }}>{t('admin.brandSidebar')}</span>
          <span style={{ background: form.sidebarHover }}>{t('admin.brandSidebarHover')}</span>
          <span style={{ background: form.sidebarActive }}>{t('admin.brandSidebarActive')}</span>
          <span style={{ background: form.accentColor }}>{t('admin.brandAccent')}</span>
          <span style={{ background: form.sidebarSub }}>{t('admin.brandSidebarSub')}</span>
          <span style={{ background: form.sidebarText, color: '#111' }}>{t('admin.brandSidebarText')}</span>
          <span style={{ background: form.foldBg }}>{t('admin.brandFoldBg')}</span>
          <span style={{ background: form.foldHover }}>{t('admin.brandFoldHover')}</span>
          <span style={{ background: form.tabbarBg }}>{t('admin.brandTabbar')}</span>
          <span style={{ background: form.tabbarText, color: '#111' }}>{t('admin.brandTabbarText')}</span>
          <span style={{ background: form.tabbarActive }}>{t('admin.brandTabbarActive')}</span>
          <span style={{ background: panelBg, color: '#333' }}>{t('admin.brandLoginPanelBg')}</span>
        </div>
      </section>

      {msg && <p className={ok ? 'muted-text' : 'auth-error'}>{msg}</p>}
    </form>
  );
}
