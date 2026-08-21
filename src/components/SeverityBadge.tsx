import type { Severity, Priority } from '../types';

type BadgeValue = Severity | Priority;

const BADGE_STYLES: Record<BadgeValue, string> = {
  Critical: 'bg-red-50 text-red-700 border-red-200',
  High: 'bg-red-50 text-red-700 border-red-200',
  Moderate: 'bg-amber-50 text-amber-700 border-amber-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  Minor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

interface SeverityBadgeProps {
  value: BadgeValue | null;
}

export function SeverityBadge({ value }: SeverityBadgeProps) {
  const style = value
    ? BADGE_STYLES[value] ?? 'bg-gray-50 text-gray-700 border-gray-200'
    : 'bg-gray-50 text-gray-600 border-gray-200';

  return (
    <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded border ${style}`}>
      {value ?? 'Unavailable'}
    </span>
  );
}
