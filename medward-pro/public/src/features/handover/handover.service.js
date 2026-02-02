// features/handover/handover.service.js
// Handover service for patient transfers

import { CloudFunctions } from '../../services/firebase.functions.js';
import { PatientService } from '../patients/patient.service.js';
import { Store } from '../../core/store.js';
import { EventBus } from '../../core/core.events.js';
import { Monitor } from '../../monitor/monitor.core.js';
import { Storage } from '../../services/storage.adapter.js';

export const HandoverService = {
  // Send patient to another user
  async sendPatient(recipientEmail, patientId, notes = '') {
    const patient = PatientService.getById(patientId);
    if (!patient) {
      throw new Error('Patient not found');
    }

    const patientData = PatientService.exportForHandover(patientId);

    try {
      const result = await CloudFunctions.sendPatient(recipientEmail, patientData, notes);

      Monitor.log('HANDOVER', `Sent patient ${patient.name} to ${recipientEmail}`);

      return result;
    } catch (error) {
      Monitor.logError('HANDOVER_SEND', error);
      throw error;
    }
  },

  // Check inbox for incoming patients
  async checkInbox() {
    try {
      const result = await CloudFunctions.checkInbox();

      if (result.count > 0) {
        EventBus.emit('inbox:updated', result);

        if (result.pendingCount > 0) {
          EventBus.emit('toast:info', `You have ${result.pendingCount} pending handover(s)`);
        }
      }

      return result;
    } catch (error) {
      Monitor.logError('HANDOVER_CHECK_INBOX', error);
      throw error;
    }
  },

  // Get local inbox items
  async getLocalInbox() {
    return Storage.inbox.getAll();
  },

  // Accept incoming patient
  async acceptPatient(itemId, targetUnitId) {
    if (!targetUnitId) {
      targetUnitId = Store.currentUnit?.id;
    }

    if (!targetUnitId) {
      throw new Error('No target unit selected');
    }

    try {
      const result = await CloudFunctions.acceptInboxPatient(itemId, targetUnitId);

      // Update local inbox status
      await Storage.inbox.updateStatus(itemId, 'accepted');

      Monitor.log('HANDOVER', `Accepted patient from inbox: ${itemId}`);

      return result;
    } catch (error) {
      Monitor.logError('HANDOVER_ACCEPT', error);
      throw error;
    }
  },

  // Decline incoming patient
  async declinePatient(itemId) {
    try {
      await CloudFunctions.declineInboxItem(itemId);

      // Update local inbox status
      await Storage.inbox.updateStatus(itemId, 'declined');

      EventBus.emit('toast:info', 'Handover declined');
      Monitor.log('HANDOVER', `Declined handover: ${itemId}`);

      return { success: true };
    } catch (error) {
      Monitor.logError('HANDOVER_DECLINE', error);
      throw error;
    }
  },

  // Generate handover summary using AI
  async generateSummary(patientId) {
    const patient = PatientService.getWithTasks(patientId);
    if (!patient) {
      throw new Error('Patient not found');
    }

    try {
      const result = await CloudFunctions.generateHandoverSummary(patientId);
      return result;
    } catch (error) {
      Monitor.logError('HANDOVER_SUMMARY', error);
      throw error;
    }
  },

  // Create handover report (local)
  createReport(patientIds, options = {}) {
    const {
      includeCompletedTasks = false,
      includeNotes = true,
      format = 'text'
    } = options;

    const patients = patientIds
      .map(id => PatientService.getWithTasks(id))
      .filter(Boolean);

    if (format === 'text') {
      return this._formatTextReport(patients, { includeCompletedTasks, includeNotes });
    } else if (format === 'json') {
      return this._formatJsonReport(patients, { includeCompletedTasks, includeNotes });
    }

    return patients;
  },

  _formatTextReport(patients, options) {
    const lines = [];
    const timestamp = new Date().toLocaleString();

    lines.push(`HANDOVER REPORT`);
    lines.push(`Generated: ${timestamp}`);
    lines.push(`Total Patients: ${patients.length}`);
    lines.push('='.repeat(50));
    lines.push('');

    for (const patient of patients) {
      lines.push(`PATIENT: ${patient.name}`);
      lines.push(`MRN: ${patient.mrn || 'N/A'} | Bed: ${patient.bed || 'N/A'}`);
      lines.push(`Diagnosis: ${patient.diagnosis || 'N/A'}`);

      if (options.includeNotes && patient.notes) {
        lines.push(`Notes: ${patient.notes}`);
      }

      const pendingTasks = patient.tasks.filter(t => !t.completed);
      const urgentTasks = pendingTasks.filter(t => t.priority === 'urgent');

      if (pendingTasks.length > 0) {
        lines.push('');
        lines.push('Pending Tasks:');

        // Urgent tasks first
        if (urgentTasks.length > 0) {
          lines.push('  [URGENT]');
          for (const task of urgentTasks) {
            lines.push(`    - ${task.text}`);
          }
        }

        // Regular tasks
        const regularTasks = pendingTasks.filter(t => t.priority !== 'urgent');
        for (const task of regularTasks) {
          lines.push(`  - ${task.text}`);
        }
      }

      if (options.includeCompletedTasks) {
        const completedTasks = patient.tasks.filter(t => t.completed);
        if (completedTasks.length > 0) {
          lines.push('');
          lines.push('Completed Tasks:');
          for (const task of completedTasks) {
            lines.push(`  [x] ${task.text}`);
          }
        }
      }

      lines.push('');
      lines.push('-'.repeat(50));
      lines.push('');
    }

    return lines.join('\n');
  },

  _formatJsonReport(patients, options) {
    return patients.map(patient => ({
      name: patient.name,
      mrn: patient.mrn,
      bed: patient.bed,
      diagnosis: patient.diagnosis,
      notes: options.includeNotes ? patient.notes : undefined,
      status: patient.status,
      tasks: patient.tasks
        .filter(t => options.includeCompletedTasks || !t.completed)
        .map(t => ({
          text: t.text,
          category: t.category,
          priority: t.priority,
          completed: t.completed
        })),
      taskStats: patient.taskStats
    }));
  },

  // Copy report to clipboard
  async copyReportToClipboard(patientIds, options = {}) {
    const report = this.createReport(patientIds, { ...options, format: 'text' });

    try {
      await navigator.clipboard.writeText(report);
      EventBus.emit('toast:success', 'Handover report copied to clipboard');
      return true;
    } catch (error) {
      EventBus.emit('toast:error', 'Failed to copy report');
      return false;
    }
  }
};
