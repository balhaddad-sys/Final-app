// features/patients/patient.service.js
// Patient management service

import { Data } from '../../core/app.data.js';
import { Store } from '../../core/store.js';
import { EventBus } from '../../core/core.events.js';
import { Monitor } from '../../monitor/monitor.core.js';
import { TaskService } from '../tasks/task.service.js';

export const PatientService = {
  // Get all patients for current unit
  getForCurrentUnit() {
    const unit = Store.currentUnit;
    if (!unit) return [];
    return Data.Patients.get(unit.id);
  },

  // Get patient by ID
  getById(id) {
    return Data.Patients.getById(id);
  },

  // Get all patients
  getAll() {
    return Data.Patients.getAll();
  },

  // Get patients by status
  getByStatus(status) {
    return Data.Patients.getByStatus(status);
  },

  // Get active patients
  getActive() {
    return this.getForCurrentUnit().filter(p => p.status === 'active');
  },

  // Get discharged patients
  getDischarged() {
    return this.getForCurrentUnit().filter(p => p.status === 'discharged');
  },

  // Add a new patient
  async add(patientData) {
    try {
      const result = await Data.Patients.add({
        ...patientData,
        unitId: patientData.unitId || Store.currentUnit?.id
      });

      EventBus.emit('toast:success', 'Patient added');
      Monitor.log('PATIENT', `Added patient: ${patientData.name}`);

      return result;
    } catch (error) {
      EventBus.emit('toast:error', `Failed to add patient: ${error.message}`);
      throw error;
    }
  },

  // Update patient
  async update(id, updates) {
    try {
      await Data.Patients.update(id, updates);
      EventBus.emit('toast:success', 'Patient updated');
      return { success: true };
    } catch (error) {
      EventBus.emit('toast:error', `Failed to update patient: ${error.message}`);
      throw error;
    }
  },

  // Discharge patient
  async discharge(id) {
    try {
      await Data.Patients.discharge(id);
      EventBus.emit('toast:success', 'Patient discharged');
      Monitor.log('PATIENT', `Discharged patient: ${id}`);
      return { success: true };
    } catch (error) {
      EventBus.emit('toast:error', 'Failed to discharge patient');
      throw error;
    }
  },

  // Archive patient
  async archive(id) {
    try {
      await Data.Patients.archive(id);
      EventBus.emit('toast:info', 'Patient archived');
      return { success: true };
    } catch (error) {
      EventBus.emit('toast:error', 'Failed to archive patient');
      throw error;
    }
  },

  // Delete patient (soft delete)
  async delete(id) {
    try {
      await Data.Patients.delete(id);
      EventBus.emit('toast:info', 'Patient moved to trash');
      Monitor.log('PATIENT', `Deleted patient: ${id}`);
      return { success: true };
    } catch (error) {
      EventBus.emit('toast:error', 'Failed to delete patient');
      throw error;
    }
  },

  // Restore patient from trash
  async restore(id) {
    try {
      await Data.Patients.restore(id);
      EventBus.emit('toast:success', 'Patient restored');
      return { success: true };
    } catch (error) {
      EventBus.emit('toast:error', 'Failed to restore patient');
      throw error;
    }
  },

  // Select a patient
  select(patient) {
    Store.setCurrentPatient(patient);
    EventBus.emit('patient:selected', patient);
  },

  // Deselect patient
  deselect() {
    Store.setCurrentPatient(null);
    EventBus.emit('patient:deselected');
  },

  // Get currently selected patient
  getCurrent() {
    return Store.currentPatient;
  },

  // Get patient with tasks
  getWithTasks(id) {
    const patient = this.getById(id);
    if (!patient) return null;

    return {
      ...patient,
      tasks: TaskService.getByPatient(id),
      taskStats: TaskService.getStats(id)
    };
  },

  // Search patients
  search(query, options = {}) {
    const { unitId, status, limit = 50 } = options;

    let patients = unitId
      ? Data.Patients.get(unitId)
      : this.getAll();

    if (status) {
      patients = patients.filter(p => p.status === status);
    }

    if (!query) return patients.slice(0, limit);

    const lowerQuery = query.toLowerCase();

    return patients
      .filter(p =>
        p.name?.toLowerCase().includes(lowerQuery) ||
        p.mrn?.toLowerCase().includes(lowerQuery) ||
        p.bed?.toLowerCase().includes(lowerQuery) ||
        p.diagnosis?.toLowerCase().includes(lowerQuery)
      )
      .slice(0, limit);
  },

  // Get patient statistics for current unit
  getStats() {
    const patients = this.getForCurrentUnit();

    const active = patients.filter(p => p.status === 'active');
    const discharged = patients.filter(p => p.status === 'discharged');
    const archived = patients.filter(p => p.status === 'archived');

    // Calculate task stats across all patients
    let totalTasks = 0;
    let completedTasks = 0;
    let urgentTasks = 0;

    for (const patient of active) {
      const stats = TaskService.getStats(patient.id);
      totalTasks += stats.total;
      completedTasks += stats.completed;
      urgentTasks += stats.urgent;
    }

    return {
      total: patients.length,
      active: active.length,
      discharged: discharged.length,
      archived: archived.length,
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        pending: totalTasks - completedTasks,
        urgent: urgentTasks,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
      }
    };
  },

  // Export patient data (for handover)
  exportForHandover(id) {
    const patient = this.getWithTasks(id);
    if (!patient) return null;

    // Strip internal fields
    const { _createdAt, _updatedAt, _createdBy, _updatedBy, ...exportData } = patient;

    return {
      ...exportData,
      exportedAt: Date.now(),
      tasks: patient.tasks.filter(t => !t.completed).map(t => ({
        text: t.text,
        category: t.category,
        priority: t.priority
      }))
    };
  },

  // Import patient from handover
  async importFromHandover(patientData, unitId) {
    try {
      // Create patient
      const { tasks, exportedAt, ...patientFields } = patientData;

      const result = await this.add({
        ...patientFields,
        unitId,
        status: 'active',
        importedFrom: patientData.id,
        importedAt: Date.now()
      });

      // Create tasks
      if (tasks?.length) {
        for (const task of tasks) {
          await TaskService.add(result.id, task.text, {
            category: task.category,
            priority: task.priority
          });
        }
      }

      return result;
    } catch (error) {
      Monitor.logError('PATIENT_IMPORT', error);
      throw error;
    }
  },

  // Get patients sorted by various criteria
  getSorted(sortBy = 'name', direction = 'asc') {
    const patients = this.getForCurrentUnit();

    const sortFn = (a, b) => {
      let valueA, valueB;

      switch (sortBy) {
        case 'name':
          valueA = a.name?.toLowerCase() || '';
          valueB = b.name?.toLowerCase() || '';
          break;
        case 'bed':
          valueA = a.bed?.toLowerCase() || '';
          valueB = b.bed?.toLowerCase() || '';
          break;
        case 'createdAt':
          valueA = a.createdAt || 0;
          valueB = b.createdAt || 0;
          break;
        case 'updatedAt':
          valueA = a.updatedAt || 0;
          valueB = b.updatedAt || 0;
          break;
        case 'tasks':
          valueA = TaskService.getStats(a.id).pending;
          valueB = TaskService.getStats(b.id).pending;
          break;
        default:
          valueA = a[sortBy] || '';
          valueB = b[sortBy] || '';
      }

      if (valueA < valueB) return direction === 'asc' ? -1 : 1;
      if (valueA > valueB) return direction === 'asc' ? 1 : -1;
      return 0;
    };

    return [...patients].sort(sortFn);
  }
};
