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
  getHistoricalAccidentTrends,
} from '../../api';
import { getApiErrorMessage } from '../../api/client';
import type { AccidentForecast, AccidentTrend } from '../../types';

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

export function GovernmentDashboard() {
  const [historicalTrends, setHistoricalTrends] = useState<AccidentTrend[]>([]);
  const [trends, setTrends] = useState<AccidentTrend[]>([]);
  const [forecast, setForecast] = useState<AccidentForecast | null>(null);
  const [isLoadingHistoricalTrends, setIsLoadingHistoricalTrends] = useState(true);
  const [isLoadingTrends, setIsLoadingTrends] = useState(true);
  const [isLoadingForecast, setIsLoadingForecast] = useState(true);
  const [historicalTrendsError, setHistoricalTrendsError] = useState('');
  const [trendsError, setTrendsError] = useState('');
  const [forecastError, setForecastError] = useState('');

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
                  <Bar dataKey="count" fill="url(#blueGradient)" radius={[6, 6, 0, 0]} name="Accidents">
                    <defs>
                      <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                  </Bar>
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
                  <Bar dataKey="count" fill="url(#purpleGradient)" radius={[6, 6, 0, 0]} name="Accidents">
                    <defs>
                      <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                  </Bar>
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
      </div>
    </DashboardShell>
  );
}
