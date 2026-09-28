import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DashboardShell } from '../../components/DashboardShell';
import { Card } from '../../components/Card';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import {
  getAccidentForecast,
  getAccidentTrends,
  getAssociationRules,
  getHistoricalAccidentTrends,
} from '../../api';
import { getApiErrorMessage } from '../../api/client';
import type {
  AccidentForecast,
  AccidentTrend,
  AssociationRule,
  AssociationRulesResponse,
} from '../../types';

const RISK_BADGE_STYLES: Record<string, { bg: string; color: string; border: string; glow: string }> = {
  Low: {
    bg: 'rgba(16, 185, 129, 0.15)',
    color: '#6ee7b7',
    border: 'rgba(16, 185, 129, 0.3)',
    glow: '0 0 10px rgba(16, 185, 129, 0.15)',
  },
  Medium: {
    bg: 'rgba(245, 158, 11, 0.15)',
    color: '#fcd34d',
    border: 'rgba(245, 158, 11, 0.3)',
    glow: '0 0 10px rgba(245, 158, 11, 0.15)',
  },
  High: {
    bg: 'rgba(239, 68, 68, 0.15)',
    color: '#fca5a5',
    border: 'rgba(239, 68, 68, 0.3)',
    glow: '0 0 10px rgba(239, 68, 68, 0.2)',
  },
};

/* Recharts dark tooltip styles */
const tooltipStyle = {
  backgroundColor: 'rgba(15, 23, 42, 0.95)',
  border: '1px solid rgba(148, 163, 184, 0.15)',
  borderRadius: '10px',
  color: '#f1f5f9',
  fontSize: '13px',
  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
};

const thStyle = {
  color: 'var(--text-muted)',
  borderBottom: '1px solid var(--border-subtle)',
};

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
      ? '#fca5a5'
      : severity === 'low'
      ? '#6ee7b7'
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
                        color: '#c4b5fd',
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
        color: active ? '#c4b5fd' : 'var(--text-muted)',
        border: active ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(148,163,184,0.12)',
      }}
    >
      {label}
    </button>
  );
}

