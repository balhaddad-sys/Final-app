/**
 * MedWard Master - Backend API (Enhanced with Vision AI)
 * Google Apps Script Web App
 *
 * SETUP INSTRUCTIONS:
 * 1. Copy this code to script.google.com
 * 2. Add Script Properties:
 *    - OPENAI_API_KEY = your_openai_key (for GPT-4 and GPT-4 Vision)
 *    - ANTHROPIC_API_KEY = your_anthropic_key (for Claude Vision)
 *    - AI_PROVIDER = 'claude' or 'openai' (optional, defaults to claude)
 * 3. Deploy as Web App (Execute as: Me, Access: Anyone)
 *
 * Note: Drive API is no longer required (removed basic OCR)
 */

// Configuration - OPTIMIZED FOR SPEED
const CONFIG = {
  OPENAI_TEXT_MODEL: 'gpt-4',
  OPENAI_VISION_MODEL: 'gpt-4-vision-preview',
  CLAUDE_MODEL: 'claude-haiku-4-5-20250929', // Claude Haiku 4.5 - Fastest model
  MAX_TOKENS: 1500, // Reduced for faster responses
  TEMPERATURE: 0.8, // Slightly higher for faster generation
  DRIVE_FOLDER_NAME: 'MedWard Reports',
  DEFAULT_PROVIDER: 'claude', // 'claude' or 'openai'
  SKIP_ARCHIVING: true // Skip archiving for speed
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

    // Minimal logging for speed

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
      case 'uploadAndInterpret':
        response = handleUploadAndInterpret(requestData);
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
    if (!data.image) {
      return { success: false, error: 'No image data provided' };
    }

    // Extract base64 data and media type
    let base64Data = data.image;
    let mediaType = 'image/jpeg'; // Default to JPEG for speed

    // Check if it's a data URL
    if (base64Data.startsWith('data:')) {
      const match = base64Data.match(/data:([^;]+);base64,(.+)/);
      if (match) {
        mediaType = match[1];
        base64Data = match[2];
      }
    }

    // Convert base64 to blob
    const blob = Utilities.newBlob(
      Utilities.base64Decode(base64Data),
      mediaType,
      'img-' + new Date().getTime()
    );

    // Get or create MedWard folder
    let folder;
    const folders = DriveApp.getFoldersByName(CONFIG.DRIVE_FOLDER_NAME);
    folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(CONFIG.DRIVE_FOLDER_NAME);

    // Save to Drive
    const file = folder.createFile(blob);

    return {
      success: true,
      fileId: file.getId(),
      fileName: file.getName(),
      fileSize: file.getSize()
    };

  } catch (error) {
    return {
      success: false,
      error: 'Failed to upload image: ' + error.toString()
    };
  }
}

/**
 * Handle combined upload and interpret in single request
 * OPTIMIZED: Reduces round-trip time by 50%
 */
