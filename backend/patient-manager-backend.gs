/**
 * MedWard Patient Manager - Backend v2.0
 * Fixed parsing for the actual sheet structure
 *
 * SHEET STRUCTURE:
 * Row 1: Date header (Thursday, 15th January 2026)
 * Row 3: "Male list (active)" section header
 * Row 4: Column headers (Room/Ward, Patient name, Diagnosis, Assigned Doctor, Status)
 * Row 5+: Ward sections with patients
 *
 * Ward sections start with "Ward X" or "ICU" or "ER" in column A
 * Chronic section starts with "(Chronic list)"
 */

const SHEET_ID = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
const SHEET_NAME = 'Unit e'; // Change if your sheet has a different name

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    let response;
    switch(action) {
      case 'getPatients':
        response = getPatients(data);
        break;
      case 'getWards':
        response = getWards();
        break;
      case 'addPatient':
        response = addPatient(data);
        break;
      case 'updatePatient':
        response = updatePatient(data);
        break;
      case 'deletePatient':
        response = deletePatient(data);
        break;
      case 'dischargePatient':
        response = dischargePatient(data);
        break;
      case 'getDoctors':
        response = getDoctors();
        break;
      case 'getSheetUrl':
        response = getSheetUrl();
        break;
      case 'updateDateHeader':
        response = updateDateHeader();
        break;
      default:
        response = { success: false, error: 'Unknown action: ' + action };
    }

    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('Error: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  // Auto-update date header on any GET request
  try {
    updateDateHeader();
  } catch(e) {}

  return ContentService.createTextOutput(JSON.stringify({
    status: 'MedWard Patient Manager API v2.0',
    sheetId: SHEET_ID ? 'configured' : 'missing'
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Get the Google Sheet URL for direct access
 */
function getSheetUrl() {
  return {
    success: true,
    url: 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/edit'
  };
}

/**
 * Update the date header to today's date
 */
function updateDateHeader() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];

  const today = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];

  const dayName = days[today.getDay()];
  const day = today.getDate();
  const month = months[today.getMonth()];
  const year = today.getFullYear();

  // Add ordinal suffix
  const ordinal = (d) => {
    if (d > 3 && d < 21) return 'th';
    switch (d % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  const dateString = `${dayName}, ${day}${ordinal(day)} ${month} ${year}`;

  // Update cell B1 (or wherever your date is)
  sheet.getRange('B1').setValue(dateString);

  return {
    success: true,
    date: dateString
  };
}

/**
 * Parse the sheet and get all patients with proper structure
 */
function getPatients(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  const values = sheet.getDataRange().getValues();

  const patients = [];
  let currentWard = '';
  let currentSection = 'active'; // 'active' or 'chronic'
  let inDataSection = false;

  // Skip patterns - these are NOT patients
  const skipPatterns = [
    /^male list/i,
    /^female list/i,
    /^\(chronic/i,
    /^chronic list/i,
    /^room\s*\/?\s*ward/i,
    /^patient\s*name/i,
    /^diagnosis/i,
    /^assigned/i,
    /^status/i,
    /^er\/unassigned/i,
    /^unassigned/i,
    /monday|tuesday|wednesday|thursday|friday|saturday|sunday/i,
    /january|february|march|april|may|june|july|august|september|october|november|december/i
  ];

  // Ward patterns
  const wardPatterns = [
    /^ward\s*\d+/i,
    /^icu$/i,
    /^er$/i,
    /^ER\/Unassigned$/i
  ];

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const colA = row[0] ? row[0].toString().trim() : '';
    const colB = row[1] ? row[1].toString().trim() : '';

    // Check for chronic section
    if (colA.toLowerCase().includes('chronic') || colB.toLowerCase().includes('chronic')) {
      currentSection = 'chronic';
      continue;
    }

    // Check for ward header
    let isWardHeader = false;
    for (const pattern of wardPatterns) {
      if (pattern.test(colA)) {
        currentWard = colA;
        inDataSection = true;
        isWardHeader = true;
        break;
      }
    }
    if (isWardHeader) continue;

    // Check for ER/Unassigned section
    if (colA.toLowerCase().includes('er/unassigned') || colA.toLowerCase() === 'er') {
      currentWard = 'ER/Unassigned';
      inDataSection = true;
      continue;
    }

    // Skip non-data rows
    let shouldSkip = false;
    for (const pattern of skipPatterns) {
      if (pattern.test(colA) || pattern.test(colB)) {
        shouldSkip = true;
        break;
      }
    }
    if (shouldSkip) continue;

    // Skip empty rows
    if (!colB) continue;

    // Skip if no ward assigned yet
    if (!currentWard) continue;

    // This is a patient row
    const roomBed = colA;
    const patientName = colB;
    const diagnosis = row[2] ? row[2].toString().trim() : '';
    const assignedDoctor = row[3] ? row[3].toString().trim() : '';
    const statusFromSheet = row[4] ? row[4].toString().trim() : '';

    // Determine status
    let status = statusFromSheet || (currentSection === 'chronic' ? 'Chronic' : 'Non-Chronic');

    patients.push({
      rowIndex: i + 1, // 1-indexed for Sheets API
      ward: currentWard,
      roomBed: roomBed,
      patientName: patientName,
      diagnosis: diagnosis,
      assignedDoctor: assignedDoctor,
      status: status,
      section: currentSection
    });
  }

  // Apply filters
  let filtered = patients;

  if (data.ward && data.ward !== '') {
    filtered = filtered.filter(p =>
      p.ward.toLowerCase().includes(data.ward.toLowerCase())
    );
  }

  if (data.doctor && data.doctor !== '') {
    filtered = filtered.filter(p =>
      p.assignedDoctor.toLowerCase().includes(data.doctor.toLowerCase())
    );
  }

  if (data.status && data.status !== '') {
    if (data.status.toLowerCase() === 'chronic') {
      filtered = filtered.filter(p => p.section === 'chronic');
    } else if (data.status.toLowerCase() === 'active' || data.status.toLowerCase() === 'non-chronic') {
      filtered = filtered.filter(p => p.section === 'active');
    }
  }

  // Group by ward for frontend
  const byWard = {};
  filtered.forEach(p => {
    if (!byWard[p.ward]) byWard[p.ward] = [];
    byWard[p.ward].push(p);
  });

  return {
    success: true,
    patients: filtered,
    patientsByWard: byWard,
    totalCount: filtered.length,
    activeCount: filtered.filter(p => p.section === 'active').length,
    chronicCount: filtered.filter(p => p.section === 'chronic').length,
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Get unique wards from the sheet
 */
function getWards() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  const values = sheet.getDataRange().getValues();

  const wards = [];
  const wardPatterns = [/^ward\s*\d+/i, /^icu$/i, /^er$/i];

  for (let i = 0; i < values.length; i++) {
    const cell = values[i][0];
    if (cell && typeof cell === 'string') {
      const val = cell.trim();
      for (const pattern of wardPatterns) {
        if (pattern.test(val) && !wards.includes(val)) {
          wards.push(val);
          break;
        }
      }
    }
  }

  // Sort wards: Ward 5, Ward 10, Ward 14, etc., then ICU, ER
  wards.sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?.[0] || '999');
    const numB = parseInt(b.match(/\d+/)?.[0] || '999');
    if (numA !== numB) return numA - numB;
    return a.localeCompare(b);
  });

  return {
    success: true,
    wards: wards
  };
}

/**
 * Get unique doctors
 */
function getDoctors() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  const values = sheet.getDataRange().getValues();

  const doctors = new Set();

  for (let i = 0; i < values.length; i++) {
    const doctor = values[i][3]; // Column D
    if (doctor && typeof doctor === 'string') {
      const name = doctor.trim();
      // Skip headers and empty
      if (name &&
          !name.toLowerCase().includes('assigned') &&
          !name.toLowerCase().includes('doctor') &&
          name.length > 1) {
        doctors.add(name);
      }
    }
  }

  return {
    success: true,
    doctors: Array.from(doctors).sort()
  };
}

