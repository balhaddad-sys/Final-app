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
  // Claude model - check https://docs.anthropic.com/en/docs/models-overview for latest versions
  // Haiku is faster and more cost-effective for most medical analysis tasks
  CLAUDE_MODEL: 'claude-haiku-4-5-20251001',
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
    const presentationFormat = data.presentationFormat || 'detailed'; // 'detailed' or 'ward'

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

      Logger.log('[Drive] Successfully downloaded image from Drive');
      Logger.log('Image data length: ' + imageData.length + ' characters');
    }
    // If image is provided directly (legacy support - has size limitations)
    else if (data.image) {
      Logger.log('=== Using direct base64 upload (legacy) ===');
      Logger.log('[Warning] Direct base64 upload has size limitations. Consider using Drive API.');
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
    const interpretation = getAIInterpretation(medicalText, documentType, provider, presentationFormat);

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
 * Optimized with minimal logging
 */
function analyzeImageWithClaude(base64Data, mediaType, documentType) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');

  if (!apiKey) {
    throw new Error('Anthropic API key not configured in Script Properties');
  }

  const prompt = buildVisionPrompt(documentType);

  // Minimal logging - only essential info
  Logger.log('Claude Vision API: ' + base64Data.length + ' chars, ' + mediaType);

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
    // Provide helpful error messages for common issues
    let errorMsg = 'Claude API Error: ' + JSON.stringify(result.error);
    if (result.error.type === 'not_found_error' && result.error.message && result.error.message.includes('model')) {
      errorMsg = 'Claude model "' + CONFIG.CLAUDE_MODEL + '" not found. ' +
        'Please check https://docs.anthropic.com/en/docs/models-overview for available models ' +
        'and update CONFIG.CLAUDE_MODEL in the script.';
    } else if (result.error.type === 'authentication_error') {
      errorMsg = 'Claude authentication failed. Please verify ANTHROPIC_API_KEY in Script Properties.';
    } else if (result.error.type === 'permission_error') {
      errorMsg = 'Claude API permission error. Your API key may not have access to this model.';
    }

    Logger.log('Claude API error: ' + result.error.type);
    throw new Error(errorMsg);
  }

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
 * Optimized version with minimal logging
 */
function sanitizeBase64(base64String) {
  if (!base64String) {
    throw new Error('Base64 string is empty or null');
  }

  // Remove data URL prefix if present (single operation)
  let cleanBase64 = base64String.includes(',') && base64String.startsWith('data:')
    ? base64String.split(',')[1]
    : base64String;

  // Remove whitespace and URL encoding artifacts in one pass
  cleanBase64 = cleanBase64
    .replace(/\s+/g, '')
    .replace(/%20/g, '')
    .replace(/%2B/g, '+')
    .replace(/%2F/g, '/')
    .replace(/%3D/g, '=');

  // Fast validation: check minimum length first (cheapest operation)
  const MIN_BASE64_LENGTH = 50;
  if (cleanBase64.length < MIN_BASE64_LENGTH) {
    throw new Error(
      'Base64 string too short (' + cleanBase64.length + ' chars). ' +
      'Expected at least ' + MIN_BASE64_LENGTH + ' characters. ' +
      'Use Drive API workflow (upload → fileId → interpret).'
    );
  }

  // Validate base64 format - only if length check passes
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleanBase64)) {
    // Only log details on validation failure
    Logger.log('Base64 validation failed. Length: ' + cleanBase64.length);
    throw new Error('Base64 string contains invalid characters. Use Drive API workflow to avoid encoding issues.');
  }

  // Optional: Log only on success in debug mode (comment out for production)
  // Logger.log('Base64 validated: ' + cleanBase64.length + ' chars');

  return cleanBase64;
}

/**
 * Get AI interpretation using preferred provider
 * With intelligent caching for faster repeated requests
 */
function getAIInterpretation(medicalText, documentType, provider, presentationFormat) {
  // Generate cache key from input parameters
  const cacheKey = generateCacheKey(medicalText, documentType, provider, presentationFormat);

  // Try to get cached result (cache expires after 1 hour)
  const cache = CacheService.getScriptCache();
  const cachedResult = cache.get(cacheKey);

  if (cachedResult) {
    Logger.log('[Cache] Hit - returning cached interpretation');
    try {
      return JSON.parse(cachedResult);
    } catch (e) {
      Logger.log('Cache parse error, fetching fresh data');
      // Fall through to fetch new data
    }
  }

  // Cache miss - fetch fresh interpretation
  Logger.log('Cache miss - fetching new interpretation');
  let result;

  if (provider === 'claude') {
    result = getClaudeInterpretation(medicalText, documentType, presentationFormat);
  } else {
    result = getOpenAIInterpretation(medicalText, documentType, presentationFormat);
  }

  // Store in cache (max 1 hour = 3600 seconds)
  try {
    cache.put(cacheKey, JSON.stringify(result), 3600);
  } catch (e) {
    Logger.log('Warning: Failed to cache result: ' + e.message);
    // Continue anyway - caching failure shouldn't break the app
  }

  return result;
}

