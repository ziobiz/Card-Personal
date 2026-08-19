import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, type BrandConfig } from '../../api';
import { useBrand } from '../../brand/BrandContext';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > 350_000) {
      reject(new Error('max350'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function AdminBrand() {
  const { t } = useTranslation();
  const { reload } = useBrand();
  const [form, setForm] = useState<BrandConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);

  useEffect(() => {
    api.admin.getBrand().then(setForm).catch(() => setForm(null));
  }, []);

  const set = (k: keyof BrandConfig, v: string) => {
    setForm((s) => (s ? { ...s, [k]: v } : s));
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

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setMsg('');
    try {
      const next = await api.admin.updateBrand(form);
      setForm(next);
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

  if (!form) return <p className="muted-text">{t('common.loading')}</p>;

  return (
    <form className="hq-brand" onSubmit={save}>
      <p className="hq-brand-lead">{t('admin.brandLead')}</p>

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
        <div className="hq-brand-logos">
          {(
            [
              ['logoAdmin', t('admin.brandLogoAdmin')],
              ['logoLogin', t('admin.brandLogoLogin')],
              ['favicon', t('admin.brandFavicon')],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="hq-logo-slot">
              <span>{label}</span>
              <div className="hq-logo-preview" style={{ background: form.logoBg }}>
                {form[key] ? <img src={form[key]} alt="" /> : <em>{form.productName}</em>}
              </div>
              <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={(e) => onFile(key, e.target.files?.[0])} />
              {form[key] && (
                <button type="button" className="btn-outline" onClick={() => set(key, '')}>
                  {t('admin.brandClear')}
                </button>
              )}
            </label>
          ))}
        </div>
      </section>

      <section className="card-surface hq-brand-card">
        <h3>{t('admin.brandColors')}</h3>
        <div className="hq-brand-colors">
          {(
            [
              ['headerBg', t('admin.brandHeader')],
              ['sidebarBg', t('admin.brandSidebar')],
              ['accentColor', t('admin.brandAccent')],
              ['logoBg', t('admin.brandLogoBg')],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <span className="hq-color-row">
                <input type="color" value={form[key]} onChange={(e) => set(key, e.target.value)} />
                <input className="input" value={form[key]} onChange={(e) => set(key, e.target.value)} />
              </span>
            </label>
          ))}
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
        </div>
      </section>

      {msg && <p className={ok ? 'muted-text' : 'auth-error'}>{msg}</p>}
      <button type="submit" className="btn-primary" disabled={saving}>
        {saving ? t('common.loading') : t('admin.brandSave')}
      </button>
    </form>
  );
}
