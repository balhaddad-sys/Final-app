# MedWard v3.0 Enhancement Testing Guide

## Overview
This guide covers testing for the comprehensive improvements implemented in MedWard v3.0, focusing on four critical areas:

1. **More Efficient and Accurate Analysis**
2. **Better Lab/Clinical Data Differentiation**
3. **Improved Patient Ward Presentation**
4. **Neural Model Learning from AI Responses**

## Test Environment Setup

### Prerequisites
- Google Apps Script backend deployed with updated Code.gs
- ANTHROPIC_API_KEY configured in Script Properties
- Backend URL set in index.html or localStorage

### Browser Requirements
- Modern browser with IndexedDB support
- JavaScript enabled
- 10MB+ available storage for neural patterns

## Testing Checklist

### 1. Analysis Efficiency Tests

#### Test 1.1: Combined Upload+Analyze Endpoint
**Objective**: Verify single-request analysis is 50% faster

**Steps**:
1. Open browser DevTools Network tab
2. Upload a lab report image
3. Observe network requests

**Expected Results**:
- ✅ Single `uploadAndInterpret` request to backend
- ✅ No separate `uploadImage` + `interpret` requests
- ✅ Total time < 5 seconds for typical lab report
- ✅ Console shows: `[App] Processing image with enhanced vision...`

**Fallback Test**:
- If backend doesn't support combined endpoint, should automatically fall back to two-step
- Console should show: `[App] Falling back to two-step upload+analyze`

#### Test 1.2: Enhanced Vision Prompt
**Objective**: Verify improved extraction with structured JSON

**Steps**:
1. Upload a lab report with multiple values
2. Check Network tab response
3. Examine `extractedText` field

**Expected Results**:
- ✅ Response includes `labValues` array with structured data
- ✅ Each lab value has: name, value, unit, flag (if abnormal), reference
- ✅ Response includes `clinicalData` object with history/examination/diagnoses
- ✅ Response includes `dataType` field ('lab', 'clinical', or 'mixed')

#### Test 1.3: Client-Side Caching
**Objective**: Verify neural pattern matching works

**Steps**:
1. Upload a lab report (first time)
2. Note the processing time
3. Wait for analysis to complete
4. Upload the SAME lab report again
5. Note the processing time

**Expected Results**:
- ✅ First upload: ~3-5 seconds (API call)
- ✅ Second upload: < 500ms (cache hit from neural patterns)
- ✅ Console shows: `[Neural] Local pattern match: X.XX`
- ✅ Metrics show increased cache hit rate

---

### 2. Lab/Clinical Data Differentiation Tests

#### Test 2.1: Data Classification
**Objective**: Verify correct classification of document types

**Test Cases**:
```
A. Pure lab report → type: 'lab', confidence: >80%
B. Clinical note → type: 'clinical', confidence: >80%
C. Mixed document → type: 'mixed', confidence: >70%
```

**Steps**:
1. Upload each test case
2. Check console output: `[MedWard v6.0] Data classification:`

**Expected Results**:
- ✅ Data type badge appears at top of analysis
- ✅ Badge color: Lab (blue), Clinical (green), Mixed (blue)
- ✅ Confidence percentage shown

#### Test 2.2: Lab/Clinical Separation
**Objective**: Verify `separateLabFromClinical` method works correctly

**Steps**:
1. Upload a mixed document (lab values + clinical notes)
2. Check console: `[App] Data separated: X labs, Y history items`
3. Inspect results object in DevTools

**Expected Results**:
- ✅ `result.separatedData.labData.values` contains numeric lab values
- ✅ `result.separatedData.clinicalData.history` contains narrative text
- ✅ Lab patterns removed from clinical raw text
- ✅ No duplicate data between lab and clinical sections

#### Test 2.3: Visual Differentiation
**Objective**: Verify distinct visual sections for lab vs clinical

**Steps**:
1. Upload a mixed document
2. Switch to "Detailed" tab
3. Observe visual layout

**Expected Results**:
- ✅ Lab section: Blue gradient background, lab icon 🧪
- ✅ Clinical section: Green gradient background, clinical icon 📋
- ✅ Clear visual separation between sections
- ✅ Lab values in tabular format
- ✅ Clinical data in narrative format

---

### 3. Patient Ward Presentation Tests

#### Test 3.1: SBAR Format Generation
**Objective**: Verify SBAR presentation is generated correctly

**Steps**:
1. Upload a complete lab report
2. Check console: `[App] SBAR presentation generated`
3. Inspect `results.sbar` object in DevTools

**Expected Results**:
- ✅ `sbar.situation` contains patient status summary
- ✅ `sbar.background` array contains PMH, medications, symptoms
- ✅ `sbar.assessment` array contains diagnoses ranked by confidence
- ✅ `sbar.recommendation` array contains actionable next steps
- ✅ Urgent recommendations marked with priority: 'urgent'

