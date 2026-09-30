import { useState, useEffect, useCallback } from 'react';
import { DashboardShell } from '../../components/DashboardShell';
import { Card } from '../../components/Card';
import { PatientListItem } from '../../components/PatientListItem';
import { SeverityBadge } from '../../components/SeverityBadge';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useAuth } from '../../auth/AuthContext';
import { submitPatientIntake, updatePatientIntake, getMyPatients, getPatientDetail } from '../../api';
import { getApiErrorMessage } from '../../api/client';
import type { Patient, PatientIntakeForm } from '../../types';

// ── Dropdown Options ────────────────────────────────────────────────────────

const COLLISION_TYPES = ['ambulance', 'animal', 'bicycle', 'car or van', 'fall from vehicle', 'fixed object', 'heavy vehicle', 'motorbike', 'others', 'pedestrian', 'slipped', 'three wheeler', 'train'];
const TRANSPORT_MODES = ['ambulance', 'motor bike', 'three wheeler', 'other vehicle'];
const TRAVEL_TIMES = ['less than 15 minutes', '15 minutes - 30 minutes', '30 minutes - 1 hour', '1 hour - 2 hour', 'more than 2 hour'];
const INJURY_SITES = ['abdomen', 'cervical', 'chest injury', 'chest rib', 'clavicle', 'elbow region', 'eye injury', 'facial injury', 'femur', 'foot', 'foot metacarpals', 'foot metatarsals', 'foot phalanges', 'foot tarsals', 'forearm', 'forearm (radius, ulna)', 'forearm radius', 'forearm ulna', 'forehead', 'hand', 'hand metacarpals', 'hand phalanges', 'head injury', 'humerus head', 'humerus region', 'knee', 'knee patella', 'leg', 'leg (tibia, fibula)', 'leg fibula', 'leg tibia', 'lumbar', 'no injury found', 'pelvis', 'pelvis ilium', 'pelvis ramous', 'sacrum', 'shoulder clavicle', 'shoulder injury', 'thigh', 'thigh femur', 'thigh nof', 'thoracic'];
const SECONDARY_INJURY_SITES = ['no secondary injury found', ...INJURY_SITES.filter((s) => s !== 'no injury found')];
const INJURY_TYPES = ['abration', 'amputation', 'bowel injury', 'contusion', 'dislocation', 'fracture', 'ich', 'kidney injury', 'laceration', 'ligament injury', 'lung injury', 'nerve lesion', 'pericardial effusion', 'pneumothorax', 'sdh', 'spinal cord injury', 'spleen injury'];
const SECONDARY_INJURY_TYPES = ['abration', 'amputation', 'bowel injury', 'contusion', 'dislocation', 'fracture', 'kidney injury', 'laceration', 'ligament injury', 'nerve lesion', 'pneumothorax', 'spleen injury'];
const MODE_OF_TRAVEL = ['bicycle', 'bicycle pillion', 'car or van', 'car or van passenger', 'heavy vehicle', 'heavy vehicle passenger', 'motor cyclist', 'motorbike pillion rider', 'others', 'pedestrian', 'three wheeler', 'three wheeler passenger'];
const VEHICLE_TYPES = ['motor cyclist', 'other vehicle'];
const PASSENGER_TYPES = ['driver', 'frontseatpassenger', 'passengerenteringorleavingbus', 'passengerfallingofvehicle', 'rearseatpassenger'];
const OTHER_INJURY_OPTIONS = ['multiple', 'no other injury'];
const ROAD_TYPES = ['straight', 'bend', 'junction'];
const SPEEDS = ['less than 40 km/h', '40 - 80 km/h', '80 - 100 km/h', 'more than 100 km/h'];
const COLLISION_FORCES = ['front', 'behind', 'leftside', 'rightside'];
const ROAD_CONDITIONS = ['good', 'poor'];
const YES_NO = ['yes', 'no'];
const GENDERS = ['Male', 'Female', 'Other'] as const;

const EMPTY_FORM: PatientIntakeForm = {
  name: '', age: null, gender: '', collision_type: '', mode_of_transport: '', time_to_hospital: '',
  site_of_injury: '', type_of_injury: '', secondary_site_of_injury: '', secondary_type_of_injury: '',
  incident_at: '', vehicle_type: '', helmet_worn: '', road_type: '', speed: '', road_condition: '',
  visibility: '', road_signals_exist: '', collision_force_from: '', alcohol_consumption: '', illicit_drugs: '',
  mode_of_travel_during_accident: '', passenger_type: '', other_injury: '',
};

const labelClass = "block text-sm font-medium mb-1.5";
const labelStyle = { color: 'var(--text-secondary)' };

