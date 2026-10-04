import { NavLink, Outlet } from 'react-router-dom';
import { DashboardShell } from '../../components/DashboardShell';

const LINKS = [
  { to: '/government', label: 'Overview', end: true },
  { to: '/government/severity', label: 'Severity' },
  { to: '/government/stay', label: 'Stay Duration' },
  { to: '/government/transfer', label: 'Transfer' },
  { to: '/government/discharge', label: 'Discharge' },
  { to: '/government/forecast', label: 'Forecast' },
  { to: '/government/associations', label: 'Association Rules' },
];

/** Government pages: read-only, network-wide analytics, one model per page. */
export function GovernmentLayout() {
  return (
    <DashboardShell>
      <nav aria-label="Government" className="mb-6 flex flex-wrap gap-2" data-testid="government-nav">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className="px-4 py-2 text-sm rounded-lg border transition-colors"
            style={({ isActive }) => (isActive
              ? { background: 'rgba(139, 92, 246, 0.15)', color: 'var(--text-accent)', borderColor: 'var(--border-accent)', fontWeight: 600 }
              : { color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' })}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </DashboardShell>
  );
}
