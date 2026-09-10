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

/* Dark-themed label helper */
const labelClass = "block text-sm font-medium mb-1.5";
const labelStyle = { color: 'var(--text-secondary)' };
const requiredStar = <span style={{ color: '#f87171' }} aria-hidden="true">*</span>;

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
        <h1 className="text-xl font-semibold gradient-text">Patient intake</h1>

        {/* Severity result banner */}
        {resultPatient && (
          <div
            className="glass-card p-6"
            style={{
              borderColor: 'rgba(16, 185, 129, 0.3)',
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.1)',
              cursor: 'default',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'none'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold mb-1" style={{ color: '#6ee7b7' }}>
                  Severity assessment complete
                </h3>
                <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                  Patient <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{resultPatient.name}</span> has been assessed.
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Patient severity score:</span>
                  <SeverityBadge value={resultPatient.severity} />
                </div>
                <div className="mt-3 space-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
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
                className="text-sm transition-colors duration-200"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Intake form */}
        <Card title="New patient record">
          {submitError && (
            <div
              className="mb-4 px-4 py-3 rounded-lg text-sm"
              style={{
                color: '#fca5a5',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
              }}
            >
              {submitError}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Fields marked <span className="font-semibold" style={{ color: '#f87171' }}>*</span> are required
              for the minimum complete model input set.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className={labelClass} style={labelStyle}>
                  Patient name {requiredStar}
                </label>
                <input id="name" name="name" type="text" required value={form.name} onChange={handleChange}
                  className="w-full px-4 py-2.5 text-sm dark-input" />
              </div>

              <div>
                <label htmlFor="age" className={labelClass} style={labelStyle}>
                  Age {requiredStar}
                </label>
                <input id="age" name="age" type="number" min={1} max={100} required value={form.age ?? ''}
                  onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input" />
              </div>

              <div>
                <label htmlFor="gender" className={labelClass} style={labelStyle}>Gender</label>
                <select id="gender" name="gender" value={form.gender} onChange={handleChange}
                  className="w-full px-4 py-2.5 text-sm dark-input">
                  <option value="">Not provided</option>
                  {GENDERS.map((g) => (<option key={g} value={g}>{g}</option>))}
                </select>
              </div>

              <div>
                <label htmlFor="incident_at" className={labelClass} style={labelStyle}>
                  Incident date and time {requiredStar}
                </label>
                <input id="incident_at" name="incident_at" type="datetime-local" required
                  value={form.incident_at} onChange={handleChange}
                  className="w-full px-4 py-2.5 text-sm dark-input" />
              </div>

              <div>
                <label htmlFor="collision_type" className={labelClass} style={labelStyle}>
                  Collision type {requiredStar}
                </label>
                <select id="collision_type" name="collision_type" required value={form.collision_type}
                  onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input">
                  <option value="">Select type</option>
                  {COLLISION_TYPES.map((ct) => (<option key={ct} value={ct}>{ct}</option>))}
                </select>
              </div>

              <div>
                <label htmlFor="mode_of_transport" className={labelClass} style={labelStyle}>
                  Transport to hospital {requiredStar}
                </label>
                <select id="mode_of_transport" name="mode_of_transport" required value={form.mode_of_transport}
                  onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input">
                  <option value="">Select transport</option>
                  {TRANSPORT_MODES.map((mode) => (<option key={mode} value={mode}>{mode}</option>))}
                </select>
              </div>

              <div>
                <label htmlFor="time_to_hospital" className={labelClass} style={labelStyle}>
                  Time to hospital {requiredStar}
                </label>
                <select id="time_to_hospital" name="time_to_hospital" required value={form.time_to_hospital}
                  onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input">
                  <option value="">Select travel time</option>
                  {TRAVEL_TIMES.map((time) => (<option key={time} value={time}>{time}</option>))}
                </select>
              </div>

              <div>
                <label htmlFor="vehicle_type" className={labelClass} style={labelStyle}>
                  Vehicle type {requiredStar}
                </label>
                <select id="vehicle_type" name="vehicle_type" required value={form.vehicle_type}
                  onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input">
                  <option value="">Select vehicle</option>
                  {VEHICLE_TYPES.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="road_type" className={labelClass} style={labelStyle}>Road type {requiredStar}</label>
                <select id="road_type" name="road_type" required value={form.road_type} onChange={handleChange}
                  className="w-full px-4 py-2.5 text-sm dark-input">
                  <option value="">Select road type</option>
                  {ROAD_TYPES.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="speed" className={labelClass} style={labelStyle}>Approximate speed {requiredStar}</label>
                <select id="speed" name="speed" required value={form.speed} onChange={handleChange}
                  className="w-full px-4 py-2.5 text-sm dark-input">
                  <option value="">Select speed</option>
                  {SPEEDS.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="collision_force_from" className={labelClass} style={labelStyle}>Collision force from {requiredStar}</label>
                <select id="collision_force_from" name="collision_force_from" required value={form.collision_force_from}
                  onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input">
                  <option value="">Select direction</option>
                  {COLLISION_FORCES.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="visibility" className={labelClass} style={labelStyle}>Visibility {requiredStar}</label>
                <select id="visibility" name="visibility" required value={form.visibility} onChange={handleChange}
                  className="w-full px-4 py-2.5 text-sm dark-input">
                  <option value="">Select visibility</option>
                  <option value="adequate">adequate</option>
                  <option value="poor">poor</option>
                </select>
              </div>

              <div>
                <label htmlFor="road_condition" className={labelClass} style={labelStyle}>Road condition {requiredStar}</label>
                <input id="road_condition" name="road_condition" required value={form.road_condition}
                  onChange={handleChange} placeholder="e.g. dry, wet"
                  className="w-full px-4 py-2.5 text-sm dark-input" />
              </div>

              <div>
                <label htmlFor="helmet_worn" className={labelClass} style={labelStyle}>Helmet worn</label>
                <select id="helmet_worn" name="helmet_worn" value={form.helmet_worn} onChange={handleChange}
                  className="w-full px-4 py-2.5 text-sm dark-input">
                  <option value="">Not applicable / unknown</option>
                  {YES_NO.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="road_signals_exist" className={labelClass} style={labelStyle}>Road signals existed</label>
                <select id="road_signals_exist" name="road_signals_exist" value={form.road_signals_exist}
                  onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input">
                  <option value="">Unknown</option>
                  {YES_NO.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="alcohol_consumption" className={labelClass} style={labelStyle}>Alcohol consumption {requiredStar}</label>
                <select id="alcohol_consumption" name="alcohol_consumption" required value={form.alcohol_consumption}
                  onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input">
                  <option value="">Select</option>
                  {YES_NO.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="illicit_drugs" className={labelClass} style={labelStyle}>Illicit drugs</label>
                <select id="illicit_drugs" name="illicit_drugs" value={form.illicit_drugs} onChange={handleChange}
                  className="w-full px-4 py-2.5 text-sm dark-input">
                  <option value="">Unknown</option>
                  {YES_NO.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="site_of_injury" className={labelClass} style={labelStyle}>
                  Primary injury site {requiredStar}
                </label>
                <select id="site_of_injury" name="site_of_injury" required value={form.site_of_injury}
                  onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input">
                  <option value="">Select injury site</option>
                  {INJURY_SITES.map((site) => (<option key={site} value={site}>{site}</option>))}
                </select>
              </div>

              <div>
                <label htmlFor="secondary_site_of_injury" className={labelClass} style={labelStyle}>
                  Secondary injury site
                </label>
                <select id="secondary_site_of_injury" name="secondary_site_of_injury"
                  value={form.secondary_site_of_injury} onChange={handleChange}
                  className="w-full px-4 py-2.5 text-sm dark-input">
                  <option value="">None</option>
                  {INJURY_SITES.map((site) => <option key={site} value={site}>{site}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="injury_description" className={labelClass} style={labelStyle}>
                Injury description {requiredStar}
              </label>
              <textarea id="injury_description" name="injury_description" required rows={3}
                value={form.injury_description} onChange={handleChange}
                className="w-full px-4 py-2.5 text-sm dark-input resize-vertical" />
            </div>

            <div>
              <label htmlFor="secondary_injury_description" className={labelClass} style={labelStyle}>
                Secondary injury description
              </label>
              <textarea id="secondary_injury_description" name="secondary_injury_description" rows={2}
                value={form.secondary_injury_description} onChange={handleChange}
                className="w-full px-4 py-2.5 text-sm dark-input resize-vertical" />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="py-2.5 px-6 text-sm gradient-btn"
            >
              {isSubmitting ? 'Submitting...' : 'Submit and run available models'}
            </button>
          </form>
        </Card>

        {/* My records */}
        <Card title="My patient records">
          {patientsError && (
            <div
              className="mb-4 px-4 py-3 rounded-lg text-sm"
              style={{
                color: '#fca5a5',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
              }}
            >
              {patientsError}
            </div>
          )}
          {isLoadingPatients ? (
            <LoadingSpinner />
          ) : myPatients.length === 0 ? (
            <p className="text-sm py-4" style={{ color: 'var(--text-muted)' }}>No patient records yet.</p>
          ) : (
            <div
              className="rounded-lg overflow-hidden"
              style={{ border: '1px solid var(--border-subtle)' }}
            >
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
