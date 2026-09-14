import type { CredentialKit } from '../api';

export default function CredentialKitCard({
  kit,
  title,
  hint,
  onClose,
  closeLabel,
}: {
  kit: CredentialKit;
  title: string;
  hint: string;
  onClose?: () => void;
  closeLabel?: string;
}) {
  return (
    <div className="card-surface admin-api-key-modal">
      <h3>{title}</h3>
      <p className="muted-text">{kit.warning}</p>
      <p className="muted-text">{hint}</p>
      <dl className="kit-dl">
        <dt>MID</dt>
        <dd><code>{kit.mid}</code></dd>
        <dt>API Key</dt>
        <dd><code className="admin-api-key-value">{kit.apiKey}</code></dd>
        <dt>API Secret</dt>
        <dd><code className="admin-api-key-value">{kit.apiSecret}</code></dd>
        <dt>HMAC</dt>
        <dd><code className="admin-api-key-value">{kit.hmacSecret}</code></dd>
        {kit.solutionUrl ? (
          <>
            <dt>Solution</dt>
            <dd><code>{kit.solutionUrl}</code></dd>
          </>
        ) : null}
      </dl>
      <pre className="kit-json">{JSON.stringify(kit, null, 2)}</pre>
      {onClose ? (
        <button type="button" className="btn-primary" onClick={onClose}>
          {closeLabel || 'OK'}
        </button>
      ) : null}
    </div>
  );
}
