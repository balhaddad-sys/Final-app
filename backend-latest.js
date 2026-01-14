/**
 * MedWard Master - Backend API (Enhanced with Vision AI)
 * Google Apps Script Web App
 *
 * SETUP INSTRUCTIONS:
 * 1. Copy this code to script.google.com
 * 2. Add Script Properties (File > Project properties > Script properties):
 *    - ANTHROPIC_API_KEY = your_anthropic_key (for Claude Vision - RECOMMENDED)
 *    - OPENAI_API_KEY = your_openai_key (for GPT-4 Vision - optional fallback)
 *    - AI_PROVIDER = 'claude' or 'openai' (optional, defaults to claude)
 * 3. Enable Google Drive API (Services > Drive API)
 * 4. Deploy as Web App:
 *    - Execute as: Me (your account with Drive access)
 *    - Who has access: Anyone (for public access) or Anyone with Google account
 * 5. Copy the deployment URL to js/app.js CONFIG.BACKEND_URL
 *
 * RECOMMENDED WORKFLOW (avoids base64 size limits):
 * 1. Frontend calls 'uploadImage' action → uploads to Google Drive → returns fileId
 * 2. Frontend calls 'interpret' action with fileId (not base64)
 * 3. Backend downloads from Drive, processes with Vision AI
 *
 * LEGACY WORKFLOW (has size limitations):
 * - Frontend can still send base64 directly to 'interpret' action
 * - Limited to ~50KB due to URL/payload size restrictions
 * - Use Drive workflow for production
 */

// Configuration
const CONFIG = {
  OPENAI_TEXT_MODEL: 'gpt-4',
  OPENAI_VISION_MODEL: 'gpt-4-vision-preview',
  CLAUDE_MODEL: 'claude-3-5-sonnet-20241022',
  MAX_TOKENS: 4000,
  TEMPERATURE: 0.7,
  DRIVE_FOLDER_NAME: 'MedWard Reports',
  DEFAULT_PROVIDER: 'claude' // 'claude' or 'openai'
};

/**
 * Main entry point for POST requests
 * Handles CORS by accepting text/plain content type
 */
function doPost(e) {
  try {
    // Parse the request
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;

    // Log request details
    Logger.log('=== Request received ===');
    Logger.log('Action: ' + action);
    Logger.log('Raw POST data length: ' + e.postData.contents.length);

    if (requestData.image) {
      Logger.log('Image data present in request');
      Logger.log('Image data type: ' + typeof requestData.image);
      Logger.log('Image data length: ' + requestData.image.length);
      Logger.log('Image data starts with: ' + requestData.image.substring(0, 100));
    }

    // Route to appropriate handler
    let response;
    switch(action) {
      case 'login':
        response = handleLogin(requestData);
        break;
      case 'uploadImage':
        response = handleUploadImage(requestData);
        break;
      case 'interpret':
        response = handleInterpret(requestData);
        break;
      default:
        response = { success: false, error: 'Unknown action' };
    }

    // Return JSON response with CORS headers
    return createCORSResponse(response);

  } catch (error) {
    Logger.log('Error: ' + error.toString());
    return createCORSResponse({
      success: false,
      error: error.toString()
    });
  }
}

/**
 * Handle OPTIONS requests for CORS preflight
 */
function doGet(e) {
  return createCORSResponse({
    status: 'MedWard Backend API is running',
    version: '2.0.0',
    features: ['Claude Vision', 'GPT-4 Vision', 'Advanced OCR']
  });
}

/**
 * Create response with CORS headers
 */
function createCORSResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * Handle login requests
 */
function handleLogin(data) {
  const username = data.username || 'Guest';

  // Simple authentication (enhance with real auth in production)
  if (username.length > 0) {
    return {
      success: true,
      token: generateToken(),
      user: {
        username: username,
        role: 'doctor',
        timestamp: new Date().toISOString()
      }
    };
  }

  return { success: false, error: 'Invalid username' };
}

/**
 * Handle image upload to Google Drive
 * Accepts base64 image, saves to Drive, returns file ID
 */
