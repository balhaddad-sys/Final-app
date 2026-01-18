/**
 * MedWard Enterprise - Main Application
 */

var MedWard = MedWard || {};

MedWard.App = {
  init() {
    const { $, $$ } = MedWard.Utils;
    
    console.log('[MedWard] Initializing...');
    
    // Load data
    MedWard.Storage.load();
    console.log('[MedWard] Units loaded:', MedWard.Storage.state.units.length);
    
    // Render units
    this.renderUnits();
    
    // Setup file handlers
    $('importFile').onchange = function() {
      if (this.files[0]) {
        MedWard.Import.handleFile(this.files[0]);
      }
    };
    
    $('analysisFile').onchange = function() {
      const files = this.files;
      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith('image/')) {
          MedWard.Analysis.addImage(files[i]);
        }
      }
      this.value = '';
    };
    
    // Modal click-to-close
    $$('.modal').forEach(m => {
      m.onclick = e => { if (e.target === m) m.classList.remove('active'); };
    });
    
    // Enter key handlers
    $('adminPwd').onkeydown = e => { if (e.key === 'Enter') this.loginAdmin(); };
    $('userName').onkeydown = e => { if (e.key === 'Enter') this.enterUnit(); };
    
    console.log('[MedWard] Initialized - API:', MedWard.Storage.state.settings.apiUrl);
  },
  
  // === UNITS ===
  renderUnits() {
    const { $ } = MedWard.Utils;
    const units = MedWard.Storage.state.units;
    const container = $('unitsGrid');
    
    console.log('[MedWard] Rendering units:', units);
    
    if (!container) {
      console.error('[MedWard] unitsGrid container not found!');
      return;
    }
    
    if (!units || units.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No units configured. Click the settings icon to add units.</div>';
      return;
    }
    
    let html = '';
    units.forEach(u => {
      html += `
        <div class="unit-card" style="--unit-color:${u.color || '#d4a437'}" onclick="MedWard.App.openUnit('${u.id}')">
          <div class="unit-card-icon">${u.icon || '🏥'}</div>
          <div class="unit-card-name">${u.name || 'Unknown Unit'}</div>
          <div class="unit-card-desc">${u.desc || ''}</div>
        </div>`;
    });
    container.innerHTML = html;
    console.log('[MedWard] Units rendered:', units.length);
  },
  
  openUnit(id) {
    const { $, $$, openModal } = MedWard.Utils;
    const unit = MedWard.Storage.getUnit(id);
    if (!unit) return;
    
    MedWard.Storage.state.selectedUnitId = id;
    $('accessIcon').textContent = unit.icon;
    $('accessTitle').textContent = unit.name;
    $('codeError').classList.remove('show');
    $('userSection').style.display = 'none';
    $('enterBtn').style.display = 'none';
    
    // Create code inputs
    let html = '';
    for (let i = 0; i < 4; i++) {
      html += `<input type="tel" class="code-digit" maxlength="1" data-idx="${i}" inputmode="numeric">`;
    }
    $('codeInputs').innerHTML = html;
    
    const inputs = $$('.code-digit');
    inputs.forEach((inp, idx) => {
      inp.oninput = () => {
        inp.value = inp.value.replace(/\D/g, '');
        if (inp.value && idx < 3) inputs[idx + 1].focus();
        
        const code = Array.from(inputs).map(i => i.value).join('');
        if (code.length === 4) {
          if (code === unit.code) {
            inputs.forEach(i => { i.classList.add('success'); i.disabled = true; });
            $('codeError').classList.remove('show');
            $('userSection').style.display = 'block';
            $('enterBtn').style.display = 'flex';
            $('userName').focus();
          } else {
            $('codeError').classList.add('show');
            inputs.forEach(i => i.classList.add('error'));
            setTimeout(() => {
              inputs.forEach(i => { i.classList.remove('error'); i.value = ''; });
              inputs[0].focus();
            }, 500);
          }
        }
      };
      inp.onkeydown = e => {
        if (e.key === 'Backspace' && !inp.value && idx > 0) inputs[idx - 1].focus();
      };
    });
    
    openModal('accessModal');
    setTimeout(() => inputs[0].focus(), 100);
  },
  
  enterUnit() {
    const { $, closeModal, toast } = MedWard.Utils;
    const name = $('userName').value.trim();
    if (!name) { toast('Enter your name', true); return; }
    
    const unit = MedWard.Storage.getUnit(MedWard.Storage.state.selectedUnitId);
    MedWard.Storage.state.currentUnit = unit;
    MedWard.Storage.state.currentUser = { name, role: $('userRole').value };
    
    closeModal('accessModal');
    this.showDashboard();
  },
  
  // === DASHBOARD ===
  showDashboard() {
    const { $, initials, toast } = MedWard.Utils;
    const unit = MedWard.Storage.state.currentUnit;
    const user = MedWard.Storage.state.currentUser;
    
    $('landing').classList.add('hidden');
    $('dashboard').classList.add('active');
    
    $('unitBadge').textContent = unit.name;
    $('unitBadge').style.cssText = `border:1px solid ${unit.color};color:${unit.color};background:${unit.color}20`;
    $('dashAvatar').textContent = initials(user.name);
    
    MedWard.Patients.render();
    this.renderReference();
    toast(`Welcome to ${unit.name}`);
  },
  
  logout() {
    const { $ } = MedWard.Utils;
    MedWard.Storage.state.currentUnit = null;
    MedWard.Storage.state.currentUser = null;
    $('dashboard').classList.remove('active');
    $('landing').classList.remove('hidden');
  },
  
  showTab(name, btn) {
    const { $, $$ } = MedWard.Utils;
    $$('.tab').forEach(t => t.classList.remove('active'));
    $$('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $('panel' + name.charAt(0).toUpperCase() + name.slice(1)).classList.add('active');
  },
  
  // === ADMIN ===
  openAdminLogin() {
    const { $, openModal } = MedWard.Utils;
    $('adminPwd').value = '';
    $('adminError').classList.remove('show');
    openModal('adminModal');
    setTimeout(() => $('adminPwd').focus(), 100);
  },
  
  loginAdmin() {
    const { $, closeModal } = MedWard.Utils;
    if ($('adminPwd').value === MedWard.Storage.state.settings.adminPassword) {
      closeModal('adminModal');
      this.showAdmin();
    } else {
      $('adminError').classList.add('show');
    }
  },
  
  showAdmin() {
    const { $ } = MedWard.Utils;
    $('landing').classList.add('hidden');
    $('adminPanel').classList.add('active');
    $('apiUrl').value = MedWard.Storage.state.settings.apiUrl || '';
    this.renderUnitsTable();
  },
  
  exitAdmin() {
    const { $ } = MedWard.Utils;
    $('adminPanel').classList.remove('active');
    $('landing').classList.remove('hidden');
  },
  
  renderUnitsTable() {
    const { $ } = MedWard.Utils;
    const units = MedWard.Storage.state.units;
    
    let html = '';
    units.forEach(u => {
      html += `
        <tr>
          <td>${u.icon} <b>${u.name}</b></td>
          <td><code style="background:var(--bg-elevated);padding:3px 8px;border-radius:4px">${u.code}</code></td>
          <td>
            <button class="btn-icon" onclick="MedWard.App.editUnit('${u.id}')">✏️</button>
            <button class="btn-icon" onclick="MedWard.App.deleteUnit('${u.id}')">🗑️</button>
          </td>
        </tr>`;
    });
    
    $('unitsTable').innerHTML = html || '<tr><td colspan="3" style="text-align:center;padding:30px;color:var(--text-muted)">No units</td></tr>';
  },
  
  addUnit() {
    const { $, openModal } = MedWard.Utils;
    MedWard.Storage.state.editingUnitId = null;
    $('unitModalTitle').textContent = 'Add Unit';
    $('uName').value = '';
    $('uIcon').value = '🏥';
    $('uCode').value = '';
    $('uDesc').value = '';
    openModal('unitModal');
  },
  
  editUnit(id) {
    const { $, openModal } = MedWard.Utils;
    const unit = MedWard.Storage.getUnit(id);
    if (!unit) return;
    
    MedWard.Storage.state.editingUnitId = id;
    $('unitModalTitle').textContent = 'Edit Unit';
    $('uName').value = unit.name;
    $('uIcon').value = unit.icon;
    $('uCode').value = unit.code;
    $('uDesc').value = unit.desc || '';
    openModal('unitModal');
  },
  
  saveUnit() {
    const { $, closeModal, toast } = MedWard.Utils;
    const name = $('uName').value.trim();
    const icon = $('uIcon').value.trim() || '🏥';
    const code = $('uCode').value.trim();
    const desc = $('uDesc').value.trim();
    
    if (!name) { toast('Name required', true); return; }
    if (!/^\d{4}$/.test(code)) { toast('Code must be 4 digits', true); return; }
    
    const editId = MedWard.Storage.state.editingUnitId;
    
    if (editId) {
      MedWard.Storage.updateUnit(editId, { name, icon, code, desc });
      toast('Unit updated!');
    } else {
      MedWard.Storage.addUnit({ name, icon, code, desc });
      toast('Unit created!');
    }
    
    this.renderUnitsTable();
    this.renderUnits();
    closeModal('unitModal');
  },
  
  deleteUnit(id) {
    const { toast } = MedWard.Utils;
    if (!confirm('Delete this unit?')) return;
    MedWard.Storage.deleteUnit(id);
    this.renderUnitsTable();
    this.renderUnits();
    toast('Unit deleted');
  },
  
  saveSettings() {
    const { $, toast } = MedWard.Utils;
    const pwd = $('newAdminPwd').value.trim();
    const url = $('apiUrl').value.trim();
    
    if (pwd) MedWard.Storage.state.settings.adminPassword = pwd;
    if (url) MedWard.Storage.state.settings.apiUrl = url;
    
    MedWard.Storage.save();
    toast('Settings saved!');
    $('newAdminPwd').value = '';
  },
  
  // === REFERENCE ===
  renderReference() {
    const { $ } = MedWard.Utils;
    let html = '';
    MedWard.REFERENCES.forEach(r => {
      html += `<div class="ref-card"><h4>${r.title}</h4><p>${r.content}</p></div>`;
    });
    $('refGrid').innerHTML = html;
  }
};

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => MedWard.App.init());
} else {
  MedWard.App.init();
}
