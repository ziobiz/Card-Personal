import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';
import { EntityFilterBar } from '../../components/EntityFilterBar';
import { EMPTY_ENTITY_FILTER, filterByEntity, type EntityFilterState } from '../../lib/dateRange';
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

type Unit = { id: string; orgLevel: string; parentId?: string; parentName?: string; code: string; name: string; status: string; loginId?: string; createdAt?: string };

export default function AdminOrg() {
  const { t } = useTranslation();
  const [level, setLevel] = useState<string>('REGIONAL');
  const [items, setItems] = useState<Unit[]>([]);
  const [form, setForm] = useState(emptyOrgProfile());
  const [parentOpen, setParentOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applied, setApplied] = useState<EntityFilterState>(EMPTY_ENTITY_FILTER);
  const [draft, setDraft] = useState<EntityFilterState>(EMPTY_ENTITY_FILTER);

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

  const filtered = useMemo(
    () =>
      filterByEntity(items, applied, {
        date: (u) => u.createdAt,
        status: (u) => u.status,
        text: (u, field) => {
          if (field === 'name') return u.name;
          if (field === 'code') return u.code;
          if (field === 'loginId') return u.loginId || '';
          return `${u.name} ${u.code} ${u.loginId || ''} ${u.parentName || ''}`;
        },
      }),
    [items, applied]
  );

  return (
    <div>
      <p className="muted-text hq-card-hint">{t('admin.orgHqOnly')}</p>
      <p className="muted-text hq-card-hint">{t('admin.orgDesc')}</p>
      <div className="admin-org-levels">
        {LEVELS.map((code) => (
          <button
            key={code}
            type="button"
            className={level === code ? 'btn-primary' : 'btn-outline'}
            onClick={() => setLevel(code)}
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
        <EntityFilterBar
          value={draft}
          onChange={setDraft}
          onSearch={() => setApplied(draft)}
          onReset={() => setApplied(EMPTY_ENTITY_FILTER)}
          dateFieldOptions={[{ value: 'createdAt', label: t('admin.colJoined') }]}
          searchFieldOptions={[
            { value: 'all', label: t('admin.filterAll') },
            { value: 'name', label: t('admin.orgName') },
            { value: 'code', label: t('admin.orgCode') },
            { value: 'loginId', label: t('admin.loginId') },
          ]}
          statusOptions={[
            { value: 'ACTIVE', label: t('admin.statusActive') },
            { value: 'INACTIVE', label: t('admin.statusSuspended') },
          ]}
        />
        <p className="entity-filter-count">{t('admin.filterCount', { n: filtered.length })}</p>
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
            {filtered.map((u) => (
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
