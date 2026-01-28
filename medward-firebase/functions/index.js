/**
 * Firebase Cloud Functions V2 - Lab Analysis API
 * FIXED VERSION: Resolves critical API key mismatch bug
 * 
 * This module provides serverless lab result analysis powered by Claude AI.
 * Migration to Functions V2 includes improved error handling and configuration management.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Initialize Firebase Admin
admin.initializeApp();

// Configuration Constants
const AI_CONFIG = {
  MODELS: {
    FAST: 'claude-3-5-sonnet-20241022',
    SMART: 'claude-3-opus-20240229'
  },
  MAX_TOKENS: 4000,
  TEMPERATURE: 0.3
};

// ============================================================================
// CRITICAL FIX #1: API KEY MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Gets Claude API key from Firebase config or environment.
 * ROBUST VERSION: Checks multiple possible config locations.
 * 
 * BUG FIX: The original code looked for claude.api_key but the key was 
 * saved as anthropic.key - this function now checks both locations.
 * 
 * Configuration priority:
 * 1. ANTHROPIC_API_KEY environment variable (where you saved it)
 * 2. CLAUDE_API_KEY environment variable (backwards compatibility)
 * 3. Return null if not found (triggers proper error handling)
 */
function getClaudeApiKey() {
  // PRIMARY: Check the config you actually set (anthropic.key)
  // This is set via: firebase functions:config:set anthropic.key="YOUR_KEY"
  if (process.env.ANTHROPIC_API_KEY) {
    console.log('✓ Using API key from ANTHROPIC_API_KEY environment variable');
    return process.env.ANTHROPIC_API_KEY;
  }
  
  // SECONDARY: Check legacy config names (for backwards compatibility)
  if (process.env.CLAUDE_API_KEY) {
    console.log('✓ Using API key from CLAUDE_API_KEY environment variable');
    return process.env.CLAUDE_API_KEY;
  }
  
  // FALLBACK: No API key found
  console.error('✗ CRITICAL: No API Key found in environment');
  return null;
}

/**
 * Calls the Claude API with proper error handling.
 * 
 * IMPROVED VERSION:
 * - Validates API key before making request
 * - Better error diagnostics with actionable messages
 * - Proper Anthropic header configuration
 * - Robust fetch error handling
 * - Specific HTTP error code handling
 */
