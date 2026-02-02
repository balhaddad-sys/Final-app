#!/bin/bash
# MedWard Pro Setup Script
# Run this from the medward-pro directory

set -e

echo "=== MedWard Pro Setup ==="
echo ""

# Check if we're in the right directory
if [ ! -f "firebase.json" ]; then
    echo "Error: firebase.json not found!"
    echo "Please run this script from the medward-pro directory:"
    echo "  cd /home/user/Final-app/medward-pro"
    echo "  ./setup.sh"
    exit 1
fi

echo "1. Installing main project dependencies..."
npm install

echo ""
echo "2. Installing functions dependencies..."
cd functions
npm install
cd ..

echo ""
echo "3. Building functions..."
cd functions
npm run build
cd ..

echo ""
echo "=== Setup Complete! ==="
echo ""
echo "You can now run:"
echo "  firebase deploy          # Deploy everything"
echo "  firebase deploy --only hosting   # Deploy hosting only"
echo "  firebase deploy --only functions # Deploy functions only"
echo "  npm run dev              # Start development server"
