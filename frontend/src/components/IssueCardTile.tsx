import { useTranslation } from 'react-i18next';
import CardVisual from './CardVisual';

type Props = {
  type: 'virtual' | 'plastic';
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
};

export default function IssueCardTile({ type, disabled, loading, onClick }: Props) {
  const { t } = useTranslation();
  const isPlastic = type === 'plastic';

  return (
    <div className={`card-tile card-tile-issue card-tile-issue-${type}`}>
      <button
        type="button"
        className="card-issue-button"
        onClick={onClick}
        disabled={disabled || loading}
        aria-label={isPlastic ? t('cards.issuePlastic') : t('cards.issueVirtual')}
      >
        <CardVisual
          preview
          type={type}
          panLast4={isPlastic ? '8899' : '4242'}
          currency="USD"
          variant={isPlastic ? 'metal' : 'virtual'}
        />
        <div className="card-issue-caption">
          <span className="card-issue-plus" aria-hidden>
            +
          </span>
          <span className="card-issue-title">
            {loading
              ? t('cards.issuing')
              : isPlastic
                ? t('cards.issuePlastic')
                : t('cards.issueVirtual')}
          </span>
          <span className="card-issue-desc">
            {isPlastic ? t('cards.issuePlasticDesc') : t('cards.issueVirtualDesc')}
          </span>
        </div>
      </button>
    </div>
  );
}