function handleUploadImage(data) {
  try {
    Logger.log('=== handleUploadImage ===');

    if (!data.image) {
      return { success: false, error: 'No image data provided' };
    }

    Logger.log('Image data length received: ' + data.image.length);

    // Extract base64 data and media type
    let base64Data = data.image;
    let mediaType = 'image/png';

    // Check if it's a data URL
    if (base64Data.startsWith('data:')) {
      const match = base64Data.match(/data:([^;]+);base64,(.+)/);
      if (match) {
        mediaType = match[1];
        base64Data = match[2];
      }
    }

    Logger.log('Media type: ' + mediaType);
    Logger.log('Base64 data length (after prefix removal): ' + base64Data.length);

    // Convert base64 to blob
    const blob = Utilities.newBlob(
      Utilities.base64Decode(base64Data),
      mediaType,
      'medical-image-' + new Date().getTime()
    );

    Logger.log('Blob created, size: ' + blob.getBytes().length);

    // Get or create MedWard folder
    const folderName = CONFIG.DRIVE_FOLDER_NAME || 'MedWard Images';
    let folder;
    const folders = DriveApp.getFoldersByName(folderName);

    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }

    Logger.log('Using folder: ' + folder.getName());

    // Save to Drive
    const file = folder.createFile(blob);
    const fileId = file.getId();

    Logger.log('File saved to Drive with ID: ' + fileId);

    return {
      success: true,
      fileId: fileId,
      fileName: file.getName(),
      fileSize: file.getSize()
    };

  } catch (error) {
    Logger.log('Upload error: ' + error.toString());
    return {
      success: false,
      error: 'Failed to upload image: ' + error.toString()
    };
  }
}

/**
 * Handle medical report interpretation requests
 */