/**
 * Generate a cache key from interpretation parameters
 * Uses MD5 hash to keep key size manageable
 */
function generateCacheKey(medicalText, documentType, provider, presentationFormat) {
  // Normalize the text to handle minor variations
  const normalizedText = medicalText.trim().toLowerCase().substring(0, 5000); // Limit to 5000 chars for hashing
  const keyData = normalizedText + '|' + documentType + '|' + provider + '|' + (presentationFormat || 'detailed');

  // Generate MD5 hash for consistent key length
  const hash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    keyData,
    Utilities.Charset.UTF_8
  );

  // Convert to hex string
  return 'ai_interp_' + hash.map(function(byte) {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join('');
}

/**
 * Get interpretation using Claude API
 */
function getClaudeInterpretation(medicalText, documentType, presentationFormat) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');

  if (!apiKey) {
    throw new Error('Anthropic API key not configured in Script Properties');
  }

  const systemPrompt = buildSystemPrompt(documentType, presentationFormat);
  const userPrompt = buildUserPrompt(medicalText, documentType, presentationFormat);

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
    Logger.log('Claude API returned error: ' + JSON.stringify(result.error));

    // Provide helpful error messages for common issues
    let errorMsg = 'Claude API Error: ' + JSON.stringify(result.error);
    if (result.error.type === 'not_found_error' && result.error.message && result.error.message.includes('model')) {
      errorMsg = 'Claude model "' + CONFIG.CLAUDE_MODEL + '" not found. ' +
        'Please check https://docs.anthropic.com/en/docs/models-overview for available models ' +
        'and update CONFIG.CLAUDE_MODEL in the script.';
    } else if (result.error.type === 'authentication_error') {
      errorMsg = 'Claude authentication failed. Please verify ANTHROPIC_API_KEY in Script Properties.';
    } else if (result.error.type === 'permission_error') {
      errorMsg = 'Claude API permission error. Your API key may not have access to this model.';
    }

    throw new Error(errorMsg);
  }

  const aiResponse = result.content[0].text;
  return parseAIResponse(aiResponse);
}

/**
 * Get interpretation using OpenAI API
 */
function getOpenAIInterpretation(medicalText, documentType, presentationFormat) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');

  if (!apiKey) {
    throw new Error('OpenAI API key not configured in Script Properties');
  }

  const systemPrompt = buildSystemPrompt(documentType, presentationFormat);
  const userPrompt = buildUserPrompt(medicalText, documentType, presentationFormat);

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
 * Build system prompt based on document type and presentation format
 */
function buildSystemPrompt(documentType, presentationFormat) {
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

  let formatSpecific = '';
  if (presentationFormat === 'ward') {
    formatSpecific = '\n\nYou are generating output for ward rounds. Format your response to be concise, scannable, and actionable for busy clinicians. Prioritize brevity and clinical relevance. Use standard medical abbreviations.';
  }

  return basePrompt + '\n\n' + (typeSpecific[documentType] || typeSpecific['general']) + formatSpecific;
}

/**
 * Build user prompt for interpretation
 */
function buildUserPrompt(medicalText, documentType, presentationFormat) {
  if (presentationFormat === 'ward') {
    return buildWardPresentationPrompt(medicalText, documentType);
  } else {
    return buildDetailedPrompt(medicalText, documentType);
  }
}

/**
 * Build detailed presentation prompt (comprehensive analysis format)
 * Enhanced for clinical accuracy and structured output
 */