/**
 * Add a new patient to a ward
 */
function addPatient(data) {
  if (!data.patientName) {
    return { success: false, error: 'Patient name is required' };
  }
  if (!data.ward) {
    return { success: false, error: 'Ward is required' };
  }

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  const values = sheet.getDataRange().getValues();

  // Determine if this is chronic or active
  const isChronicPatient = data.section === 'chronic' || data.status?.toLowerCase() === 'chronic';

  // Find the correct position to insert
  let insertRow = -1;
  let foundTargetWard = false;
  let inChronicSection = false;

  for (let i = 0; i < values.length; i++) {
    const colA = values[i][0] ? values[i][0].toString().trim().toLowerCase() : '';

    // Track chronic section
    if (colA.includes('chronic')) {
      inChronicSection = true;
    }

    // Looking for active patient position
    if (!isChronicPatient && !inChronicSection) {
      if (colA === data.ward.toLowerCase() || colA.includes(data.ward.toLowerCase())) {
        foundTargetWard = true;
        continue;
      }

      // If we found our ward and hit next ward or chronic section, insert before
      if (foundTargetWard) {
        if (colA.includes('ward') || colA === 'icu' || colA === 'er' || colA.includes('chronic')) {
          insertRow = i + 1;
          break;
        }
        // If empty row in our ward section, use it
        if (!values[i][1]) {
          insertRow = i + 1;
          break;
        }
      }
    }

    // Looking for chronic patient position
    if (isChronicPatient && inChronicSection) {
      if (colA === data.ward.toLowerCase() || colA.includes(data.ward.toLowerCase())) {
        foundTargetWard = true;
        continue;
      }

      if (foundTargetWard) {
        if (colA.includes('ward') || colA === 'icu' || colA === 'er') {
          insertRow = i + 1;
          break;
        }
        if (!values[i][1]) {
          insertRow = i + 1;
          break;
        }
      }
    }
  }

  // If no position found, append at end
  if (insertRow === -1) {
    insertRow = sheet.getLastRow() + 1;
  }

  // Insert new row and data
  sheet.insertRowBefore(insertRow);

  const status = isChronicPatient ? 'Chronic' : (data.status || 'Non-Chronic');

  sheet.getRange(insertRow, 1, 1, 5).setValues([[
    data.roomBed || '',
    data.patientName,
    data.diagnosis || '',
    data.assignedDoctor || '',
    status
  ]]);

  return {
    success: true,
    message: 'Patient added successfully',
    rowIndex: insertRow
  };
}