/* ── Main component ── */
export function GovernmentDashboard() {
  const [historicalTrends, setHistoricalTrends] = useState<AccidentTrend[]>([]);
  const [trends, setTrends] = useState<AccidentTrend[]>([]);
  const [forecast, setForecast] = useState<AccidentForecast | null>(null);
  const [rulesData, setRulesData] = useState<AssociationRulesResponse | null>(null);

  const [isLoadingHistoricalTrends, setIsLoadingHistoricalTrends] = useState(true);
  const [isLoadingTrends, setIsLoadingTrends] = useState(true);
  const [isLoadingForecast, setIsLoadingForecast] = useState(true);
  const [isLoadingRules, setIsLoadingRules] = useState(true);

  const [historicalTrendsError, setHistoricalTrendsError] = useState('');
  const [trendsError, setTrendsError] = useState('');
  const [forecastError, setForecastError] = useState('');
  const [rulesError, setRulesError] = useState('');

  // Rule filter state
  const [ruleFilter, setRuleFilter] = useState<string>(''); // consequent filter
  const [ruleSortBy, setRuleSortBy] = useState<'lift' | 'confidence' | 'support'>('lift');
  const [ruleSearch, setRuleSearch] = useState('');

  useEffect(() => {
    getHistoricalAccidentTrends()
      .then(setHistoricalTrends)
      .catch((error: unknown) => {
        setHistoricalTrendsError(
          getApiErrorMessage(error, 'Unable to load historical accident trends.'),
        );
      })
      .finally(() => setIsLoadingHistoricalTrends(false));

    getAccidentTrends()
      .then(setTrends)
      .catch((error: unknown) => {
        setTrendsError(getApiErrorMessage(error, 'Unable to load accident trends.'));
      })
      .finally(() => setIsLoadingTrends(false));

    getAccidentForecast()
      .then(setForecast)
      .catch((error: unknown) => {
        setForecastError(getApiErrorMessage(error, 'Unable to load the accident forecast.'));
      })
      .finally(() => setIsLoadingForecast(false));
  }, []);

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
    <DashboardShell>
      <div className="space-y-6">
        <h1 className="text-xl font-semibold gradient-text">Data mining insights</h1>

        <Card title="Historical monthly accident trends — notebook dataset">
          {isLoadingHistoricalTrends ? (
            <LoadingSpinner />
          ) : historicalTrendsError ? (
            <p className="text-sm py-4" style={{ color: '#fca5a5' }}>{historicalTrendsError}</p>
          ) : historicalTrends.length === 0 ? (
            <p className="text-sm py-4" style={{ color: 'var(--text-muted)' }}>No historical accident data found.</p>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={historicalTrends} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(148, 163, 184, 0.15)' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(148, 163, 184, 0.15)' }}
                  />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(139, 92, 246, 0.08)' }} />
                  <defs>
                    <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                  <Bar dataKey="count" fill="url(#blueGradient)" radius={[6, 6, 0, 0]} name="Accidents" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Monthly accident trends — database records">
          {isLoadingTrends ? (
            <LoadingSpinner />
          ) : trendsError ? (
            <p className="text-sm py-4" style={{ color: '#fca5a5' }}>{trendsError}</p>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(148, 163, 184, 0.15)' }}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(148, 163, 184, 0.15)' }}
                  />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(139, 92, 246, 0.08)' }} />
                  <defs>
                    <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                  <Bar dataKey="count" fill="url(#purpleGradient)" radius={[6, 6, 0, 0]} name="Accidents" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Future monthly accident forecast — model output">
          {isLoadingForecast ? (
            <LoadingSpinner />
          ) : forecastError ? (
            <p className="text-sm py-4" style={{ color: '#fca5a5' }}>{forecastError}</p>
          ) : !forecast || forecast.status !== 'OK' ? (
            <div className="py-4">
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Forecast unavailable</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                {forecast?.message ?? 'Install the forecasting artifact and restart the backend.'}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                {forecast.model_name}{forecast.model_version ? ` · ${forecast.model_version}` : ''}
              </p>
              {forecast.message && (
                <p
                  className="mb-4 rounded-lg px-4 py-2.5 text-xs"
                  style={{
                    color: '#fcd34d',
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                  }}
                >
                  {forecast.message}
                </p>
              )}
              {forecast.risk_thresholds && (
                <div className="mb-4 flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Relative risk thresholds:</span>
                  {(['Low', 'Medium', 'High'] as const).map((level) => {
                    const s = RISK_BADGE_STYLES[level];
                    const labelText = level === 'Low'
                      ? `Low: <${forecast.risk_thresholds!.medium_min}`
                      : level === 'Medium'
                        ? `Medium: ${forecast.risk_thresholds!.medium_min}–${forecast.risk_thresholds!.high_min - 1}`
                        : `High: ≥${forecast.risk_thresholds!.high_min}`;
                    return (
                      <span
                        key={level}
                        className="rounded-full px-2.5 py-1 font-medium"
                        style={{
                          background: s.bg,
                          color: s.color,
                          border: `1px solid ${s.border}`,
                        }}
                      >
                        {labelText}
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left py-3 px-4 font-medium" style={thStyle}>Month</th>
                      <th className="text-right py-3 px-4 font-medium" style={thStyle}>Predicted accidents</th>
                      <th className="text-center py-3 px-4 font-medium" style={thStyle}>Risk level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.points.map((point) => {
                      const riskStyle = point.risk_level ? RISK_BADGE_STYLES[point.risk_level] : null;
                      return (
                        <tr
                          key={point.period}
                          className="dark-table-row"
                          style={{ borderBottom: '1px solid var(--border-subtle)' }}
                        >
                          <td className="py-3 px-4 font-medium" style={{ color: 'var(--text-primary)' }}>
                            {point.period}
                          </td>
                          <td className="py-3 px-4 text-right" style={{ color: 'var(--text-primary)' }}>
                            {point.predicted_accidents}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {riskStyle ? (
                              <span
                                className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                                style={{
                                  background: riskStyle.bg,
                                  color: riskStyle.color,
                                  border: `1px solid ${riskStyle.border}`,
                                  boxShadow: riskStyle.glow,
                                }}
                              >
                                {point.risk_level}
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>

        {/* ── Apriori Association Rules ── */}
        <Card title="Association rule mining — Apriori patterns">
          {/* Info banner */}
          <p
            className="mb-5 rounded-lg px-4 py-3 text-xs leading-relaxed"
            style={{
              color: '#c4b5fd',
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
            <FilterPill label="→ High severity" active={ruleFilter === 'severity_label=high'} onClick={() => setRuleFilter('severity_label=high')} />
            <FilterPill label="→ Low severity" active={ruleFilter === 'severity_label=low'} onClick={() => setRuleFilter('severity_label=low')} />

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
            <p className="text-sm py-4" style={{ color: '#fca5a5' }}>{rulesError}</p>
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
    </DashboardShell>
  );
}
