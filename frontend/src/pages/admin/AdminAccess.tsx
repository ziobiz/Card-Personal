import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';

type Group = { id: string; code: string; name: string; menus: string[]; builtIn: boolean };
type Operator = {
  id: string;
  email: string;
  name: string;
  scope: string;
  groupId?: string;
  menuOverride?: string[];
  isSuper?: boolean;
  status: string;
  partnerId?: string;
};
type Audit = { id: string; at: string; actorEmail: string; action: string; targetType: string; targetId: string; detail: string };

export default function AdminAccess() {
  const { t } = useTranslation();
  const [owner, setOwner] = useState('HQ');
  const [partners, setPartners] = useState<Array<{ id: string; name: string; companyName?: string }>>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [catalog, setCatalog] = useState<string[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [history, setHistory] = useState<Audit[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [message, setMessage] = useState('');

  const load = async (nextOwner = owner) => {
    const [g, ops, hist] = await Promise.all([
      api.admin.getAccessGroups(nextOwner),
      api.admin.getOperators(nextOwner === 'HQ' ? 'HQ' : 'PARTNER'),
      api.admin.getAccessHistory(nextOwner),
    ]);
    setGroups(g.items);
    setCatalog(g.catalog);
    setSelected((id) => id || g.items[0]?.id || '');
    setOperators(nextOwner === 'HQ' ? ops.items : ops.items.filter((o) => o.partnerId === nextOwner));
    setHistory(hist.items);
  };

  useEffect(() => {
    api.admin.getPartners().then((r) => setPartners(r.items)).catch(() => setPartners([]));
    load('HQ').catch((e) => setMessage((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const group = groups.find((g) => g.id === selected);

  const toggleMenu = (key: string) => {
    if (!group) return;
    const menus = group.menus.includes(key) ? group.menus.filter((k) => k !== key) : [...group.menus, key];
    setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, menus } : g)));
  };

  const saveGroup = async () => {
    if (!group) return;
    setMessage('');
    try {
      await api.admin.updateAccessGroup(group.id, { name: group.name, menus: group.menus });
      await load();
      setMessage(t('admin.saved'));
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  return (
    <div>
      <p className="muted-text">{t('access.hqHint')}</p>
      <div className="hq-toolbar" style={{ justifyContent: 'flex-start', gap: 12, marginBottom: 12 }}>
        <label>
          {t('access.owner')}
          <select
            className="input"
            value={owner}
            onChange={async (e) => {
              const next = e.target.value;
              setOwner(next);
              setSelected('');
              try {
                await load(next);
              } catch (err) {
                setMessage((err as Error).message);
              }
            }}
          >
            <option value="HQ">{t('admin.navHqOperators')}</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.companyName || p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {message ? <p className="muted-text">{message}</p> : null}
      <div className="hq-form-grid">
        <div className="card-surface">
          <h3 className="section-title">{t('access.groups')}</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {groups.map((g) => (
              <li key={g.id}>
                <button type="button" className={`btn-outline btn-compact${g.id === selected ? ' on' : ''}`} onClick={() => setSelected(g.id)}>
                  {t(`access.group.${g.code}`, { defaultValue: g.name })}
                </button>
              </li>
            ))}
          </ul>
          <div className="hq-toolbar" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
            <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('access.groupName')} />
            <button
              type="button"
              className="btn-primary"
              onClick={async () => {
                if (!newName.trim()) return;
                await api.admin.createAccessGroup({ owner, name: newName.trim(), menus: catalog });
                setNewName('');
                await load();
              }}
            >
              {t('access.addGroup')}
            </button>
          </div>
        </div>
        <div className="card-surface">
          <h3 className="section-title">{t('access.menus')}</h3>
          {group ? (
            <>
              <label>
                {t('access.groupName')}
                <input
                  className="input"
                  value={group.name}
                  onChange={(e) => setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, name: e.target.value } : g)))}
                />
              </label>
              <div style={{ display: 'grid', gap: 6, margin: '12px 0' }}>
                {catalog.map((key) => (
                  <label key={key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="checkbox" checked={group.menus.includes(key)} onChange={() => toggleMenu(key)} />
                    {t(`access.menu.${key}`, { defaultValue: key })}
                  </label>
                ))}
              </div>
              <button type="button" className="btn-primary" onClick={saveGroup}>
                {t('access.saveGroup')}
              </button>
            </>
          ) : (
            <p className="muted-text">{t('access.noGroup')}</p>
          )}
        </div>
      </div>
      <div className="card-surface" style={{ marginTop: 16, padding: 0 }}>
        <h3 className="section-title" style={{ padding: 16, margin: 0 }}>
          {t('access.assign')}
        </h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('admin.colEmail')}</th>
              <th>{t('admin.operatorName')}</th>
              <th>{t('access.groupLabel')}</th>
              <th>{t('access.super')}</th>
            </tr>
          </thead>
          <tbody>
            {operators.map((o) => (
              <tr key={o.id}>
                <td>{o.email}</td>
                <td>{o.name}</td>
                <td>
                  <select
                    className="input"
                    value={o.groupId || ''}
                    onChange={async (e) => {
                      await api.admin.updateOperator(o.id, { groupId: e.target.value, menuOverride: [] });
                      await load();
                    }}
                  >
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {t(`access.group.${g.code}`, { defaultValue: g.name })}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{o.isSuper ? t('common.confirm') : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card-surface" style={{ marginTop: 16, padding: 0 }}>
        <h3 className="section-title" style={{ padding: 16, margin: 0 }}>
          {t('access.history')}
        </h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('access.at')}</th>
              <th>{t('access.actor')}</th>
              <th>{t('access.actionLabel')}</th>
              <th>{t('access.detail')}</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id}>
                <td>{new Date(h.at).toLocaleString()}</td>
                <td>{h.actorEmail}</td>
                <td>{t(`access.action.${h.action}`, { defaultValue: h.action })}</td>
                <td>{h.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {history.length === 0 && <p className="muted-text empty-text">{t('access.noHistory')}</p>}
      </div>
    </div>
  );
}