/**
 * Update existing patient
 */
function updatePatient(data) {
  if (!data.rowIndex) {
    return { success: false, error: 'Row index required' };
  }

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];

  const row = parseInt(data.rowIndex);

  // If ward changed, we need to move the patient
  if (data.newWard && data.oldWard && data.newWard !== data.oldWard) {
    // Get current patient data
    const currentData = sheet.getRange(row, 1, 1, 5).getValues()[0];

    // Delete from current location
    sheet.deleteRow(row);

    // Add to new ward
    return addPatient({
      ward: data.newWard,
      roomBed: data.roomBed !== undefined ? data.roomBed : currentData[0],
      patientName: data.patientName !== undefined ? data.patientName : currentData[1],
      diagnosis: data.diagnosis !== undefined ? data.diagnosis : currentData[2],
      assignedDoctor: data.assignedDoctor !== undefined ? data.assignedDoctor : currentData[3],
      status: data.status !== undefined ? data.status : currentData[4],
      section: data.section
    });
  }

  // Simple update without ward change
  if (data.roomBed !== undefined) sheet.getRange(row, 1).setValue(data.roomBed);
  if (data.patientName !== undefined) sheet.getRange(row, 2).setValue(data.patientName);
  if (data.diagnosis !== undefined) sheet.getRange(row, 3).setValue(data.diagnosis);
  if (data.assignedDoctor !== undefined) sheet.getRange(row, 4).setValue(data.assignedDoctor);
  if (data.status !== undefined) sheet.getRange(row, 5).setValue(data.status);

  return {
    success: true,
    message: 'Patient updated'
  };
}

/**
 * Delete patient (remove row)
 */
function deletePatient(data) {
  if (!data.rowIndex) {
    return { success: false, error: 'Row index required' };
  }

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];

  sheet.deleteRow(parseInt(data.rowIndex));

  return {
    success: true,
    message: 'Patient removed'
  };
}

/**
 * Discharge patient (move to discharged or just delete)
 */
function dischargePatient(data) {
  // For now, same as delete. Could move to a "Discharged" sheet later
  return deletePatient(data);
}

// Test function
function testGetPatients() {
  const result = getPatients({});
  Logger.log(JSON.stringify(result, null, 2));
}

function testGetWards() {
  const result = getWards();
  Logger.log(JSON.stringify(result, null, 2));
}
