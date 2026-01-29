#!/bin/bash

# MedWard Pro - Firebase Functions Diagnostic Script
# This script helps diagnose why Cloud Functions are returning "internal" errors

echo "🔍 Firebase Functions Diagnostic Tool"
echo "========================================"
echo ""

# Check if firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not installed"
    echo "   Install with: npm install -g firebase-tools"
    exit 1
fi

echo "✅ Firebase CLI installed: $(firebase --version)"
echo ""

# Check authentication
echo "📋 Checking Firebase authentication..."
if ! firebase login:list &> /dev/null; then
    echo "⚠️  Not logged in to Firebase"
    echo "   Run: firebase login"
else
    echo "✅ Authenticated"
    firebase login:list
fi
echo ""

# Check project
echo "📋 Current Firebase project..."
cd "$(dirname "$0")"
firebase use
echo ""

# List deployed functions
echo "📋 Listing deployed functions..."
echo "   This may take a moment..."
firebase functions:list --project medward-pro 2>&1 | head -50
echo ""

# Check function logs for errors
echo "📋 Checking recent function logs for errors..."
echo "   Looking for 'internal' errors..."
firebase functions:log --project medward-pro --limit 50 2>&1 | grep -i "error\|internal\|fail" | head -20
echo ""

# Test health check endpoint
echo "📋 Testing health check endpoint..."
HEALTH_URL="https://us-central1-medward-pro.cloudfunctions.net/healthCheck"
echo "   URL: $HEALTH_URL"
HTTP_CODE=$(curl -s -o /tmp/health-response.txt -w "%{http_code}" "$HEALTH_URL")
echo "   HTTP Status: $HTTP_CODE"
if [ "$HTTP_CODE" == "200" ]; then
    echo "   ✅ Health check succeeded!"
    echo "   Response:"
    cat /tmp/health-response.txt | jq . 2>/dev/null || cat /tmp/health-response.txt
else
    echo "   ❌ Health check failed"
    echo "   Response:"
    cat /tmp/health-response.txt
fi
echo ""

# Check functions configuration
echo "📋 Checking functions configuration..."
firebase functions:config:get --project medward-pro 2>&1
echo ""

# Test if API key is configured
echo "📋 Checking if Claude API key is configured..."
if firebase functions:config:get anthropic.key --project medward-pro 2>&1 | grep -q "null"; then
    echo "   ⚠️  Claude API key NOT configured"
    echo "   AI functions will fail until you run:"
    echo "   firebase functions:config:set anthropic.key=\"YOUR_KEY\" --project medward-pro"
else
    echo "   ✅ Claude API key is configured"
fi
echo ""

# Check firebase.json
echo "📋 Checking firebase.json configuration..."
if [ -f "firebase.json" ]; then
    echo "   Runtime: $(cat firebase.json | jq -r '.functions.runtime')"
    echo "   Region: $(cat firebase.json | jq -r '.functions.region // "us-central1 (default)"')"
else
    echo "   ❌ firebase.json not found!"
fi
echo ""

echo "========================================"
echo "📝 Summary:"
echo ""
echo "If functions are deployed but returning 'internal' errors, check:"
echo ""
echo "1️⃣  Function logs above for specific error messages"
echo "2️⃣  Claude API key configuration (required for AI functions)"
echo "3️⃣  GitHub Actions deployment logs:"
echo "   https://github.com/balhaddad-sys/Final-app/actions"
echo ""
echo "4️⃣  Firebase Console:"
echo "   https://console.firebase.google.com/project/medward-pro/functions"
echo ""
echo "5️⃣  Test the health check endpoint directly in browser:"
echo "   $HEALTH_URL"
echo ""
echo "If health check fails with 404, functions may not be deployed yet."
echo "If health check fails with 500, check function logs for errors."
echo "If health check succeeds, but other functions fail, they may need auth or API keys."
echo ""
