/**
 * MedWard Enterprise - Patients Module
 */

var MedWard = MedWard || {};

MedWard.Patients = {
  render() {
    const { $, escapeHtml, initials } = MedWard.Utils;
    const patients = MedWard.Storage.state.patients;
    const container = $('patientsList');
    
    if (!patients.length) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No patients yet. Click "+ Add" or "📥 Import".</div>';
    } else {
      let html = '';
      patients.forEach((p, idx) => {
        html += `
          <div class="patient ${p.status}" data-id="${p.id}">
            <div class="patient-top">
              <div class="patient-avatar">${initials(p.name)}</div>
              <div class="patient-info">
                <div class="patient-name">${escapeHtml(p.name)}</div>
                <div class="patient-meta">Room ${escapeHtml(p.room)} • ${escapeHtml(p.doctor || 'Unassigned')}</div>
              </div>
              <span class="patient-status ${p.status}">${p.status}</span>
            </div>
            <div class="patient-dx">${escapeHtml(p.diagnosis)}</div>
            <div class="patient-actions">
              <button class="btn btn-secondary btn-sm" onclick="MedWard.Patients.edit(${p.id})">✏️ Edit</button>
              <button class="btn btn-danger btn-sm" onclick="MedWard.Patients.delete(${p.id})">🗑️ Delete</button>
            </div>
          </div>`;
      });
      container.innerHTML = html;
    }
    
    this.updateStats();
  },
  
  updateStats() {
    const { $ } = MedWard.Utils;
    const patients = MedWard.Storage.state.patients;
    $('statTotal').textContent = patients.length;
    $('statActive').textContent = patients.filter(p => p.status === 'active').length;
    $('statCritical').textContent = patients.filter(p => p.status === 'critical').length;
    $('statChronic').textContent = patients.filter(p => p.status === 'chronic').length;
  },
  
  openAdd() {
    const { $, openModal } = MedWard.Utils;
    $('patientModalTitle').textContent = 'Add Patient';
    $('ptId').value = '';
    $('ptName').value = '';
    $('ptRoom').value = '';
    $('ptDx').value = '';
    $('ptStatus').value = 'active';
    openModal('patientModal');
  },
  
  edit(id) {
    const { $, openModal } = MedWard.Utils;
    const patient = MedWard.Storage.state.patients.find(p => p.id === id);
    if (!patient) return;
    
    $('patientModalTitle').textContent = 'Edit Patient';
    $('ptId').value = patient.id;
    $('ptName').value = patient.name;
    $('ptRoom').value = patient.room;
    $('ptDx').value = patient.diagnosis;
    $('ptStatus').value = patient.status;
    openModal('patientModal');
  },
  
  save() {
    const { $, closeModal, toast } = MedWard.Utils;
    const id = $('ptId').value;
    const name = $('ptName').value.trim();
    const room = $('ptRoom').value.trim() || '—';
    const diagnosis = $('ptDx').value.trim() || 'Pending evaluation';
    const status = $('ptStatus').value;
    
    if (!name) {
      toast('Name is required', true);
      return;
    }
    
    const user = MedWard.Storage.state.currentUser;
    
    if (id) {
      // Update existing
      MedWard.Storage.updatePatient(parseInt(id), { name, room, diagnosis, status });
      toast('Patient updated!');
    } else {
      // Add new
      MedWard.Storage.addPatient({
        name,
        room,
        diagnosis,
        status,
        doctor: user ? user.name : 'Unassigned'
      });
      toast('Patient added!');
    }
    
    this.render();
    closeModal('patientModal');
  },
  
  delete(id) {
    const { toast } = MedWard.Utils;
    if (!confirm('Delete this patient?')) return;
    
    if (MedWard.Storage.deletePatient(id)) {
      toast('Patient deleted');
      this.render();
    }
  }
};