export function NurseDashboard() {
  const { user } = useAuth();
  const [form, setForm] = useState<PatientIntakeForm>({ ...EMPTY_FORM });
  const [activeAccidentId, setActiveAccidentId] = useState<string | null>(null);
  
  const [isSubmittingBasic, setIsSubmittingBasic] = useState(false);
  const [isSubmittingSeverity, setIsSubmittingSeverity] = useState(false);
  const [isSubmittingOther, setIsSubmittingOther] = useState(false);
  
  const [resultPatient, setResultPatient] = useState<Patient | null>(null);
  const [myPatients, setMyPatients] = useState<Patient[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchMyPatients = useCallback(async () => {
    if (!user) return;
    setIsLoadingPatients(true);
    try {
      const data = await getMyPatients();
      setMyPatients(data);
    } catch (error) {
      setErrorMsg(getApiErrorMessage(error, 'Unable to load patient records.'));
    } finally {
      setIsLoadingPatients(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMyPatients();
  }, [fetchMyPatients]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === 'age' ? (value === '' ? null : parseInt(value, 10)) : value,
    }));
  };

  const handlePatientSelect = async (patientItem: Patient) => {
    if (!user) return;
    setErrorMsg('');
    try {
      // Fetch full details to populate form
      const detail = await getPatientDetail(patientItem.hospital_id || user.hospital_id, patientItem.id);
      const acc = detail.accident;
      const inj1 = detail.injuries?.[0] || {};
      const inj2 = detail.injuries?.[1] || {};
      
      setActiveAccidentId(acc.accident_id);
      setForm({
        name: detail.patient.full_name || '',
        age: detail.patient.age ? parseInt(detail.patient.age, 10) : null,
        gender: detail.patient.gender as any || '',
        collision_type: acc.collision_with || '',
        mode_of_transport: acc.mode_of_transport || '',
        time_to_hospital: acc.time_to_hospital || '',
        site_of_injury: inj1.site_of_injury || '',
        type_of_injury: inj1.type_of_injury || '',
        secondary_site_of_injury: inj2.site_of_injury || '',
        secondary_type_of_injury: inj2.type_of_injury || '',
        incident_at: acc.incident_at ? acc.incident_at.slice(0, 16) : '', // datetime-local format
        vehicle_type: acc.vehicle_type || '',
        helmet_worn: acc.helmet_worn || '',
        road_type: acc.road_type || '',
        speed: acc.speed || '',
        road_condition: acc.road_condition || '',
        visibility: acc.visibility || '',
        road_signals_exist: acc.road_signals_exist || '',
        collision_force_from: acc.collision_force_from || '',
        alcohol_consumption: acc.alcohol_consumption || '',
        illicit_drugs: acc.illicit_drugs || '',
        mode_of_travel_during_accident: acc.mode_of_travel_during_accident || '',
        passenger_type: acc.passenger_type || '',
        other_injury: acc.other_injury || '',
      });
      setResultPatient(patientItem);
    } catch (error) {
      setErrorMsg(getApiErrorMessage(error, 'Failed to load patient details.'));
    }
  };

  const handleNewPatient = () => {
    setActiveAccidentId(null);
    setForm({ ...EMPTY_FORM });
    setResultPatient(null);
    setErrorMsg('');
  };

  const submitBasicDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmittingBasic(true);
    setErrorMsg('');
    try {
      if (activeAccidentId) {
        const patient = await updatePatientIntake(activeAccidentId, { name: form.name, age: form.age, gender: form.gender }, user.hospital_id);
        setResultPatient(patient);
      } else {
        const patient = await submitPatientIntake({ name: form.name, age: form.age, gender: form.gender } as PatientIntakeForm, user.hospital_id);
        setActiveAccidentId(patient.accident_id);
        setResultPatient(patient);
      }
      await fetchMyPatients();
    } catch (error) {
      setErrorMsg(getApiErrorMessage(error, 'Unable to save basic details.'));
    } finally {
      setIsSubmittingBasic(false);
    }
  };

  const submitSeverityInputs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeAccidentId) return;
    setIsSubmittingSeverity(true);
    setErrorMsg('');
    try {
      const patient = await updatePatientIntake(activeAccidentId, {
        collision_type: form.collision_type, mode_of_travel_during_accident: form.mode_of_travel_during_accident,
        passenger_type: form.passenger_type, mode_of_transport: form.mode_of_transport, time_to_hospital: form.time_to_hospital,
        site_of_injury: form.site_of_injury, type_of_injury: form.type_of_injury,
        secondary_site_of_injury: form.secondary_site_of_injury, secondary_type_of_injury: form.secondary_type_of_injury,
        other_injury: form.other_injury,
        incident_at: form.incident_at, vehicle_type: form.vehicle_type, helmet_worn: form.helmet_worn
      }, user.hospital_id);
      setResultPatient(patient);
      await fetchMyPatients();
    } catch (error) {
      setErrorMsg(getApiErrorMessage(error, 'Unable to save severity inputs.'));
    } finally {
      setIsSubmittingSeverity(false);
    }
  };

  const submitOtherInputs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeAccidentId) return;
    setIsSubmittingOther(true);
    setErrorMsg('');
    try {
      const patient = await updatePatientIntake(activeAccidentId, {
        road_type: form.road_type, speed: form.speed, road_condition: form.road_condition, visibility: form.visibility,
        road_signals_exist: form.road_signals_exist, collision_force_from: form.collision_force_from,
        alcohol_consumption: form.alcohol_consumption, illicit_drugs: form.illicit_drugs
      }, user.hospital_id);
      setResultPatient(patient);
      await fetchMyPatients();
    } catch (error) {
      setErrorMsg(getApiErrorMessage(error, 'Unable to save other inputs.'));
    } finally {
      setIsSubmittingOther(false);
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-semibold gradient-text">Patient intake</h1>
          {activeAccidentId && (
            <button onClick={handleNewPatient} className="px-4 py-2 text-sm gradient-btn">
              + New Patient
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ color: '#fca5a5', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            {errorMsg}
          </div>
        )}

        {/* Severity result banner (Nurse only sees Severity) */}
        {resultPatient && resultPatient.severity && resultPatient.severity !== 'Severity not classified' && (
          <div className="glass-card p-6 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
            <h3 className="text-sm font-semibold mb-1 text-emerald-400">Severity assessment complete</h3>
            <p className="text-sm mb-3 text-slate-400">
              Patient <span className="font-medium text-slate-200">{resultPatient.name}</span> has been assessed.
            </p>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400">Patient severity score:</span>
              <SeverityBadge value={resultPatient.severity} />
            </div>
          </div>
        )}

        {/* Intake Forms */}
        <div className="space-y-6">
          
          <Card title="Box 1: Basic Details">
            <form onSubmit={submitBasicDetails} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="name" className={labelClass} style={labelStyle}>Patient name</label>
                  <input id="name" name="name" type="text" required value={form.name} onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input" />
                </div>
                <div>
                  <label htmlFor="age" className={labelClass} style={labelStyle}>Age</label>
                  <input id="age" name="age" type="number" min={1} max={100} value={form.age ?? ''} onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input" />
                </div>
                <div>
                  <label htmlFor="gender" className={labelClass} style={labelStyle}>Gender</label>
                  <select id="gender" name="gender" value={form.gender} onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input">
                    <option value="">Not provided</option>
                    {GENDERS.map((g) => (<option key={g} value={g}>{g}</option>))}
                  </select>
                </div>
              </div>
              <button type="submit" disabled={isSubmittingBasic} className="py-2.5 px-6 text-sm gradient-btn">
                {isSubmittingBasic ? 'Saving...' : 'Save Basic Details'}
              </button>
            </form>
          </Card>

          {activeAccidentId && (
            <Card title="Box 2: Severity Prediction Inputs">
              <form onSubmit={submitSeverityInputs} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="collision_type" className={labelClass} style={labelStyle}>Collision with</label>
                    <select id="collision_type" name="collision_type" value={form.collision_type} onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input">
                      <option value="">Select type</option>
                      {COLLISION_TYPES.map((ct) => (<option key={ct} value={ct}>{ct}</option>))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="mode_of_travel_during_accident" className={labelClass} style={labelStyle}>Mode of travel</label>
                    <select id="mode_of_travel_during_accident" name="mode_of_travel_during_accident" value={form.mode_of_travel_during_accident} onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input">
                      <option value="">Unknown</option>
                      {MODE_OF_TRAVEL.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="passenger_type" className={labelClass} style={labelStyle}>Passenger type</label>
                    <select id="passenger_type" name="passenger_type" value={form.passenger_type} onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input">
                      <option value="">Unknown</option>
                      {PASSENGER_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="mode_of_transport" className={labelClass} style={labelStyle}>Transport to hospital</label>
                    <select id="mode_of_transport" name="mode_of_transport" value={form.mode_of_transport} onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input">
                      <option value="">Unknown</option>
                      {TRANSPORT_MODES.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="time_to_hospital" className={labelClass} style={labelStyle}>Time to hospital</label>
                    <select id="time_to_hospital" name="time_to_hospital" value={form.time_to_hospital} onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input">
                      <option value="">Unknown</option>
                      {TRAVEL_TIMES.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="incident_at" className={labelClass} style={labelStyle}>Time of collision</label>
                    <input id="incident_at" name="incident_at" type="datetime-local" value={form.incident_at} onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input" />
                  </div>
                  <div>
                    <label htmlFor="vehicle_type" className={labelClass} style={labelStyle}>Vehicle type</label>
                    <select id="vehicle_type" name="vehicle_type" value={form.vehicle_type} onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input">
                      <option value="">Unknown</option>
                      {VEHICLE_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="helmet_worn" className={labelClass} style={labelStyle}>Helmet worn</label>
                    <select id="helmet_worn" name="helmet_worn" value={form.helmet_worn} onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input">
                      <option value="">Unknown</option>
                      {YES_NO.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="site_of_injury" className={labelClass} style={labelStyle}>Primary injury site</label>
                    <select id="site_of_injury" name="site_of_injury" value={form.site_of_injury} onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input">
                      <option value="">Unknown</option>
                      {INJURY_SITES.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="type_of_injury" className={labelClass} style={labelStyle}>Type of injury (primary)</label>
                    <select id="type_of_injury" name="type_of_injury" value={form.type_of_injury} onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input">
                      <option value="">Unknown</option>
                      {INJURY_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="secondary_site_of_injury" className={labelClass} style={labelStyle}>Secondary injury site</label>
                    <select id="secondary_site_of_injury" name="secondary_site_of_injury" value={form.secondary_site_of_injury} onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input">
                      <option value="">None</option>
                      {SECONDARY_INJURY_SITES.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="secondary_type_of_injury" className={labelClass} style={labelStyle}>Type of injury (secondary)</label>
                    <select id="secondary_type_of_injury" name="secondary_type_of_injury" value={form.secondary_type_of_injury} onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input">
                      <option value="">None</option>
                      {SECONDARY_INJURY_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="other_injury" className={labelClass} style={labelStyle}>Other injury</label>
                    <select id="other_injury" name="other_injury" value={form.other_injury} onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input">
                      <option value="">Unknown</option>
                      {OTHER_INJURY_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={isSubmittingSeverity} className="py-2.5 px-6 text-sm gradient-btn">
                  {isSubmittingSeverity ? 'Saving...' : 'Save Severity Inputs'}
                </button>
              </form>
            </Card>
          )}

          {activeAccidentId && (
            <Card title="Box 3: Other Models Input">
              <form onSubmit={submitOtherInputs} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="road_type" className={labelClass} style={labelStyle}>Road type</label>
                    <select id="road_type" name="road_type" value={form.road_type} onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input">
                      <option value="">Unknown</option>
                      {ROAD_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="speed" className={labelClass} style={labelStyle}>Approximate speed</label>
                    <select id="speed" name="speed" value={form.speed} onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input">
                      <option value="">Unknown</option>
                      {SPEEDS.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="road_condition" className={labelClass} style={labelStyle}>Road condition</label>
                    <select id="road_condition" name="road_condition" value={form.road_condition} onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input">
                      <option value="">Unknown</option>
                      {ROAD_CONDITIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="visibility" className={labelClass} style={labelStyle}>Visibility</label>
                    <select id="visibility" name="visibility" value={form.visibility} onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input">
                      <option value="">Unknown</option>
                      <option value="adequate">adequate</option>
                      <option value="poor">poor</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="road_signals_exist" className={labelClass} style={labelStyle}>Road signals existed</label>
                    <select id="road_signals_exist" name="road_signals_exist" value={form.road_signals_exist} onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input">
                      <option value="">Unknown</option>
                      {YES_NO.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="collision_force_from" className={labelClass} style={labelStyle}>Collision force from</label>
                    <select id="collision_force_from" name="collision_force_from" value={form.collision_force_from} onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input">
                      <option value="">Unknown</option>
                      {COLLISION_FORCES.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="alcohol_consumption" className={labelClass} style={labelStyle}>Alcohol consumption</label>
                    <select id="alcohol_consumption" name="alcohol_consumption" value={form.alcohol_consumption} onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input">
                      <option value="">Unknown</option>
                      {YES_NO.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="illicit_drugs" className={labelClass} style={labelStyle}>Illicit drugs</label>
                    <select id="illicit_drugs" name="illicit_drugs" value={form.illicit_drugs} onChange={handleChange} className="w-full px-4 py-2.5 text-sm dark-input">
                      <option value="">Unknown</option>
                      {YES_NO.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={isSubmittingOther} className="py-2.5 px-6 text-sm gradient-btn">
                  {isSubmittingOther ? 'Saving...' : 'Save Other Inputs'}
                </button>
              </form>
            </Card>
          )}
        </div>

        {/* My records */}
        <Card title="My patient records">
          {isLoadingPatients ? (
            <LoadingSpinner />
          ) : myPatients.length === 0 ? (
            <p className="text-sm py-4 text-slate-400">No patient records yet.</p>
          ) : (
            <div className="rounded-lg overflow-hidden border border-slate-700">
              {myPatients.map((p) => (
                <PatientListItem key={p.id} patient={p} badgeType="severity" onClick={() => handlePatientSelect(p)} />
              ))}
            </div>
          )}
        </Card>
      </div>
    </DashboardShell>
  );
}