function handleInterpret(data) {
  try {
    const documentType = data.documentType || 'general';
    const username = data.username || 'Anonymous';
    const provider = data.provider || getPreferredProvider();

    let medicalText = data.text || '';
    let visionAnalysis = null;
    let imageData = null;

    // If fileId is provided, download from Drive (RECOMMENDED)
    if (data.fileId) {
      Logger.log('=== Using Drive API workflow ===');
      Logger.log('Processing image from Drive fileId: ' + data.fileId);

      imageData = downloadImageFromDrive(data.fileId);

      if (!imageData) {
        const errorMsg = 'Failed to download image from Google Drive. Please check: ' +
          '1) File ID is valid, ' +
          '2) File exists in Drive, ' +
          '3) Script has Drive access permissions';
        Logger.log('ERROR: ' + errorMsg);
        return { success: false, error: errorMsg };
      }

      Logger.log('✓ Successfully downloaded image from Drive');
      Logger.log('Image data length: ' + imageData.length + ' characters');
    }
    // If image is provided directly (legacy support - has size limitations)
    else if (data.image) {
      Logger.log('=== Using direct base64 upload (legacy) ===');
      Logger.log('⚠️ Warning: Direct base64 upload has size limitations. Consider using Drive API.');
      Logger.log('Image data length: ' + data.image.length + ' characters');
      Logger.log('Image data starts with: ' + data.image.substring(0, 100));

      // Validate the image data is not truncated (data URL includes prefix, so threshold is higher)
      const MIN_DATA_URL_LENGTH = 75; // Accounts for 'data:image/png;base64,' prefix + minimal base64
      if (data.image.length < MIN_DATA_URL_LENGTH) {
        const errorMsg = 'Image data appears to be truncated or invalid. ' +
          'Length: ' + data.image.length + ' characters (expected at least ' + MIN_DATA_URL_LENGTH + '). ' +
          'Use the Drive API workflow (upload image first, then pass fileId) for reliable operation.';
        Logger.log('ERROR: ' + errorMsg);
        return { success: false, error: errorMsg };
      }

      imageData = data.image;
    }

    // If we have image data, use Vision AI for extraction and analysis
    if (imageData) {
      visionAnalysis = analyzeImageWithVisionAI(imageData, documentType, provider);

      if (!visionAnalysis || !visionAnalysis.extractedText) {
        return { success: false, error: 'Vision AI failed to analyze image' };
      }

      medicalText = visionAnalysis.extractedText;
    }

    if (!medicalText || medicalText.trim().length === 0) {
      return { success: false, error: 'No medical text provided or extracted' };
    }

    // Get comprehensive AI interpretation
    const interpretation = getAIInterpretation(medicalText, documentType, provider);

    // If vision analysis provided initial insights, merge them
    if (visionAnalysis && visionAnalysis.initialInsights) {
      interpretation.visionInsights = visionAnalysis.initialInsights;
    }

    // Archive the report to Google Drive
    archiveReport(medicalText, interpretation, username, documentType);

    return {
      success: true,
      provider: provider,
      ...interpretation,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    Logger.log('Interpret error: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * Get preferred AI provider from Script Properties or use default
 */
function getPreferredProvider() {
  const provider = PropertiesService.getScriptProperties().getProperty('AI_PROVIDER');
  return provider || CONFIG.DEFAULT_PROVIDER;
}

/**
 * Analyze medical image using Vision AI (Claude or GPT-4 Vision)
 */
function analyzeImageWithVisionAI(base64Image, documentType, provider) {
  try {
    // Sanitize and validate base64 data
    const base64Data = sanitizeBase64(base64Image);
    const mediaType = getMediaTypeFromBase64(base64Image);

    Logger.log(`Using ${provider} Vision API for image analysis`);

    if (provider === 'claude') {
      return analyzeImageWithClaude(base64Data, mediaType, documentType);
    } else {
      return analyzeImageWithOpenAIVision(base64Image, documentType);
    }

  } catch (error) {
    Logger.log('Vision AI error: ' + error.toString());

    // Try fallback to other provider
    const fallbackProvider = provider === 'claude' ? 'openai' : 'claude';
    Logger.log(`Attempting fallback to ${fallbackProvider}`);

    try {
      if (fallbackProvider === 'claude') {
        const base64Data = sanitizeBase64(base64Image);
        const mediaType = getMediaTypeFromBase64(base64Image);
        return analyzeImageWithClaude(base64Data, mediaType, documentType);
      } else {
        return analyzeImageWithOpenAIVision(base64Image, documentType);
      }
    } catch (fallbackError) {
      Logger.log('Fallback also failed: ' + fallbackError.toString());
      throw new Error('Both vision providers failed');
    }
  }
}

/**
 * Analyze image using Claude Vision API (Anthropic)
 */
function analyzeImageWithClaude(base64Data, mediaType, documentType) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');

  if (!apiKey) {
    throw new Error('Anthropic API key not configured in Script Properties');
  }

  const prompt = buildVisionPrompt(documentType);

  // Log payload details for debugging
  Logger.log('Preparing Claude Vision API request');
  Logger.log('Media type: ' + mediaType);
  Logger.log('Base64 data length: ' + base64Data.length);
  Logger.log('Base64 starts with: ' + base64Data.substring(0, 50));
  Logger.log('Base64 ends with: ' + base64Data.substring(base64Data.length - 20));

  const requestPayload = {
    model: CONFIG.CLAUDE_MODEL,
    max_tokens: CONFIG.MAX_TOKENS,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
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

  const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    payload: JSON.stringify(requestPayload),
    muteHttpExceptions: true
  });

  const result = JSON.parse(response.getContentText());

  if (result.error) {
    Logger.log('Claude API returned error: ' + JSON.stringify(result.error));
    throw new Error('Claude API Error: ' + JSON.stringify(result.error));
  }

  Logger.log('Claude Vision API request successful');

  // Extract the text content from Claude's response
  const extractedText = result.content[0].text;

  return {
    extractedText: extractedText,
    initialInsights: `Analyzed with Claude Vision (${CONFIG.CLAUDE_MODEL})`,
    provider: 'claude'
  };
}

/**
 * Analyze image using GPT-4 Vision API
 */
function analyzeImageWithOpenAIVision(base64Image, documentType) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');

  if (!apiKey) {
    throw new Error('OpenAI API key not configured in Script Properties');
  }

  const prompt = buildVisionPrompt(documentType);

  const response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({
      model: CONFIG.OPENAI_VISION_MODEL,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt
          },
          {
            type: 'image_url',
            image_url: {
              url: base64Image,
              detail: 'high'
            }
          }
        ]
      }],
      max_tokens: CONFIG.MAX_TOKENS
    }),
    muteHttpExceptions: true
  });

  const result = JSON.parse(response.getContentText());

  if (result.error) {
    throw new Error('OpenAI Vision API Error: ' + result.error.message);
  }

  const extractedText = result.choices[0].message.content;

  return {
    extractedText: extractedText,
    initialInsights: `Analyzed with GPT-4 Vision (${CONFIG.OPENAI_VISION_MODEL})`,
    provider: 'openai'
  };
}

