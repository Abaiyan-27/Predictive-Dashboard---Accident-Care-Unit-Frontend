import { useState, useEffect, useCallback } from 'react';
import { DashboardShell } from '../../components/DashboardShell';
import { Card } from '../../components/Card';
import { PatientListItem } from '../../components/PatientListItem';
import { SeverityBadge } from '../../components/SeverityBadge';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useAuth } from '../../auth/AuthContext';
import { submitPatientIntake, getMyPatients } from '../../api';
import type { Patient, PatientIntakeForm } from '../../types';

const COLLISION_TYPES = [
  'Vehicle-Vehicle',
  'Vehicle-Pedestrian',
  'Single Vehicle',
  'Vehicle-Bicycle',
  'Multi-Vehicle Pileup',
  'Other',
];

const GENDERS = ['Male', 'Female', 'Other'] as const;

const EMPTY_FORM: PatientIntakeForm = {
  name: '',
  age: 0,
  gender: 'Male',
  collision_type: '',
  injury_description: '',
};

export function NurseDashboard() {
  const { user } = useAuth();
  const [form, setForm] = useState<PatientIntakeForm>({ ...EMPTY_FORM });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultPatient, setResultPatient] = useState<Patient | null>(null);
  const [myPatients, setMyPatients] = useState<Patient[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);

  const fetchMyPatients = useCallback(async () => {
    if (!user) return;
    setIsLoadingPatients(true);
    try {
      const data = await getMyPatients(user.id);
      setMyPatients(data);
    } catch {
      // silently handle
    } finally {
      setIsLoadingPatients(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMyPatients();
  }, [fetchMyPatients]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === 'age' ? parseInt(value, 10) || 0 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    setResultPatient(null);

    try {
      const patient = await submitPatientIntake(form, user.id, user.hospital_id);
      setResultPatient(patient);
      setForm({ ...EMPTY_FORM });
      // Refresh the patient list
      await fetchMyPatients();
    } catch {
      // Handle error
    } finally {
      setIsSubmitting(false);
    }
  };

  const dismissResult = () => {
    setResultPatient(null);
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-gray-900">Patient intake</h1>

        {/* Severity result banner */}
        {resultPatient && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-1">
                  Severity assessment complete
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Patient <span className="font-medium">{resultPatient.name}</span> has been assessed.
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">Patient severity score:</span>
                  <SeverityBadge value={resultPatient.severity} />
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Predicted length of stay: {resultPatient.predicted_los_days} days
                </p>
              </div>
              <button
                onClick={dismissResult}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Intake form */}
        <Card title="New patient record">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Patient name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={form.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              <div>
                <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-1">
                  Age
                </label>
                <input
                  id="age"
                  name="age"
                  type="number"
                  min={0}
                  max={150}
                  required
                  value={form.age || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">
                  Gender
                </label>
                <select
                  id="gender"
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
                >
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="collision_type" className="block text-sm font-medium text-gray-700 mb-1">
                  Collision type
                </label>
                <select
                  id="collision_type"
                  name="collision_type"
                  required
                  value={form.collision_type}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
                >
                  <option value="">Select type</option>
                  {COLLISION_TYPES.map((ct) => (
                    <option key={ct} value={ct}>
                      {ct}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="injury_description" className="block text-sm font-medium text-gray-700 mb-1">
                Injury description
              </label>
              <textarea
                id="injury_description"
                name="injury_description"
                required
                rows={3}
                value={form.injury_description}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-vertical"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="py-2 px-6 text-sm font-medium text-white bg-purple-600 rounded hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Submitting...' : 'Submit and assess severity'}
            </button>
          </form>
        </Card>

        {/* My records */}
        <Card title="My patient records">
          {isLoadingPatients ? (
            <LoadingSpinner />
          ) : myPatients.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">No patient records yet.</p>
          ) : (
            <div className="border border-gray-100 rounded overflow-hidden">
              {myPatients.map((p) => (
                <PatientListItem key={p.id} patient={p} badgeType="severity" />
              ))}
            </div>
          )}
        </Card>
      </div>
    </DashboardShell>
  );
}
