import type { Patient, Severity, Priority } from '../types';
import { SeverityBadge } from './SeverityBadge';

interface PatientListItemProps {
  patient: Patient;
  badgeType?: 'severity' | 'priority';
  onClick?: () => void;
}

export function PatientListItem({ patient, badgeType = 'severity', onClick }: PatientListItemProps) {
  const badgeValue: Severity | Priority = badgeType === 'priority' ? patient.priority : patient.severity;

  return (
    <div
      className={`flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-100 last:border-b-0 ${
        onClick ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''
      }`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{patient.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {patient.age} yr, {patient.gender} &middot; {patient.collision_type} &middot; {patient.admission_date}
        </p>
      </div>
      <SeverityBadge value={badgeValue} />
    </div>
  );
}
