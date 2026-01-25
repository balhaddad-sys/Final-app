# Drug Monograph Feature - Usage Guide

## Overview

The Dynamic Drug Monograph feature provides **patient-specific AI analysis** for medications, considering:
- Patient age, gender, and lab values
- Current medication list for interaction checking
- Renal function (calculated CrCl) for dose adjustments
- Liver function (ALT/AST) for hepatic considerations
- Known allergies for safety alerts

## How to Use

### 1. From Medication List

When viewing a patient's medications, you'll see two info buttons:

- **🧠 AI Monograph**: Opens the new Smart Monograph with patient-specific analysis
- **📚 Drug Info**: Opens the existing drug information modal

### 2. Quick Access

Click the **"Smart Monograph – Patient-Specific Analysis"** button at the bottom of any medication card.

### 3. What You'll See

The monograph modal displays:

#### Safety Banner
- **✅ Likely Safe**: Green banner - drug is appropriate for this patient
- **⚠️ Caution**: Orange banner - requires monitoring or dose adjustment
- **⛔ Contraindicated**: Red banner - should not be used for this patient

#### Optimized Dosing Section
- Recommended dose specifically for this patient
- Renal/hepatic adjustment details
- Calculated based on CrCl and liver function

#### Interactions Card
- Lists interactions with patient's CURRENT medications only
- Not a generic list - specific to this patient
- Includes severity and management recommendations

#### Clinical Pearls
- 3 key points: Monitoring, Administration, Side Effects
- Actionable information for clinical use

## Backend Setup Required

### Step 1: Deploy to Google Apps Script

1. Open your Google Apps Script project (Code.gs)
2. Copy the `getDrugMonograph` function from `DRUG_MONOGRAPH_BACKEND.md`
3. Paste it into your Code.gs file
4. Add the case to your `doPost` function:
   ```javascript
   case 'getDrugInfo':
     result = getDrugMonograph(request);
     break;
   ```

### Step 2: Configure API Key

1. In Google Apps Script, go to Project Settings
2. Under Script Properties, add:
   - Property: `CLAUDE_API_KEY`
   - Value: Your Anthropic API key

### Step 3: Deploy

1. Click "Deploy" → "New deployment"
2. Select "Web app"
3. Execute as: Me
4. Who has access: Anyone
5. Copy the deployment URL
6. In your app settings, set this as your API URL

## Technical Details

### Frontend Function Call
```javascript
openDrugLearn('Metformin')
```

### API Request Format
```javascript
{
  action: 'getDrugInfo',
  drugName: 'Metformin',
  patientContext: {
    age: 65,
    gender: 'M',
    cr: 1.8,
    crcl: 45,
    alt: 25,
    ast: 30,
    allergies: 'Penicillin',
    meds: ['Lisinopril 10mg', 'Atorvastatin 40mg']
  }
}
```

### Expected Response
```javascript
{
  success: true,
  data: {
    safety_status: 'caution',
    safety_reason: 'CrCl 45 mL/min requires dose adjustment',
    dosing_rec: 'Start 500mg daily with meals, max 1000mg daily',
    renal_hepatic: 'Reduce dose if CrCl <45, avoid if <30',
    interactions: 'Monitor for hypoglycemia if on sulfonylureas',
    pearls: 'Monitor renal function q3-6 months. Take with meals to reduce GI upset. Hold 48h before contrast studies.'
  }
}
```

## Cost Optimization

The system uses **Claude Haiku 4.5** model which:
- Costs ~$0.001 per monograph lookup
- Responds in 1-2 seconds
- Provides structured JSON output
- Perfect balance of speed, cost, and quality

## Fallback Behavior

If the backend is not configured or the API call fails:
- User sees a friendly error toast
- Modal closes automatically
- Existing drug info feature still works via the 📚 button

## Why This is Better Than Static Lookups

| Feature | Static Drug Database | Smart Monograph |
|---------|---------------------|-----------------|
| Patient Age | ❌ Generic | ✅ Age-specific recommendations |
| Renal Function | ❌ Manual lookup | ✅ Auto-calculated CrCl with dosing |
| Drug Interactions | ❌ Full list (overwhelming) | ✅ Only current meds |
| Liver Disease | ❌ Generic warning | ✅ Based on actual ALT/AST |
| Allergies | ❌ Separate check | ✅ Integrated safety check |
| Time to Decision | 3-5 minutes | 10 seconds |

## Troubleshooting

### Modal doesn't open
- Ensure a patient is selected first
- Check browser console for errors

### "Failed to load drug info" error
- Verify backend Code.gs has getDrugMonograph function
- Check API key is set in Script Properties
- Verify API URL is configured in app settings

### Empty or incorrect data
- Check patient has lab values entered
- Verify medication list is populated
- Review patient demographics (age, gender)

## Future Enhancements

Potential improvements:
- Save monograph history for reference
- Export to PDF for documentation
- Add "Prescribe" button to directly add medication
- Include pharmacokinetic calculations
- Integrate with formulary pricing
- Add pregnancy/lactation warnings
