/**
 * MedWard Patient Manager v2.1
 * Professional ward patient management with Google Sheets integration
 * Now with Patient Presentation modal support
 */

(function() {
  'use strict';

  const API_URL = window.MEDWARD_PATIENT_API_URL || '';

  // State
  let patients = [];
  let patientsByWard = {};
  let wards = [];
  let doctors = [];
  let currentFilter = { ward: '', doctor: '', status: '' };
  let editingPatient = null;
  let sheetUrl = '';

  // DOM Elements
  const $ = id => document.getElementById(id);

  // Initialize
  function init() {
    if (!API_URL) {
      console.warn('[PatientManager] API URL not configured');
      return;
    }

    setupEventListeners();
    setupPresentationModal();

    // Load data when patients tab is clicked
    const patientsTab = $('patients-tab');
    if (patientsTab) {
      patientsTab.addEventListener('click', () => {
        showPatientsScreen();
        loadAllData();
      });
    }
  }

  function setupEventListeners() {
    // Filters
    $('ward-filter')?.addEventListener('change', applyFilters);
    $('doctor-filter')?.addEventListener('change', applyFilters);
    $('status-filter')?.addEventListener('change', applyFilters);

    // Buttons
    $('add-patient-btn')?.addEventListener('click', () => openModal());
    $('refresh-patients-btn')?.addEventListener('click', () => loadAllData());
    $('open-sheet-btn')?.addEventListener('click', openGoogleSheet);

    // Modal
    $('patient-modal-close')?.addEventListener('click', closeModal);
    $('cancel-patient-btn')?.addEventListener('click', closeModal);
    $('patient-modal')?.addEventListener('click', e => {
      if (e.target.id === 'patient-modal') closeModal();
    });

    // Form
    $('patient-form')?.addEventListener('submit', handleSave);

    // Section toggle (Active vs Chronic)
    document.querySelectorAll('.section-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.section-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter.status = btn.dataset.section;
        loadPatients();
      });
    });
  }

  // ========== PRESENTATION MODAL ==========
  
  function setupPresentationModal() {
    // Close presentation modal
    $('pres-modal-close')?.addEventListener('click', closePresentation);
    
    // Close on overlay click
    $('pres-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'pres-modal') closePresentation();
    });
    
    // Copy presentation text
    $('pres-copy-btn')?.addEventListener('click', () => {
      const container = $('pres-container');
      if (container) {
        navigator.clipboard.writeText(container.innerText).then(() => {
          showToast('Copied to clipboard!', 'success');
        }).catch(() => {
          showToast('Failed to copy', 'error');
        });
      }
    });
  }

  function openPresentation(patient) {
    const modal = $('pres-modal');
    const container = $('pres-container');
    const nameEl = $('pres-patient-name');
    
    if (!modal || !container) return;
    
    // Set patient name in header
    if (nameEl) nameEl.textContent = patient.patientName || 'Patient';
    
    // Parse and render using PatientPresentation
    if (window.PatientPresentation) {
      const parsed = PatientPresentation.parse(patient.diagnosis || '');
      PatientPresentation.render(parsed, container);
    } else {
      container.innerHTML = `
        <div class="pres-empty">
          <p>Patient Presentation module not loaded</p>
          <pre style="text-align: left; margin-top: 1rem; padding: 1rem; background: var(--surface); border-radius: 8px; white-space: pre-wrap;">${escapeHtml(patient.diagnosis || 'No clinical data')}</pre>
        </div>
      `;
    }
    
    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closePresentation() {
    const modal = $('pres-modal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // API Calls
  async function api(action, data = {}) {
    if (!API_URL) return null;

    try {
      const res = await fetch(API_URL, {
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

  // Data Loading
  async function loadAllData() {
    showLoading(true);

    // Use optimized single API call to get everything at once
    const result = await api('getAllData', currentFilter);

    if (!result) {
      showLoading(false);
      return;
    }

    // Extract all data from single response
    patients = result.patients || [];
    patientsByWard = result.patientsByWard || {};
    wards = result.wards || [];
    doctors = result.doctors || [];
    sheetUrl = result.sheetUrl || '';

    // Populate dropdowns
    populateWardDropdowns();
    populateDoctorDropdowns();

    // Update UI
    updateStats(result);
    renderPatients();

    showLoading(false);
  }

  async function loadPatients() {
    const result = await api('getPatients', currentFilter);
    if (!result) return;

    patients = result.patients || [];
    patientsByWard = result.patientsByWard || {};

    updateStats(result);
    renderPatients();
  }

  function populateWardDropdowns() {
    // Populate filter dropdown
    const wardFilter = $('ward-filter');
    if (wardFilter) {
      wardFilter.innerHTML = '<option value="">All Wards</option>' +
        wards.map(w => `<option value="${w}">${w}</option>`).join('');
    }

    // Populate form dropdown
    const patientWard = $('patient-ward');
    if (patientWard) {
      patientWard.innerHTML = '<option value="">Select Ward</option>' +
        wards.map(w => `<option value="${w}">${w}</option>`).join('');
    }
  }

  function populateDoctorDropdowns() {
    // Populate filter
    const doctorFilter = $('doctor-filter');
    if (doctorFilter) {
      doctorFilter.innerHTML = '<option value="">All Doctors</option>' +
        doctors.map(d => `<option value="${d}">${d}</option>`).join('');
    }

    // Populate form (with option to add new)
    const patientDoctor = $('patient-doctor');
    if (patientDoctor) {
      patientDoctor.innerHTML = '<option value="">Unassigned</option>' +
        doctors.map(d => `<option value="${d}">${d}</option>`).join('');
    }
  }

  // Rendering
  function renderPatients() {
    const grid = $('patients-grid');
    if (!grid) return;

    if (patients.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <h3>No Patients Found</h3>
          <p>Try adjusting filters or add a new patient</p>
        </div>
      `;
      return;
    }

    // Render grouped by ward
    let html = '';

    // Sort wards
    const sortedWards = Object.keys(patientsByWard).sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '999');
      const numB = parseInt(b.match(/\d+/)?.[0] || '999');
      return numA - numB;
    });

    sortedWards.forEach(ward => {
      const wardPatients = patientsByWard[ward];
      if (!wardPatients || wardPatients.length === 0) return;

      html += `
        <div class="ward-group">
          <div class="ward-header">
            <h3>${escapeHtml(ward)}</h3>
            <span class="ward-count">${wardPatients.length} patient${wardPatients.length !== 1 ? 's' : ''}</span>
          </div>
          <div class="ward-patients">
      `;

      wardPatients.forEach(patient => {
        html += renderPatientCard(patient);
      });

      html += `
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;

    // Attach event listeners
    grid.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = patients.find(x => x.rowIndex === parseInt(btn.dataset.row));
        if (p) openModal(p);
      });
    });

    grid.querySelectorAll('.btn-discharge').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = patients.find(x => x.rowIndex === parseInt(btn.dataset.row));
        if (p) confirmDischarge(p);
      });
    });

    // View Presentation buttons
    grid.querySelectorAll('.btn-view').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = patients.find(x => x.rowIndex === parseInt(btn.dataset.row));
        if (p) openPresentation(p);
      });
    });
  }

  function renderPatientCard(p) {
    const statusClass = p.section === 'chronic' ? 'chronic' : 'active';
    
    // Quick preview of key data from diagnosis
    let quickPreview = '';
    if (p.diagnosis && window.PatientPresentation) {
      const parsed = PatientPresentation.parse(p.diagnosis);
      
      // Show PMH badges
      if (parsed.pmh && parsed.pmh.conditions.length > 0) {
        const icons = { DM: '🩸', HTN: '💉', IHD: '❤️', HF: '💔', CKD: '🫘', AF: '💗', CVA: '🧠', COPD: '🫁' };
        quickPreview += '<div class="quick-pmh">';
        parsed.pmh.conditions.slice(0, 5).forEach(c => {
          quickPreview += `<span class="pmh-badge" title="${c}">${icons[c] || '•'}</span>`;
        });
        quickPreview += '</div>';
      }
      
      // Show critical vitals
      if (parsed.vitals && Object.keys(parsed.vitals).length > 0) {
        quickPreview += '<div class="quick-vitals">';
        if (parsed.vitals.bp) {
          const bpClass = parsed.vitals.bp.status !== 'normal' ? parsed.vitals.bp.status : '';
          quickPreview += `<span class="qv-item ${bpClass}">BP ${parsed.vitals.bp.value}</span>`;
        }
        if (parsed.vitals.hr) {
          const hrClass = parsed.vitals.hr.status !== 'normal' ? parsed.vitals.hr.status : '';
          quickPreview += `<span class="qv-item ${hrClass}">HR ${parsed.vitals.hr.value}</span>`;
        }
        if (parsed.vitals.spo2) {
          const spClass = parsed.vitals.spo2.status !== 'normal' ? parsed.vitals.spo2.status : '';
          quickPreview += `<span class="qv-item ${spClass}">SpO2 ${parsed.vitals.spo2.value}%</span>`;
        }
        quickPreview += '</div>';
      }
      
      // Show critical labs
      if (parsed.labs) {
        const criticalLabs = [];
        for (const cat of Object.values(parsed.labs)) {
          for (const lab of Object.values(cat)) {
            if (lab.status === 'high' || lab.status === 'low') {
              criticalLabs.push({ name: lab.name, value: lab.value, status: lab.status });
            }
          }
        }
        if (criticalLabs.length > 0) {
          quickPreview += '<div class="quick-labs">';
          criticalLabs.slice(0, 4).forEach(lab => {
            quickPreview += `<span class="ql-item ${lab.status}">${lab.name} ${lab.value}</span>`;
          });
          quickPreview += '</div>';
        }
      }
    }

    // Truncate diagnosis for display
    let diagnosisDisplay = p.diagnosis || '';
    if (diagnosisDisplay.length > 100) {
      diagnosisDisplay = diagnosisDisplay.substring(0, 100) + '...';
    }

    return `
      <div class="patient-card">
        <div class="patient-header">
          <div class="patient-info">
            ${p.roomBed ? `<span class="patient-room">${escapeHtml(p.roomBed)}</span>` : ''}
            <span class="patient-name">${escapeHtml(p.patientName)}</span>
          </div>
          <span class="patient-status ${statusClass}">${p.section === 'chronic' ? 'Chronic' : 'Active'}</span>
        </div>

        ${diagnosisDisplay ? `<div class="patient-diagnosis">${escapeHtml(diagnosisDisplay)}</div>` : ''}

        ${quickPreview}

        <div class="patient-footer">
          <div class="patient-doctor">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span>${p.assignedDoctor || 'Unassigned'}</span>
          </div>
          <div class="patient-actions">
            <button class="btn-icon btn-view" data-row="${p.rowIndex}" title="View Presentation">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <button class="btn-icon btn-edit" data-row="${p.rowIndex}" title="Edit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn-icon btn-discharge" data-row="${p.rowIndex}" title="Discharge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function updateStats(data) {
    const total = $('stat-total');
    const active = $('stat-active');
    const chronic = $('stat-chronic');

    if (total) total.textContent = data.totalCount || 0;
    if (active) active.textContent = data.activeCount || 0;
    if (chronic) chronic.textContent = data.chronicCount || 0;
  }

  // Modal
  function openModal(patient = null) {
    editingPatient = patient;

    const modal = $('patient-modal');
    const title = $('patient-modal-title');
    const form = $('patient-form');

    if (!modal) return;

    // Reset form
    form?.reset();

    // Set title
    if (title) title.textContent = patient ? 'Edit Patient' : 'Add New Patient';

    // Fill form if editing
    if (patient) {
      const setVal = (id, val) => { const el = $(id); if (el) el.value = val || ''; };
      setVal('patient-ward', patient.ward);
      setVal('patient-room', patient.roomBed);
      setVal('patient-name', patient.patientName);
      setVal('patient-diagnosis', patient.diagnosis);
      setVal('patient-doctor', patient.assignedDoctor);
      setVal('patient-section', patient.section);
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Focus first input
    setTimeout(() => $('patient-ward')?.focus(), 100);
  }

  function closeModal() {
    const modal = $('patient-modal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
    editingPatient = null;
  }

  // CRUD
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
    if (editingPatient) {
      result = await api('updatePatient', {
        rowIndex: editingPatient.rowIndex,
        oldWard: editingPatient.ward,
        newWard: data.ward,
        ...data
      });
    } else {
      result = await api('addPatient', data);
    }

    if (result) {
      showToast(editingPatient ? 'Patient updated' : 'Patient added', 'success');
      closeModal();
      loadPatients();
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
      loadPatients();
    }
  }

  // Filters
  function applyFilters() {
    currentFilter.ward = $('ward-filter')?.value || '';
    currentFilter.doctor = $('doctor-filter')?.value || '';
    currentFilter.status = $('status-filter')?.value || '';
    loadPatients();
  }

  // Utilities
  function showPatientsScreen() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $('patients-screen')?.classList.add('active');

    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    $('patients-tab')?.classList.add('active');
  }

  function showLoading(show) {
    const grid = $('patients-grid');
    if (grid && show) {
      grid.innerHTML = `
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading patients...</p>
        </div>
      `;
    }
  }

  function openGoogleSheet() {
    if (sheetUrl) {
      window.open(sheetUrl, '_blank');
    } else {
      showToast('Sheet URL not available', 'error');
    }
  }

  function showToast(message, type = 'success') {
    // Use global toast if available
    const toast = $('toast');
    const toastMsg = $('toast-message');
    if (toast && toastMsg) {
      toast.className = `toast ${type}`;
      toastMsg.textContent = message;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 3000);
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose
  window.PatientManager = { 
    refresh: loadAllData, 
    openSheet: openGoogleSheet,
    openPresentation: openPresentation
  };

})();
