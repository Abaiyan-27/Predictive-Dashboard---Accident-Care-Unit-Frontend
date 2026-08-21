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

const RISK_BADGE_CLASSES = {
  Low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  High: 'bg-red-50 text-red-700 border-red-200',
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
        <h1 className="text-xl font-semibold text-gray-900">Data mining insights</h1>

        <Card title="Historical monthly accident trends — notebook dataset">
          {isLoadingHistoricalTrends ? (
            <LoadingSpinner />
          ) : historicalTrendsError ? (
            <p className="text-sm text-red-600 py-4">{historicalTrendsError}</p>
          ) : historicalTrends.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">No historical accident data found.</p>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={historicalTrends} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} name="Accidents" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Monthly accident trends — database records">
          {isLoadingTrends ? (
            <LoadingSpinner />
          ) : trendsError ? (
            <p className="text-sm text-red-600 py-4">{trendsError}</p>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} name="Accidents" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Future monthly accident forecast — model output">
          {isLoadingForecast ? (
            <LoadingSpinner />
          ) : forecastError ? (
            <p className="text-sm text-red-600 py-4">{forecastError}</p>
          ) : !forecast || forecast.status !== 'OK' ? (
            <div className="py-4">
              <p className="text-sm font-medium text-gray-700">Forecast unavailable</p>
              <p className="text-sm text-gray-500 mt-1">
                {forecast?.message ?? 'Install the forecasting artifact and restart the backend.'}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-gray-500 mb-4">
                {forecast.model_name}{forecast.model_version ? ` · ${forecast.model_version}` : ''}
              </p>
              {forecast.message && (
                <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {forecast.message}
                </p>
              )}
              {forecast.risk_thresholds && (
                <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  <span className="font-medium text-gray-700">Relative risk thresholds:</span>
                  <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">
                    Low: &lt;{forecast.risk_thresholds.medium_min}
                  </span>
                  <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">
                    Medium: {forecast.risk_thresholds.medium_min}–{forecast.risk_thresholds.high_min - 1}
                  </span>
                  <span className="rounded border border-red-200 bg-red-50 px-2 py-1 text-red-700">
                    High: ≥{forecast.risk_thresholds.high_min}
                  </span>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Month</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-500">Predicted accidents</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-500">Risk level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.points.map((point) => (
                      <tr key={point.period} className="border-b border-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-900">{point.period}</td>
                        <td className="py-3 px-4 text-right text-gray-900">{point.predicted_accidents}</td>
                        <td className="py-3 px-4 text-center">
                          {point.risk_level ? (
                            <span className={`inline-flex rounded border px-2 py-1 text-xs font-medium ${RISK_BADGE_CLASSES[point.risk_level]}`}>
                              {point.risk_level}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
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
