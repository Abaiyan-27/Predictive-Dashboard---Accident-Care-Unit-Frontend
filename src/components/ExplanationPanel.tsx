import type { ShapFactor, XAIExplanation } from '../types';

// Effect sizes (SHAP thresholds 0.5 / 0.2 / 0.05 log-odds). Worded so they are never
// mistaken for Severity levels.
const EFFECT_TEXT: Record<ShapFactor['effect'], string> = {
  strong: 'Strong influence', moderate: 'Clear influence', slight: 'Slight influence',
};

/**
 * Factors for or against the predicted outcome. Colours mark direction only
 * (towards / away from this prediction), never good or bad: the predicted
 * outcome itself may be the worse one.
 */
function FactorList({ title, items, tone, largest, testId }: {
  title: string; items: ShapFactor[]; tone: string; largest: number; testId: string;
}) {
  if (items.length === 0) return null;
  return (
    <div data-testid={testId}>
      <p className="text-xs font-semibold mb-2 text-[color:var(--text-muted)]">{title}</p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.factor} className="text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[color:var(--text-primary)]">
                {item.factor}: <span className="font-medium">{item.value}</span>
              </span>
              <span className="text-xs text-[color:var(--text-muted)]">{EFFECT_TEXT[item.effect]}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full" style={{ background: 'var(--border-subtle)' }} aria-hidden="true">
              <div className="h-1.5 rounded-full" style={{ width: `${Math.max(6, (Math.abs(item.shap) / largest) * 100)}%`, background: tone }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The doctor-facing SHAP explanation of one model prediction (collapsible). */
export function ExplanationPanel({ data }: { data: XAIExplanation }) {
  const towards = data.points_towards ?? [];
  const away = data.points_away ?? [];
  const largest = Math.max(1e-9, ...[...towards, ...away].map((item) => Math.abs(item.shap)));
  return (
    <details open data-testid="shap-explanation"
      className="mt-6 p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 [&_svg.chevron]:open:-rotate-180">
      <summary className="text-sm font-semibold text-[color:var(--text-accent)] flex items-center justify-between cursor-pointer list-none">
        <span>Why this prediction (SHAP)</span>
        <svg className="chevron w-4 h-4 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </summary>
      <div className="space-y-4 mt-4 pt-4 border-t border-blue-500/20">
        {!data.available ? (
          <p className="text-sm text-[color:var(--text-secondary)]">{data.message}</p>
        ) : (
          <>
            <p className="text-sm font-semibold text-[color:var(--text-primary)]" data-testid="shap-headline">{data.headline}</p>
            {data.note && <p className="text-sm" style={{ color: 'var(--tone-warning)' }}>{data.note}</p>}
            <FactorList title={`Points towards ${data.outcome}`} items={towards} tone="var(--tone-accent)" largest={largest} testId="shap-towards" />
            <FactorList title={`Points away from ${data.outcome}`} items={away} tone="var(--tone-info)" largest={largest} testId="shap-away" />
            {towards.length === 0 && away.length === 0 && (
              <p className="text-sm text-[color:var(--text-muted)]">No recorded detail moved this prediction noticeably.</p>
            )}
            {data.not_recorded && data.not_recorded.length > 0 && (
              <p className="text-xs text-[color:var(--text-muted)]">Not yet recorded: {data.not_recorded.join(', ')}</p>
            )}
          </>
        )}
        <p className="text-xs text-[color:var(--text-muted)]">{data.disclaimer}</p>
        <p className="text-[11px] text-[color:var(--text-muted)]">{data.method}</p>
      </div>
    </details>
  );
}
