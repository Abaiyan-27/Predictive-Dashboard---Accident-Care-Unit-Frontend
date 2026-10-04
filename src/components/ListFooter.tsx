/** "Showing N of M" under a paged list, with a button for the next page. */
export function ListFooter({ shown, total, loading, onMore, noun = 'records' }: {
  shown: number; total: number; loading?: boolean; onMore: () => void; noun?: string;
}) {
  if (total === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[color:var(--text-muted)]" data-testid="list-footer">
      <span>Showing {shown} of {total} {noun}</span>
      {shown < total && (
        <button type="button" onClick={onMore} disabled={loading} className="px-4 py-2 text-sm rounded-lg border"
          style={{ borderColor: 'var(--border-input)', color: 'var(--text-secondary)' }}>
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}