/**
 * Build vision-specific prompt for image analysis
 */
function buildVisionPrompt(documentType) {
  const typeSpecific = {
    'lab': 'laboratory test results, including all test names, values, units, and reference ranges',
    'imaging': 'medical imaging report, including findings, impressions, technique, and clinical correlations',
    'pathology': 'pathology report, including specimen description, microscopic findings, and diagnosis',
    'general': 'medical document, extracting all relevant clinical information'
  };

  const docDescription = typeSpecific[documentType] || typeSpecific['general'];

  return `You are analyzing a medical ${docDescription}.

Please perform these tasks:

1. EXTRACT ALL TEXT: Extract all visible text from the image with high accuracy. Include:
   - All test names and values
   - All reference ranges and units
   - All headings and labels
   - All dates, patient info, and identifiers
   - All findings and impressions
   - Maintain the original structure and formatting as much as possible

2. ORGANIZE THE TEXT: Present the extracted text in a clear, structured format that preserves:
   - Hierarchical relationships
   - Section headers
   - List structures
   - Tabular data (if present)

3. QUALITY CHECK: Ensure you've captured:
   - All numerical values accurately
   - All medical terminology correctly
   - All units of measurement
   - All flags or abnormal indicators

Please provide the complete extracted text now. Be thorough and accurate.`;
}

/**
 * Get media type from base64 string
 */
function getMediaTypeFromBase64(base64String) {
  if (base64String.startsWith('data:')) {
    const match = base64String.match(/data:([^;]+);/);
    return match ? match[1] : 'image/png';
  }
  // Default to common medical image formats
  return 'image/png';
}

/**
 * Sanitize and validate base64 string for Vision APIs
 * Handles data URLs and cleans up common encoding issues
 */
function sanitizeBase64(base64String) {
  if (!base64String) {
    throw new Error('Base64 string is empty or null');
  }

  Logger.log('=== sanitizeBase64 function ===');
  Logger.log('Input string length: ' + base64String.length);
  Logger.log('Input starts with: ' + base64String.substring(0, 100));

  // Check if this is a data URL
  const isDataUrl = base64String.startsWith('data:');
  Logger.log('Is data URL: ' + isDataUrl);

  // Remove data URL prefix if present
  let cleanBase64 = base64String;
  if (isDataUrl) {
    if (base64String.includes(',')) {
      cleanBase64 = base64String.split(',')[1];
      Logger.log('Removed data URL prefix, new length: ' + cleanBase64.length);
    } else {
      Logger.log('Warning: Data URL format detected but no comma found');
    }
  }

  // Remove all whitespace characters (spaces, newlines, tabs, carriage returns)
  const beforeWhitespace = cleanBase64.length;
  cleanBase64 = cleanBase64.replace(/\s+/g, '');
  if (cleanBase64.length !== beforeWhitespace) {
    Logger.log('Removed whitespace, length changed from ' + beforeWhitespace + ' to ' + cleanBase64.length);
  }

  // Remove any URL encoding artifacts
  cleanBase64 = cleanBase64.replace(/%20/g, '').replace(/%2B/g, '+').replace(/%2F/g, '/').replace(/%3D/g, '=');

  // Validate base64 format - should only contain A-Z, a-z, 0-9, +, /, and = for padding
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(cleanBase64)) {
    Logger.log('❌ Base64 validation FAILED');
    Logger.log('Length: ' + cleanBase64.length);
    Logger.log('First 100 chars: ' + cleanBase64.substring(0, 100));
    Logger.log('Last 50 chars: ' + cleanBase64.substring(Math.max(0, cleanBase64.length - 50)));

    // Find invalid characters for better error reporting
    const invalidChars = cleanBase64.match(/[^A-Za-z0-9+/=]/g);
    if (invalidChars) {
      Logger.log('Invalid characters found: ' + invalidChars.join(', '));
    }

    throw new Error('Base64 string contains invalid characters. Use Drive API workflow to avoid encoding issues.');
  }

  // Validate minimum length (a 1x1 PNG is ~96 chars, set threshold to 50 to catch truncation)
  const MIN_BASE64_LENGTH = 50;
  if (cleanBase64.length < MIN_BASE64_LENGTH) {
    Logger.log('❌ Base64 string too short: ' + cleanBase64.length + ' characters');
    Logger.log('This usually indicates truncated or placeholder data');
    throw new Error(
      'Base64 string too short (' + cleanBase64.length + ' chars). ' +
      'Expected at least ' + MIN_BASE64_LENGTH + ' characters for a valid image. ' +
      'Ensure you are using the Drive API workflow (upload → fileId → interpret).'
    );
  }

  // Validate base64 padding
  const paddingCount = (cleanBase64.match(/=/g) || []).length;
  if (paddingCount > 2) {
    Logger.log('Warning: Unusual base64 padding: ' + paddingCount + ' equals signs');
  }

  Logger.log('✓ Base64 validation passed');
  Logger.log('Final length: ' + cleanBase64.length + ' characters');
  Logger.log('Padding: ' + paddingCount + ' equals signs');

  return cleanBase64;
}

