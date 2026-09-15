import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';

type Group = { id: string; code: string; name: string; menus: string[] };
type Operator = { id: string; email: string; name: string; groupId?: string; isSuper?: boolean };
type Audit = { id: string; at: string; actorEmail: string; action: string; detail: string };

export default function PartnerAccess() {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<Group[]>([]);
  const [catalog, setCatalog] = useState<string[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [history, setHistory] = useState<Audit[]>([]);
  const [selected, setSelected] = useState('');
  const [newName, setNewName] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    const [g, staff, hist] = await Promise.all([
      api.partnerPortal.accessGroups(),
      api.partnerPortal.staff(),
      api.partnerPortal.accessHistory(),
    ]);
    setGroups(g.items);
    setCatalog(g.catalog);
    setSelected((id) => id || g.items[0]?.id || '');
    setOperators(staff.items);
    setHistory(hist.items);
  };

  useEffect(() => {
    load().catch((e) => setMessage((e as Error).message));
  }, []);

  const group = groups.find((g) => g.id === selected);

  return (
    <div className="pp-card">
      <h1>{t('partner.navAccess')}</h1>
      <p className="muted-text">{t('access.partnerHint')}</p>
      {message ? <p className="muted-text">{message}</p> : null}
      <div className="hq-form-grid">
        <div>
          <h3>{t('access.groups')}</h3>
          {groups.map((g) => (
            <button key={g.id} type="button" className="btn-outline btn-compact" onClick={() => setSelected(g.id)}>
              {t(`access.group.${g.code}`, { defaultValue: g.name })}
            </button>
          ))}
          <div className="hq-toolbar" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
            <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('access.groupName')} />
            <button
              type="button"
              className="btn-primary"
              onClick={async () => {
                if (!newName.trim()) return;
                await api.partnerPortal.createAccessGroup({ name: newName.trim(), menus: catalog });
                setNewName('');
                await load();
              }}
            >
              {t('access.addGroup')}
            </button>
          </div>
        </div>
        <div>
          <h3>{t('access.menus')}</h3>
          {group ? (
            <>
              {catalog.map((key) => (
                <label key={key} style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={group.menus.includes(key)}
                    onChange={() =>
                      setGroups((prev) =>
                        prev.map((g) =>
                          g.id === group.id
                            ? { ...g, menus: g.menus.includes(key) ? g.menus.filter((k) => k !== key) : [...g.menus, key] }
                            : g
                        )
                      )
                    }
                  />
                  {t(`access.menu.${key}`, { defaultValue: key })}
                </label>
              ))}
              <button
                type="button"
                className="btn-primary"
                style={{ marginTop: 12 }}
                onClick={async () => {
                  await api.partnerPortal.updateAccessGroup(group.id, { name: group.name, menus: group.menus });
                  await load();
                  setMessage(t('admin.saved'));
                }}
              >
                {t('access.saveGroup')}
              </button>
            </>
          ) : null}
        </div>
      </div>
      <table className="admin-table" style={{ marginTop: 16 }}>
        <thead>
          <tr>
            <th>{t('admin.colEmail')}</th>
            <th>{t('access.groupLabel')}</th>
          </tr>
        </thead>
        <tbody>
          {operators.map((o) => (
            <tr key={o.id}>
              <td>{o.email}</td>
              <td>
                <select
                  className="input"
                  value={o.groupId || ''}
                  onChange={async (e) => {
                    await api.partnerPortal.updateStaff(o.id, { groupId: e.target.value, menuOverride: [] });
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
            </tr>
          ))}
        </tbody>
      </table>
      <h3 style={{ marginTop: 20 }}>{t('access.history')}</h3>
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
    </div>
  );
}
