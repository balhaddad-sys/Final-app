/**
 * ═══════════════════════════════════════════════════════════════════
 * MEDWARD PRO - GOOGLE APPS SCRIPT BACKEND v2.1
 * ═══════════════════════════════════════════════════════════════════
 * 
 * NEW IN v2.1:
 * - Added getDrugInfo action for AI-powered drug information
 * - Patient-specific warnings based on diagnosis and other medications
 * - Drug interaction checking
 * 
 * SETUP INSTRUCTIONS:
 * 
 * 1. Create a new Google Apps Script project at script.google.com
 * 2. Delete any existing code and paste this entire file
 * 3. Set up Script Properties:
 *    - Click ⚙️ Project Settings (gear icon on left)
 *    - Scroll to "Script Properties"
 *    - Click "Add script property"
 *    - Add: CLAUDE_API_KEY = sk-ant-api03-xxxxx (your Anthropic key)
 *    - Add: SHEET_ID = (optional - Google Sheet ID for data storage)
 * 4. Run the testSetup() function once to grant permissions
 * 5. Deploy as Web App:
 *    - Click Deploy → New Deployment
 *    - Type: Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Copy the Web App URL to use in MedWard
 * 
 * ═══════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

// OPTION 1: Paste your API key here directly (less secure but works)
const HARDCODED_API_KEY = ''; // Paste your key here if not using Script Properties

// Model Configuration - Use Haiku 3.5 for fast extraction
const CONFIG = {
  MODEL: 'claude-haiku-4-5-20251001',   // Haiku 4.5
  MAX_TOKENS: 4096,
  TEMPERATURE: 0  // Deterministic output for medical data
};

function getConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    // Try Script Properties first, then fall back to hardcoded
    claudeApiKey: props.getProperty('CLAUDE_API_KEY') || HARDCODED_API_KEY || null,
    sheetId: props.getProperty('SHEET_ID') || null
  };
}

// ═══════════════════════════════════════════════════════════════════
// MAIN ENTRY POINTS
// ═══════════════════════════════════════════════════════════════════

function doPost(e) {
  // Set CORS headers for cross-origin requests
  const output = handleRequest(e);
  return output;
}

function doGet(e) {
  const config = getConfig();
  const response = {
    status: 'MedWard API is running',
    timestamp: new Date().toISOString(),
    hasApiKey: !!config.claudeApiKey,
    hasSheetId: !!config.sheetId
  };
  return createResponse(response);
}

function handleRequest(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createResponse({ success: false, error: 'No data received' });
    }
    
    // DEBUG: Log raw request
    Logger.log('═══ RAW POST DATA ═══');
    Logger.log(e.postData.contents.substring(0, 500));
    
    const request = JSON.parse(e.postData.contents);
    const action = request.action;
    
    Logger.log('═══ MedWard Request ═══');
    Logger.log('Action: ' + action);
    Logger.log('Request keys: ' + Object.keys(request).join(', '));
    
    let result;
    
    // For analyze calls, use payload if present, otherwise use request directly
    const analyzeData = request.payload || request;
    
    switch (action) {
      case 'saveData':
        result = saveData(request.payload);
        break;
        
      case 'loadData':
        result = loadData();
        break;
        
      case 'analyzeLabsEnhanced':
      case 'analyzeLabs':  // Alias for compatibility
        result = analyzeLabsWithClaude(analyzeData);
        break;
        
      case 'analyzeMeds':
        result = analyzeMedsWithClaude(analyzeData);
        break;
        
      case 'analyzeDocument':
        result = analyzeDocumentWithClaude(analyzeData);
        break;
        
      case 'extractPatients':
        result = extractPatientsWithClaude(analyzeData);
        break;
        
      case 'loadFromSheet':
        result = loadPatientsFromSheet(request);
        break;
        
      case 'saveToSheet':
        result = savePatientsToSheet(request);
        break;
        
      case 'getDrugInfo':
        result = getDrugInfoWithClaude(analyzeData);
        break;
        
      case 'ping':
        result = { success: true, message: 'pong', timestamp: new Date().toISOString() };
        break;
        
      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }
    
    Logger.log('Result success: ' + result.success);
    return createResponse(result);
    
  } catch (error) {
    Logger.log('ERROR: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    return createResponse({
      success: false,
      error: error.toString()
    });
  }
}

// Create proper JSON response with CORS support
function createResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ═══════════════════════════════════════════════════════════════════
// DATA STORAGE (Script Properties)
// ═══════════════════════════════════════════════════════════════════

function saveData(payload) {
  try {
    const props = PropertiesService.getScriptProperties();
    
    // Store main data
    props.setProperty('medward_data', JSON.stringify(payload));
    
    // Also backup to Sheet if configured
    const config = getConfig();
    if (config.sheetId && payload.patients) {
      try {
        backupPatientsToSheet(payload.patients);
      } catch (sheetError) {
        Logger.log('Sheet backup failed: ' + sheetError);
      }
    }
    
    return {
      success: true,
      timestamp: new Date().toISOString(),
      message: 'Data saved successfully'
    };
  } catch (error) {
    return { success: false, error: 'Save failed: ' + error.toString() };
  }
}

function loadData() {
  try {
    const props = PropertiesService.getScriptProperties();
    const data = props.getProperty('medward_data');
    
    if (data) {
      return {
        success: true,
        data: JSON.parse(data)
      };
    }
    
    return {
      success: true,
      data: { units: [], patients: [], settings: {} }
    };
  } catch (error) {
    return { success: false, error: 'Load failed: ' + error.toString() };
  }
}

// ═══════════════════════════════════════════════════════════════════
// GOOGLE SHEETS INTEGRATION
// ═══════════════════════════════════════════════════════════════════

function loadPatientsFromSheet(request) {
  try {
    const config = getConfig();
    let sheet;
    
    if (config.sheetId) {
      const ss = SpreadsheetApp.openById(config.sheetId);
      sheet = ss.getSheetByName('Patients') || ss.getSheets()[0];
    } else {
      // Try active spreadsheet if no ID configured
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      if (!ss) {
        return { success: false, error: 'No Sheet ID configured. Add SHEET_ID to Script Properties.' };
      }
      sheet = ss.getSheetByName('Patients') || ss.getSheets()[0];
    }
    
    const data = sheet.getDataRange().getValues();
    
    if (data.length < 2) {
      return { success: true, patients: [], message: 'Sheet is empty' };
    }
    
    // First row is headers
    const headers = data[0].map(h => String(h).toLowerCase().trim());
    
    // Map rows to patient objects
    const patients = data.slice(1).map((row, index) => {
      const patient = {
        id: Date.now() + index,
        name: '',
        room: '',
        ward: '',
        diagnosis: '',
        doctor: '',
        status: 'active'
      };
      
      headers.forEach((header, i) => {
        const value = row[i] || '';
        
        if (header.includes('name') || header.includes('patient')) {
          patient.name = String(value);
        } else if (header.includes('room') || header.includes('bed')) {
          patient.room = String(value);
        } else if (header.includes('ward')) {
          patient.ward = String(value);
        } else if (header.includes('diagnosis') || header.includes('dx')) {
          patient.diagnosis = String(value);
        } else if (header.includes('doctor') || header.includes('physician') || header.includes('assigned')) {
          patient.doctor = String(value);
        } else if (header.includes('status')) {
          patient.status = String(value).toLowerCase().includes('chronic') ? 'chronic' : 'active';
        }
      });
      
      return patient;
    }).filter(p => p.name); // Only return patients with names
    
    Logger.log('Loaded ' + patients.length + ' patients from Sheet');
    
    return {
      success: true,
      patients: patients,
      source: 'google_sheet'
    };
    
  } catch (error) {
    return { success: false, error: 'Sheet load failed: ' + error.toString() };
  }
}

function savePatientsToSheet(request) {
  try {
    const patients = request.patients || [];
    return backupPatientsToSheet(patients);
  } catch (error) {
    return { success: false, error: 'Sheet save failed: ' + error.toString() };
  }
}

function backupPatientsToSheet(patients) {
  const config = getConfig();
  if (!config.sheetId) {
    return { success: false, error: 'No SHEET_ID configured' };
  }
  
  try {
    const ss = SpreadsheetApp.openById(config.sheetId);
    let sheet = ss.getSheetByName('Patients');
    
    if (!sheet) {
      sheet = ss.insertSheet('Patients');
    }
    
    // Clear and write headers
    sheet.clear();
    const headers = ['Name', 'Room', 'Ward', 'Diagnosis', 'Doctor', 'Status', 'Last Updated'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Write patient data
    if (patients.length > 0) {
      const rows = patients.map(p => [
        p.name || '',
        p.room || '',
        p.ward || '',
        p.diagnosis || '',
        p.doctor || '',
        p.status || 'active',
        new Date().toISOString()
      ]);
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }
    
    return {
      success: true,
      message: 'Saved ' + patients.length + ' patients to Sheet'
    };
    
  } catch (error) {
    return { success: false, error: 'Sheet backup failed: ' + error.toString() };
  }
}

// ═══════════════════════════════════════════════════════════════════
// CLAUDE AI INTEGRATION
// ═══════════════════════════════════════════════════════════════════

function callClaudeAPI(imageBase64, mediaType, prompt) {
  const config = getConfig();
  
  if (!config.claudeApiKey) {
    throw new Error('CLAUDE_API_KEY not configured. Go to Project Settings → Script Properties and add it.');
  }
  
  const model = CONFIG.MODEL;
  
  Logger.log('Calling Claude API with model: ' + model);
  Logger.log('API Key: ' + config.claudeApiKey.substring(0, 15) + '...');
  
  // Prepare image data - strip data URL prefix if present
  let base64Data = imageBase64;
  let mimeType = mediaType || 'image/jpeg';
  
  if (imageBase64.startsWith('data:')) {
    const matches = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      mimeType = matches[1];
      base64Data = matches[2];
    }
  }
  
  // Check payload size (Apps Script limit is ~50MB but API has limits too)
  const payloadSizeKB = Math.round(base64Data.length * 0.75 / 1024);
  Logger.log('Image payload size: ' + payloadSizeKB + ' KB');
  
  if (payloadSizeKB > 5000) {
    throw new Error('Image too large (' + payloadSizeKB + 'KB). Please compress to under 5MB.');
  }
  
  const payload = {
    model: model,
    max_tokens: CONFIG.MAX_TOKENS,
    temperature: CONFIG.TEMPERATURE,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mimeType,
            data: base64Data
          }
        },
        {
          type: 'text',
          text: prompt
        }
      ]
    }]
  };
  
  const startTime = new Date().getTime();
  
  const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    headers: {
      'x-api-key': config.claudeApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  
  const elapsed = new Date().getTime() - startTime;
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();
  
  Logger.log('Claude response code: ' + responseCode + ' (took ' + elapsed + 'ms)');
  
  if (responseCode !== 200) {
    Logger.log('Claude error response: ' + responseText.substring(0, 500));
    throw new Error('Claude API error ' + responseCode + ': ' + responseText.substring(0, 200));
  }
  
  const result = JSON.parse(responseText);
  
  if (!result.content || !result.content[0] || !result.content[0].text) {
    throw new Error('Invalid response from Claude');
  }
  
  Logger.log('Response received in ' + elapsed + 'ms');
  return result.content[0].text;
}

function parseJSONFromAI(text) {
  if (!text) {
    Logger.log('parseJSONFromAI: text is null/empty');
    return null;
  }
  
  Logger.log('parseJSONFromAI input length: ' + text.length);
  Logger.log('First 100 chars: ' + text.substring(0, 100));
  
  // CLEAN APPROACH: Remove markdown code blocks globally
  var cleanText = text
    .replace(/```json/gi, '')  // Remove ```json
    .replace(/```/g, '')       // Remove remaining ```
    .trim();
  
  Logger.log('After cleaning, first 100 chars: ' + cleanText.substring(0, 100));
  
  // Try direct parse first
  try {
    var result = JSON.parse(cleanText);
    Logger.log('parseJSONFromAI: Direct parse SUCCESS!');
    return result;
  } catch (e1) {
    Logger.log('Direct parse failed: ' + e1.message);
    
    // Fallback: Extract JSON object between first { and last }
    var firstBrace = cleanText.indexOf('{');
    var lastBrace = cleanText.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      var jsonStr = cleanText.substring(firstBrace, lastBrace + 1);
      Logger.log('Trying brace extraction...');
      
      try {
        var result2 = JSON.parse(jsonStr);
        Logger.log('parseJSONFromAI: Brace extraction SUCCESS!');
        return result2;
      } catch (e2) {
        Logger.log('Brace extraction failed: ' + e2.message);
      }
    }
    
    Logger.log('parseJSONFromAI: ALL METHODS FAILED');
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// LAB ANALYSIS
// ═══════════════════════════════════════════════════════════════════

function analyzeLabsWithClaude(request) {
  try {
    // Guard against undefined request
    if (!request) {
      Logger.log('ERROR: request is undefined/null');
      return { success: false, error: 'Missing request body/payload' };
    }
    
    Logger.log('analyzeLabsWithClaude called with keys: ' + Object.keys(request).join(', '));
    
    // Handle both 'images' array and single 'image' property
    let images = [];
    if (request.images && Array.isArray(request.images) && request.images.length > 0) {
      images = request.images;
    } else if (request.image) {
      images = [request.image];
    }
    
    if (images.length === 0 || !images[0]) {
      Logger.log('No images found in request. Keys: ' + Object.keys(request).join(', '));
      return { success: false, error: 'No images provided' };
    }
    
    Logger.log('Analyzing ' + images.length + ' lab image(s)');
    Logger.log('First image length: ' + (images[0] ? images[0].length : 0));
    
    // Use custom prompt if provided, otherwise use Kuwait MOH optimized prompt
    const prompt = request.extractionPrompt || `You are an expert medical laboratory report OCR system specializing in Kuwait Ministry of Health (MOH) lab reports.

ANALYZE THIS LAB REPORT IMAGE AND EXTRACT ALL DATA.

KUWAIT MOH FORMAT RECOGNITION:
1. Header: Ministry of Health logo, Hospital name, Patient info box
2. Main Results Table: Test Description, Result Value, Reference Range, Unit
3. "H" or "HH" flags = HIGH, "L" or "LL" flags = LOW
4. PATIENT CUMULATIVE REPORT section at bottom shows historical values across multiple dates

EXTRACT EVERY SINGLE LAB VALUE YOU CAN SEE. Common parameters:

HEMATOLOGY:
- PT (Prothrombin Time) - seconds, ref: 9.6-13.6
- PT INR - ratio, ref: 0.85-1.15
- APTT - seconds, ref: 25-37

BIOCHEMISTRY:
- Glucose (Gluc) - mmol/L, ref: 4.1-5.6
- Urea - mmol/L, ref: 2.8-7.2
- Creatinine (Creat) - μmol/L, ref: 64-104
- Sodium (Na) - mmol/L, ref: 136-146
- Potassium (K) - mmol/L, ref: 3.5-5.1
- Chloride (CL) - mmol/L, ref: 98-107
- CO2 - mmol/L, ref: 22-29
- Calcium (Ca) - mmol/L
- Phosphorus (Phos) - mmol/L
- Magnesium (Mg) - mmol/L
- Total Protein (T.Protein) - g/L
- Albumin - g/L
- Uric Acid (Urate) - μmol/L
- eGFR - mL/min/1.73m²

LIVER FUNCTION:
- Total Bilirubin (T.Bil) - μmol/L, ref: 3.4-20.5
- Direct Bilirubin (D.Bil) - μmol/L
- Alkaline Phosphatase (Alk.Phos) - IU/L
- GGT - IU/L, ref: 10-71
- ALT - IU/L, ref: 0-50
- AST - IU/L, ref: 0-50

CARDIAC MARKERS:
- NT-proBNP - pg/ml (age-specific cutoffs for HF)
- HS Troponin I - ng/L, ref: 0-19.8 (CRITICAL if very high)

IMPORTANT: 
- Parse the CUMULATIVE REPORT table to get historical values with their dates
- Date format is DD/MM/YYYY HH:MM:SS - convert to YYYY-MM-DD
- Include ALL dates and ALL values for trending

Return ONLY valid JSON:
{
  "dates": ["2026-01-16", "2026-01-15", "2026-01-14"],
  "parameters": [
    {
      "name": "Hemoglobin",
      "abbrev": "Hb",
      "unit": "g/dL",
      "refMin": 12.0,
      "refMax": 16.0,
      "refRange": "12.0-16.0",
      "values": [
        {"date": "2026-01-16", "value": "12.5", "status": "normal"},
        {"date": "2026-01-15", "value": "11.8", "status": "low"}
      ]
    }
  ],
  "interpretation": {
    "summary": "Brief clinical summary",
    "criticalFindings": ["Any critical values"],
    "trends": ["Notable trends like improving/worsening kidney function"],
    "recommendations": ["Clinical recommendations"]
  },
  "confidence": 0.9
}

NO MARKDOWN CODE BLOCKS. NO BACKTICKS. NO \`\`\`json. JUST THE RAW JSON OBJECT STARTING WITH { AND ENDING WITH }`;
    
    const aiText = callClaudeAPI(images[0], 'image/jpeg', prompt);
    
    // DEBUG: Log raw AI response
    Logger.log('=== RAW AI RESPONSE ===');
    Logger.log(aiText ? aiText.substring(0, 2000) : 'NULL RESPONSE');
    
    const parsed = parseJSONFromAI(aiText);
    
    // DEBUG: Log parsed object structure
    Logger.log('=== PARSED OBJECT ===');
    Logger.log('parsed is null: ' + (parsed === null));
    if (parsed) {
      Logger.log('parsed keys: ' + Object.keys(parsed).join(', '));
      Logger.log('has labData: ' + !!parsed.labData);
      Logger.log('has parameters: ' + !!parsed.parameters);
      if (parsed.labData) {
        Logger.log('labData keys: ' + Object.keys(parsed.labData).join(', '));
        Logger.log('labData.parameters length: ' + (parsed.labData.parameters ? parsed.labData.parameters.length : 'N/A'));
      }
      if (parsed.parameters) {
        Logger.log('parameters length: ' + parsed.parameters.length);
      }
    }
    
    if (!parsed) {
      Logger.log('Failed to parse AI response');
      Logger.log('Raw response: ' + (aiText || '').substring(0, 1000));
      
      // More debug info
      var firstBrace = (aiText || '').indexOf('{');
      var lastBrace = (aiText || '').lastIndexOf('}');
      
      // FALLBACK: Return raw text for debugging
      return {
        success: false,
        error: 'Could not parse lab results from AI response',
        debug: {
          rawResponsePreview: (aiText || '').substring(0, 500),
          rawResponseLength: (aiText || '').length,
          firstBraceAt: firstBrace,
          lastBraceAt: lastBrace,
          extractedPreview: firstBrace !== -1 && lastBrace > firstBrace ? (aiText || '').substring(firstBrace, Math.min(firstBrace + 100, lastBrace + 1)) : 'N/A'
        }
      };
    }
    
    // SCHEMA NORMALIZATION: Handle both nested (labData.parameters) and flat (parameters) responses
    // The frontend prompt asks for nested { labData: { parameters: [...] } }
    // But we need to handle if AI returns flat { parameters: [...] } too
    const extracted = (parsed.labData && parsed.labData.parameters) ? parsed.labData : parsed;
    
    Logger.log('=== EXTRACTION RESULT ===');
    Logger.log('Schema type: ' + (parsed.labData ? 'nested' : 'flat'));
    Logger.log('extracted.parameters length: ' + (extracted.parameters ? extracted.parameters.length : 0));
    if (extracted.parameters && extracted.parameters[0]) {
      Logger.log('First param: ' + JSON.stringify(extracted.parameters[0]).substring(0, 200));
    }
    
    return {
      success: true,
      labData: {
        dates: extracted.dates || [new Date().toISOString().split('T')[0]],
        parameters: extracted.parameters || [],
        interpretation: extracted.interpretation || null
      },
      confidence: parsed.confidence || extracted.confidence || 0.85,
      patientInfo: parsed.patientInfo || null,
      meta: {
        imagesProcessed: images.length
      }
    };
    
  } catch (error) {
    Logger.log('Lab analysis error: ' + error);
    Logger.log('Stack: ' + error.stack);
    return { success: false, error: error.toString() };
  }
}

// ═══════════════════════════════════════════════════════════════════
// PATIENT EXTRACTION FROM IMAGES
// ═══════════════════════════════════════════════════════════════════

function extractPatientsWithClaude(request) {
  try {
    const image = request.image;
    
    if (!image) {
      return { success: false, error: 'No image provided' };
    }
    
    Logger.log('Extracting patients from ward list image...');
    
    const prompt = `You are a clinical data analyst. Extract ALL patients from this hospital ward list/spreadsheet image.

Return ONLY a valid JSON object (no markdown, no explanation):

{
  "patients": [
    {
      "name": "Patient Name",
      "room": "Room/Bed (e.g., 1-13, 18-2, ER)",
      "ward": "Ward name (e.g., Ward 14, Ward 20, ICU)",
      "diagnosis": "Primary diagnosis",
      "doctor": "Assigned doctor",
      "status": "active or chronic"
    }
  ],
  "confidence": 0.9
}

IMPORTANT:
- Extract EVERY patient visible
- Handle Arabic names correctly
- "status" should be "chronic" if from chronic list section, otherwise "active"
- If a field is not visible, use empty string ""
- Parse all sections: Male list, Female list, Chronic list`;
    
    const aiText = callClaudeAPI(image, 'image/jpeg', prompt);
    const parsed = parseJSONFromAI(aiText);
    
    if (!parsed || !parsed.patients) {
      return {
        success: false,
        error: 'Could not extract patients from image'
      };
    }
    
    Logger.log('Extracted ' + parsed.patients.length + ' patients');
    
    return {
      success: true,
      patients: parsed.patients,
      confidence: parsed.confidence || 0.85
    };
    
  } catch (error) {
    Logger.log('Patient extraction error: ' + error);
    return { success: false, error: error.toString() };
  }
}

// ═══════════════════════════════════════════════════════════════════
// MEDICATION ANALYSIS
// ═══════════════════════════════════════════════════════════════════

function analyzeMedsWithClaude(request) {
  try {
    const image = request.image;
    
    if (!image) {
      return { success: false, error: 'No image provided' };
    }
    
    const prompt = `Extract all medications from this prescription/medication list image.

Return ONLY valid JSON:
{
  "medications": [
    {
      "name": "Drug Name",
      "dose": "500mg",
      "frequency": "BID",
      "route": "PO",
      "indication": "reason if visible"
    }
  ],
  "confidence": 0.9
}`;
    
    const aiText = callClaudeAPI(image, 'image/jpeg', prompt);
    const parsed = parseJSONFromAI(aiText);
    
    return {
      success: true,
      medications: parsed?.medications || []
    };
    
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// ═══════════════════════════════════════════════════════════════════
// DOCUMENT ANALYSIS
// ═══════════════════════════════════════════════════════════════════

function analyzeDocumentWithClaude(request) {
  try {
    const image = request.image;
    
    if (!image) {
      return { success: false, error: 'No image provided' };
    }
    
    const prompt = `Analyze this clinical document image and provide a summary.

Return ONLY valid JSON:
{
  "type": "progress_note|consult|referral|discharge|other",
  "summary": "Brief summary of content",
  "keyFindings": ["Important findings"],
  "recommendations": ["Recommendations mentioned"],
  "date": "Date if visible",
  "author": "Author if visible"
}`;
    
    const aiText = callClaudeAPI(image, 'image/jpeg', prompt);
    const parsed = parseJSONFromAI(aiText);
    
    return {
      success: true,
      document: parsed || { summary: aiText }
    };
    
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// ═══════════════════════════════════════════════════════════════════
// AI-POWERED DRUG INFORMATION - Learn More Feature
// ═══════════════════════════════════════════════════════════════════

function getDrugInfoWithClaude(request) {
  try {
    const drugName = request.drugName;
    const patientContext = request.patientContext || {};
    const indication = request.indication || '';
    
    if (!drugName) {
      return { success: false, error: 'No drug name provided' };
    }
    
    Logger.log('Getting drug info for: ' + drugName);
    Logger.log('Patient context: ' + JSON.stringify(patientContext).substring(0, 200));
    
    const prompt = `You are a clinical pharmacist AI assistant providing drug information for healthcare professionals.

DRUG: ${drugName}
INDICATION: ${indication || 'Not specified'}

PATIENT CONTEXT:
- Diagnosis: ${patientContext.diagnosis || 'Not specified'}
- Other Medications: ${(patientContext.medications || []).join(', ') || 'None listed'}
- Recent Lab Values: ${JSON.stringify(patientContext.labData || [])}

Provide comprehensive, clinically relevant drug information. Focus on practical considerations for this specific patient context.

Return ONLY valid JSON (no markdown, no explanation):
{
  "warnings": [
    {"icon": "🫘", "text": "Warning text relevant to patient's condition"},
    {"icon": "⚡", "text": "Another warning"}
  ],
  "interactions": ["Drug interaction with X - clinical significance"],
  "mechanism": "Clear explanation of how the drug works, 2-3 sentences",
  "sideEffects": [
    "Common: nausea, headache (10-20%)",
    "Less common: dizziness (5%)",
    "Rare but serious: condition to watch for"
  ],
  "contraindications": [
    "Absolute: severe renal impairment (eGFR <30)",
    "Relative: pregnancy category C"
  ],
  "monitoring": [
    "Check renal function at baseline and periodically",
    "Monitor for signs of X"
  ]
}

IMPORTANT:
- Be specific and clinically actionable
- Include percentages/frequencies where relevant
- Highlight any concerns based on patient's OTHER medications
- Highlight any concerns based on patient's DIAGNOSIS
- If patient has relevant lab values, comment on them
- Use appropriate medical terminology
- Keep each item concise but informative`;

    const config = getConfig();
    
    if (!config.claudeApiKey) {
      return { success: false, error: 'API key not configured' };
    }
    
    // Call Claude API (text-only, no image)
    const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      headers: {
        'x-api-key': config.claudeApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      payload: JSON.stringify({
        model: CONFIG.MODEL,
        max_tokens: CONFIG.MAX_TOKENS,
        messages: [{
          role: 'user',
          content: prompt
        }]
      }),
      muteHttpExceptions: true
    });
    
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    Logger.log('Claude API response code: ' + responseCode);
    
    if (responseCode !== 200) {
      Logger.log('API Error: ' + responseText.substring(0, 300));
      return { success: false, error: 'API error: ' + responseCode };
    }
    
    const result = JSON.parse(responseText);
    const aiText = result.content?.[0]?.text || '';
    
    Logger.log('AI Response length: ' + aiText.length);
    
    // Parse the JSON response
    const parsed = parseJSONFromAI(aiText);
    
    if (!parsed) {
      Logger.log('Failed to parse drug info response');
      return { 
        success: false, 
        error: 'Could not parse drug information',
        raw: aiText.substring(0, 500)
      };
    }
    
    return {
      success: true,
      warnings: parsed.warnings || [],
      interactions: parsed.interactions || [],
      mechanism: parsed.mechanism || 'Information not available.',
      sideEffects: parsed.sideEffects || [],
      contraindications: parsed.contraindications || [],
      monitoring: parsed.monitoring || []
    };
    
  } catch (error) {
    Logger.log('Drug info error: ' + error);
    Logger.log('Stack: ' + error.stack);
    return { success: false, error: error.toString() };
  }
}

// ═══════════════════════════════════════════════════════════════════
// SETUP & TESTING
// ═══════════════════════════════════════════════════════════════════

function testSetup() {
  Logger.log('═══════════════════════════════════════════');
  Logger.log('MedWard API Setup Test');
  Logger.log('═══════════════════════════════════════════');
  
  const config = getConfig();
  
  // Check API Key
  if (config.claudeApiKey) {
    Logger.log('✅ CLAUDE_API_KEY found: ' + config.claudeApiKey.substring(0, 15) + '...');
    
    // Test Claude API
    try {
      const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
        method: 'post',
        headers: {
          'x-api-key': config.claudeApiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        payload: JSON.stringify({
          model: CONFIG.MODEL,
          max_tokens: 50,
          messages: [{ role: 'user', content: 'Say "API OK" in 2 words' }]
        }),
        muteHttpExceptions: true
      });
      
      if (response.getResponseCode() === 200) {
        Logger.log('✅ Claude API connection successful!');
      } else {
        Logger.log('❌ Claude API error: ' + response.getResponseCode());
        Logger.log(response.getContentText().substring(0, 200));
      }
    } catch (e) {
      Logger.log('❌ Claude API test failed: ' + e);
    }
  } else {
    Logger.log('❌ CLAUDE_API_KEY not found!');
    Logger.log('   → Go to Project Settings (⚙️) → Script Properties');
    Logger.log('   → Add: CLAUDE_API_KEY = your-api-key');
  }
  
  // Check Sheet ID
  if (config.sheetId) {
    Logger.log('✅ SHEET_ID found: ' + config.sheetId);
    try {
      const ss = SpreadsheetApp.openById(config.sheetId);
      Logger.log('✅ Sheet accessible: ' + ss.getName());
    } catch (e) {
      Logger.log('❌ Cannot access Sheet: ' + e);
    }
  } else {
    Logger.log('ℹ️ SHEET_ID not configured (optional)');
  }
  
  // Test data storage
  try {
    const testSave = saveData({ test: true, timestamp: new Date().toISOString() });
    Logger.log('✅ Data storage: ' + (testSave.success ? 'Working' : 'Failed'));
  } catch (e) {
    Logger.log('❌ Data storage test failed: ' + e);
  }
  
  Logger.log('═══════════════════════════════════════════');
  Logger.log('Setup test complete!');
  Logger.log('═══════════════════════════════════════════');
}

// Run this to check everything is configured
function checkConfig() {
  const config = getConfig();
  return {
    hasApiKey: !!config.claudeApiKey,
    apiKeyPrefix: config.claudeApiKey ? config.claudeApiKey.substring(0, 10) : 'NOT SET',
    hasSheetId: !!config.sheetId
  };
}
