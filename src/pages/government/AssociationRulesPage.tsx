import { useEffect, useState } from 'react';
import { Card } from '../../components/Card';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { getAssociationRules } from '../../api';
import { getApiErrorMessage } from '../../api/client';
import type { AssociationRule, AssociationRulesResponse } from '../../types';
import { RISK_BADGE_STYLES } from './governmentData';

/* ── Helpers for association rule labels ── */
function formatItem(raw: string): string {
  // e.g. "Helmet Worn=no" → "Helmet Worn: no"
  const eq = raw.indexOf('=');
  if (eq === -1) return raw;
  const field = raw.slice(0, eq).trim();
  const value = raw.slice(eq + 1).trim();
  return `${field}: ${value}`;
}

function isSeverityItem(item: string) {
  return item.toLowerCase().startsWith('severity_label=');
}

function severityFromItem(item: string): 'high' | 'low' | null {
  const lower = item.toLowerCase();
  if (lower.includes('severity_label=high')) return 'high';
  if (lower.includes('severity_label=low')) return 'low';
  return null;
}

/* ── Mini metric bar (e.g. confidence %) ── */
function MetricBar({ value, color }: { value: number; color: string }) {
  return (
    <div
      style={{
        height: 4,
        borderRadius: 4,
        background: 'rgba(148,163,184,0.12)',
        marginTop: 4,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${Math.round(value * 100)}%`,
          background: color,
          borderRadius: 4,
          transition: 'width 0.4s ease',
        }}
      />
    </div>
  );
}

/* ── Single rule card ── */
function RuleCard({ rule, index }: { rule: AssociationRule; index: number }) {
  const hasSeverityConsequent = rule.consequents.some(isSeverityItem);
  const severity = hasSeverityConsequent
    ? rule.consequents.map(severityFromItem).find(Boolean)
    : null;

  const accentColor =
    severity === 'high'
      ? 'var(--tone-danger)'
      : severity === 'low'
      ? 'var(--tone-success)'
      : '#a78bfa';

  const accentBg =
    severity === 'high'
      ? 'rgba(239, 68, 68, 0.08)'
      : severity === 'low'
      ? 'rgba(16, 185, 129, 0.08)'
      : 'rgba(139, 92, 246, 0.08)';

  const accentBorder =
    severity === 'high'
      ? 'rgba(239, 68, 68, 0.2)'
      : severity === 'low'
      ? 'rgba(16, 185, 129, 0.2)'
      : 'rgba(139, 92, 246, 0.2)';

  return (
    <div
      style={{
        background: accentBg,
        border: `1px solid ${accentBorder}`,
        borderRadius: 12,
        padding: '14px 16px',
        position: 'relative',
      }}
    >
      {/* rank badge */}
      <span
        style={{
          position: 'absolute',
          top: 10,
          right: 12,
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--text-muted)',
          letterSpacing: '0.05em',
        }}
      >
        #{index + 1}
      </span>

      {/* antecedents */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {rule.antecedents.map((item) => (
          <span
            key={item}
            style={{
              fontSize: 11,
              fontWeight: 500,
              padding: '3px 8px',
              borderRadius: 6,
              background: 'rgba(148,163,184,0.1)',
              color: 'var(--text-secondary)',
              border: '1px solid rgba(148,163,184,0.15)',
            }}
          >
            {formatItem(item)}
          </span>
        ))}
      </div>

      {/* arrow */}
      <div
        style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span>→</span>
        {/* consequents */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {rule.consequents.map((item) => {
            const sev = severityFromItem(item);
            const sevStyle = sev ? (sev === 'high' ? RISK_BADGE_STYLES.High : RISK_BADGE_STYLES.Low) : null;
            return (
              <span
                key={item}
                style={
                  sevStyle
                    ? {
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '3px 10px',
                        borderRadius: 20,
                        background: sevStyle.bg,
                        color: sevStyle.color,
                        border: `1px solid ${sevStyle.border}`,
                        boxShadow: sevStyle.glow,
                      }
                    : {
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '3px 10px',
                        borderRadius: 20,
                        background: 'rgba(139,92,246,0.15)',
                        color: 'var(--tone-accent)',
                        border: '1px solid rgba(139,92,246,0.25)',
                      }
                }
              >
                {formatItem(item)}
              </span>
            );
          })}
        </div>
      </div>

      {/* metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>CONFIDENCE</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: accentColor }}>
            {(rule.confidence * 100).toFixed(1)}%
          </div>
          <MetricBar value={rule.confidence} color={accentColor} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>LIFT</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            {rule.lift.toFixed(2)}×
          </div>
          <MetricBar value={Math.min(rule.lift / 5, 1)} color="#818cf8" />
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>SUPPORT</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
            {(rule.support * 100).toFixed(1)}%
          </div>
          <MetricBar value={rule.support / 0.5} color="#64748b" />
        </div>
      </div>
    </div>
  );
}

/* ── Filter pill ── */
function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s',
        background: active ? 'rgba(139, 92, 246, 0.2)' : 'rgba(148,163,184,0.08)',
        color: active ? 'var(--tone-accent)' : 'var(--text-muted)',
        border: active ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(148,163,184,0.12)',
      }}
    >
      {label}
    </button>
  );
}

/** Pre-computed Apriori rules from the notebook artifact; read-only. */
export function AssociationRulesPage() {
  const [rulesData, setRulesData] = useState<AssociationRulesResponse | null>(null);
  const [isLoadingRules, setIsLoadingRules] = useState(true);
  const [rulesError, setRulesError] = useState('');

  // Rule filter state
  const [ruleFilter, setRuleFilter] = useState<string>(''); // consequent filter
  const [ruleSortBy, setRuleSortBy] = useState<'lift' | 'confidence' | 'support'>('lift');
  const [ruleSearch, setRuleSearch] = useState('');

  // Reload rules when filter/sort changes
  useEffect(() => {
    setIsLoadingRules(true);
    setRulesError('');
    getAssociationRules({
      consequent: ruleFilter || undefined,
      limit: 100,
      sortBy: ruleSortBy,
    })
      .then(setRulesData)
      .catch((error: unknown) => {
        setRulesError(getApiErrorMessage(error, 'Unable to load association rules.'));
      })
      .finally(() => setIsLoadingRules(false));
  }, [ruleFilter, ruleSortBy]);

  // Client-side search filter on top of server filter
  const displayedRules = (rulesData?.rules ?? []).filter((rule) => {
    if (!ruleSearch.trim()) return true;
    const q = ruleSearch.toLowerCase();
    return (
      rule.antecedents.some((a) => a.toLowerCase().includes(q)) ||
      rule.consequents.some((c) => c.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6" data-testid="government-associations">
      <div>
        <h1 className="text-xl font-semibold gradient-text">Association rules</h1>
        <p className="mt-2 text-sm text-[color:var(--text-secondary)] max-w-3xl">
          Patterns mined from the historical accident dataset with the Apriori algorithm. The rules are computed
          in advance and cannot be changed here. Items such as “severity_label: high” are values recorded in the
          dataset, not outputs of the Severity model.
        </p>
      </div>
        {/* ── Apriori Association Rules ── */}
        <Card title="Association rule mining — Apriori patterns">
          {/* Info banner */}
          <p
            className="mb-5 rounded-lg px-4 py-3 text-xs leading-relaxed"
            style={{
              color: 'var(--tone-accent)',
              background: 'rgba(139, 92, 246, 0.08)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
            }}
          >
            <span style={{ fontWeight: 700 }}>Apriori algorithm</span> — {rulesData?.total_rules ?? '…'} validated
            rules mined from {rulesData ? '6,178' : '…'} accident records (min support 2%, confidence 50%, lift 1.2×).
            Each rule was stability-checked across 5 independent random data splits and pruned for redundancy.
          </p>

          {/* Filters */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 8,
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>FILTER:</span>
            <FilterPill label="All rules" active={ruleFilter === ''} onClick={() => setRuleFilter('')} />
            <FilterPill label="→ severity_label: high (dataset)" active={ruleFilter === 'severity_label=high'} onClick={() => setRuleFilter('severity_label=high')} />
            <FilterPill label="→ severity_label: low (dataset)" active={ruleFilter === 'severity_label=low'} onClick={() => setRuleFilter('severity_label=low')} />

            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginLeft: 8 }}>SORT:</span>
            <FilterPill label="By lift" active={ruleSortBy === 'lift'} onClick={() => setRuleSortBy('lift')} />
            <FilterPill label="By confidence" active={ruleSortBy === 'confidence'} onClick={() => setRuleSortBy('confidence')} />
            <FilterPill label="By support" active={ruleSortBy === 'support'} onClick={() => setRuleSortBy('support')} />

            {/* Search */}
            <input
              type="text"
              placeholder="Search items…"
              value={ruleSearch}
              onChange={(e) => setRuleSearch(e.target.value)}
              style={{
                marginLeft: 'auto',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 12,
                background: 'rgba(148,163,184,0.08)',
                border: '1px solid rgba(148,163,184,0.15)',
                color: 'var(--text-primary)',
                outline: 'none',
                width: 180,
              }}
            />
          </div>

          {isLoadingRules ? (
            <LoadingSpinner />
          ) : rulesError ? (
            <p className="text-sm py-4" style={{ color: 'var(--tone-danger)' }}>{rulesError}</p>
          ) : displayedRules.length === 0 ? (
            <p className="text-sm py-4" style={{ color: 'var(--text-muted)' }}>
              No rules match the current filter.
            </p>
          ) : (
            <>
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                Showing {displayedRules.length} rule{displayedRules.length !== 1 ? 's' : ''}
                {ruleSearch ? ` matching "${ruleSearch}"` : ''}
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: 12,
                  maxHeight: 600,
                  overflowY: 'auto',
                  paddingRight: 4,
                }}
              >
                {displayedRules.map((rule, i) => (
                  <RuleCard key={`${rule.antecedents.join(',')}->${rule.consequents.join(',')}`} rule={rule} index={i} />
                ))}
              </div>
              {rulesData && rulesData.message && (
                <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {rulesData.message}
                </p>
              )}
            </>
          )}
        </Card>
    </div>
  );
}
