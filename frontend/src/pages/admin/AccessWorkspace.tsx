import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';
import '../access-work.css';

type Group = { id: string; code: string; name: string; menus: string[]; builtIn?: boolean };
type Operator = {
  id: string;
  email: string;
  name: string;
  scope?: string;
  role?: string;
  groupId?: string;
  menuOverride?: string[];
  isSuper?: boolean;
  status?: string;
  partnerId?: string;
  partnerName?: string;
};
type Audit = { id: string; at: string; actorEmail: string; action: string; detail: string };

const HQ_SECTIONS: Array<{ id: string; keys: string[] }> = [
  { id: 'sectionHq', keys: ['dashboard', 'brand', 'sandbox', 'settings', 'platform'] },
  { id: 'sectionMerchant', keys: ['partners', 'partners_new', 'org', 'fee_list', 'fee_policy'] },
  { id: 'sectionUsers', keys: ['operators', 'operators_partner', 'customers', 'access'] },
  { id: 'sectionOps', keys: ['cards', 'manuals'] },
];

const PARTNER_SECTIONS: Array<{ id: string; keys: string[] }> = [
  { id: 'sectionWork', keys: ['home', 'api', 'fees'] },
  { id: 'sectionAdmin', keys: ['staff', 'access', 'manual'] },
];

