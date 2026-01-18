/**
 * MedWard Enterprise - Storage Module
 */

var MedWard = MedWard || {};

MedWard.Storage = {
  state: {
    units: [],
    settings: {},
    patients: [],
    currentUnit: null,
    currentUser: null,
    selectedUnitId: null,
    editingUnitId: null
  },
  
  load() {
    // Always start with defaults
    this.state.units = MedWard.DEFAULT_UNITS.slice();
    this.state.settings = {
      adminPassword: MedWard.CONFIG.ADMIN_PASSWORD,
      apiUrl: MedWard.CONFIG.API_URL
    };
    this.state.patients = [];
    
    try {
      const saved = localStorage.getItem(MedWard.CONFIG.STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        // Only override units if we have valid unit data with proper structure
        if (data.units && Array.isArray(data.units) && data.units.length > 0) {
          // Validate that units have required fields
          const validUnits = data.units.filter(u => u && u.id && u.name && u.code);
          if (validUnits.length > 0) {
            this.state.units = validUnits;
          }
        }
        if (data.settings) {
          this.state.settings.adminPassword = data.settings.adminPassword || MedWard.CONFIG.ADMIN_PASSWORD;
          this.state.settings.apiUrl = data.settings.apiUrl || MedWard.CONFIG.API_URL;
        }
        if (data.patients && Array.isArray(data.patients)) {
          this.state.patients = data.patients;
        }
      }
    } catch (e) {
      console.warn('Storage load failed, using defaults:', e);
      // Clear corrupted storage
      try {
        localStorage.removeItem(MedWard.CONFIG.STORAGE_KEY);
      } catch (clearError) {
        console.warn('Could not clear storage:', clearError);
      }
    }
    
    // Final safety check - ensure we always have units
    if (!this.state.units || this.state.units.length === 0) {
      console.log('No units found, loading defaults');
      this.state.units = MedWard.DEFAULT_UNITS.slice();
    }
  },
  
  save() {
    try {
      localStorage.setItem(MedWard.CONFIG.STORAGE_KEY, JSON.stringify({
        units: this.state.units,
        settings: this.state.settings,
        patients: this.state.patients
      }));
    } catch (e) {
      console.warn('Storage save failed:', e);
    }
  },
  
  getUnit(id) {
    return this.state.units.find(u => u.id === id);
  },
  
  addPatient(patient) {
    patient.id = Date.now();
    this.state.patients.push(patient);
    this.save();
    return patient;
  },
  
  updatePatient(id, updates) {
    const idx = this.state.patients.findIndex(p => p.id === id);
    if (idx !== -1) {
      this.state.patients[idx] = { ...this.state.patients[idx], ...updates };
      this.save();
      return this.state.patients[idx];
    }
    return null;
  },
  
  deletePatient(id) {
    const idx = this.state.patients.findIndex(p => p.id === id);
    if (idx !== -1) {
      this.state.patients.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  },
  
  addUnit(unit) {
    unit.id = 'u' + Date.now();
    const colors = ['#d4a437', '#14b8a6', '#3b82f6', '#a855f7', '#ef4444', '#f97316'];
    unit.color = unit.color || colors[this.state.units.length % colors.length];
    this.state.units.push(unit);
    this.save();
    return unit;
  },
  
  updateUnit(id, updates) {
    const idx = this.state.units.findIndex(u => u.id === id);
    if (idx !== -1) {
      this.state.units[idx] = { ...this.state.units[idx], ...updates };
      this.save();
      return this.state.units[idx];
    }
    return null;
  },
  
  deleteUnit(id) {
    this.state.units = this.state.units.filter(u => u.id !== id);
    this.save();
  }
};