/**
 * Get AI interpretation using preferred provider
 */
function getAIInterpretation(medicalText, documentType, provider) {
  if (provider === 'claude') {
    return getClaudeInterpretation(medicalText, documentType);
  } else {
    return getOpenAIInterpretation(medicalText, documentType);
  }
}

/**
 * Get interpretation using Claude API
 */
function getClaudeInterpretation(medicalText, documentType) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');

  if (!apiKey) {
    throw new Error('Anthropic API key not configured in Script Properties');
  }

  const systemPrompt = buildSystemPrompt(documentType);
  const userPrompt = buildUserPrompt(medicalText, documentType);

  const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    payload: JSON.stringify({
      model: CONFIG.CLAUDE_MODEL,
      max_tokens: CONFIG.MAX_TOKENS,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: userPrompt
      }]
    }),
    muteHttpExceptions: true
  });

  const result = JSON.parse(response.getContentText());

  if (result.error) {
    throw new Error('Claude API Error: ' + JSON.stringify(result.error));
  }

  const aiResponse = result.content[0].text;
  return parseAIResponse(aiResponse);
}

/**
 * Get interpretation using OpenAI API
 */
function getOpenAIInterpretation(medicalText, documentType) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');

  if (!apiKey) {
    throw new Error('OpenAI API key not configured in Script Properties');
  }

  const systemPrompt = buildSystemPrompt(documentType);
  const userPrompt = buildUserPrompt(medicalText, documentType);

  const response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({
      model: CONFIG.OPENAI_TEXT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: CONFIG.MAX_TOKENS,
      temperature: CONFIG.TEMPERATURE
    }),
    muteHttpExceptions: true
  });

  const result = JSON.parse(response.getContentText());

  if (result.error) {
    throw new Error('OpenAI API Error: ' + result.error.message);
  }

  const aiResponse = result.choices[0].message.content;
  return parseAIResponse(aiResponse);
}

/**
 * Build system prompt based on document type
 */
function buildSystemPrompt(documentType) {
  const basePrompt = `You are MedWard Master, an expert medical AI assistant specializing in clinical interpretation.
Your role is to analyze medical reports and provide clear, actionable insights for healthcare professionals.

You have advanced training in:
- Clinical pathology and laboratory medicine
- Medical imaging interpretation
- Pathology and histopathology
- Differential diagnosis
- Clinical correlations`;

  const typeSpecific = {
    'lab': 'Focus on laboratory values, reference ranges, clinical significance of abnormalities, and potential underlying conditions.',
    'imaging': 'Emphasize radiological findings, anatomical locations, clinical correlations, and recommended follow-up.',
    'pathology': 'Highlight histological findings, cellular changes, diagnostic implications, and staging information.',
    'general': 'Provide comprehensive analysis of all clinical information presented with appropriate clinical context.'
  };

  return basePrompt + '\n\n' + (typeSpecific[documentType] || typeSpecific['general']);
}

