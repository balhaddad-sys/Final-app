/**
 * Handover Service
 * QR code generation, scanning, and patient transfer
 */
import { Data } from '../core/data.js';
import { Store } from '../core/store.js';
import { EventBus } from '../core/events.js';

// QR code library (use qrcode.js or similar)
const QR_SIZE = 256;
const HANDOVER_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

export const Handover = {
  /**
   * Generate handover package for selected patients
   * @param {string[]} patientIds - Array of patient IDs to handover
   * @returns {object} Handover package with QR data
   */
  async generateHandover(patientIds) {
    if (!patientIds.length) {
      throw new Error('No patients selected for handover');
    }

    // Get patient data
    const patients = patientIds.map(id => {
      const patient = Data.patients.get(id);
      if (!patient) throw new Error(`Patient ${id} not found`);

      // Get tasks for patient
      const tasks = Data.tasks.list(id);

      return {
        ...patient,
        tasks: tasks.filter(t => !t.completed) // Only pending tasks
      };
    });

    // Create handover package
    const handover = {
      id: crypto.randomUUID(),
      type: 'medward-handover',
      version: 1,
      createdAt: Date.now(),
      expiresAt: Date.now() + HANDOVER_EXPIRY_MS,
      fromUser: {
        uid: Store.get('user')?.uid,
        name: Store.get('user')?.displayName,
        email: Store.get('user')?.email
      },
      fromUnit: {
        id: Store.get('currentUnitId'),
        name: Store.currentUnit?.name
      },
      patients: patients.map(p => ({
        id: p.id,
        name: p.name,
        mrn: p.mrn,
        bed: p.bed,
        diagnosis: p.diagnosis,
        age: p.age,
        status: p.status,
        notes: p.notes,
        tasks: p.tasks,
        labs: p.labs,
        vitals: p.vitals
      })),
      patientCount: patients.length
    };

    // Generate verification hash
    handover.hash = await this._generateHash(handover);

    // Generate QR code
    const qrData = await this._generateQR(handover);

    return {
      handover,
      qrDataUrl: qrData,
      expiresIn: HANDOVER_EXPIRY_MS / 1000
    };
  },

  /**
   * Generate QR code from handover data
   */
  async _generateQR(handover) {
    // Compress handover data for QR
    const compressed = {
      id: handover.id,
      t: handover.type,
      v: handover.version,
      e: handover.expiresAt,
      h: handover.hash,
      f: handover.fromUser.uid,
      c: handover.patientCount
    };

    const payload = JSON.stringify(compressed);

    // Use QRCode library
    // This is a placeholder - integrate actual QR library
    if (typeof QRCode !== 'undefined') {
      const canvas = document.createElement('canvas');
      await QRCode.toCanvas(canvas, payload, {
        width: QR_SIZE,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      return canvas.toDataURL('image/png');
    }

    // Fallback: Use external API
    return `https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}x${QR_SIZE}&data=${encodeURIComponent(payload)}`;
  },

  /**
   * Scan and parse QR code
   */
  async scanQR() {
    return new Promise((resolve, reject) => {
      // Check for camera support
      if (!navigator.mediaDevices?.getUserMedia) {
        reject(new Error('Camera not supported'));
        return;
      }

      // Create scanner modal
      const modal = document.createElement('div');
      modal.className = 'qr-scanner-modal';
      modal.innerHTML = `
        <div class="qr-scanner-content glass">
          <div class="qr-scanner-header">
            <h3>Scan Handover QR</h3>
            <button class="btn btn-ghost btn-icon qr-close">✕</button>
          </div>
          <div class="qr-scanner-viewfinder">
            <video id="qr-video" autoplay playsinline></video>
            <div class="qr-scanner-overlay"></div>
          </div>
          <p class="qr-scanner-hint">Point camera at the handover QR code</p>
        </div>
      `;

      document.body.appendChild(modal);

      const video = modal.querySelector('#qr-video');
      const closeBtn = modal.querySelector('.qr-close');
      let stream = null;

      // Close handler
      const cleanup = () => {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        modal.remove();
      };

      closeBtn.addEventListener('click', () => {
        cleanup();
        reject(new Error('Cancelled'));
      });

      // Start camera
      navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      }).then(s => {
        stream = s;
        video.srcObject = stream;

        // Use jsQR or similar for scanning
        const scanFrame = () => {
          if (!stream) return;

          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

          // Use jsQR library
          if (typeof jsQR !== 'undefined') {
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code) {
              cleanup();
              resolve(this._parseQR(code.data));
              return;
            }
          }

          requestAnimationFrame(scanFrame);
        };

        video.onloadedmetadata = () => {
          video.play();
          scanFrame();
        };

      }).catch(err => {
        cleanup();
        reject(err);
      });
    });
  },

  /**
   * Parse scanned QR data
   */
  _parseQR(data) {
    try {
      const parsed = JSON.parse(data);

      // Validate it's a MedWard handover
      if (parsed.t !== 'medward-handover') {
        throw new Error('Invalid QR code');
      }

      // Check expiry
      if (parsed.e < Date.now()) {
        throw new Error('Handover QR has expired');
      }

      return {
        id: parsed.id,
        fromUserId: parsed.f,
        patientCount: parsed.c,
        hash: parsed.h,
        expiresAt: parsed.e
      };

    } catch (e) {
      throw new Error('Invalid QR code format');
    }
  },

  /**
   * Fetch full handover data from server
   */
  async fetchHandover(handoverId, hash) {
    // In production, this would fetch from your backend
    // The QR only contains the handover ID for security
    // Full data is fetched authenticated from server

    const { functions } = await import('./firebase.config.js');
    const { httpsCallable } = await import('firebase/functions');

    const getHandover = httpsCallable(functions, 'getHandover');
    const result = await getHandover({ id: handoverId, hash });

    return result.data;
  },

  /**
   * Accept handover - import patients to current unit
   */
  async acceptHandover(handover, targetUnitId) {
    const results = {
      success: [],
      failed: []
    };

    for (const patient of handover.patients) {
      try {
        // Create patient in new unit
        await Data.patients.add({
          ...patient,
          id: crypto.randomUUID(), // New ID in receiving unit
          unitId: targetUnitId,
          handoverFrom: {
            userId: handover.fromUser.uid,
            unitId: handover.fromUnit.id,
            originalId: patient.id,
            timestamp: Date.now()
          }
        });

        // Create tasks
        for (const task of patient.tasks || []) {
          await Data.tasks.add(patient.id, {
            ...task,
            id: undefined // Generate new ID
          });
        }

        results.success.push(patient.name);

      } catch (error) {
        console.error(`Failed to import ${patient.name}:`, error);
        results.failed.push({ name: patient.name, error: error.message });
      }
    }

    // Log handover for audit
    this._logHandover('accept', handover.id, results);

    return results;
  },

  /**
   * Generate hash for verification
   */
  async _generateHash(handover) {
    const data = JSON.stringify({
      id: handover.id,
      patients: handover.patients.map(p => p.id),
      from: handover.fromUser.uid,
      created: handover.createdAt
    });

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  },

  /**
   * Audit logging
   */
  _logHandover(action, handoverId, details) {
    console.log('[Handover Audit]', {
      action,
      handoverId,
      userId: Store.get('user')?.uid,
      unitId: Store.get('currentUnitId'),
      timestamp: Date.now(),
      details
    });

    // In production, send to audit service
  }
};
