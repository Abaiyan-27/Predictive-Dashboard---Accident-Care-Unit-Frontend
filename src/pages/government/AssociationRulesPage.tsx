import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/Card';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { getAssociationRules } from '../../api';
import { getApiErrorMessage } from '../../api/client';
import type { AssociationRule, AssociationRulesResponse, RuleStrength } from '../../types';

/*
 * The plain-language rules of Association_Rule_Mining.ipynb (section 9).
 * Strength bands are the notebook's, by lift; "moderate" is shown as "Clear"
 * so it is never read as a Severity level.
 */
const STRENGTHS: { key: RuleStrength; label: string; band: string; tone: string }[] = [
  { key: 'very strong', label: 'Very strong link', band: '3× or more', tone: 'var(--tone-danger)' },
  { key: 'strong', label: 'Strong link', band: '2× or more', tone: 'var(--tone-warning)' },
  { key: 'moderate', label: 'Clear link', band: '1.5× or more', tone: 'var(--tone-accent)' },
  { key: 'mild', label: 'Mild link', band: 'below 1.5×', tone: 'var(--tone-info)' },
];
const STRENGTH = Object.fromEntries(STRENGTHS.map((s) => [s.key, s])) as Record<RuleStrength, (typeof STRENGTHS)[number]>;

type SortKey = 'lift' | 'confidence' | 'accidents';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'lift', label: 'Strongest link' },
  { key: 'confidence', label: 'Most consistent' },
  { key: 'accidents', label: 'Most accidents' },
];

/** "Helmet Worn=no" → "Helmet Worn: no" (the technical items behind a rule). */
function formatItem(raw: string): string {
  const eq = raw.indexOf('=');
  return eq === -1 ? raw : `${raw.slice(0, eq).trim()}: ${raw.slice(eq + 1).trim()}`;
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
      style={{
        background: active ? 'rgba(139, 92, 246, 0.2)' : 'rgba(148,163,184,0.08)',
        color: active ? 'var(--tone-accent)' : 'var(--text-muted)',
        border: active ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(148,163,184,0.12)',
      }}>
      {label}
    </button>
  );
}