function MenuGrid({
  catalog,
  selected,
  sections,
  disabled,
  onToggle,
}: {
  catalog: string[];
  selected: string[];
  sections: Array<{ id: string; keys: string[] }>;
  disabled?: boolean;
  onToggle: (key: string) => void;
}) {
  const { t } = useTranslation();
  const used = new Set<string>();
  const blocks = sections
    .map((s) => ({ ...s, keys: s.keys.filter((k) => catalog.includes(k)) }))
    .filter((s) => s.keys.length);
  blocks.forEach((s) => s.keys.forEach((k) => used.add(k)));
  const extra = catalog.filter((k) => !used.has(k));
  const all = extra.length ? [...blocks, { id: 'menus', keys: extra }] : blocks;

  return (
    <>
      {all.map((block) => (
        <div className="access-section" key={block.id}>
          <h4>{t(`access.${block.id}`, { defaultValue: t('access.menus') })}</h4>
          <div className="access-menus">
            {block.keys.map((key) => (
              <label key={key} className="access-check">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={selected.includes(key)}
                  onChange={() => onToggle(key)}
                />
                {t(`access.menu.${key}`, { defaultValue: key })}
              </label>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export default function AccessWorkspace({ variant }: { variant: 'hq' | 'partner' }) {
  const { t } = useTranslation();
  const isHq = variant === 'hq';
  const sections = isHq ? HQ_SECTIONS : PARTNER_SECTIONS;

  const [tab, setTab] = useState<'people' | 'groups' | 'history'>('people');
  const [owner, setOwner] = useState('HQ');
  const [partners, setPartners] = useState<Array<{ id: string; name: string; companyName?: string }>>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [catalog, setCatalog] = useState<string[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [history, setHistory] = useState<Audit[]>([]);
  const [canAdd, setCanAdd] = useState(isHq);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedOp, setSelectedOp] = useState<string>('');
  const [newGroupName, setNewGroupName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('STAFF');
  const [addGroupId, setAddGroupId] = useState('');

  const [editMode, setEditMode] = useState<'group' | 'custom'>('group');
  const [editGroupId, setEditGroupId] = useState('');
  const [editMenus, setEditMenus] = useState<string[]>([]);

  const load = async (nextOwner = owner) => {
    setError('');
    if (isHq) {
      const [g, ops, hist] = await Promise.all([
        api.admin.getAccessGroups(nextOwner),
        api.admin.getOperators(nextOwner === 'HQ' ? 'HQ' : 'PARTNER'),
        api.admin.getAccessHistory(nextOwner),
      ]);
      setGroups(g.items);
      setCatalog(g.catalog);
      setSelectedGroup((id) => (g.items.some((x) => x.id === id) ? id : g.items[0]?.id || ''));
      setAddGroupId((id) => id || g.items.find((x) => x.code === 'general')?.id || g.items[0]?.id || '');
      setOperators(nextOwner === 'HQ' ? ops.items : ops.items.filter((o) => o.partnerId === nextOwner));
      setHistory(hist.items);
      setCanAdd(true);
      return;
    }
    const [g, staff, hist] = await Promise.all([
      api.partnerPortal.accessGroups(),
      api.partnerPortal.staff(),
      api.partnerPortal.accessHistory(),
    ]);
    setGroups(g.items);
    setCatalog(g.catalog);
    setSelectedGroup((id) => (g.items.some((x) => x.id === id) ? id : g.items[0]?.id || ''));
    setAddGroupId((id) => id || g.items.find((x) => x.code === 'general')?.id || g.items[0]?.id || '');
    setOperators(staff.items);
    setHistory(hist.items);
    setCanAdd(Boolean(staff.canAdd));
  };

  useEffect(() => {
    if (isHq) {
      api.admin.getPartners().then((r) => setPartners(r.items)).catch(() => setPartners([]));
    }
    load(isHq ? 'HQ' : '').catch((e) => setError((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  const group = groups.find((g) => g.id === selectedGroup);
  const operator = operators.find((o) => o.id === selectedOp);

  const resolvedMenus = useMemo(() => {
    if (!operator) return [];
    if (operator.isSuper) return catalog;
    if (operator.menuOverride?.length) return operator.menuOverride;
    return groups.find((g) => g.id === operator.groupId)?.menus || [];
  }, [operator, catalog, groups]);

  useEffect(() => {
    if (!operator) return;
    const custom = Boolean(operator.menuOverride?.length);
    setEditMode(custom ? 'custom' : 'group');
    setEditGroupId(operator.groupId || groups[0]?.id || '');
    setEditMenus(custom ? [...(operator.menuOverride || [])] : [...resolvedMenus]);
  }, [operator?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const note = (ok: string) => {
    setMessage(ok);
    setError('');
  };

  const fail = (e: unknown) => {
    setError((e as Error).message);
    setMessage('');
  };

  const addOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isHq) {
        await api.admin.createOperator({
          email,
          name,
          password,
          scope: owner === 'HQ' ? 'HQ' : 'PARTNER',
          partnerId: owner === 'HQ' ? undefined : owner,
          role,
          groupId: addGroupId,
        });
      } else {
        await api.partnerPortal.addStaff({ email, name, password, role, groupId: addGroupId });
      }
      setEmail('');
      setName('');
      setPassword('');
      await load();
      note(t('access.operatorAdded'));
    } catch (err) {
      fail(err);
    }
  };

  const saveOperatorAccess = async () => {
    if (!operator) return;
    try {
      const payload =
        editMode === 'custom'
          ? { groupId: editGroupId, menuOverride: editMenus }
          : { groupId: editGroupId, menuOverride: [] as string[] };
      if (isHq) await api.admin.updateOperator(operator.id, payload);
      else await api.partnerPortal.updateStaff(operator.id, payload);
      await load();
      note(t('admin.saved'));
    } catch (err) {
      fail(err);
    }
  };

  const saveGroup = async () => {
    if (!group) return;
    try {
      if (isHq) await api.admin.updateAccessGroup(group.id, { name: group.name, menus: group.menus });
      else await api.partnerPortal.updateAccessGroup(group.id, { name: group.name, menus: group.menus });
      await load();
      note(t('admin.saved'));
    } catch (err) {
      fail(err);
    }
  };

  const addGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      if (isHq) await api.admin.createAccessGroup({ owner, name: newGroupName.trim(), menus: catalog });
      else await api.partnerPortal.createAccessGroup({ name: newGroupName.trim(), menus: catalog });
      setNewGroupName('');
      await load();
      note(t('admin.saved'));
    } catch (err) {
      fail(err);
    }
  };

  const removeGroup = async () => {
    if (!group || group.builtIn) return;
    if (!window.confirm(t('access.deleteGroupConfirm', { name: group.name }))) return;
    try {
      if (isHq) await api.admin.deleteAccessGroup(group.id);
      else await api.partnerPortal.deleteAccessGroup(group.id);
      setSelectedGroup('');
      await load();
      note(t('admin.saved'));
    } catch (err) {
      fail(err);
    }
  };

  const toggleGroupMenu = (key: string) => {
    if (!group) return;
    const menus = group.menus.includes(key) ? group.menus.filter((k) => k !== key) : [...group.menus, key];
    setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, menus } : g)));
  };

  const permLabel = (o: Operator) => {
    if (o.isSuper) return t('access.permSuper');
    if (o.menuOverride?.length) return t('access.permCustom');
    return groups.find((g) => g.id === o.groupId)?.name || t('access.permGroup');
  };

  return (
    <div className="access-work">
      <p className={isHq ? 'access-hint hq-card-hint' : 'access-hint'}>{isHq ? t('access.hqHint') : t('access.partnerHint')}</p>
      {isHq ? (
        <div className="access-toolbar">
          <label>
            {t('access.owner')}
            <select
              className="input"
              value={owner}
              onChange={async (e) => {
                const next = e.target.value;
                setOwner(next);
                setSelectedOp('');
                try {
                  await load(next);
                } catch (err) {
                  fail(err);
                }
              }}
            >
              <option value="HQ">{t('access.ownerHq')}</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.companyName || p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <div className="access-tabs">
        {(['people', 'groups', 'history'] as const).map((key) => (
          <button
            key={key}
            type="button"
            className={`access-tab${tab === key ? ' is-on' : ''}`}
            onClick={() => setTab(key)}
          >
            {t(`access.tab${key[0].toUpperCase()}${key.slice(1)}`)}
          </button>
        ))}
      </div>

      {error ? <p className="access-msg is-err">{error}</p> : null}
      {message ? <p className="access-msg muted-text">{message}</p> : null}

      {tab === 'people' ? (
        <>
          {canAdd ? (
            <form className="card-surface access-add" onSubmit={addOperator}>
              <h3 className="section-title">{t('access.addOperator')}</h3>
              <div className="access-add-grid">
                <label>
                  {t('admin.colEmail')}
                  <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </label>
                <label>
                  {t('admin.operatorName')}
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
                </label>
                <label>
                  {t('admin.password')}
                  <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={4} />
                </label>
                <label>
                  {t('admin.operatorRole')}
                  <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="ADMIN">{t('admin.roleAdmin')}</option>
                    <option value="STAFF">{t('admin.roleStaff')}</option>
                  </select>
                </label>
                <label>
                  {t('access.groupLabel')}
                  <select className="input" value={addGroupId} onChange={(e) => setAddGroupId(e.target.value)}>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {t(`access.group.${g.code}`, { defaultValue: g.name })}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="access-add-actions">
                <button type="submit" className="btn-primary">
                  {t('admin.register')}
                </button>
              </div>
            </form>
          ) : (
            <p className="muted-text">{t('partner.staffNoAdd')}</p>
          )}

          <div className="card-surface access-table-wrap">
            <h3 className="section-title">{t('access.assign')}</h3>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('admin.colEmail')}</th>
                  <th>{t('admin.operatorName')}</th>
                  <th>{t('access.permission')}</th>
                  <th>{t('admin.colStatus')}</th>
                  <th>{t('admin.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {operators.map((o) => (
                  <tr key={o.id}>
                    <td>{o.email}</td>
                    <td>{o.name}</td>
                    <td>{permLabel(o)}</td>
                    <td>{o.status === 'suspended' ? t('admin.statusSuspended') : t('admin.statusActive')}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-outline btn-compact"
                        onClick={() => setSelectedOp(o.id === selectedOp ? '' : o.id)}
                      >
                        {t('access.editAccess')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {operators.length === 0 ? <p className="access-empty">{t('access.noOperators')}</p> : null}
          </div>

          {operator ? (
            <div className="card-surface access-editor">
              <h3 className="section-title">
                {t('access.editAccess')} · {operator.email}
              </h3>
              {operator.isSuper ? (
                <p className="access-hint">{t('access.superLocked')}</p>
              ) : (
                <>
                  <div className="access-modes">
                    <label>
                      <input type="radio" checked={editMode === 'group'} onChange={() => setEditMode('group')} />
                      {t('access.modeGroup')}
                    </label>
                    <label>
                      <input
                        type="radio"
                        checked={editMode === 'custom'}
                        onChange={() => {
                          setEditMode('custom');
                          setEditMenus((m) => (m.length ? m : [...resolvedMenus]));
                        }}
                      />
                      {t('access.modeCustom')}
                    </label>
                  </div>
                  <div className="access-editor-head">
                    <label>
                      {t('access.groupLabel')}
                      <select className="input" value={editGroupId} onChange={(e) => setEditGroupId(e.target.value)}>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {t(`access.group.${g.code}`, { defaultValue: g.name })}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {editMode === 'custom' ? (
                    <MenuGrid
                      catalog={catalog}
                      selected={editMenus}
                      sections={sections}
                      onToggle={(key) =>
                        setEditMenus((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
                      }
                    />
                  ) : (
                    <MenuGrid catalog={catalog} selected={groups.find((g) => g.id === editGroupId)?.menus || []} sections={sections} disabled onToggle={() => undefined} />
                  )}
                  <div className="access-actions">
                    <button type="button" className="btn-primary" onClick={saveOperatorAccess}>
                      {t('access.saveAccess')}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </>
      ) : null}

      {tab === 'groups' ? (
        <div className="access-split">
          <div className="card-surface">
            <h3 className="section-title">{t('access.groups')}</h3>
            <div className="access-group-list">
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={`btn-outline access-group-item${g.id === selectedGroup ? ' is-on' : ''}`}
                  onClick={() => setSelectedGroup(g.id)}
                >
                  {t(`access.group.${g.code}`, { defaultValue: g.name })}
                </button>
              ))}
            </div>
            <div className="access-group-add">
              <input className="input" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder={t('access.groupName')} />
              <button type="button" className="btn-primary" onClick={addGroup}>
                {t('access.addGroup')}
              </button>
            </div>
          </div>
          <div className="card-surface access-editor">
            <h3 className="section-title">{t('access.menus')}</h3>
            {group ? (
              <>
                <div className="access-editor-head">
                  <label>
                    {t('access.groupName')}
                    <input
                      className="input"
                      value={group.name}
                      onChange={(e) => setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, name: e.target.value } : g)))}
                    />
                  </label>
                </div>
                <MenuGrid catalog={catalog} selected={group.menus} sections={sections} onToggle={toggleGroupMenu} />
                <div className="access-actions">
                  <button type="button" className="btn-primary" onClick={saveGroup}>
                    {t('access.saveGroup')}
                  </button>
                  {!group.builtIn ? (
                    <button type="button" className="btn-outline" onClick={removeGroup}>
                      {t('access.deleteGroup')}
                    </button>
                  ) : (
                    <span className="muted-text">{t('access.builtIn')}</span>
                  )}
                </div>
              </>
            ) : (
              <p className="access-empty">{t('access.noGroup')}</p>
            )}
          </div>
        </div>
      ) : null}

      {tab === 'history' ? (
        <div className="card-surface access-table-wrap">
          <h3 className="section-title">{t('access.history')}</h3>
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
          {history.length === 0 ? <p className="access-empty">{t('access.noHistory')}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