#### Test 3.2: SBAR Rendering
**Objective**: Verify SBAR renders correctly in UI

**Steps**:
1. After analysis completes, switch to "Ward" tab
2. Observe SBAR sections

**Expected Results**:
- ✅ Four distinct sections: S-B-A-R
- ✅ Each section has colored label (S=blue, B=purple, A=orange, R=green)
- ✅ Situation: Patient status in one sentence
- ✅ Background: Medical history items with labels
- ✅ Assessment: Ranked diagnoses with confidence badges
- ✅ Recommendation: Prioritized actions with urgency indicators (🔴/🟡/🟢)

#### Test 3.3: Quick Glance Summary
**Objective**: Verify quick summary card displays correctly

**Steps**:
1. Complete an analysis
2. Look for quick glance card at top of detailed view

**Expected Results**:
- ✅ Card shows patient demographics (age, gender)
- ✅ Chief complaint or diagnosis displayed
- ✅ Status indicator: Stable (green), Abnormal (yellow), or Critical (red)
- ✅ Stats show count of critical/abnormal findings
- ✅ Vital signs displayed if available
- ✅ Critical status: Animated pulse effect on border

---

### 4. Neural Learning Tests

#### Test 4.1: Pattern Storage
**Objective**: Verify neural system stores patterns correctly

**Steps**:
1. Clear IndexedDB (DevTools → Application → IndexedDB → Delete)
2. Upload first lab report
3. Check console: `[Neural] Learned X patterns`
4. Open IndexedDB and inspect `MedWardNeural` database

**Expected Results**:
- ✅ Database created: `MedWardNeural`
- ✅ Object store: `patterns`
- ✅ Pattern count matches console output
- ✅ Each pattern has: id, type, signature, embedding, template
- ✅ Template includes interpretations for ALL tests (not just abnormal)

#### Test 4.2: Pattern Matching
**Objective**: Verify neural system matches similar inputs

**Steps**:
1. Upload lab report A
2. Wait for analysis
3. Upload slightly modified version of lab report A (same tests, similar values)
4. Check console for match info

**Expected Results**:
- ✅ Console shows: `[Neural] Finding matches for signature:`
- ✅ Console shows: `[Neural] Found X candidate matches`
- ✅ If match confidence > 70%: `[Neural] Local pattern match: X.XX`
- ✅ Response includes `meta.source: 'local'`
- ✅ Processing time < 500ms

#### Test 4.3: Learning from ALL Patterns
**Objective**: Verify system learns from normal and abnormal values

**Steps**:
1. Upload lab report with all normal values
2. Check pattern storage after analysis
3. Inspect stored pattern template

**Expected Results**:
- ✅ Pattern created even though all values are normal
- ✅ Template includes `interpretations` for every test
- ✅ Normal values have: `status: 'normal'`, `severity: 'normal'`
- ✅ `isOverallPattern: true` in pattern metadata
- ✅ Signature includes test names (even if normal)

#### Test 4.4: Cache Hit Rate Improvement
**Objective**: Verify cache hit rate increases over time

**Steps**:
1. Clear neural patterns
2. Upload 5 different lab reports
3. Upload the same 5 reports again
4. Check metrics display

**Expected Results**:
- ✅ First round: 0% cache hit rate, all API calls
- ✅ Second round: ~80-100% cache hit rate
- ✅ Metrics show: "X% cache hit rate"
- ✅ Average local response time < 500ms
- ✅ Patterns stored: 5-10 (one overall pattern per unique report)

---

### 5. Integration Tests

#### Test 5.1: End-to-End Single Image
**Objective**: Verify complete workflow for single image

**Steps**:
1. Login
2. Upload a lab report image
3. Wait for analysis
4. Switch between tabs (Detailed, Ward, Labs)

**Expected Results**:
- ✅ Login successful
- ✅ Image uploads (combined request)
- ✅ Analysis completes in < 5 seconds
- ✅ Detailed tab: Shows separated lab/clinical sections
- ✅ Ward tab: Shows SBAR presentation
- ✅ Labs tab: Shows categorized lab values with trends
- ✅ All abnormal values highlighted
- ✅ Critical values show alerts

#### Test 5.2: End-to-End Batch Processing
**Objective**: Verify batch processing works with new features

**Steps**:
1. Upload 3+ lab report images
2. Click "Analyze X Images"
3. Observe batch progress

**Expected Results**:
- ✅ Batch progress bar shows
- ✅ Each image processed with combined endpoint
- ✅ Progress updates: "Analyzing X of Y"
- ✅ Combined results view shows all findings
- ✅ Neural patterns learned from each unique report
- ✅ Subsequent batch of same images uses cache

