// index.js
// MedWard Pro Cloud Functions — Main entry point
// Firebase Cloud Functions v2 (Node.js 20)

const admin = require("firebase-admin");

// Initialize Firebase Admin SDK ONCE at module level
admin.initializeApp();

// ═══════════════════════════════════════════════════════════════
// MEDWARD AI FUNCTIONS
// ═══════════════════════════════════════════════════════════════
const { medward_askClinical } = require("./medward/askClinical");
const { medward_getDrugInfo } = require("./medward/getDrugInfo");
const { medward_getAntibioticGuidance } = require("./medward/getAntibioticGuidance");
const { medward_analyzeLabImage } = require("./medward/analyzeLabImage");
const { medward_scanLabReport } = require("./medward/scanLabReport");
const { medward_generateHandoverSummary } = require("./medward/generateHandoverSummary");

exports.medward_askClinical = medward_askClinical;
exports.medward_getDrugInfo = medward_getDrugInfo;
exports.medward_getAntibioticGuidance = medward_getAntibioticGuidance;
exports.medward_analyzeLabImage = medward_analyzeLabImage;
exports.medward_scanLabReport = medward_scanLabReport;
exports.medward_generateHandoverSummary = medward_generateHandoverSummary;

// Backward-compatible aliases for existing client calls
exports.askClinical = medward_askClinical;
exports.getDrugInfo = medward_getDrugInfo;
exports.getAntibioticGuidance = medward_getAntibioticGuidance;
exports.analyzeLabImage = medward_analyzeLabImage;
exports.generateHandoverSummary = medward_generateHandoverSummary;

// ═══════════════════════════════════════════════════════════════
// ONCALL AI FUNCTIONS
// ═══════════════════════════════════════════════════════════════
const { oncall_oncallConsult } = require("./oncall/oncallConsult");
const { oncall_generateDifferential } = require("./oncall/generateDifferential");
const { oncall_verifyElectrolyteCorrection } = require("./oncall/verifyElectrolyteCorrection");

exports.oncall_oncallConsult = oncall_oncallConsult;
exports.oncall_generateDifferential = oncall_generateDifferential;
exports.oncall_verifyElectrolyteCorrection = oncall_verifyElectrolyteCorrection;

// ═══════════════════════════════════════════════════════════════
// CORE FUNCTIONS (non-AI)
// ═══════════════════════════════════════════════════════════════

// User management
const { ensureUserProfile } = require("./core/userData");
exports.ensureUserProfile = ensureUserProfile;

// Data operations
const { loadData, saveData, moveToTrash, restoreFromTrash } = require("./core/dataOps");
exports.loadData = loadData;
exports.saveData = saveData;
exports.moveToTrash = moveToTrash;
exports.restoreFromTrash = restoreFromTrash;

// Handover operations
const { sendPatient, checkInbox, acceptInboxPatient, declineInboxPatient } = require("./core/handover");
exports.sendPatient = sendPatient;
exports.checkInbox = checkInbox;
exports.acceptInboxPatient = acceptInboxPatient;
exports.declineInboxPatient = declineInboxPatient;

// Admin operations
const { exportUserData, deleteAccount } = require("./core/admin");
exports.exportUserData = exportUserData;
exports.deleteAccount = deleteAccount;

// Scheduled functions
const { cleanupTrash } = require("./core/scheduled");
exports.cleanupTrash = cleanupTrash;
