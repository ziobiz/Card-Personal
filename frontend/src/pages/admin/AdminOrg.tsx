import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';
import {
  emptyOrgProfile,
  OrgAccountFields,
  OrgBasicFields,
  profilePayload,
  validateOrgProfile,
} from './OrgProfileFields';
import ParentOrgSearchModal, { type ParentOrg } from './ParentOrgSearchModal';
import ConfirmRegisterModal from './ConfirmRegisterModal';

const LEVELS = ['HEADQUARTERS', 'REGIONAL', 'MASTER_DIST', 'BRANCH', 'AGENCY', 'SALES_OFFICE', 'MERCHANT'] as const;

type Unit = { id: string; orgLevel: string; parentId?: string; parentName?: string; code: string; name: string; status: string; loginId?: string };

export default function AdminOrg() {
  const { t } = useTranslation();
  const [level, setLevel] = useState<string>('REGIONAL');
  const [items, setItems] = useState<Unit[]>([]);
  const [form, setForm] = useState(emptyOrgProfile());
  const [parentOpen, setParentOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.admin.getOrg(level).then((r) => setItems(r.items)).catch((e) => setMessage((e as Error).message));
  };

  useEffect(() => {
    load();
    setForm({ ...emptyOrgProfile(), orgLevel: level });
  }, [level]);

  const pickParent = (org: ParentOrg) => {
    setForm((f) => ({ ...f, parentId: org.id, parentName: `${org.name} (${org.code || org.id})` }));
    setParentOpen(false);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    const err = validateOrgProfile({ ...form, orgLevel: level }, t);
    if (err) {
      setMessage(err);
      return;
    }
    setConfirmOpen(true);
  };

  const doCreate = async () => {
    setSaving(true);
    try {
      const payload = profilePayload({ ...form, orgLevel: level });
      await api.admin.createOrg({
        ...payload,
        orgLevel: level,
      });
      setForm({ ...emptyOrgProfile(), orgLevel: level });
      setConfirmOpen(false);
      load();
    } catch (err) {
      setMessage((err as Error).message);
      setConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-container">
      <div className="page-header">
        <h1 className="page-title">{t('admin.navOrg')}</h1>
        <Link to="/admin/partners" className="btn-outline">{t('admin.navPartners')}</Link>
      </div>
      <p className="muted-text">{t('admin.orgDesc')}</p>
      <div className="admin-org-levels">
        {LEVELS.map((code) => (
          <button
            key={code}
            type="button"
            className={level === code ? 'btn-primary' : 'btn-outline'}
            onClick={() => {
              setLevel(code);
              if (code !== 'HEADQUARTERS') setParentOpen(true);
            }}
          >
            {t(`admin.orgLevel.${code}`)}
          </button>
        ))}
      </div>
      {level !== 'HEADQUARTERS' && (
        <form onSubmit={handleCreate} className="reg-page">
          <div className="card-surface reg-card">
            <h3 className="section-title">{t('admin.sectionBasic')}</h3>
            <p className="hq-card-hint">{t('admin.basicHint')}</p>
            <OrgBasicFields
              value={{ ...form, orgLevel: level }}
              onChange={setForm}
              onSearchParent={() => setParentOpen(true)}
              lockLevel
            />
          </div>
          <div className="card-surface reg-card">
            <h3 className="section-title">{t('admin.sectionAccount')}</h3>
            <OrgAccountFields value={form} onChange={setForm} />
          </div>
          {message && <div className="auth-error">{message}</div>}
          <div className="reg-actions">
            <button type="submit" className="btn-primary" disabled={saving}>{t('admin.register')}</button>
          </div>
        </form>
      )}
      <div className="card-surface admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('admin.orgName')}</th>
              <th>{t('admin.orgLevelLabel')}</th>
              <th>{t('admin.orgParent')}</th>
              <th>{t('admin.loginId')}</th>
              <th>{t('admin.colStatus')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id}>
                <td>{u.name} <span className="mono">{u.code}</span></td>
                <td>{t(`admin.orgLevel.${u.orgLevel}`)}</td>
                <td>{u.parentName || '-'}</td>
                <td className="mono">{u.loginId || '-'}</td>
                <td>
                  <select
                    className="admin-status-select"
                    value={u.status}
                    onChange={(e) => api.admin.updateOrg(u.id, { status: e.target.value }).then(load)}
                    disabled={u.orgLevel === 'HEADQUARTERS'}
                  >
                    <option value="ACTIVE">{t('admin.statusActive')}</option>
                    <option value="INACTIVE">{t('admin.statusSuspended')}</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ParentOrgSearchModal
        open={parentOpen}
        forLevel={level}
        onClose={() => setParentOpen(false)}
        onSelect={pickParent}
      />
      <ConfirmRegisterModal
        open={confirmOpen}
        busy={saving}
        summary={`${form.name} · ${form.loginId}`}
        onClose={() => !saving && setConfirmOpen(false)}
        onConfirm={doCreate}
      />
    </div>
  );
}