function buildDetailedPrompt(medicalText, documentType) {
  return `You are a clinical AI assistant providing comprehensive medical report analysis.
Analyze this ${documentType} report and provide a detailed, structured interpretation.

Return JSON in this EXACT structure:

{
  "interpretation": {
    "summary": "Clinical overview in 2-3 sentences highlighting the most important findings. Be specific with values and clinical significance.",
    "keyFindings": [
      "Finding 1 with specific values, reference ranges, and clinical significance",
      "Finding 2 with specific values, reference ranges, and clinical significance",
      "Include all clinically significant findings"
    ],
    "abnormalities": [
      "Abnormality 1: [Test name] = [Value] ([Reference range]) - [SEVERITY: HIGH/MODERATE/LOW] → [Clinical implications and recommended actions]",
      "Include all abnormal results with quantitative data",
      "Prioritize by clinical urgency"
    ],
    "normalFindings": [
      "Normal finding 1 with values",
      "Normal finding 2 with values",
      "Include reassuring normal results that rule out important differentials"
    ]
  },
  "clinicalPearls": [
    "Clinical pearl 1: Evidence-based insight relevant to these findings",
    "Clinical pearl 2: Diagnostic or management pearls",
    "Maximum 5 pearls, prioritize actionable insights"
  ],
  "potentialQuestions": [
    "Question 1 to ask the patient about symptoms or history relevant to findings",
    "Question 2 to clarify clinical context",
    "Focus on questions that would change management"
  ],
  "presentation": {
    "patientFriendly": "Clear explanation in simple, non-medical terms that a patient can understand. Explain what the results mean for their health. Avoid medical jargon. Be reassuring where appropriate but honest about concerns.",
    "recommendations": [
      "Recommendation 1: Specific follow-up action with timeframe",
      "Recommendation 2: Further testing or specialist referral if indicated",
      "Include preventive measures and lifestyle modifications if relevant"
    ]
  }
}

CRITICAL ANALYSIS REQUIREMENTS:

1. PRECISION:
   - Include ALL numerical values with units
   - State reference ranges for abnormal values
   - Use standard medical terminology and abbreviations
   - Quantify severity (not just "elevated" but "elevated 2x upper limit")

2. CLINICAL SIGNIFICANCE:
   - Explain WHY findings matter clinically
   - Consider differential diagnoses
   - Note urgent/critical findings explicitly
   - Correlate findings with common clinical presentations

3. ACTIONABILITY:
   - Recommendations must be specific and time-bound
   - Prioritize by urgency
   - Consider follow-up intervals
   - Include both immediate and long-term actions

4. EVIDENCE-BASE:
   - Use current clinical guidelines where applicable
   - Reference normal pathophysiology
   - Consider common clinical patterns

5. FORMAT:
   - No emoji or decorative characters
   - Use standard medical abbreviations (Hb, WBC, Plt, Cr, Na, K, etc.)
   - Use arrows (→) to indicate actions or implications
   - Use severity labels in capitals: CRITICAL, HIGH, MODERATE, LOW

Document Type: ${documentType}

Medical Report:
${medicalText}

Provide comprehensive clinical analysis following ALL requirements above.`;
}

/**
 * Build ward presentation prompt (concise format for rounds)
 * Enhanced for clinical-grade output with structured data
 */