/**
 * Build user prompt for interpretation
 */
function buildUserPrompt(medicalText, documentType) {
  return `Please analyze this ${documentType} report and provide a structured interpretation in JSON format with the following sections:

{
  "interpretation": {
    "summary": "Brief clinical overview in 2-3 sentences highlighting the most important findings",
    "keyFindings": ["Finding 1 with clinical significance", "Finding 2 with clinical significance", "..."],
    "abnormalities": ["Abnormality 1 with values, severity, and clinical implications", "..."],
    "normalFindings": ["Normal finding 1", "Normal finding 2", "..."]
  },
  "clinicalPearls": ["Clinical pearl 1 relevant to these findings", "Pearl 2", "..."],
  "potentialQuestions": ["Question 1 to ask the patient", "Question 2 about symptoms or history", "..."],
  "presentation": {
    "patientFriendly": "Clear explanation in simple, non-medical terms that a patient can understand",
    "recommendations": ["Recommendation 1 for follow-up or further testing", "Recommendation 2", "..."]
  }
}

Important:
- Be precise with numerical values and reference ranges
- Highlight any critical or urgent findings
- Consider differential diagnoses where appropriate
- Provide actionable clinical recommendations
- Use evidence-based clinical reasoning

Medical Report:
${medicalText}`;
}

/**
 * Parse AI response into structured format
 */
function parseAIResponse(aiResponse) {
  try {
    // Try to extract JSON from the response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // Fallback: return as plain text interpretation
    return {
      interpretation: {
        summary: aiResponse.substring(0, 500),
        keyFindings: [aiResponse],
        abnormalities: [],
        normalFindings: []
      },
      clinicalPearls: [],
      potentialQuestions: [],
      presentation: {
        patientFriendly: aiResponse,
        recommendations: []
      }
    };
  } catch (error) {
    Logger.log('Parse error: ' + error.toString());
    throw new Error('Failed to parse AI response');
  }
}

/**
 * Download image from Google Drive and convert to base64 data URL
 * @param {string} fileId - Google Drive file ID
 * @return {string} Base64 data URL or null if error
 */
function downloadImageFromDrive(fileId) {
  try {
    // Validate fileId
    if (!fileId || typeof fileId !== 'string' || fileId.trim().length === 0) {
      Logger.log('Invalid fileId provided: ' + fileId);
      return null;
    }

    Logger.log('Downloading file from Drive: ' + fileId);

    // Get file from Drive
    const file = DriveApp.getFileById(fileId);

    // Verify file exists and is accessible
    if (!file) {
      Logger.log('File not found in Drive: ' + fileId);
      return null;
    }

    const blob = file.getBlob();
    const mimeType = blob.getContentType();
    const fileSize = blob.getBytes().length;

    Logger.log('File downloaded successfully');
    Logger.log('- File name: ' + file.getName());
    Logger.log('- MimeType: ' + mimeType);
    Logger.log('- Size: ' + fileSize + ' bytes');

    // Validate it's an image
    if (!mimeType || !mimeType.startsWith('image/')) {
      Logger.log('Warning: File does not appear to be an image. MimeType: ' + mimeType);
      // Continue anyway - let the Vision API decide
    }

    // Check size limits (10MB max for most Vision APIs)
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (fileSize > MAX_SIZE) {
      Logger.log('Error: File too large: ' + fileSize + ' bytes (max: ' + MAX_SIZE + ')');
      throw new Error('Image file too large. Maximum size is 10MB.');
    }

    // Convert to base64
    const base64 = Utilities.base64Encode(blob.getBytes());
    Logger.log('Converted to base64, length: ' + base64.length);

    // Create data URL
    const dataUrl = 'data:' + mimeType + ';base64,' + base64;
    Logger.log('Created data URL, total length: ' + dataUrl.length);

    return dataUrl;

  } catch (error) {
    Logger.log('Error downloading from Drive: ' + error.toString());
    Logger.log('Error stack: ' + (error.stack || 'No stack trace available'));
    return null;
  }
}