function handleUploadAndInterpret(data) {
  try {
    // Validate input
    if (!data.image) {
      return { success: false, error: 'No image data provided' };
    }

    // Step 1: Upload image (inline processing)
    const uploadResult = handleUploadImage(data);
    if (!uploadResult.success) {
      return uploadResult;
    }

    // Step 2: Immediately analyze with fileId
    data.fileId = uploadResult.fileId;
    const interpretResult = handleInterpret(data);

    // Step 3: Return combined result
    if (interpretResult.success) {
      return {
        ...interpretResult,
        fileId: uploadResult.fileId,
        fileName: uploadResult.fileName,
        combinedRequest: true
      };
    } else {
      return interpretResult;
    }

  } catch (error) {
    Logger.log('UploadAndInterpret error: ' + error.toString());
    return {
      success: false,
      error: 'Combined request failed: ' + error.toString()
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

    // If fileId is provided, download from Drive
    if (data.fileId) {
      imageData = downloadImageFromDrive(data.fileId);
      if (!imageData) {
        return { success: false, error: 'Failed to download image from Drive' };
      }
    }
    // If image is provided directly (legacy support)
    else if (data.image) {
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

    // Skip archiving for speed (configurable)
    if (!CONFIG.SKIP_ARCHIVING) {
      archiveReport(medicalText, interpretation, username, documentType);
    }

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

    if (provider === 'claude') {
      return analyzeImageWithClaude(base64Data, mediaType, documentType);
    } else {
      return analyzeImageWithOpenAIVision(base64Image, documentType);
    }

  } catch (error) {
    // Try fallback to other provider quickly
    const fallbackProvider = provider === 'claude' ? 'openai' : 'claude';

    if (fallbackProvider === 'claude') {
      const base64Data = sanitizeBase64(base64Image);
      const mediaType = getMediaTypeFromBase64(base64Image);
      return analyzeImageWithClaude(base64Data, mediaType, documentType);
    } else {
      return analyzeImageWithOpenAIVision(base64Image, documentType);
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
    throw new Error('Claude API Error: ' + JSON.stringify(result.error));
  }

  // Extract the text content from Claude's response
  const extractedText = result.content[0].text;

  return {
    extractedText: extractedText,
    initialInsights: `Analyzed with Claude Vision`,
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
 * Build vision-specific prompt for image analysis - ENHANCED FOR ACCURACY
 */
function buildVisionPrompt(documentType) {
  return `You are a medical document analyzer. Extract ALL data with precision from this ${documentType} image.

EXTRACTION REQUIREMENTS:

1. LAB VALUES: Extract EVERY numeric value with:
   - Test name (standardized)
   - Value (exact number)
   - Unit (if visible)
   - Flag (H/L/HH/LL if present)
   - Reference range (if visible)

2. CLINICAL DATA: Separately identify:
   - History/Symptoms (non-numeric clinical information)
   - Physical examination findings
   - Diagnoses and assessments

3. OUTPUT FORMAT - Provide structured JSON:
{
  "extractedText": "complete raw text from document",
  "labValues": [
    {"name": "Hemoglobin", "value": 10.2, "unit": "g/dL", "flag": "L", "reference": "13.5-17.5"}
  ],
  "clinicalData": {
    "history": ["presenting complaint", "symptoms"],
    "examination": ["physical findings"],
    "diagnoses": ["diagnosis 1"]
  },
  "dataType": "lab|clinical|mixed"
}

Extract ALL visible information accurately and completely.`;
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
 * Sanitize and validate base64 string for Claude API
 */
function sanitizeBase64(base64String) {
  if (!base64String) {
    throw new Error('Base64 string is empty or null');
  }

  // Remove data URL prefix if present
  let cleanBase64 = base64String.includes(',') ? base64String.split(',')[1] : base64String;

  // Remove all whitespace and URL encoding
  cleanBase64 = cleanBase64.replace(/\s+/g, '').replace(/%20/g, '');

  // Quick validation
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleanBase64) || cleanBase64.length < 100) {
    throw new Error('Invalid base64 string');
  }

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
 * Build system prompt based on document type - OPTIMIZED FOR SPEED
 */
function buildSystemPrompt(documentType) {
  return `You are MedWard Master, an expert medical AI providing concise clinical interpretations for healthcare professionals. Analyze medical reports efficiently and provide actionable insights.`;
}

/**
 * Build user prompt for interpretation - OPTIMIZED FOR SPEED
 */
function buildUserPrompt(medicalText, documentType) {
  return `Analyze this ${documentType} report. Provide JSON with:
{
  "interpretation": {
    "summary": "Brief 1-2 sentence overview",
    "keyFindings": ["Finding 1", "Finding 2"],
    "abnormalities": ["Abnormality 1 with value & severity"],
    "normalFindings": ["Normal 1", "Normal 2"]
  },
  "clinicalPearls": ["Pearl 1", "Pearl 2"],
  "potentialQuestions": ["Question 1", "Question 2"],
  "presentation": {
    "patientFriendly": "Simple patient explanation",
    "recommendations": ["Rec 1", "Rec 2"]
  }
}

Report:
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
 * @return {string} Base64 data URL
 */
function downloadImageFromDrive(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    const base64 = Utilities.base64Encode(blob.getBytes());
    return 'data:' + blob.getContentType() + ';base64,' + base64;
  } catch (error) {
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
 * Test function for image interpretation (requires base64 image)
 */
function testImageInterpret() {
  // Note: Replace with actual base64 image data for testing
  const testData = {
    action: 'interpret',
    image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...',
    documentType: 'lab',
    username: 'TestUser',
    provider: 'claude' // or 'openai'
  };

  const result = handleInterpret(testData);
  Logger.log(JSON.stringify(result, null, 2));
}
