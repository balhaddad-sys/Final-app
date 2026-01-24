# Multi-Page Lab Analysis Setup Guide

## Overview
This guide explains how to update your Google Apps Script to support multi-page lab report analysis. The frontend has been updated to send multiple images in a single batch request.

## What Changed in the Frontend

### 1. File Input - Now Accepts Multiple Images
```html
<!-- Before -->
<input type="file" id="labFileInput" accept="image/*" style="display:none">

<!-- After -->
<input type="file" id="labFileInput" accept="image/*" multiple style="display:none">
```

### 2. Batch Processing
The `handleLabUpload()` function now:
- Accepts an array of files (FileList)
- Compresses all images in parallel using `Promise.all()`
- Sends all images in a single API request
- Shows progress: "Scanning N Pages..."

### 3. Request Format Change
```javascript
// OLD FORMAT (single image):
{
  action: 'analyzeLabsEnhanced',
  image: "data:image/jpeg;base64,..." // Single string
}

// NEW FORMAT (multiple images):
{
  action: 'analyzeLabsEnhanced',
  images: [ // Array of base64 strings
    "data:image/jpeg;base64,...",
    "data:image/jpeg;base64,...",
    "data:image/jpeg;base64,..."
  ]
}
```

---

## Google Apps Script Update Required

### Step 1: Open Your Google Apps Script
1. Go to https://script.google.com
2. Open your MedWard Pro project
3. Find the `analyzeLabsEnhanced` function

### Step 2: Update the Function

Replace your existing `analyzeLabsEnhanced` function with this:

```javascript
function analyzeLabsEnhanced(data) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');

  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    return { error: 'Claude API key not configured' };
  }

  // ═══════════════════════════════════════════════════════════════
  // MULTI-PAGE SUPPORT: Handle both 'image' (old) and 'images' (new)
  // ═══════════════════════════════════════════════════════════════
  let imageArray = [];

  if (data.images && Array.isArray(data.images)) {
    // NEW: Multiple images batch
    imageArray = data.images;
    Logger.log(`📄 Processing ${imageArray.length} pages in batch`);
  } else if (data.image) {
    // OLD: Single image (backward compatibility)
    imageArray = [data.image];
    Logger.log(`📄 Processing single image (legacy mode)`);
  } else {
    return { error: 'No images provided' };
  }

  // ═══════════════════════════════════════════════════════════════
  // THE MASTER PROMPT: Instructions for Organization
  // ═══════════════════════════════════════════════════════════════
  const systemPrompt = `
You are an advanced Medical OCR System.
You are provided with ${imageArray.length} image(s) of medical lab reports.

YOUR MISSION:
1. READ all images as a SINGLE document (they are pages of the same report).
2. MERGE duplicate tests (if a test appears on multiple pages, keep the most recent value).
3. ORGANIZE the output into a single JSON structure with proper categories.
4. Extract patient name and report date if available.

IMPORTANT RULES:
- If multiple pages show the same test with different dates, keep the MOST RECENT.
- Categorize tests properly: Hematology, Chemistry, Renal Function, Liver Function, etc.
- Mark abnormal values with their flag (High, Low, Critical).
- Use standard medical abbreviations.

STRICT JSON OUTPUT FORMAT:
{
  "parameters": [
    {
      "name": "White Blood Cell Count",
      "abbrev": "WBC",
      "unit": "K/uL",
      "refMin": 4.0,
      "refMax": 11.0,
      "values": [
        {
          "value": 10.5,
          "date": "2024-01-15",
          "status": "high"
        }
      ]
    }
  ],
  "dates": ["2024-01-15"],
  "notes": "Multi-page lab report merged successfully"
}

