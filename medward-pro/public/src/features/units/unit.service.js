// features/units/unit.service.js
// Unit management service

import { Data } from '../../core/app.data.js';
import { Store } from '../../core/store.js';
import { EventBus } from '../../core/core.events.js';
import { Monitor } from '../../monitor/monitor.core.js';
import { PatientService } from '../patients/patient.service.js';

export const UnitService = {
  // Get all units
  getAll() {
    return Data.Units.getAll();
  },

  // Get unit by ID
  getById(id) {
    return Data.Units.getById(id);
  },

  // Get current unit
  getCurrent() {
    return Store.currentUnit;
  },

  // Create a new unit
  async create(name, icon = '') {
    try {
      const result = await Data.Units.create(name, icon);

      EventBus.emit('toast:success', `Unit "${name}" created`);
      Monitor.log('UNIT', `Created unit: ${name}`);

      // Auto-select the new unit
      const unit = Data.Units.getById(result.id);
      if (unit) {
        this.select(unit);
      }

      return result;
    } catch (error) {
      EventBus.emit('toast:error', `Failed to create unit: ${error.message}`);
      throw error;
    }
  },

  // Update unit
  async update(id, updates) {
    try {
      await Data.Units.update(id, updates);
      EventBus.emit('toast:success', 'Unit updated');
      return { success: true };
    } catch (error) {
      EventBus.emit('toast:error', 'Failed to update unit');
      throw error;
    }
  },

  // Delete unit
  async delete(id) {
    // Check if unit has patients
    const patients = PatientService.getAll().filter(p => p.unitId === id);
    if (patients.length > 0) {
      throw new Error(`Cannot delete unit with ${patients.length} patients`);
    }

    try {
      await Data.Units.delete(id);
      EventBus.emit('toast:info', 'Unit deleted');

      // Deselect if this was current unit
      if (Store.currentUnit?.id === id) {
        const units = this.getAll();
        if (units.length > 0) {
          this.select(units[0]);
        } else {
          Store.setCurrentUnit(null);
        }
      }

      return { success: true };
    } catch (error) {
      EventBus.emit('toast:error', 'Failed to delete unit');
      throw error;
    }
  },

  // Select a unit
  select(unit) {
    Data.Units.select(unit);
    EventBus.emit('unit:selected', unit);
    Monitor.log('UNIT', `Selected unit: ${unit?.name}`);
  },

  // Add member to unit
  async addMember(unitId, userId) {
    try {
      await Data.Units.addMember(unitId, userId);
      EventBus.emit('toast:success', 'Member added to unit');
      return { success: true };
    } catch (error) {
      EventBus.emit('toast:error', 'Failed to add member');
      throw error;
    }
  },

  // Remove member from unit
  async removeMember(unitId, userId) {
    const unit = this.getById(unitId);
    if (unit?.ownerId === userId) {
      throw new Error('Cannot remove unit owner');
    }

    try {
      await Data.Units.removeMember(unitId, userId);
      EventBus.emit('toast:info', 'Member removed from unit');
      return { success: true };
    } catch (error) {
      EventBus.emit('toast:error', 'Failed to remove member');
      throw error;
    }
  },

  // Get unit statistics
  getStats(unitId) {
    const unit = this.getById(unitId);
    if (!unit) return null;

    const patients = PatientService.getAll().filter(p => p.unitId === unitId);
    const activePatients = patients.filter(p => p.status === 'active' && !p.deleted);
    const dischargedPatients = patients.filter(p => p.status === 'discharged');

    return {
      ...unit,
      patientCount: activePatients.length,
      dischargedCount: dischargedPatients.length,
      memberCount: unit.members?.length || 0
    };
  },

  // Get all units with statistics
  getAllWithStats() {
    return this.getAll().map(unit => this.getStats(unit.id));
  },

  // Check if user is member of unit
  isMember(unitId, userId) {
    const unit = this.getById(unitId);
    return unit?.members?.includes(userId) || false;
  },

  // Check if user is owner of unit
  isOwner(unitId, userId) {
    const unit = this.getById(unitId);
    return unit?.ownerId === userId;
  },

  // Get units owned by user
  getOwnedBy(userId) {
    return this.getAll().filter(u => u.ownerId === userId);
  }
};
