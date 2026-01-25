# Drug Monograph Backend Implementation

## Instructions for Google Apps Script (Code.gs)

Add the following function to your Google Apps Script `Code.gs` file to enable the dynamic drug monograph feature:

```javascript
// ═══════════════════════════════════════════════════════════════════
// DYNAMIC DRUG MONOGRAPH ENGINE
// ═══════════════════════════════════════════════════════════════════

function getDrugMonograph(request) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');

  // 1. EXTRACT CONTEXT
  const p = request.patientContext || {};
  const drug = request.drugName;

  // 2. THE CLINICAL PHARMACIST PROMPT
  const systemPrompt = `
    You are a Senior Clinical Pharmacist.

    TARGET DRUG: ${drug}

    PATIENT CONTEXT:
    - Age/Sex: ${p.age} ${p.gender}
    - Creatinine: ${p.cr || 'Unknown'} (Est CrCl: ${p.crcl || 'Unknown'} mL/min)
    - Liver: ALT ${p.alt || '-'}, AST ${p.ast || '-'}
    - Allergies: ${p.allergies || 'NKDA'}
    - Current Meds: ${(p.meds || []).join(', ')}

    TASK:
    Provide a specific, safety-focused monograph for THIS patient.

    OUTPUT FORMAT (Strict JSON):
    {
      "safety_status": "safe" | "caution" | "contraindicated",
      "safety_reason": "Short reason (e.g. 'CrCl < 30 requires dose reduction')",
      "dosing_rec": "Specific dosing for this patient (e.g. 'Reduce to 500mg q24h')",
      "renal_hepatic": "Summary of adjustments needed",
      "interactions": "List major interactions with CURRENT meds only",
      "pearls": "3 key clinical pearls (Monitoring, Administration, Side Effects)"
    }
  `;

  // 3. FAST API CALL (Haiku Model for Speed)
  const payload = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    temperature: 0,
    messages: [{ role: "user", content: systemPrompt }]
  };

  try {
    const response = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
      method: "post",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const json = JSON.parse(response.getContentText());
    if (json.error) return { success: false, error: json.error.message };

    const content = json.content[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
    return { success: true, data: JSON.parse(content) };

  } catch (e) {
    return { success: false, error: e.toString() };
  }
}
```

## Update doPost Function

Add this case to your `doPost` function's switch statement:

```javascript
case 'getDrugInfo':
  result = getDrugMonograph(request);
  break;
```

## Testing

After adding the function, test it with a request like:

```javascript
{
  "action": "getDrugInfo",
  "drugName": "Metformin",
  "patientContext": {
    "age": 65,
    "gender": "M",
    "cr": 1.8,
    "crcl": 45,
    "alt": 25,
    "ast": 30,
    "allergies": "Penicillin",
    "meds": ["Lisinopril 10mg", "Atorvastatin 40mg"]
  }
}
```

Expected response:
```javascript
{
  "success": true,
  "data": {
    "safety_status": "caution",
    "safety_reason": "CrCl 45 mL/min requires dose adjustment",
    "dosing_rec": "Start 500mg daily with meals, max 1000mg daily",
    "renal_hepatic": "Reduce dose if CrCl <45, avoid if <30",
    "interactions": "Monitor for hypoglycemia if on sulfonylureas",
    "pearls": "Monitor renal function q3-6 months. Take with meals to reduce GI upset. Hold 48h before contrast studies."
  }
}
```
