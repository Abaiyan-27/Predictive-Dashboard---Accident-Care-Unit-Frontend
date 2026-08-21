import { useState, useEffect, useCallback } from 'react';
import { DashboardShell } from '../../components/DashboardShell';
import { Card } from '../../components/Card';
import { PatientListItem } from '../../components/PatientListItem';
import { SeverityBadge } from '../../components/SeverityBadge';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useAuth } from '../../auth/AuthContext';
import { submitPatientIntake, getMyPatients } from '../../api';
import { getApiErrorMessage } from '../../api/client';
import type { Patient, PatientIntakeForm } from '../../types';

const COLLISION_TYPES = [
  'fall from vehicle',
  'motorbike',
  'animal',
  'three wheeler',
  'car or van',
  'heavy vehicle',
  'bicycle',
  'fixed object',
  'pedestrian',
  'others',
];

const TRANSPORT_MODES = ['ambulance', 'motor bike', 'three wheeler', 'other vehicle'];

const TRAVEL_TIMES = [
  'less than 15 minutes',
  '15 minutes - 30 minutes',
  '30 minutes - 1 hour',
  '1 hour - 2 hour',
  'more than 2 hour',
];

const INJURY_SITES = [
  'head injury',
  'facial injury',
  'chest injury',
  'shoulder injury',
  'forearm',
  'hand',
  'knee',
  'leg',
  'foot',
  'other',
];

const VEHICLE_TYPES = ['motorcycle', 'car', 'van', 'three wheeler', 'bus', 'lorry', 'bicycle', 'other'];
const ROAD_TYPES = ['straight', 'bend', 'junction'];
const SPEEDS = ['less than 40 km/h', '40 - 80 km/h', '80 - 100 km/h', 'more than 100 km/h'];
const COLLISION_FORCES = ['front', 'behind', 'leftside', 'rightside'];
const YES_NO = ['yes', 'no'];

const GENDERS = ['Male', 'Female', 'Other'] as const;

const EMPTY_FORM: PatientIntakeForm = {
  name: '',
  age: null,
  gender: '',
  collision_type: '',
  mode_of_transport: '',
  time_to_hospital: '',
  site_of_injury: '',
  secondary_site_of_injury: '',
  secondary_injury_description: '',
  injury_description: '',
  incident_at: '',
  vehicle_type: '',
  helmet_worn: '',
  road_type: '',
  speed: '',
  road_condition: '',
  visibility: '',
  road_signals_exist: '',
  collision_force_from: '',
  alcohol_consumption: '',
  illicit_drugs: '',
};

