#!/bin/bash
# Fast Deployment Script for MedWard Pro
# Usage: ./fast-deploy.sh "Your commit message"

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Fast Deploy Starting...${NC}"

# Get commit message
MSG="${1:-Quick update}"

# Git optimizations (run once)
git config core.compression 0
git config protocol.version 2

# Stage all changes
echo -e "${BLUE}📦 Staging changes...${NC}"
git add -A

# Commit
echo -e "${BLUE}💾 Committing...${NC}"
git commit -m "$MSG" --no-verify  # Skip hooks for speed

# Push
echo -e "${BLUE}⬆️  Pushing to GitHub...${NC}"
START=$(date +%s)
git push origin HEAD
END=$(date +%s)

ELAPSED=$((END - START))
echo -e "${GREEN}✅ Deployed in ${ELAPSED} seconds!${NC}"

# Show deployed URL (adjust to your GitHub Pages URL)
echo -e "${GREEN}🌐 Live at: https://balhaddad-sys.github.io/Final-app/${NC}"
