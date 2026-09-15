import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type DateQuickKey,
  type EntityFilterState,
  EMPTY_ENTITY_FILTER,
  rangeForQuick,
} from '../lib/dateRange';

export type FilterOption = { value: string; label: string };

const QUICKS: DateQuickKey[] = ['today', 'thisMonth', 'yesterday', 'week1', 'week2', 'lastMonth'];

export function EntityFilterBar({
  value,
  onChange,
  onSearch,
  onReset,
  dateFieldOptions,
  searchFieldOptions,
  statusOptions,
  extraFields,
}: {
  value: EntityFilterState;
  onChange: (next: EntityFilterState) => void;
  onSearch: () => void;
  onReset?: () => void;
  dateFieldOptions: FilterOption[];
  searchFieldOptions: FilterOption[];
  statusOptions: FilterOption[];
  extraFields?: ReactNode;
}) {
  const { t } = useTranslation();

  const setQuick = (key: DateQuickKey) => {
    const r = rangeForQuick(key);
    onChange({ ...value, quick: key, dateFrom: r.from, dateTo: r.to });
  };

  return (
    <div className="entity-filter">
      <div className="entity-filter-row">
        <label>
          <span>{t('admin.filterDateField')}</span>
          <select
            className="input"
            value={value.dateField}
            onChange={(e) => onChange({ ...value, dateField: e.target.value })}
          >
            {dateFieldOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t('admin.filterDateFrom')}</span>
          <input
            type="date"
            className="input entity-filter-date"
            value={value.dateFrom}
            onChange={(e) => onChange({ ...value, dateFrom: e.target.value, quick: '' })}
          />
        </label>
        <span className="entity-filter-tilde">~</span>
        <label>
          <span>{t('admin.filterDateTo')}</span>
          <input
            type="date"
            className="input entity-filter-date"
            value={value.dateTo}
            onChange={(e) => onChange({ ...value, dateTo: e.target.value, quick: '' })}
          />
        </label>
        <div className="entity-filter-quicks">
          {QUICKS.map((key) => (
            <button
              key={key}
              type="button"
              className={`entity-filter-quick${value.quick === key ? ' is-on' : ''}`}
              onClick={() => setQuick(key)}
            >
              {t(`admin.filterQuick.${key}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="entity-filter-row">
        <label>
          <span>{t('admin.filterSearchField')}</span>
          <select
            className="input"
            value={value.searchField}
            onChange={(e) => onChange({ ...value, searchField: e.target.value })}
          >
            {searchFieldOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t('admin.filterKeyword')}</span>
          <input
            className="input entity-filter-keyword"
            value={value.keyword}
            onChange={(e) => onChange({ ...value, keyword: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSearch();
            }}
            placeholder={t('admin.filterKeywordPh')}
          />
        </label>
        <label>
          <span>{t('admin.colStatus')}</span>
          <select
            className="input"
            value={value.status}
            onChange={(e) => onChange({ ...value, status: e.target.value })}
          >
            <option value="">{t('admin.filterAll')}</option>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {extraFields}
        <div className="entity-filter-actions">
          <button type="button" className="btn-primary" onClick={onSearch}>
            {t('admin.search')}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              onChange({ ...EMPTY_ENTITY_FILTER, dateField: value.dateField });
              onReset?.();
            }}
          >
            {t('admin.filterReset')}
          </button>
        </div>
      </div>
    </div>
  );
}