Return ONLY the JSON object, no markdown formatting.
`;

  // ═══════════════════════════════════════════════════════════════
  // BUILD CLAUDE API REQUEST WITH MULTIPLE IMAGES
  // ═══════════════════════════════════════════════════════════════
  const userContent = [];

  // Add all images to the content array
  imageArray.forEach((imgData, index) => {
    // Clean the base64 data
    const cleanData = imgData.replace(/^data:image\/\w+;base64,/, '');

    userContent.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: cleanData
      }
    });

    Logger.log(`✅ Added image ${index + 1}/${imageArray.length} to request`);
  });

  // Add the text prompt at the end
  userContent.push({
    type: "text",
    text: systemPrompt
  });

  // ═══════════════════════════════════════════════════════════════
  // SEND TO CLAUDE API
  // ═══════════════════════════════════════════════════════════════
  const payload = {
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 4096,
    temperature: 0,
    messages: [{
      role: "user",
      content: userContent
    }]
  };

  try {
    Logger.log(`📤 Sending request to Claude API with ${imageArray.length} images...`);

    const response = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
      method: "post",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const json = JSON.parse(response.getContentText());
    Logger.log(`📥 Response received`);

    // Check for API errors
    if (json.error) {
      Logger.log(`❌ API Error: ${json.error.message}`);
      return {
        success: false,
        error: json.error.message
      };
    }

    // Extract the AI response
    const aiContent = json.content[0].text;
    Logger.log(`📄 AI Response length: ${aiContent.length} chars`);

    // Parse the JSON response
    try {
      // Remove markdown code blocks if present
      const cleanJson = aiContent
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      const labData = JSON.parse(cleanJson);

      Logger.log(`✅ Successfully parsed lab data`);
      Logger.log(`📊 Found ${labData.parameters?.length || 0} parameters`);

      return {
        success: true,
        labData: labData,
        confidence: 0.9, // High confidence for multi-page analysis
        meta: {
          pagesAnalyzed: imageArray.length,
          interactionId: generateId()
        }
      };

    } catch (parseError) {
      Logger.log(`❌ JSON Parse Error: ${parseError.message}`);
      Logger.log(`📄 Raw response: ${aiContent.substring(0, 500)}`);

      return {
        success: false,
        error: "AI output was not valid JSON",
        debug: {
          rawResponse: aiContent.substring(0, 1000),
          parseError: parseError.message
        }
      };
    }

  } catch (fetchError) {
    Logger.log(`❌ Fetch Error: ${fetchError.message}`);
    return {
      success: false,
      error: `API Request failed: ${fetchError.message}`
    };
  }
}

// Helper function to generate unique IDs
function generateId() {
  return 'int_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}
```

### Step 3: Deploy the Changes

1. Click **Deploy** → **Manage deployments**
2. Click the **pencil icon** next to your active deployment
3. Change **Version** to "New version"
4. Add description: "Multi-page lab analysis support"
5. Click **Deploy**
6. **IMPORTANT**: Copy the new Web App URL if it changed

### Step 4: Test the Multi-Page Feature

1. Go to MedWard Pro
2. Open a patient profile
3. Click Labs → Upload Lab Report
4. **Select 2-3 images** (hold Ctrl/Cmd to select multiple)
5. Click Open
6. You should see: "Scanning 3 Pages... Stitching reports together"
7. Verify the preview shows all page thumbnails (numbered 1, 2, 3)

---

## Expected Behavior

### Single Image (Backward Compatible)
- Works exactly as before
- "Analyzing Lab Report..."

### Multiple Images (New Feature)
- Shows: "Scanning N Pages..."
- Displays numbered thumbnails (1, 2, 3...)
- Claude reads all pages as one document
- Merges duplicate tests automatically
- Shows: "✅ 3 pages analyzed and merged"

---

## Troubleshooting

### Error: "No images provided"
**Solution**: Clear browser cache and try again. The old single-image format might be cached.

### Error: "API Request failed"
**Solution**: Check that your Google Apps Script is deployed with the NEW code.

### Images not merging correctly
**Solution**: Ensure the images are from the SAME patient/report. Claude will try to merge based on test names and dates.

### Preview shows only 1 thumbnail despite uploading multiple
**Solution**: Check browser console for errors. The `state.pendingLabImages` array might not be populated correctly.

---

## Technical Notes

### Why Promise.all()?
```javascript
// WRONG (Sequential - Slow):
for (const file of files) {
  const compressed = await compressForAI(file); // Wait for each
}

// RIGHT (Parallel - Fast):
const compressed = await Promise.all(files.map(f => compressForAI(f)));
```

Compressing 3 images:
- **Sequential**: 6 seconds (2s per image)
- **Parallel**: 2 seconds (all at once)

### API Token Limits
Claude API has input token limits:
- Sonnet 3.5: 200K tokens
- 1 image ≈ 1,500 tokens
- Safe limit: ~10 images per request

The app automatically compresses images to stay under the API size limits.

---

## Support

If you encounter issues:
1. Check browser console (F12) for errors
2. Check Google Apps Script logs (View → Logs)
3. Verify API key is set in Script Properties
4. Test with a single image first to confirm basic functionality

---

**Master Shifu's Wisdom**: "The difference between a good medical app and a professional one is handling the edge cases gracefully. Multi-page analysis is one such edge case that separates hobbyist tools from clinical-grade software."
