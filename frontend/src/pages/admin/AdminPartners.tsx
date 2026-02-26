import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';

type Partner = {
  id: string;
  name: string;
  companyName?: string;
  apiKeyPrefix: string;
  status: string;
  billingWalletAddress?: string;
  billingWarnings?: number;
  lastBillingMonth?: string;
  createdAt: string;
};

export default function AdminPartners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createCompany, setCreateCompany] = useState('');
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const fetchPartners = () => {
    api.admin
      .getPartners()
      .then((r) => setPartners(r.items))
      .catch((e) => {
        const msg = (e as Error).message || '';
        if (msg.includes('Admin') || msg.includes('403')) {
          localStorage.removeItem('token');
          window.location.href = '/admin/login';
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    try {
      const r = await api.admin.createPartner({ name: createName.trim(), companyName: createCompany.trim() || undefined });
      setNewApiKey(r.apiKey);
      setShowCreate(false);
      setCreateName('');
      setCreateCompany('');
      fetchPartners();
    } catch (err) {
      setMessage((err as Error).message);
    }
  };

  const handleRegenerate = async (id: string) => {
    if (!confirm('기존 API Key가 즉시 무효화됩니다. 새 Key를 발급할까요?')) return;
    setMessage('');
    try {
      const r = await api.admin.regeneratePartnerKey(id);
      setNewApiKey(r.apiKey);
      setMessage('새 API Key: ' + r.apiKey);
      fetchPartners();
    } catch (err) {
      setMessage((err as Error).message);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await api.admin.updatePartner(id, { status: status as 'active' | 'suspended' });
      fetchPartners();
    } catch (err) {
      setMessage((err as Error).message);
    }
  };

  const apiBase =
    import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:3001' : '');

  return (
    <div className="app-container">
      <div className="page-header">
        <h1 className="page-title">파트너 API 관리</h1>
        <div className="page-header-actions">
          <button
            onClick={async () => {
              try {
                const r = await api.admin.runPartnerBilling();
                alert(`청구 완료: ${r.month}\n${r.results.map((x) => `${x.name}: ${x.status}`).join('\n')}`);
                fetchPartners();
              } catch (e) {
                alert((e as Error).message);
              }
            }}
            className="btn-secondary"
          >
            월간 청구 실행
          </button>
          <Link to="/admin/dashboard" className="btn-outline">
            ← 대시보드
          </Link>
          <button onClick={() => setShowCreate(!showCreate)} className="btn-primary">
            + 파트너 추가
          </button>
        </div>
      </div>

      <p className="muted-text admin-partners-desc">
        타 업체가 우리 API를 통해 카드 발급·지갑 연동 서비스를 제공할 수 있습니다. 파트너마다 API Key를 발급하며, 해당 Key로 인증합니다.
      </p>

      {showCreate && (
        <form onSubmit={handleCreate} className="card-surface admin-partners-create">
          <h3>새 파트너 등록</h3>
          <label className="admin-settings-label">
            파트너명 *
            <input
              type="text"
              className="input"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="예: ABC사"
              required
            />
          </label>
          <label className="admin-settings-label">
            회사명
            <input
              type="text"
              className="input"
              value={createCompany}
              onChange={(e) => setCreateCompany(e.target.value)}
              placeholder="예: (주)ABC"
            />
          </label>
          <div className="admin-settings-actions">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">
              취소
            </button>
            <button type="submit" className="btn-primary">
              등록
            </button>
          </div>
        </form>
      )}

      {newApiKey && (
        <div className="card-surface admin-api-key-modal">
          <h3>API Key (한 번만 표시됨)</h3>
          <code className="admin-api-key-value">{newApiKey}</code>
          <p className="muted-text">이 값을 안전하게 저장하세요. 다시 표시되지 않습니다.</p>
          <button onClick={() => setNewApiKey(null)} className="btn-primary">
            확인
          </button>
        </div>
      )}

      {message && (
        <div className={message.includes('API Key') ? 'admin-settings-success' : 'auth-error'}>
          {message}
        </div>
      )}

      <div className="card-surface admin-api-docs">
        <h3>파트너 API 엔드포인트</h3>
        <p className="muted-text">Base URL: {apiBase || window.location.origin}/api/partner/v1</p>
        <div className="admin-api-sections">
          <div>
            <h4>1. 카드 발급 API</h4>
            <ul>
              <li><code>GET /cards</code> - 카드 목록</li>
              <li><code>POST /cards/virtual</code> - 가상 카드 발급</li>
              <li><code>PUT /cards/:cardId/block</code> - 카드 차단</li>
              <li><code>PUT /cards/:cardId/unblock</code> - 차단 해제</li>
              <li><code>PUT /cards/:cardId/limit</code> - 한도 설정</li>
            </ul>
          </div>
          <div>
            <h4>2. 지갑 연동 API</h4>
            <ul>
              <li><code>GET /wallet/balance</code> - 잔액 조회</li>
              <li><code>GET /wallet/tokens</code> - 지원 토큰 목록</li>
              <li><code>GET /wallet/card/:cardId/deposit-info</code> - 충전 정보</li>
              <li><code>POST /wallet/card/:cardId/deposit</code> - 카드 충전</li>
            </ul>
          </div>
        </div>
        <p className="admin-api-auth">
          <strong>인증:</strong> <code>X-API-Key: &lt;api_key&gt;</code> 또는 <code>Authorization: Bearer &lt;api_key&gt;</code><br />
          <strong>사용자 식별:</strong> <code>X-Partner-User-Id</code> (파트너의 사용자 ID, 필수)
        </p>
      </div>

      {loading ? (
        <p className="muted-text">로딩 중...</p>
      ) : (
        <div className="card-surface admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>파트너명</th>
                <th>회사명</th>
                <th>과금 월렛</th>
                <th>경고</th>
                <th>API Key</th>
                <th>상태</th>
                <th>등록일</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.companyName || '-'}</td>
                  <td className="mono">{p.billingWalletAddress ? p.billingWalletAddress.slice(0, 10) + '...' : '-'}</td>
                  <td>{p.billingWarnings ?? 0}</td>
                  <td className="mono">{p.apiKeyPrefix}</td>
                  <td>
                    <select
                      value={p.status}
                      onChange={(e) => handleStatusChange(p.id, e.target.value)}
                      className="admin-status-select"
                    >
                      <option value="active">활성</option>
                      <option value="suspended">중지</option>
                    </select>
                  </td>
                  <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button
                      onClick={() => {
                        const addr = prompt('과금 월렛 주소 (0x...)');
                        if (addr) {
                          api.admin.updatePartner(p.id, { billingWalletAddress: addr }).then(() => fetchPartners()).catch(alert);
                        }
                      }}
                      className="btn-outline btn-compact"
                      title="과금 월렛 등록"
                    >
                      월렛
                    </button>
                    <button
                      onClick={() => {
                        const amt = prompt('충전 금액 (USD)');
                        if (amt && !isNaN(parseFloat(amt))) {
                          api.admin.addPartnerBillingBalance(p.id, parseFloat(amt)).then(() => fetchPartners()).catch(alert);
                        }
                      }}
                      className="btn-outline btn-compact"
                      title="테스트 잔액 충전"
                    >
                      충전
                    </button>
                    <button
                      onClick={() => handleRegenerate(p.id)}
                      className="btn-outline btn-compact"
                      title="API Key 재발급"
                    >
                      Key
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {partners.length === 0 && <p className="muted-text empty-text">등록된 파트너가 없습니다.</p>}
        </div>
      )}
    </div>
  );
}
