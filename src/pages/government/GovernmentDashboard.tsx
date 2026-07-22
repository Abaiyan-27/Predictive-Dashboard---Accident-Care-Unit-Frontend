import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { DashboardShell } from '../../components/DashboardShell';
import { Card } from '../../components/Card';
import { SeverityBadge } from '../../components/SeverityBadge';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { getAccidentTrends, getRiskPredictions } from '../../api';
import type { AccidentTrend, RiskPrediction, RiskLevel } from '../../types';

// Map risk levels to severity badge values for color coding
const RISK_TO_BADGE: Record<RiskLevel, 'Critical' | 'Moderate' | 'Minor'> = {
  High: 'Critical',
  Medium: 'Moderate',
  Low: 'Minor',
};

export function GovernmentDashboard() {
  const [trends, setTrends] = useState<AccidentTrend[]>([]);
  const [risks, setRisks] = useState<RiskPrediction[]>([]);
  const [isLoadingTrends, setIsLoadingTrends] = useState(true);
  const [isLoadingRisks, setIsLoadingRisks] = useState(true);

  useEffect(() => {
    setIsLoadingTrends(true);
    getAccidentTrends()
      .then(setTrends)
      .catch(() => {})
      .finally(() => setIsLoadingTrends(false));

    setIsLoadingRisks(true);
    getRiskPredictions()
      .then(setRisks)
      .catch(() => {})
      .finally(() => setIsLoadingRisks(false));
  }, []);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-gray-900">Data mining insights</h1>

        {/* Monthly accident trends */}
        <Card title="Monthly accident trends">
          {isLoadingTrends ? (
            <LoadingSpinner />
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    axisLine={{ stroke: '#e5e7eb' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    axisLine={{ stroke: '#e5e7eb' }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '13px',
                    }}
                    labelStyle={{ color: '#374151', fontWeight: 600 }}
                  />
                  <Bar
                    dataKey="count"
                    fill="#7c3aed"
                    radius={[4, 4, 0, 0]}
                    name="Accidents"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Future risk predictions */}
        <Card title="Future risk predictions">
          {isLoadingRisks ? (
            <LoadingSpinner />
          ) : risks.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">No prediction data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Region</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Risk level</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500">Predicted accidents (next month)</th>
                  </tr>
                </thead>
                <tbody>
                  {risks.map((r) => (
                    <tr key={r.region} className="border-b border-gray-50 last:border-b-0">
                      <td className="py-3 px-4 font-medium text-gray-900">{r.region}</td>
                      <td className="py-3 px-4">
                        <SeverityBadge value={RISK_TO_BADGE[r.risk_level]} />
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-gray-900">
                        {r.predicted_accidents}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </DashboardShell>
  );
}