/**
 * Archive report to Google Drive
 */
function archiveReport(medicalText, interpretation, username, documentType) {
  try {
    // Get or create the MedWard Reports folder
    const folder = getOrCreateFolder(CONFIG.DRIVE_FOLDER_NAME);

    // Create report document
    const timestamp = new Date().toISOString();
    const fileName = `MedWard_Report_${documentType}_${timestamp}.txt`;

    const reportContent = `
MedWard Master - Medical Report Archive
========================================
Date: ${timestamp}
User: ${username}
Document Type: ${documentType}
AI Provider: ${interpretation.provider || 'N/A'}

ORIGINAL TEXT:
${medicalText}

INTERPRETATION:
${JSON.stringify(interpretation, null, 2)}
`;

    // Save to Drive
    const file = DriveApp.getFolderById(folder.getId()).createFile(
      fileName,
      reportContent,
      'text/plain'
    );

    Logger.log('Report archived: ' + file.getUrl());

  } catch (error) {
    Logger.log('Archive error: ' + error.toString());
    // Don't fail the main request if archiving fails
  }
}

/**
 * Get or create folder in Google Drive
 */
function getOrCreateFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);

  if (folders.hasNext()) {
    return folders.next();
  }

  return DriveApp.createFolder(folderName);
}

/**
 * Generate simple authentication token
 */
function generateToken() {
  return Utilities.base64Encode(
    Utilities.getUuid() + ':' + new Date().getTime()
  );
}

/**
 * Test function for text interpretation
 */
function testInterpret() {
  const testData = {
    action: 'interpret',
    text: 'Hemoglobin: 10.2 g/dL (Low, Reference: 13.5-17.5)\nWBC: 4.5 K/uL (Normal, Reference: 4.0-11.0)\nPlatelets: 150 K/uL (Normal, Reference: 150-400)',
    documentType: 'lab',
    username: 'TestUser'
  };

  const result = handleInterpret(testData);
  Logger.log(JSON.stringify(result, null, 2));
}

/**
 * Test function for image interpretation using Drive API (recommended)
 * This demonstrates the proper two-step workflow:
 * 1. Upload image to Drive (get fileId)
 * 2. Interpret using fileId (avoids base64 size limits)
 */
function testImageInterpretWithDrive() {
  // Step 1: Upload a minimal valid PNG to Drive
  // This is a 1x1 red pixel PNG (minimal valid image for testing)
  const minimalPNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

  Logger.log('=== Test: Upload image to Drive ===');
  const uploadResult = handleUploadImage({ image: minimalPNG });
  Logger.log('Upload result: ' + JSON.stringify(uploadResult, null, 2));

  if (!uploadResult.success) {
    Logger.log('ERROR: Upload failed');
    return uploadResult;
  }

  // Step 2: Interpret using the Drive fileId
  Logger.log('=== Test: Interpret image from Drive ===');
  const interpretData = {
    action: 'interpret',
    fileId: uploadResult.fileId,  // Use fileId instead of base64
    documentType: 'lab',
    username: 'TestUser',
    provider: 'claude' // or 'openai'
  };

  const result = handleInterpret(interpretData);
  Logger.log('Interpret result: ' + JSON.stringify(result, null, 2));

  return result;
}

/**
 * Legacy test function for direct base64 image interpretation
 * NOTE: This approach has size limitations. Use testImageInterpretWithDrive() instead.
 * Only use this for small test images.
 */
function testImageInterpretDirect() {
  // Using a minimal valid 1x1 red pixel PNG for testing
  const minimalPNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

  Logger.log('=== Test: Direct image interpretation (legacy) ===');

  const testData = {
    action: 'interpret',
    image: minimalPNG,
    documentType: 'lab',
    username: 'TestUser',
    provider: 'claude' // or 'openai'
  };

  const result = handleInterpret(testData);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * Keep old function name for backwards compatibility
 * but redirect to the Drive-based approach
 */
function testImageInterpret() {
  Logger.log('⚠️ testImageInterpret() is deprecated. Use testImageInterpretWithDrive() instead.');
  return testImageInterpretWithDrive();
}