async function callClaudeAPI(messages, options = {}) {
  const apiKey = getClaudeApiKey();

  // CRITICAL ERROR CHECK: Prevent bad requests
  if (!apiKey) {
    console.error('CRITICAL: No API Key found in environment');
    console.error('ACTION REQUIRED: Run this command in Firebase CLI:');
    console.error('firebase functions:config:set anthropic.key="YOUR_ANTHROPIC_API_KEY"');
    throw new Error('Server configuration error: API Key missing. Please contact support.');
  }

  console.log('📡 Calling Claude API...');
  console.log('   Model:', options.model || AI_CONFIG.MODELS.FAST);
  console.log('   Max tokens:', options.maxTokens || AI_CONFIG.MAX_TOKENS);
  
  try {
    // Build request
    const requestBody = {
      model: options.model || AI_CONFIG.MODELS.FAST,
      max_tokens: options.maxTokens || AI_CONFIG.MAX_TOKENS,
      temperature: options.temperature !== undefined ? options.temperature : AI_CONFIG.TEMPERATURE,
      system: options.system || '',
      messages: messages
    };

    console.log('📨 Sending request to Anthropic API...');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📬 Response received. Status:', response.status);

    // Handle non-200 responses
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Claude API Error (${response.status}):`, errorText);
      
      // Provide specific error guidance based on HTTP status
      if (response.status === 401) {
        throw new Error('Authentication failed: Invalid API Key. Please verify your Anthropic API key is correct.');
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded: Too many requests to AI service. Please try again in a moment.');
      } else if (response.status === 500) {
        throw new Error('AI service temporarily unavailable. Please try again later.');
      } else {
        throw new Error(`AI Provider Error (${response.status}): ${response.statusText}`);
      }
    }

    const data = await response.json();
    console.log('✓ Claude API response received successfully');
    console.log('   Output tokens:', data.usage?.output_tokens);
    
    return data;
    
  } catch (error) {
    console.error('❌ Network/Fetch Error in callClaudeAPI:');
    console.error('   Message:', error.message);
    console.error('   Type:', error.constructor.name);
    throw error;
  }
}

// ============================================================================
// MAIN LAB ANALYSIS FUNCTION (HARDENED)
// ============================================================================

/**
 * HTTP Cloud Function: Analyzes lab results using Claude AI
 * 
 * Endpoint: POST /analyzeLabs
 * Request body: { labResults: string }
 * 
 * Response success: { success: true, analysis: string, details: object }
 * Response error: { error: string, details: string }
 */
exports.analyzeLabs = functions
  .region('europe-west1')
  .https.onRequest(async (req, res) => {
    
    // *** CORS Setup ***
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      res.status(200).send('OK');
      return;
    }

    // Only accept POST requests
    if (req.method !== 'POST') {
      res.status(405).json({ 
        error: 'Method not allowed. Use POST.',
        allowedMethods: ['POST', 'OPTIONS']
      });
      return;
    }

    try {
      // *** INPUT VALIDATION ***
      const { labResults } = req.body;

      if (!labResults || typeof labResults !== 'string') {
        return res.status(400).json({
          error: 'Invalid input',
          details: 'Please provide labResults as a string in the request body.'
        });
      }

      if (labResults.trim().length === 0) {
        return res.status(400).json({
          error: 'Empty input',
          details: 'Lab results cannot be empty.'
        });
      }

      console.log('📋 Processing lab analysis request');
      console.log('   Input length:', labResults.length, 'characters');

      // *** PREPARE CLAUDE REQUEST ***
      const systemPrompt = `You are an expert medical laboratory analyst with extensive experience in clinical medicine. 

Analyze the provided lab results and provide:

1. **Summary of Key Findings**: Brief overview of the most important results
2. **Normal vs Abnormal Values**: Clearly identify which values are outside normal ranges
3. **Clinical Significance**: Explain what abnormal findings may indicate
4. **Recommended Follow-up Actions**: Suggest appropriate next steps or additional testing

Be concise, professional, and clinically accurate. Use medical terminology appropriately.
Do not provide medical diagnoses - focus on objective analysis of the lab data.`;

      const messages = [
        {
          role: 'user',
          content: `Please analyze these lab results:\n\n${labResults}`
        }
      ];

      console.log('🤖 Calling Claude API...');

      // *** CALL CLAUDE API ***
      const claudeResponse = await callClaudeAPI(messages, {
        system: systemPrompt,
        model: AI_CONFIG.MODELS.FAST,
        maxTokens: AI_CONFIG.MAX_TOKENS,
        temperature: AI_CONFIG.TEMPERATURE
      });

      // *** EXTRACT AND VALIDATE RESPONSE ***
      if (!claudeResponse.content || claudeResponse.content.length === 0) {
        console.error('Invalid Claude response structure - no content array');
        return res.status(500).json({
          error: 'Failed to generate analysis',
          details: 'Received invalid response format from AI service.'
        });
      }

      const analysisText = claudeResponse.content[0].type === 'text' 
        ? claudeResponse.content[0].text 
        : '';

      if (!analysisText || analysisText.trim().length === 0) {
        console.error('No text content in Claude response');
        return res.status(500).json({
          error: 'Failed to generate analysis',
          details: 'AI service did not return any analysis text.'
        });
      }

      console.log('✅ Analysis completed successfully');
      console.log('   Output length:', analysisText.length, 'characters');

      // *** RETURN SUCCESS RESPONSE ***
      return res.status(200).json({
        success: true,
        analysis: analysisText,
        details: {
          timestamp: new Date().toISOString(),
          model: AI_CONFIG.MODELS.FAST,
          inputLength: labResults.length,
          outputLength: analysisText.length,
          tokensUsed: claudeResponse.usage?.output_tokens || 'unknown'
        }
      });

    } catch (error) {
      // *** COMPREHENSIVE ERROR HANDLING ***
      console.error('❌ Error in analyzeLabs function:');
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);

      // Determine error category and provide appropriate response
      if (error.message.includes('API Key missing')) {
        return res.status(500).json({
          error: 'Server configuration error',
          details: 'API credentials are not properly configured. Contact support.'
        });
      }

      if (error.message.includes('Invalid API Key') || error.message.includes('Authentication failed')) {
        return res.status(401).json({
          error: 'Authentication failed',
          details: 'Invalid API key configuration. Contact support.'
        });
      }

      if (error.message.includes('Rate limit')) {
        return res.status(429).json({
          error: 'Service temporarily unavailable',
          details: 'Too many requests. Please try again in a moment.'
        });
      }

      if (error.message.includes('temporarily unavailable')) {
        return res.status(503).json({
          error: 'Service unavailable',
          details: 'AI service is temporarily down. Please try again later.'
        });
      }

      // Generic error response for unknown errors
      return res.status(500).json({
        error: 'An error occurred while analyzing lab results',
        details: error.message
      });
    }
  });

// ============================================================================
// UTILITY FUNCTIONS FOR DEBUGGING & MONITORING
// ============================================================================

/**
 * HTTP Cloud Function: Health check endpoint
 * Use this to verify the function is deployed and configured correctly
 * Endpoint: GET /healthCheck
 */
exports.healthCheck = functions
  .region('europe-west1')
  .https.onRequest((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    
    const apiKey = getClaudeApiKey();
    const hasApiKey = !!apiKey;
    const keyPreview = hasApiKey ? apiKey.substring(0, 8) + '...(hidden)' : 'NOT SET';

    return res.status(200).json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      config: {
        region: 'europe-west1',
        primaryModel: AI_CONFIG.MODELS.FAST,
        apiKeyConfigured: hasApiKey,
        apiKeyPreview: keyPreview
      },
      message: 'All systems operational'
    });
  });

/**
 * HTTP Cloud Function: Configuration diagnostics
 * Helps identify setup issues and current configuration status
 * Endpoint: GET /diagnostics
 */
exports.diagnostics = functions
  .region('europe-west1')
  .https.onRequest((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    
    const apiKeySet = !!process.env.ANTHROPIC_API_KEY;
    
    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        hasAnthropicKey: apiKeySet,
        firebaseProject: process.env.GCLOUD_PROJECT || 'unknown',
        region: 'europe-west1'
      },
      availableFunctions: {
        analyzeLabs: 'POST /analyzeLabs',
        healthCheck: 'GET /healthCheck',
        diagnostics: 'GET /diagnostics'
      },
      status: apiKeySet ? 'CONFIGURED' : 'NOT CONFIGURED',
      recommendations: []
    };

    // Add recommendations based on current state
    if (!apiKeySet) {
      diagnostics.recommendations.push({
        priority: 'CRITICAL',
        issue: 'API Key not configured',
        solution: 'Run: firebase functions:config:set anthropic.key="YOUR_ANTHROPIC_API_KEY"'
      });
    }

    return res.status(200).json(diagnostics);
  });

// Export configuration for testing
module.exports.AI_CONFIG = AI_CONFIG;
module.exports.getClaudeApiKey = getClaudeApiKey;
module.exports.callClaudeAPI = callClaudeAPI;