#### Test 5.3: Neural Pattern Persistence
**Objective**: Verify patterns persist across sessions

**Steps**:
1. Upload and analyze a lab report
2. Close browser
3. Reopen MedWard
4. Upload the same lab report

**Expected Results**:
- ✅ Pattern loaded from IndexedDB on startup
- ✅ Console: `[Neural] Loaded X patterns from IndexedDB`
- ✅ Second upload uses cached pattern (< 500ms)
- ✅ No API call made for duplicate upload

---

### 6. Performance Benchmarks

#### Benchmark 6.1: Analysis Speed
**Target**: < 5 seconds for single image analysis

**Measurement**:
```javascript
// Open DevTools Console
const start = performance.now();
// Upload image
// Wait for completion
const end = performance.now();
console.log('Total time:', Math.round(end - start), 'ms');
```

**Expected**:
- First upload (API): 3000-5000ms
- Cached upload (local): 100-500ms
- Improvement: **50% faster** with combined endpoint

#### Benchmark 6.2: Cache Hit Rate
**Target**: > 80% after initial learning

**Measurement**:
- Check metrics display on dashboard
- Formula: (local hits / total analyses) × 100

**Expected**:
- After 10 unique reports: 0% cache
- After repeating same 10 reports: 80-90% cache
- After 100+ analyses with patterns: 70-80% cache

#### Benchmark 6.3: Pattern Storage Efficiency
**Target**: < 1MB for 100 patterns

**Measurement**:
```javascript
// DevTools → Application → IndexedDB → MedWardNeural
// Check database size
```

**Expected**:
- 1 pattern ≈ 5-10KB
- 100 patterns ≈ 500KB-1MB
- Automatic LRU eviction at 10,000 patterns

---

## Regression Tests

### Regression 1: Existing Features Still Work
- ✅ Text input analysis (non-image)
- ✅ Activity history saved
- ✅ User login/logout
- ✅ Batch processing
- ✅ PDF upload support

### Regression 2: Backwards Compatibility
- ✅ Backend without `uploadAndInterpret` falls back gracefully
- ✅ Missing PatientPresentation module doesn't break app
- ✅ Missing MedWardDataClassifier still shows results

### Regression 3: Error Handling
- ✅ Invalid image: Shows error toast
- ✅ Network failure: Shows error message
- ✅ Backend timeout: Falls back or retries
- ✅ Corrupted pattern storage: Clears and rebuilds

---

## Browser Compatibility

### Tested Browsers
- ✅ Chrome 120+ (recommended)
- ✅ Firefox 121+
- ✅ Safari 17+
- ✅ Edge 120+

### Known Issues
- Safari < 16: IndexedDB quota limitations
- Firefox < 115: TensorFlow.js performance issues

---

## Debugging Tips

### Enable Debug Mode
```javascript
// In browser console
localStorage.setItem('medward_debug', 'true');
location.reload();
```

### View Neural Metrics
```javascript
// After initializing neural system
if (window.MedWardNeural) {
  const metrics = neural.getMetrics();
  console.table(metrics);
}
```

### Export Neural State
```javascript
// For debugging learning issues
if (window.MedWardNeural) {
  const state = neural.exportState();
  console.log(JSON.stringify(state, null, 2));
}
```

### Clear All Patterns
```javascript
// Reset neural learning
if (window.MedWardNeural) {
  await neural.clearKnowledge();
  console.log('All patterns cleared');
}
```

---

## Success Criteria Summary

### ✅ Must Pass
1. Combined endpoint reduces API time by 40-50%
2. Lab/clinical data visually separated in UI
3. SBAR format displays correctly in ward view
4. Neural patterns stored and retrieved correctly
5. Cache hit rate > 70% after learning phase

### ⚡ Nice to Have
1. Quick glance summary displays
2. Data type badge shows at top
3. Trend indicators for lab values
4. Animated pulse on critical findings

### 🚨 Critical Failures
- Backend errors prevent any analysis
- IndexedDB unavailable breaks neural learning
- UI doesn't render (check browser console)
- Network requests timeout consistently

---

## Reporting Issues

When reporting issues, include:
1. Browser and version
2. Console logs (with errors)
3. Network tab (for backend issues)
4. Steps to reproduce
5. Expected vs actual behavior

## Next Steps After Testing

1. **All tests pass**: Ready for production deployment
2. **Minor issues**: Document and create tickets
3. **Major issues**: Roll back and investigate
4. **Performance issues**: Profile with DevTools

---

**Testing completed by**: _____________
**Date**: _____________
**Version**: MedWard v3.0
**Status**: ⬜ Pass  ⬜ Fail  ⬜ Needs Review
