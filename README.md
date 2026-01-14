# 🏥 MedWard Master - Deployment Manual

**Version 4.0** | GitHub Pages + Google Apps Script Backend + Vision AI

---

## 📋 Overview

MedWard Master is a web-based medical report interpretation tool that combines a static frontend hosted on GitHub Pages with a serverless backend powered by Google Apps Script. This architecture eliminates the need for traditional server infrastructure while providing powerful AI-driven medical analysis with advanced vision capabilities.

### Architecture Components

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Frontend** | GitHub Pages | Static hosting for UI |
| **Backend API** | Google Apps Script | Request handling & AI orchestration |
| **AI Engine** | Claude 3.5 Sonnet / GPT-4 | Medical interpretation |
| **Vision AI** | Claude Vision / GPT-4 Vision | Advanced OCR & image analysis |
| **Storage** | Google Drive | Report archiving |

### ✨ New in Version 4.0

- **Claude Vision API**: Superior medical OCR with better accuracy on complex documents
- **GPT-4 Vision API**: Alternative vision provider for image analysis
- **Automatic Fallback**: Seamless switching between providers for high availability
- **Enhanced Image Analysis**: High-quality text extraction from medical images
- **Configurable AI Provider**: Choose between Claude and OpenAI based on your needs

---

## 🚀 Part 1: Backend Setup (Google Apps Script)

### 1.1 Create the Apps Script Project

