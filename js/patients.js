/**
 * MedWard Patient Manager Module
 * Handles patient CRUD operations and ward management
 * @version 2.0.0
 */

const PatientManager = (() => {
  'use strict';

  // ============================================
  // STATE
  // ============================================
  const state = {
    patients: [],
    patientsByWard: {},
    wards: [],
    doctors: [],
    sheetUrl: '',
    filters: { ward: '', doctor: '', status: '' },
    editingPatient: null,
    loading: false
  };

  // ============================================
  // DOM REFERENCES
  // ============================================
  const $ = id => document.getElementById(id);

  // ============================================
  // API
  // ============================================
  async function api(action, data = {}) {
    const url = window.MEDWARD_CONFIG?.PATIENT_API_URL;
    if (!url) {
      console.warn('[PatientManager] API URL not configured');
      return null;
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action, ...data })
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result;
    } catch (err) {
      console.error('[PatientManager]', err);
      showToast(err.message, 'error');
      return null;
    }
  }

  // ============================================
  // DATA LOADING
  // ============================================
  async function load() {
    if (state.loading) return;
    state.loading = true;
    
    showLoading(true);
    
    const result = await api('getAllData', state.filters);
    
    if (result) {
      state.patients = result.patients || [];
      state.patientsByWard = result.patientsByWard || {};
      state.wards = result.wards || [];
      state.doctors = result.doctors || [];
      state.sheetUrl = result.sheetUrl || '';
      
      populateDropdowns();
      updateStats(result);
      render();
    }
    
    showLoading(false);
    state.loading = false;
  }

  async function refresh() {
    const result = await api('getPatients', state.filters);
    if (result) {
      state.patients = result.patients || [];
      state.patientsByWard = result.patientsByWard || {};
      updateStats(result);
      render();
    }
  }

  // ============================================
  // UI UPDATES
  // ============================================
  function populateDropdowns() {
    // Ward filter
    const wardFilter = $('ward-filter');
    if (wardFilter) {
      wardFilter.innerHTML = '<option value="">All Wards</option>' +
        state.wards.map(w => `<option value="${esc(w)}">${esc(w)}</option>`).join('');
    }

    // Doctor filter
    const doctorFilter = $('doctor-filter');
    if (doctorFilter) {
      doctorFilter.innerHTML = '<option value="">All Doctors</option>' +
        state.doctors.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');
    }

    // Patient form ward
    const patientWard = $('patient-ward');
    if (patientWard) {
      patientWard.innerHTML = '<option value="">Select Ward</option>' +
        state.wards.map(w => `<option value="${esc(w)}">${esc(w)}</option>`).join('');
    }

    // Patient form doctor
    const patientDoctor = $('patient-doctor');
    if (patientDoctor) {
      patientDoctor.innerHTML = '<option value="">Unassigned</option>' +
        state.doctors.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');
    }
  }

  function updateStats(data) {
    const total = $('stat-total');
    const active = $('stat-active');
    const chronic = $('stat-chronic');

    if (total) total.textContent = data.totalCount || 0;
    if (active) active.textContent = data.activeCount || 0;
    if (chronic) chronic.textContent = data.chronicCount || 0;
  }

  function render() {
    const grid = $('patients-grid');
    if (!grid) return;

    if (state.patients.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <h3>No Patients Found</h3>
          <p>Adjust filters or add a new patient</p>
        </div>
      `;
      return;
    }

    // Group by ward and sort
    const sortedWards = Object.keys(state.patientsByWard).sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '999');
      const numB = parseInt(b.match(/\d+/)?.[0] || '999');
      return numA - numB;
    });

    let html = '';
    sortedWards.forEach(ward => {
      const patients = state.patientsByWard[ward] || [];
      if (patients.length === 0) return;

      html += `
        <div class="ward-section">
          <div class="ward-header">
            <span class="ward-name">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              ${esc(ward)}
            </span>
            <span class="ward-count">${patients.length} patient${patients.length !== 1 ? 's' : ''}</span>
          </div>
          <div class="ward-patients">
            ${patients.map(p => renderPatientCard(p)).join('')}
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;
    attachCardHandlers();
  }

  function renderPatientCard(p) {
    const statusClass = p.section === 'chronic' ? 'chronic' : 'active';
    const diagnosis = p.diagnosis?.length > 100 
      ? p.diagnosis.substring(0, 100) + '...' 
      : p.diagnosis || '';

    return `
      <div class="patient-card" data-row="${p.rowIndex}">
        <div class="patient-header">
          <div class="patient-info">
            ${p.roomBed ? `<span class="patient-room">${esc(p.roomBed)}</span>` : ''}
            <span class="patient-name">${esc(p.patientName)}</span>
          </div>
          <span class="patient-status ${statusClass}">${p.section === 'chronic' ? 'Chronic' : 'Active'}</span>
        </div>
        ${diagnosis ? `<div class="patient-diagnosis">${esc(diagnosis)}</div>` : ''}
        <div class="patient-footer">
          <div class="patient-doctor">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span>${esc(p.assignedDoctor || 'Unassigned')}</span>
          </div>
          <div class="patient-actions">
            <button class="btn-icon btn-view" title="View">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <button class="btn-icon btn-edit" title="Edit">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn-icon btn-discharge" title="Discharge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function attachCardHandlers() {
    document.querySelectorAll('.patient-card').forEach(card => {
      const rowIndex = parseInt(card.dataset.row);
      const patient = state.patients.find(p => p.rowIndex === rowIndex);
      if (!patient) return;

      card.querySelector('.btn-view')?.addEventListener('click', (e) => {
        e.stopPropagation();
        viewPatient(patient);
      });

      card.querySelector('.btn-edit')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openModal(patient);
      });

      card.querySelector('.btn-discharge')?.addEventListener('click', (e) => {
        e.stopPropagation();
        confirmDischarge(patient);
      });
    });
  }

  function showLoading(show) {
    const grid = $('patients-grid');
    if (grid && show) {
      grid.innerHTML = `
        <div class="loading-state">
          <div class="spinner"></div>
          <p class="text-muted">Loading patients...</p>
        </div>
      `;
    }
  }

  // ============================================
  // MODAL HANDLING
  // ============================================
  function openModal(patient = null) {
    state.editingPatient = patient;
    
    const modal = $('patient-modal');
    const title = $('patient-modal-title');
    const form = $('patient-form');
    
    if (!modal) return;
    
    form?.reset();
    
    if (title) title.textContent = patient ? 'Edit Patient' : 'Add Patient';
    
    if (patient) {
      setValue('patient-ward', patient.ward);
      setValue('patient-room', patient.roomBed);
      setValue('patient-name', patient.patientName);
      setValue('patient-diagnosis', patient.diagnosis);
      setValue('patient-doctor', patient.assignedDoctor);
      setValue('patient-section', patient.section);
    }
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    setTimeout(() => $('patient-ward')?.focus(), 100);
  }

  function closeModal() {
    const modal = $('patient-modal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
    state.editingPatient = null;
  }

  function setValue(id, val) {
    const el = $(id);
    if (el) el.value = val || '';
  }

  // ============================================
  // CRUD OPERATIONS
  // ============================================
  async function handleSave(e) {
    e.preventDefault();

    const data = {
      ward: $('patient-ward')?.value,
      roomBed: $('patient-room')?.value,
      patientName: $('patient-name')?.value,
      diagnosis: $('patient-diagnosis')?.value?.trim() || '',
      assignedDoctor: $('patient-doctor')?.value,
      section: $('patient-section')?.value || 'active'
    };

    if (!data.patientName || !data.ward) {
      showToast('Name and Ward are required', 'error');
      return;
    }

    let result;
    if (state.editingPatient) {
      result = await api('updatePatient', {
        rowIndex: state.editingPatient.rowIndex,
        oldWard: state.editingPatient.ward,
        newWard: data.ward,
        ...data
      });
    } else {
      result = await api('addPatient', data);
    }

    if (result) {
      showToast(state.editingPatient ? 'Patient updated' : 'Patient added', 'success');
      closeModal();
      refresh();
    }
  }

  function confirmDischarge(patient) {
    if (confirm(`Discharge ${patient.patientName} from ${patient.ward}?`)) {
      dischargePatient(patient);
    }
  }

  async function dischargePatient(patient) {
    const result = await api('dischargePatient', { rowIndex: patient.rowIndex });
    if (result) {
      showToast(`${patient.patientName} discharged`, 'success');
      refresh();
    }
  }

  function viewPatient(patient) {
    // Could open a detailed view modal here
    console.log('[PatientManager] View patient:', patient);
    showToast(`Viewing ${patient.patientName}`, 'success');
  }

  // ============================================
  // FILTERS
  // ============================================
  function applyFilters() {
    state.filters.ward = $('ward-filter')?.value || '';
    state.filters.doctor = $('doctor-filter')?.value || '';
    state.filters.status = $('status-filter')?.value || '';
    refresh();
  }

  // ============================================
  // UTILITIES
  // ============================================
  function showToast(message, type = 'success') {
    if (typeof MedWard !== 'undefined') {
      MedWard.UI.showToast(message, type);
    } else {
      console.log(`[Toast] ${type}: ${message}`);
    }
  }

  function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function openGoogleSheet() {
    if (state.sheetUrl) {
      window.open(state.sheetUrl, '_blank');
    } else {
      showToast('Sheet URL not available', 'error');
    }
  }

  // ============================================
  // EVENT SETUP
  // ============================================
  function init() {
    // Filters
    $('ward-filter')?.addEventListener('change', applyFilters);
    $('doctor-filter')?.addEventListener('change', applyFilters);
    $('status-filter')?.addEventListener('change', applyFilters);

    // Buttons
    $('add-patient-btn')?.addEventListener('click', () => openModal());
    $('refresh-patients-btn')?.addEventListener('click', () => load());

    // Modal
    $('patient-modal-close')?.addEventListener('click', closeModal);
    $('cancel-patient-btn')?.addEventListener('click', closeModal);
    $('patient-modal')?.addEventListener('click', e => {
      if (e.target.id === 'patient-modal') closeModal();
    });

    // Form
    $('patient-form')?.addEventListener('submit', handleSave);

    console.log('[PatientManager] Initialized');
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ============================================
  // PUBLIC API
  // ============================================
  return {
    load,
    refresh,
    openModal,
    closeModal,
    openGoogleSheet,
    state
  };
})();

// Export
if (typeof window !== 'undefined') window.PatientManager = PatientManager;