function buildWardPresentationPrompt(medicalText, documentType) {
  return `You are a clinical AI assistant preparing a WARD ROUND PRESENTATION for medical teams.
Generate a structured JSON response suitable for ward rounds presentation.

CRITICAL OUTPUT REQUIREMENTS:

1. Structure your analysis in EXACTLY these sections with clear delimiters:
   - STATUS: Traffic light indicators (green/yellow/red) for each clinical domain
   - PROBLEMS: Numbered list of active problems with severity (CRITICAL/HIGH/MODERATE/LOW)
   - PLAN: Actionable items for today, specific and time-bound
   - LABS: Key lab values with reference ranges and trends (if applicable)
   - WATCH_FOR: Red flags to monitor, maximum 5 items

2. For PROBLEMS section:
   - Number each problem (1, 2, 3...)
   - Include severity assessment
   - Include recommended action
   - Example: "Acute anemia requiring transfusion (CRITICAL) → Check Hb post-transfusion in 6 hours"

3. For PLAN section:
   - Make items specific and actionable
   - Include timeframes where relevant
   - Example: "Recheck electrolytes post-correction - 6 hours"

4. For LABS section (if lab data present):
   - Include reference ranges
   - Mark abnormal values with direction (HIGH/LOW)
   - Example: "Hb 8.5 g/dL (13-17) - LOW, trending down from 9.2"

5. FORMATTING STANDARDS:
   - Use standard medical abbreviations (DM, HTN, CKD, POD, UO, Cr, Hb, BP, SpO2, HR, RR)
   - Quantify everything - use numbers not descriptions
   - Front-load critical information - most urgent first
   - Traffic light indicators: green (stable), yellow (needs attention), red (urgent/critical)
   - Maximum one page when printed
   - No emoji or special characters except arrows (→) and standard symbols

6. If information is MISSING or UNCLEAR:
   - Explicitly state what's needed
   - Add to WATCH_FOR or PLAN as appropriate
   - Don't guess or assume values

Return JSON in this EXACT structure:

{
  "wardPresentation": {
    "header": "Medical Report Analysis | ${documentType}",
    "status": [
      {"domain": "Clinical Status", "indicator": "green|yellow|red", "value": "Brief assessment"},
      {"domain": "Labs/Results", "indicator": "green|yellow|red", "value": "Key findings"},
      {"domain": "Urgent Items", "indicator": "green|yellow|red", "value": "Action needed"}
    ],
    "activeIssues": [
      {"issue": "Problem 1 name", "status": "Current status with values", "action": "Specific action with timeframe"},
      {"issue": "Problem 2 name", "status": "Current status with values", "action": "Specific action with timeframe"}
    ],
    "todaysPlan": [
      "Specific actionable task 1 - with timeframe if applicable",
      "Specific actionable task 2 - with responsible team member if applicable",
      "Maximum 8 tasks, prioritized"
    ],
    "watchFor": [
      "Red flag 1 → clinical implication if it occurs",
      "Red flag 2 → clinical implication if it occurs",
      "Maximum 5 red flags"
    ]
  }
}

CLINICAL CONTEXT:
Document Type: ${documentType}

Medical Report Data:
${medicalText}

Analyze the above medical data and generate a ward-round-ready presentation following ALL the requirements above.`;
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
 * WITH AUTOMATIC COMPRESSION for large images (>4MB)
 * Uses Drive thumbnail API to resize images that exceed Claude's 5MB limit
 * @param {string} fileId - Google Drive file ID
 * @return {string} Base64 data URL or null if error
 */
function downloadImageFromDrive(fileId) {
  try {
    // Fast validation
    if (!fileId || typeof fileId !== 'string' || fileId.trim().length === 0) {
      return null;
    }

    // Get file from Drive
    const file = DriveApp.getFileById(fileId);
    if (!file) {
      return null;
    }

    let blob = file.getBlob();
    let fileSize = blob.getBytes().length;
    const mimeType = blob.getContentType();

    Logger.log('Original: ' + file.getName() + ' (' + fileSize + ' bytes, ' + mimeType + ')');

    // Claude's API limit is 5MB for base64 images
    // Target 4MB to leave room for base64 encoding overhead (~33% increase)
    const MAX_SIZE = 4 * 1024 * 1024; // 4MB

    if (fileSize <= MAX_SIZE) {
      // Image is small enough, use original
      const base64 = Utilities.base64Encode(blob.getBytes());
      return 'data:' + mimeType + ';base64,' + base64;
    }

    // Image too large - compress using Drive thumbnail API
    Logger.log('File too large (' + (fileSize/1024/1024).toFixed(2) + 'MB), fetching compressed thumbnail...');
    
    const driveFile = Drive.Files.get(fileId, { fields: 'thumbnailLink' });
    
    if (driveFile.thumbnailLink) {
      // Request largest thumbnail (1600px) - usually sufficient for medical reports
      const thumbnailUrl = driveFile.thumbnailLink.replace(/=s\d+/, '=s1600');
      
      const response = UrlFetchApp.fetch(thumbnailUrl, {
        headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() },
        muteHttpExceptions: true
      });
      
      if (response.getResponseCode() === 200) {
        blob = response.getBlob();
        fileSize = blob.getBytes().length;
        Logger.log('Compressed to: ' + (fileSize/1024/1024).toFixed(2) + 'MB');
        
        // Verify it's now under limit
        if (fileSize > 5 * 1024 * 1024) {
          throw new Error('Image still too large after compression (' + (fileSize/1024/1024).toFixed(1) + 'MB). Please upload a smaller image.');
        }
        
        const base64 = Utilities.base64Encode(blob.getBytes());
        return 'data:' + blob.getContentType() + ';base64,' + base64;
      } else {
        Logger.log('Thumbnail fetch failed: ' + response.getResponseCode());
      }
    }

    // Fallback error if compression failed
    throw new Error('Image too large (' + (fileSize/1024/1024).toFixed(1) + 'MB > 4MB limit). Please upload a smaller image or take a lower resolution photo.');

  } catch (error) {
    Logger.log('Drive download error: ' + error.toString());
    throw error; // Re-throw to show user the actual error
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
  Logger.log('[Deprecated] testImageInterpret() is deprecated. Use testImageInterpretWithDrive() instead.');
  return testImageInterpretWithDrive();
}
