import type { XAIExplanation } from '../types';

/** The doctor-facing AI explanation of one model prediction (collapsible). */
export function ExplanationPanel({ data }: { data: XAIExplanation }) {
  return (
    <details className="mt-6 p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 shadow-[0_0_15px_rgba(59,130,246,0.1)] [&_svg.chevron]:open:-rotate-180">
      <summary className="text-sm font-semibold text-[color:var(--text-accent)] flex items-center justify-between cursor-pointer list-none">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          AI Explanation
        </div>
        <svg className="chevron w-4 h-4 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </summary>
      <div className="space-y-2 mt-4 pt-4 border-t border-blue-500/20">
        {data.doctor_explanation?.map((line, idx) => (
          <p key={idx} className="text-sm text-[color:var(--text-secondary)] leading-relaxed">
            {line.startsWith('Why:') || line.startsWith('Meaning:') || line.startsWith('Prediction:') || line.startsWith('Estimated') || line.startsWith('Next useful detail:') || line.startsWith('Data note:') ? (
              <>
                <strong className="text-[color:var(--text-accent)]">{line.split(':')[0]}:</strong>
                {line.substring(line.indexOf(':') + 1)}
              </>
            ) : (
              line
            )}
          </p>
        ))}
      </div>
    </details>
  );
}