export function NurseDashboard() {
  const { user } = useAuth();
  const [form, setForm] = useState<PatientIntakeForm>({ ...EMPTY_FORM });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultPatient, setResultPatient] = useState<Patient | null>(null);
  const [myPatients, setMyPatients] = useState<Patient[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [patientsError, setPatientsError] = useState('');
  const [submitError, setSubmitError] = useState('');

  const fetchMyPatients = useCallback(async () => {
    if (!user) return;
    setIsLoadingPatients(true);
    setPatientsError('');
    try {
      const data = await getMyPatients();
      setMyPatients(data);
    } catch (error) {
      setPatientsError(getApiErrorMessage(error, 'Unable to load patient records.'));
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
      [name]: name === 'age' ? (value === '' ? null : parseInt(value, 10)) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    setResultPatient(null);
    setSubmitError('');

    try {
      const patient = await submitPatientIntake(form, user.hospital_id);
      setResultPatient(patient);
      setForm({ ...EMPTY_FORM });
      // Refresh the patient list
      await fetchMyPatients();
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Unable to submit patient intake.'));
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
                <div className="mt-3 space-y-1 text-xs text-gray-500">
                  <p>
                    Predicted stay:{' '}
                    {resultPatient.predicted_los
                      ?? 'Awaiting investigation and management details from the doctor'}
                  </p>
                  <p>
                    Transfer probability:{' '}
                    {resultPatient.transfer_prediction.probabilities.Transfer !== undefined
                      ? `${Math.round(resultPatient.transfer_prediction.probabilities.Transfer * 100)}%`
                      : 'Unavailable'}
                  </p>
                </div>
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
          {submitError && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {submitError}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs text-gray-500">
              Fields marked <span className="font-semibold text-red-500">*</span> are required
              for the minimum complete model input set.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Patient name <span className="text-red-500" aria-hidden="true">*</span>
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
                  Age <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="age"
                  name="age"
                  type="number"
                  min={1}
                  max={100}
                  required
                  value={form.age ?? ''}
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
                  <option value="">Not provided</option>
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="incident_at" className="block text-sm font-medium text-gray-700 mb-1">
                  Incident date and time <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="incident_at"
                  name="incident_at"
                  type="datetime-local"
                  required
                  value={form.incident_at}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              <div>
                <label htmlFor="collision_type" className="block text-sm font-medium text-gray-700 mb-1">
                  Collision type <span className="text-red-500" aria-hidden="true">*</span>
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

              <div>
                <label htmlFor="mode_of_transport" className="block text-sm font-medium text-gray-700 mb-1">
                  Transport to hospital <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <select
                  id="mode_of_transport"
                  name="mode_of_transport"
                  required
                  value={form.mode_of_transport}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
                >
                  <option value="">Select transport</option>
                  {TRANSPORT_MODES.map((mode) => (
                    <option key={mode} value={mode}>{mode}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="time_to_hospital" className="block text-sm font-medium text-gray-700 mb-1">
                  Time to hospital <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <select
                  id="time_to_hospital"
                  name="time_to_hospital"
                  required
                  value={form.time_to_hospital}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
                >
                  <option value="">Select travel time</option>
                  {TRAVEL_TIMES.map((time) => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="vehicle_type" className="block text-sm font-medium text-gray-700 mb-1">
                  Vehicle type <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <select id="vehicle_type" name="vehicle_type" required value={form.vehicle_type} onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white">
                  <option value="">Select vehicle</option>
                  {VEHICLE_TYPES.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="road_type" className="block text-sm font-medium text-gray-700 mb-1">Road type <span className="text-red-500" aria-hidden="true">*</span></label>
                <select id="road_type" name="road_type" required value={form.road_type} onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white">
                  <option value="">Select road type</option>
                  {ROAD_TYPES.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="speed" className="block text-sm font-medium text-gray-700 mb-1">Approximate speed <span className="text-red-500" aria-hidden="true">*</span></label>
                <select id="speed" name="speed" required value={form.speed} onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white">
                  <option value="">Select speed</option>
                  {SPEEDS.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="collision_force_from" className="block text-sm font-medium text-gray-700 mb-1">Collision force from <span className="text-red-500" aria-hidden="true">*</span></label>
                <select id="collision_force_from" name="collision_force_from" required value={form.collision_force_from} onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white">
                  <option value="">Select direction</option>
                  {COLLISION_FORCES.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="visibility" className="block text-sm font-medium text-gray-700 mb-1">Visibility <span className="text-red-500" aria-hidden="true">*</span></label>
                <select id="visibility" name="visibility" required value={form.visibility} onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white">
                  <option value="">Select visibility</option>
                  <option value="adequate">adequate</option>
                  <option value="poor">poor</option>
                </select>
              </div>

              <div>
                <label htmlFor="road_condition" className="block text-sm font-medium text-gray-700 mb-1">Road condition <span className="text-red-500" aria-hidden="true">*</span></label>
                <input id="road_condition" name="road_condition" required value={form.road_condition} onChange={handleChange}
                  placeholder="e.g. dry, wet" className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>

              <div>
                <label htmlFor="helmet_worn" className="block text-sm font-medium text-gray-700 mb-1">Helmet worn</label>
                <select id="helmet_worn" name="helmet_worn" value={form.helmet_worn} onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white">
                  <option value="">Not applicable / unknown</option>
                  {YES_NO.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="road_signals_exist" className="block text-sm font-medium text-gray-700 mb-1">Road signals existed</label>
                <select id="road_signals_exist" name="road_signals_exist" value={form.road_signals_exist} onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white">
                  <option value="">Unknown</option>
                  {YES_NO.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="alcohol_consumption" className="block text-sm font-medium text-gray-700 mb-1">Alcohol consumption <span className="text-red-500" aria-hidden="true">*</span></label>
                <select id="alcohol_consumption" name="alcohol_consumption" required value={form.alcohol_consumption} onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white">
                  <option value="">Select</option>
                  {YES_NO.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="illicit_drugs" className="block text-sm font-medium text-gray-700 mb-1">Illicit drugs</label>
                <select id="illicit_drugs" name="illicit_drugs" value={form.illicit_drugs} onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white">
                  <option value="">Unknown</option>
                  {YES_NO.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="site_of_injury" className="block text-sm font-medium text-gray-700 mb-1">
                  Primary injury site <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <select
                  id="site_of_injury"
                  name="site_of_injury"
                  required
                  value={form.site_of_injury}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
                >
                  <option value="">Select injury site</option>
                  {INJURY_SITES.map((site) => (
                    <option key={site} value={site}>{site}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="secondary_site_of_injury" className="block text-sm font-medium text-gray-700 mb-1">
                  Secondary injury site
                </label>
                <select id="secondary_site_of_injury" name="secondary_site_of_injury"
                  value={form.secondary_site_of_injury} onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white">
                  <option value="">None</option>
                  {INJURY_SITES.map((site) => <option key={site} value={site}>{site}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="injury_description" className="block text-sm font-medium text-gray-700 mb-1">
                Injury description <span className="text-red-500" aria-hidden="true">*</span>
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

            <div>
              <label htmlFor="secondary_injury_description" className="block text-sm font-medium text-gray-700 mb-1">
                Secondary injury description
              </label>
              <textarea id="secondary_injury_description" name="secondary_injury_description" rows={2}
                value={form.secondary_injury_description} onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 resize-vertical" />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="py-2 px-6 text-sm font-medium text-white bg-purple-600 rounded hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Submitting...' : 'Submit and run available models'}
            </button>
          </form>
        </Card>

        {/* My records */}
        <Card title="My patient records">
          {patientsError && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {patientsError}
            </div>
          )}
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