1. Navigate to [script.google.com](https://script.google.com) and sign in with your Google account
2. Click **New Project**
3. Rename the project to `MedWard-Backend`
4. Delete the default code
5. Copy the entire contents of `backend/Code.gs` from this repository
6. Paste it into the Apps Script editor

### 1.2 Configure Script Properties (API Keys)

You need to configure **at least ONE** AI provider. Configure both for automatic fallback!

**Option A: Claude (Anthropic) - RECOMMENDED**

Claude 3.5 Sonnet provides superior medical OCR and interpretation:

1. Get your API key from [console.anthropic.com](https://console.anthropic.com/)
2. In Apps Script, go to **Project Settings** (gear icon ⚙️)
3. Scroll to **Script Properties**
4. Click **Add script property**
5. **Property name**: `ANTHROPIC_API_KEY`
6. **Value**: Your Anthropic API key (starts with `sk-ant-`)
7. (Optional) Add: `AI_PROVIDER` = `claude`
8. Click **Save**

**Option B: OpenAI (GPT-4)**

Use GPT-4 and GPT-4 Vision for analysis:

1. Get your API key from [platform.openai.com](https://platform.openai.com/)
2. In Apps Script, go to **Project Settings** (gear icon ⚙️)
3. Add script property:
4. **Property name**: `OPENAI_API_KEY`
5. **Value**: Your OpenAI API key (starts with `sk-`)
6. (Optional) Add: `AI_PROVIDER` = `openai`
7. Click **Save**

**Option C: Both APIs (Best)**

Configure both for automatic fallback and redundancy:
- Add both `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`
- Set `AI_PROVIDER` to your preferred default (`claude` or `openai`)
- System automatically falls back if one provider fails

> ⚠️ **Important**: Never commit API keys to the repository!

### 1.3 Enable Drive API (Optional)

Drive API is now optional (only needed for report archiving):

1. In the left sidebar, click **Services** (+ icon)
2. Search for and select **Drive API**
3. Click **Add**
4. Version: **v2** (default)

> 💡 **Note**: Vision AI no longer requires Drive API for OCR!

### 1.4 Deploy as Web App

1. Click **Deploy** > **New deployment**
2. Click the gear icon ⚙️ and select type: **Web app**
3. **Description**: `MedWard Backend v2.0 - Vision AI Enhanced`
4. **Execute as**: `Me (your-email@gmail.com)`
5. **Who has access**: `Anyone`
6. Click **Deploy**
7. **Copy the Web App URL** - you'll need this for the frontend!

**Example URL format:**
```
https://script.google.com/macros/s/ABC123xyz.../exec
```

> 💡 **Save this URL!** You will need it in Part 2.

### 1.5 Test Your Backend

Test the backend with text analysis:

1. Select `testInterpret` from the function dropdown
2. Click **Run** (▶️)
3. Check the execution log for JSON output

For image testing, modify `testImageInterpret()` with a real base64 image.

---

## 🌐 Part 2: Frontend Setup (GitHub Pages)

### 2.1 Repository Structure

Your repository is already structured correctly:

```
medward-master/
├── index.html
├── css/
│   └── styles.css
├── js/
│   └── app.js
├── assets/
│   └── (optional logo images)
├── backend/
│   └── Code.gs (reference only)
└── README.md
```

### 2.2 Configure Backend URL

**CRITICAL STEP**: Update the backend URL in your JavaScript file:

1. Open `js/app.js`
2. Find the `CONFIG` object at the top (around line 8)
3. Replace `YOUR_APPS_SCRIPT_URL_HERE` with your actual Apps Script URL from Step 1.4

```javascript
const CONFIG = {
  BACKEND_URL: 'https://script.google.com/macros/s/YOUR_ACTUAL_URL/exec',
  APP_NAME: 'MedWard Master',
  VERSION: '1.0.0'
};
```

### 2.3 Commit and Push Changes

```bash
git add .
git commit -m "Configure backend URL for MedWard Master"
git push origin claude/deploy-medward-master-sG8Pc
```

### 2.4 Enable GitHub Pages

1. Go to your GitHub repository
2. Click **Settings** > **Pages**
3. Under **Source**, select:
   - **Branch**: `claude/deploy-medward-master-sG8Pc` (or your main branch)
   - **Folder**: `/ (root)`
4. Click **Save**
5. Wait 1-2 minutes for deployment

Your site will be available at:
```
https://[username].github.io/[repository-name]/
```

---

## 🔧 Part 3: API Reference

### 3.1 Backend Endpoints

All requests are made to the single Apps Script Web App URL using POST with an `action` parameter.

#### Login Action

**Request:**
```json
{
  "action": "login",
  "username": "Dr. Smith"
}
```

**Response:**
```json
{
  "success": true,
  "token": "base64-encoded-token",
  "user": {
    "username": "Dr. Smith",
    "role": "doctor",
    "timestamp": "2026-01-14T12:00:00.000Z"
  }
}
```

#### Interpret Action (Text)

**Request:**
```json
{
  "action": "interpret",
  "text": "Hemoglobin: 10.2 g/dL (Low)\nWBC: 4.5 K/uL",
  "documentType": "lab",
  "username": "Dr. Smith"
}
```

#### Interpret Action (Image)

**Request:**
```json
{
  "action": "interpret",
  "image": "data:image/png;base64,iVBORw0KG...",
  "documentType": "imaging",
  "username": "Dr. Smith"
}
```

**Response (both):**
```json
{
  "success": true,
  "interpretation": {
    "summary": "Brief overview...",
    "keyFindings": ["Finding 1", "Finding 2"],
    "abnormalities": ["Abnormality 1"],
    "normalFindings": ["Normal 1"]
  },
  "clinicalPearls": ["Pearl 1", "Pearl 2"],
  "potentialQuestions": ["Question 1"],
  "presentation": {
    "patientFriendly": "Simple explanation...",
    "recommendations": ["Recommendation 1"]
  },
  "timestamp": "2026-01-14T12:00:00.000Z"
}
```

### 3.2 CORS Handling Strategy

GitHub Pages to Google Apps Script requests require special handling. The backend uses `text/plain` content type to avoid CORS preflight requests:

```javascript
async function callBackend(action, data) {
  const response = await fetch(CONFIG.BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action, ...data })
  });
  return response.json();
}
```

---

## 🛠️ Part 4: Troubleshooting

### 4.1 Common Issues

#### ❌ CORS Errors

**Symptoms:**
- `Access-Control-Allow-Origin` errors in browser console
- Requests failing with CORS policy errors

**Solutions:**
1. Ensure you're using `'text/plain'` content type, **not** `'application/json'`
2. Verify the Apps Script is deployed with **"Anyone"** access
3. Check that you're using the `/exec` URL, not the `/dev` URL
4. Clear browser cache and try again

#### ❌ API Key Issues

**Symptoms:**
- "OpenAI API key not configured" error
- 401 Unauthorized errors

**Solutions:**
1. Verify `OPENAI_API_KEY` is correctly set in **Script Properties** (not in code)
2. Ensure the API key has sufficient credits at [platform.openai.com](https://platform.openai.com)
3. Check API key permissions on OpenAI dashboard
4. Make sure there are no extra spaces in the key

#### ❌ OCR Not Working

**Symptoms:**
- Image uploads fail
- "OCR failed to extract text" error

**Solutions:**
1. Confirm **Drive API** is enabled in Apps Script Services
2. Grant necessary permissions when prompted during first run
3. Check image format (JPG, PNG supported; max 5MB recommended)
4. Try the **Test function** in Apps Script to debug

#### ❌ Backend URL Not Configured

**Symptoms:**
- Toast notification: "Please configure your Google Apps Script backend URL"

**Solution:**
1. Open `js/app.js`
2. Update `CONFIG.BACKEND_URL` with your actual Apps Script URL
3. Commit and push changes
4. Wait for GitHub Pages to redeploy (1-2 minutes)

### 4.2 Updating the Deployment

When you modify the Apps Script code:

1. Go to **Deploy** > **Manage deployments**
2. Click the **edit** icon (pencil) next to your active deployment
3. Select **Version**: **New version**
4. Add description (optional)
5. Click **Deploy**

> 💡 **Note**: The URL remains the same after updating. No frontend changes needed!

### 4.3 Testing the Backend

Use the built-in test function:

1. In Apps Script, open `Code.gs`
2. Select the `testInterpret` function from the dropdown
3. Click **Run** (▶️)
4. Check **Execution log** for results

---

## 🔐 Part 5: Security Considerations

### 5.1 API Key Protection

- ✅ **Never** expose API keys in frontend code
- ✅ Use Script Properties for sensitive configuration
- ✅ Consider implementing rate limiting in production
- ✅ Rotate API keys regularly

### 5.2 Data Privacy

- ⚠️ Medical data is processed through OpenAI API
- ⚠️ Reports are archived in your personal Google Drive
- ⚠️ **Consider HIPAA implications for production use**
- ⚠️ Implement proper user authentication for multi-user scenarios

### 5.3 Production Recommendations

For production deployment:

1. **Authentication**: Implement OAuth or Firebase Auth instead of simple username
2. **Logging**: Add request logging and monitoring
3. **Alerting**: Set up error alerting (e.g., email notifications)
4. **Custom Domain**: Use a custom domain with HTTPS
5. **Rate Limiting**: Implement request throttling
6. **Compliance**: Review HIPAA/GDPR requirements
7. **API Limits**: Monitor OpenAI and Google usage limits

---

## 📊 Part 6: Features & Usage

### 6.1 Core Features

✨ **Text Input Analysis**
- Paste lab results, imaging reports, or pathology reports
- AI-powered interpretation with clinical insights

✨ **Image Upload & OCR**
- Upload scanned medical reports (JPG, PNG)
- Automatic text extraction using Google Drive API

✨ **Document Types**
- 🧪 Laboratory Results
- 🔬 Imaging Reports (X-ray, CT, MRI)
- 🦠 Pathology Reports
- 📋 General Medical Reports

✨ **Comprehensive Results**
- Summary & Key Findings
- Abnormalities & Alerts
- Normal Findings
- Clinical Pearls for healthcare professionals
- Patient-friendly explanations
- Discussion points and recommendations

### 6.2 User Workflow

1. **Sign In**: Enter username (simple authentication)
2. **Choose Input Method**: Text or Image
3. **Select Report Type**: Lab, Imaging, Pathology, or General
4. **Analyze**: Click "Analyze Report" button
5. **Review Results**: Comprehensive AI interpretation
6. **Print/Copy**: Export results as needed
7. **New Analysis**: Start another interpretation

---

## 🧪 Part 7: Development & Testing

### 7.1 Local Development

To test the frontend locally:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx http-server

# Using PHP
php -S localhost:8000
```

Then open: `http://localhost:8000`

### 7.2 Testing Checklist

- [ ] Backend URL configured in `js/app.js`
- [ ] OpenAI API key set in Script Properties
- [ ] Drive API enabled in Apps Script
- [ ] Apps Script deployed with "Anyone" access
- [ ] GitHub Pages enabled and deployed
- [ ] Login functionality works
- [ ] Text input analysis works
- [ ] Image upload and OCR works
- [ ] All result sections display correctly
- [ ] Print functionality works
- [ ] Mobile responsive design works

---

## 📞 Support & Resources

### Documentation
- [Google Apps Script Documentation](https://developers.google.com/apps-script)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [GitHub Pages Documentation](https://docs.github.com/pages)

### Troubleshooting Resources
- Check browser console for errors (F12)
- Review Apps Script execution logs
- Test backend with `testInterpret()` function

### Contact
For issues or questions, please open an issue in the GitHub repository.

---

## 📝 License & Disclaimer

**Educational Use Only**: This tool is for educational and informational purposes only.

**Medical Disclaimer**: Always consult with qualified healthcare professionals for medical decisions. This AI tool does not replace professional medical judgment.

**Data Privacy**: Be aware that medical data is processed through third-party APIs (OpenAI). Do not use with real patient data without proper consent and HIPAA compliance measures.

---

## 🎉 Quick Start Summary

1. **Backend**: Deploy `backend/Code.gs` to Google Apps Script
2. **Configure**: Add OpenAI API key to Script Properties
3. **Enable**: Activate Drive API service
4. **Deploy**: Create Web App deployment
5. **Frontend**: Update `BACKEND_URL` in `js/app.js`
6. **Push**: Commit and push to GitHub
7. **Activate**: Enable GitHub Pages
8. **Test**: Visit your GitHub Pages URL and test!

---

**Version**: 3.5
**Last Updated**: January 2026
**Platform**: GitHub Pages + Google Apps Script
**AI Model**: OpenAI GPT-4

---

Made with ❤️ for healthcare professionals
