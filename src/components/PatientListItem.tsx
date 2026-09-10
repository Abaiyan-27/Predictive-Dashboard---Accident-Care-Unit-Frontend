import type { Patient, Severity, Priority } from '../types';
import { SeverityBadge } from './SeverityBadge';

interface PatientListItemProps {
  patient: Patient;
  badgeType?: 'severity' | 'priority';
  onClick?: () => void;
}

export function PatientListItem({ patient, badgeType = 'severity', onClick }: PatientListItemProps) {
  const badgeValue: Severity | Priority | null = badgeType === 'priority' ? patient.priority : patient.severity;

  return (
    <div
      className={`flex items-center justify-between gap-4 px-4 py-3.5 transition-all duration-200 ${
        onClick ? 'cursor-pointer' : ''
      }`}
      style={{
        borderBottom: '1px solid var(--border-subtle)',
        borderLeft: '3px solid transparent',
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)';
        e.currentTarget.style.borderLeftColor = 'rgba(139, 92, 246, 0.5)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.borderLeftColor = 'transparent';
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
          {patient.name}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {patient.age} yr, {patient.gender} &middot; {patient.collision_type} &middot; {patient.admission_date}
        </p>
      </div>
      <SeverityBadge value={badgeValue} />
    </div>
  );
}