function RuleCard({ rule }: { rule: AssociationRule }) {
  const strength = STRENGTH[rule.strength];
  return (
    <article data-testid="rule-card" className="rounded-xl p-4 space-y-3"
      style={{ background: 'rgba(139, 92, 246, 0.06)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="px-2 py-0.5 rounded-full font-semibold"
          style={{ color: strength.tone, border: `1px solid ${strength.tone}` }}>{strength.label}</span>
        <span className="px-2 py-0.5 rounded-full" style={{ color: 'var(--text-secondary)', background: 'rgba(148,163,184,0.1)' }}>
          {rule.topic}
        </span>
        <span className="ml-auto text-[color:var(--text-muted)]">#{rule.rank}</span>
      </div>
      <p className="text-sm font-medium leading-relaxed text-[color:var(--text-primary)]">{rule.rule}</p>
      <p className="text-xs leading-relaxed text-[color:var(--text-secondary)]">{rule.interpretation}</p>
      <dl className="grid grid-cols-3 gap-2 text-xs">
        <div><dt className="text-[color:var(--text-muted)]">Happens</dt><dd className="font-semibold text-[color:var(--text-primary)]">{Math.round(rule.confidence * 100)}% of the time</dd></div>
        <div><dt className="text-[color:var(--text-muted)]">Than usual</dt><dd className="font-semibold text-[color:var(--text-primary)]">{rule.lift.toFixed(1)}× as likely</dd></div>
        <div><dt className="text-[color:var(--text-muted)]">Accidents</dt><dd className="font-semibold text-[color:var(--text-primary)]">about {rule.accidents.toLocaleString()}</dd></div>
      </dl>
      <details className="text-xs">
        <summary className="cursor-pointer text-[color:var(--text-muted)]">Data items</summary>
        <p className="mt-2 text-[color:var(--text-secondary)]">
          If {rule.if_items.map(formatItem).join(' + ')} → then {rule.then_items.map(formatItem).join(' + ')}
        </p>
      </details>
    </article>
  );
}

/** Pre-computed association rules from the notebook artifact; read-only. */
export function AssociationRulesPage() {
  const [data, setData] = useState<AssociationRulesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [topic, setTopic] = useState('');
  const [strength, setStrength] = useState<RuleStrength | ''>('');
  const [sortBy, setSortBy] = useState<SortKey>('lift');
  const [search, setSearch] = useState('');

  // One request; every filter below works on the full list.
  useEffect(() => {
    getAssociationRules({ limit: 1000 })
      .then(setData)
      .catch((err: unknown) => setError(getApiErrorMessage(err, 'Unable to load association rules.')))
      .finally(() => setLoading(false));
  }, []);

  const rules = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (data?.rules ?? [])
      .filter((rule) => (!topic || rule.topic === topic) && (!strength || rule.strength === strength))
      .filter((rule) => !needle || rule.rule.toLowerCase().includes(needle)
        || [...rule.if_items, ...rule.then_items].some((item) => item.toLowerCase().includes(needle)))
      .sort((a, b) => b[sortBy] - a[sortBy] || a.rank - b.rank);
  }, [data, topic, strength, sortBy, search]);

  const thresholds = data?.thresholds ?? {};
  const pct = (value: number | undefined) => (value === undefined ? '…' : `${Math.round(value * 100)}%`);

  return (
    <div className="space-y-6" data-testid="government-associations">
      <h1 className="text-xl font-semibold gradient-text">Association rules</h1>
      <Card title="Accident patterns found in past records">
        {loading ? <LoadingSpinner /> : error ? (
          <p className="text-sm py-4" style={{ color: 'var(--tone-danger)' }}>{error}</p>
        ) : data && (
          <div className="space-y-5">
            <div className="rounded-lg px-4 py-3 text-xs leading-relaxed space-y-1"
              style={{ color: 'var(--text-secondary)', background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
              <p>
                <span className="font-semibold" style={{ color: 'var(--tone-accent)' }}>{data.total_rules.toLocaleString()} patterns</span>{' '}
                found in {data.total_accidents?.toLocaleString() ?? '…'} past accident records. Each one covers at least {pct(thresholds.min_support)} of
                accidents, holds at least {pct(thresholds.min_confidence)} of the time, is at least {thresholds.min_lift ?? '…'}× as likely as usual,
                and appeared again in at least {pct(data.stability.stability_floor)} of {data.stability.n_splits ?? '…'} random splits of the data.
              </p>
              <p>{data.disclaimer} “High / low severity” in a pattern is the outcome recorded in the dataset, not an output of the Severity model.</p>
            </div>

            <div className="flex flex-wrap gap-2" data-testid="rule-strengths">
              {STRENGTHS.map((s) => (
                <span key={s.key} className="text-xs text-[color:var(--text-muted)]">
                  <span className="font-semibold" style={{ color: s.tone }}>{s.label}</span> {s.band} as likely · {data.strengths[s.key] ?? 0}
                  {s.key !== 'mild' ? ' ·' : ''}
                </span>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-[color:var(--text-muted)] w-16">TOPIC</span>
                <Pill label="All topics" active={!topic} onClick={() => setTopic('')} />
                {Object.entries(data.topics).map(([name, count]) => (
                  <Pill key={name} label={`${name} (${count})`} active={topic === name} onClick={() => setTopic(name)} />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-[color:var(--text-muted)] w-16">LINK</span>
                <Pill label="Any strength" active={!strength} onClick={() => setStrength('')} />
                {STRENGTHS.map((s) => <Pill key={s.key} label={s.label} active={strength === s.key} onClick={() => setStrength(s.key)} />)}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-[color:var(--text-muted)] w-16">SORT</span>
                {SORTS.map((s) => <Pill key={s.key} label={s.label} active={sortBy === s.key} onClick={() => setSortBy(s.key)} />)}
                <input type="text" placeholder="Search, e.g. helmet" aria-label="Search patterns" value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="sm:ml-auto w-full sm:w-56 px-3 py-1.5 text-xs dark-input" />
              </div>
            </div>

            {rules.length === 0 ? (
              <p className="text-sm py-4 text-[color:var(--text-muted)]">No patterns match these filters.</p>
            ) : (
              <>
                <p className="text-xs text-[color:var(--text-muted)]" data-testid="rule-count">
                  Showing {rules.length.toLocaleString()} of {data.total_rules.toLocaleString()} patterns
                </p>
                <div className="grid gap-3 max-h-[640px] overflow-y-auto pr-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))' }}>
                  {rules.map((rule) => <RuleCard key={rule.rank} rule={rule} />)}
                </div>
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
