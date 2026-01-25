// ═══════════════════════════════════════════════════════════════════════════════
// MEDWARD PRO - INTERACTIVE TOUR GUIDE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
// A comprehensive guided walkthrough system using driver.js
// Contextually aware - adapts to which page the user is on
// ═══════════════════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // TOUR CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  const TOUR_CONFIG = {
    storageKey: 'MEDWARD_TOUR_SEEN',
    pageKey: 'MEDWARD_TOUR_PAGE_',
    showProgress: true,
    animate: true,
    allowClose: true,
    overlayColor: 'rgba(0, 20, 50, 0.75)',
    stagePadding: 10,
    stageRadius: 12,
    popoverClass: 'medward-tour-popover',
    doneBtnText: '✓ Got it!',
    nextBtnText: 'Next →',
    prevBtnText: '← Back',
    closeBtnText: '✕',
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // TOUR DEFINITIONS FOR EACH PAGE
  // ═══════════════════════════════════════════════════════════════════════════

  const TOURS = {
    // ═══════════════════════════════════════════════════════════════════════════
    // LOGIN PAGE TOUR
    // ═══════════════════════════════════════════════════════════════════════════
    login: {
      name: 'Login Tour',
      steps: [
        {
          popover: {
            title: '🏥 Welcome to MedWard Pro',
            description: 'Your secure, AI-powered clinical ward management system. Let\'s get you started!',
            side: 'center',
            align: 'center'
          }
        },
        {
          element: '.login-form',
          popover: {
            title: '🔐 Secure Login',
            description: 'Enter your credentials here. Your data is encrypted and synced securely across all your devices.',
            side: 'bottom'
          }
        },
        {
          element: 'input[type="text"], #username',
          popover: {
            title: '👤 Username',
            description: 'Enter your unique username. This identifies your account across the system.',
            side: 'bottom'
          }
        },
        {
          element: 'input[type="password"], #password',
          popover: {
            title: '🔒 Password',
            description: 'Enter your secure password. We recommend using a strong, unique password.',
            side: 'bottom'
          }
        },
        {
          element: '.remember-me, input[type="checkbox"]',
          popover: {
            title: '💾 Remember Me',
            description: 'Check this to stay logged in on this device. Uncheck for shared computers.',
            side: 'top'
          }
        },
        {
          element: 'button[type="submit"], .login-btn, .btn-primary',
          popover: {
            title: '🚀 Sign In',
            description: 'Click here to access your dashboard. All your patient data awaits!',
            side: 'top'
          }
        }
      ]
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // LANDING PAGE (UNIT SELECTION) TOUR
    // ═══════════════════════════════════════════════════════════════════════════
    landing: {
      name: 'Unit Selection Tour',
      steps: [
        {
          popover: {
            title: '🏥 Your Clinical Hub',
            description: 'Welcome to MedWard Pro! This is your command center for managing multiple hospital units.',
            side: 'center',
            align: 'center'
          }
        },
        {
          element: '.user-badge, .header-left',
          popover: {
            title: '👨‍⚕️ Your Profile',
            description: 'You\'re logged in and ready. Your username appears here for quick reference.',
            side: 'bottom'
          }
        },
        {
          element: '.quick-links, .quick-link',
          popover: {
            title: '⚡ Quick Access Tools',
            description: 'Jump directly to powerful clinical tools: AI Assistant, OnCall Toolkit, and Antibiotic Guide.',
            side: 'bottom'
          }
        },
        {
          element: '.quick-link.purple, a[href*="ai_assistant"]',
          popover: {
            title: '🤖 AI Clinical Assistant',
            description: 'Get instant AI-powered clinical decision support, drug information, and differential diagnoses.',
            side: 'right'
          }
        },
        {
          element: '.quick-link.teal, a[href*="oncall"]',
          popover: {
            title: '📟 OnCall Toolkit',
            description: 'Essential calculators for on-call: electrolyte corrections, vent settings, fluid calculations.',
            side: 'right'
          }
        },
        {
          element: '.quick-link.blue, a[href*="antibiotic"]',
          popover: {
            title: '💊 Antibiotic Stewardship',
            description: 'Evidence-based antibiotic selection guide with local sensitivity patterns.',
            side: 'right'
          }
        },
        {
          element: '.section-title, .units-grid',
          popover: {
            title: '🏢 Your Units',
            description: 'Create and manage separate clinical units. Each unit keeps its patients organized.',
            side: 'top'
          }
        },
        {
          element: '.unit-card, .add-unit-card',
          popover: {
            title: '➕ Create a Unit',
            description: 'Tap to create a new unit (e.g., "Ward 5A", "ICU", "Cardiology"). Color-code them for quick recognition.',
            side: 'bottom'
          }
        },
        {
          element: '.icon-btn[onclick*="Settings"], .settings-btn',
          popover: {
            title: '⚙️ Settings',
            description: 'Access settings, trash, cloud sync status, and app preferences here.',
            side: 'left'
          }
        },
        {
          element: '.icon-btn[onclick*="Logout"], .logout-btn',
          popover: {
            title: '🚪 Log Out',
            description: 'Sign out securely when you\'re done. Your data syncs automatically before logout.',
            side: 'left'
          }
        }
      ]
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // MAIN DASHBOARD TOUR
    // ═══════════════════════════════════════════════════════════════════════════
    dashboard: {
      name: 'Dashboard Tour',
      steps: [
        {
          popover: {
            title: '🎯 Your Clinical Dashboard',
            description: 'This is your main workspace. Manage patients, track labs, and coordinate care all in one place.',
            side: 'center',
            align: 'center'
          }
        },
        {
          element: '.dash-header, .app-header',
          popover: {
            title: '📊 Dashboard Header',
            description: 'Shows your current unit, sync status, and quick access to settings and navigation.',
            side: 'bottom'
          }
        },
        {
          element: '#syncStatus, .sync-indicator',
          popover: {
            title: '☁️ Sync Status',
            description: 'Real-time sync indicator. Green = synced, yellow = syncing, gray = offline mode.',
            side: 'bottom'
          }
        },
        {
          element: '.date-banner, #currentDate',
          popover: {
            title: '📅 Today\'s Date',
            description: 'Always know what day it is. Critical for medication timing and discharge planning.',
            side: 'bottom'
          }
        },
        {
          element: '#mainTabs, .tabs-container',
          popover: {
            title: '📑 Main Navigation',
            description: 'Switch between Patients, Clinical Scores, and Reference materials with these tabs.',
            side: 'bottom'
          }
        },
        {
          element: '.tab[data-tab="patients"]',
          popover: {
            title: '👥 Patients Tab',
            description: 'Your patient list. Filter by status (New, Active, Critical, Chronic) and manage admissions.',
            side: 'bottom'
          }
        },
        {
          element: '.tab[data-tab="scores"]',
          popover: {
            title: '📈 Clinical Scores',
            description: 'Access 30+ validated scoring calculators: CURB-65, Wells, HEART, qSOFA, NEWS2, and more.',
            side: 'bottom'
          }
        },
        {
          element: '.tab[data-tab="reference"]',
          popover: {
            title: '📚 Quick Reference',
            description: 'Critical lab values, emergency protocols, and clinical pearls at your fingertips.',
            side: 'bottom'
          }
        },
        {
          element: '.stats-grid, #statsBar',
          popover: {
            title: '📊 Patient Statistics',
            description: 'At-a-glance overview of your census. Tap any stat to filter your patient list.',
            side: 'bottom'
          }
        },
        {
          element: '.stat-card[data-filter="critical"]',
          popover: {
            title: '🚨 Critical Patients',
            description: 'Highlighted in red. These patients need immediate attention. Tap to filter.',
            side: 'bottom'
          }
        },
        {
          element: 'button[onclick*="openAddPatient"], .btn-primary',
          popover: {
            title: '➕ Add New Patient',
            description: 'Admit a new patient. Scan stickers, enter manually, or use voice input.',
            side: 'top'
          }
        },
        {
          element: 'a[href*="handover"], .btn-secondary',
          popover: {
            title: '📋 Handover Sheet',
            description: 'Generate a professional handover document for shift changes. Print or share digitally.',
            side: 'top'
          }
        },
        {
          element: '#patientsList, .patient-card',
          popover: {
            title: '👤 Patient Cards',
            description: 'Tap any patient to view their full profile, labs, medications, and plan of care.',
            side: 'top'
          }
        }
      ]
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // PATIENT PROFILE TOUR (within dashboard)
    // ═══════════════════════════════════════════════════════════════════════════
    patientProfile: {
      name: 'Patient Profile Tour',
      steps: [
        {
          element: '#patientProfile',
          popover: {
            title: '📋 Patient Profile',
            description: 'The complete clinical picture. Everything you need for informed decision-making.',
            side: 'center',
            align: 'center'
          }
        },
        {
          element: '.profile-header',
          popover: {
            title: '👤 Patient Header',
            description: 'Quick demographics, bed location, and action buttons for discharge, edit, and delete.',
            side: 'bottom'
          }
        },
        {
          element: '.back-btn',
          popover: {
            title: '← Back',
            description: 'Return to your patient list. Changes auto-save.',
            side: 'right'
          }
        },
        {
          element: '#profileDischargeBtn',
          popover: {
            title: '🏠 Discharge',
            description: 'Mark patient as discharged. Add discharge summary and follow-up instructions.',
            side: 'bottom'
          }
        },
        {
          element: '.profile-sidebar, #profileSidebar',
          popover: {
            title: '📑 Navigation Sidebar',
            description: 'Jump to any section: Overview, Medications, History, Labs, Imaging, Scores, Fluids, Plans.',
            side: 'right'
          }
        },
        {
          element: '.profile-nav-item[data-ptab="overview"]',
          popover: {
            title: '📊 Overview',
            description: 'Key information at a glance: diagnosis, vitals, allergies, and clinical summary.',
            side: 'right'
          }
        },
        {
          element: '.profile-nav-item[data-ptab="meds"]',
          popover: {
            title: '💊 Medications',
            description: 'Full medication list with doses, frequencies, and AI-powered drug interaction checking.',
            side: 'right'
          }
        },
        {
          element: '.profile-nav-item[data-ptab="labs"]',
          popover: {
            title: '🧪 Labs',
            description: 'Upload lab photos for AI extraction. View trends and flag abnormal results.',
            side: 'right'
          }
        },
        {
          element: '.profile-nav-item[data-ptab="history"]',
          popover: {
            title: '📜 History',
            description: 'Past medical history, surgical history, and uploaded clinical documents.',
            side: 'right'
          }
        },
        {
          element: '.profile-nav-item[data-ptab="plans"]',
          popover: {
            title: '✅ Plans & Tasks',
            description: 'Create and track clinical tasks. AI suggests management plans based on diagnosis.',
            side: 'right'
          }
        }
      ]
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // ONCALL ASSISTANT TOUR
    // ═══════════════════════════════════════════════════════════════════════════
    oncall: {
      name: 'OnCall Toolkit Tour',
      steps: [
        {
          popover: {
            title: '📟 OnCall Toolkit',
            description: 'Your essential companion for on-call shifts. Verified calculators and protocols when you need them most.',
            side: 'center',
            align: 'center'
          }
        },
        {
          element: '.oncall-header, .page-header',
          popover: {
            title: '⚡ Quick Access Header',
            description: 'Navigation and search. Find any calculator or protocol instantly.',
            side: 'bottom'
          }
        },
        {
          element: '.search-input, #searchInput',
          popover: {
            title: '🔍 Search',
            description: 'Type to find calculators: "potassium", "sodium", "insulin", "vancomycin"...',
            side: 'bottom'
          }
        },
        {
          element: '.category-tabs, .oncall-tabs',
          popover: {
            title: '📂 Categories',
            description: 'Browse by category: Electrolytes, Fluids, Insulin, Antibiotics, Emergency.',
            side: 'bottom'
          }
        },
        {
          element: '.calc-card, .protocol-card',
          popover: {
            title: '🧮 Calculators',
            description: 'Tap any card to open the calculator. Results are evidence-based with references.',
            side: 'top'
          }
        },
        {
          element: '[data-calc="potassium"], .calc-card',
          popover: {
            title: '🍌 Potassium Correction',
            description: 'Calculate potassium replacement based on level, weight, and route preference.',
            side: 'right'
          }
        },
        {
          element: '[data-calc="sodium"], .calc-card',
          popover: {
            title: '🧂 Sodium Correction',
            description: 'Safe sodium correction calculator with rate limits to prevent osmotic demyelination.',
            side: 'right'
          }
        },
        {
          element: '[data-calc="insulin"], .calc-card',
          popover: {
            title: '💉 Insulin Protocols',
            description: 'DKA, HHS, and sliding scale insulin calculators with monitoring reminders.',
            side: 'right'
          }
        },
        {
          element: '.emergency-section, .critical-section',
          popover: {
            title: '🚨 Emergency Protocols',
            description: 'Critical situations: Hyperkalemia, Anaphylaxis, Status Epilepticus, Sepsis.',
            side: 'top'
          }
        }
      ]
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // AI ASSISTANT TOUR
    // ═══════════════════════════════════════════════════════════════════════════
    aiAssistant: {
      name: 'AI Assistant Tour',
      steps: [
        {
          popover: {
            title: '🤖 AI Clinical Assistant',
            description: 'Your intelligent clinical partner. Ask questions, get differential diagnoses, and explore drug information.',
            side: 'center',
            align: 'center'
          }
        },
        {
          element: '.chat-container, #chatContainer',
          popover: {
            title: '💬 Chat Interface',
            description: 'Have a conversation with the AI. Ask clinical questions in natural language.',
            side: 'bottom'
          }
        },
        {
          element: '.quick-prompts, .suggestion-chips',
          popover: {
            title: '⚡ Quick Prompts',
            description: 'Common queries at your fingertips. Tap for instant access to frequent questions.',
            side: 'top'
          }
        },
        {
          element: '.input-area, #messageInput',
          popover: {
            title: '✍️ Type Your Question',
            description: 'Examples: "Differential for chest pain", "Amoxicillin dose for pneumonia", "Interpret this ABG"',
            side: 'top'
          }
        },
        {
          element: '.send-btn, #sendBtn',
          popover: {
            title: '📤 Send',
            description: 'Submit your question. The AI processes and responds within seconds.',
            side: 'left'
          }
        },
        {
          element: '.context-toggle, #patientContext',
          popover: {
            title: '👤 Patient Context',
            description: 'Link a specific patient. The AI tailors responses to their age, conditions, and medications.',
            side: 'top'
          }
        },
        {
          element: '.disclaimer-banner, .ai-disclaimer',
          popover: {
            title: '⚠️ Important Notice',
            description: 'AI is a decision support tool, not a replacement for clinical judgment. Always verify critical information.',
            side: 'bottom'
          }
        }
      ]
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // ANTIBIOTIC GUIDE TOUR
    // ═══════════════════════════════════════════════════════════════════════════
    antibiotic: {
      name: 'Antibiotic Guide Tour',
      steps: [
        {
          popover: {
            title: '💊 Antibiotic Stewardship Guide',
            description: 'Evidence-based antibiotic selection. Choose the right drug, dose, and duration.',
            side: 'center',
            align: 'center'
          }
        },
        {
          element: '.indication-selector, #indicationSelect',
          popover: {
            title: '🎯 Select Indication',
            description: 'Start by selecting the infection type: Respiratory, UTI, Skin/Soft Tissue, etc.',
            side: 'bottom'
          }
        },
        {
          element: '.severity-selector, .severity-toggle',
          popover: {
            title: '📊 Severity',
            description: 'Mild, Moderate, or Severe? This affects the recommended agent and route.',
            side: 'bottom'
          }
        },
        {
          element: '.recommendation-card, .antibiotic-card',
          popover: {
            title: '💉 Recommendations',
            description: 'Evidence-based first-line, second-line, and penicillin-allergic alternatives.',
            side: 'top'
          }
        },
        {
          element: '.dose-info, .dosing-details',
          popover: {
            title: '💊 Dosing (UpToDate)',
            description: 'Evidence-based dosing from UpToDate. Includes renal/hepatic adjustments, weight-based calculations, and monitoring parameters.',
            side: 'right'
          }
        },
        {
          element: '.duration-info, .duration-badge',
          popover: {
            title: '⏱️ Duration',
            description: 'Recommended treatment duration based on current guidelines.',
            side: 'right'
          }
        },
        {
          element: '.sensitivity-data, .antibiogram',
          popover: {
            title: '🧫 Local Antibiogram',
            description: 'Sensitivity patterns from local data. Updated regularly for accurate empiric therapy.',
            side: 'top'
          }
        },
        {
          element: '.references-btn, .evidence-link',
          popover: {
            title: '📚 References',
            description: 'Source guidelines and evidence. UpToDate, IDSA, Sanford, and local protocols linked here.',
            side: 'top'
          }
        }
      ]
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // HANDOVER PAGE TOUR
    // ═══════════════════════════════════════════════════════════════════════════
    handover: {
      name: 'Handover Tour',
      steps: [
        {
          popover: {
            title: '📋 Shift Handover',
            description: 'Generate professional handover documents for seamless shift transitions.',
            side: 'center',
            align: 'center'
          }
        },
        {
          element: '.handover-header',
          popover: {
            title: '📝 Handover Header',
            description: 'Automatic date, time, and unit information for documentation.',
            side: 'bottom'
          }
        },
        {
          element: '.patient-summary-list',
          popover: {
            title: '👥 Patient Summaries',
            description: 'Auto-generated from your patient list. Key diagnoses, active issues, and pending tasks.',
            side: 'bottom'
          }
        },
        {
          element: '.priority-indicators',
          popover: {
            title: '🚨 Priority Flags',
            description: 'Critical patients highlighted. Pending labs and follow-ups clearly marked.',
            side: 'right'
          }
        },
        {
          element: '.pending-tasks-section',
          popover: {
            title: '✅ Pending Tasks',
            description: 'Outstanding tasks that need handover. Nothing falls through the cracks.',
            side: 'top'
          }
        },
        {
          element: '.export-btn, #exportPdf',
          popover: {
            title: '📄 Export PDF',
            description: 'Generate a clean PDF for printing or digital sharing.',
            side: 'left'
          }
        },
        {
          element: '.share-btn, #shareHandover',
          popover: {
            title: '📤 Share',
            description: 'Send directly to colleagues via email or messaging apps.',
            side: 'left'
          }
        }
      ]
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // MONITOR PAGE TOUR
    // ═══════════════════════════════════════════════════════════════════════════
    monitor: {
      name: 'System Monitor Tour',
      steps: [
        {
          popover: {
            title: '⚡ MedWard System Monitor',
            description: 'God Mode activated! Monitor system health, track API performance, and review audit logs in real-time.',
            side: 'center',
            align: 'center'
          }
        },
        {
          element: '.topbar',
          popover: {
            title: '📊 Monitor Header',
            description: 'System status, server time, and quick controls at a glance.',
            side: 'bottom'
          }
        },
        {
          element: '.status-badge',
          popover: {
            title: '🟢 System Status',
            description: 'Real-time connection indicator. Green = online, Red = connection lost.',
            side: 'bottom'
          }
        },
        {
          element: '#serverTime',
          popover: {
            title: '🕒 Server Time',
            description: 'Current server timestamp for log correlation and debugging.',
            side: 'bottom'
          }
        },
        {
          element: '.sidebar',
          popover: {
            title: '📈 System Metrics',
            description: 'Key performance indicators: total users, error rates, latency, and storage usage.',
            side: 'right'
          }
        },
        {
          element: '#statUsers',
          popover: {
            title: '👥 Total Users',
            description: 'Number of registered accounts in the system.',
            side: 'right'
          }
        },
        {
          element: '#statErrors',
          popover: {
            title: '⚠️ Error Rate',
            description: 'Percentage of failed operations. Card changes color based on severity (Green < 5%, Amber < 10%, Red > 10%).',
            side: 'right'
          }
        },
        {
          element: '#statLatency',
          popover: {
            title: '⚡ Average Latency',
            description: 'API response time averaged over recent pings. Lower is better!',
            side: 'right'
          }
        },
        {
          element: '#statStorage',
          popover: {
            title: '💾 Storage Used',
            description: 'Current Google Drive storage quota consumption.',
            side: 'right'
          }
        },
        {
          element: '.graph-section',
          popover: {
            title: '📊 Latency Graph',
            description: 'Real-time visualization of API response times. Bars update every 2 seconds.',
            side: 'top'
          }
        },
        {
          element: '#currentLatency',
          popover: {
            title: '⏱️ Current Latency',
            description: 'Latest ping result. Green = fast, Amber = slow (>1s), Red = critical (>2s).',
            side: 'left'
          }
        },
        {
          element: '#latencyGraph',
          popover: {
            title: '📈 Heartbeat Monitor',
            description: 'Visual timeline of API health. Spike detection helps identify performance issues.',
            side: 'top'
          }
        },
        {
          element: '.terminal-section',
          popover: {
            title: '📝 Event Log Terminal',
            description: 'Live audit log of all system events: logins, data operations, errors, and more.',
            side: 'top'
          }
        },
        {
          element: '.terminal-tabs',
          popover: {
            title: '🔍 Log Filters',
            description: 'Filter events by type: All Events, Errors only, Logins, or Data Operations.',
            side: 'bottom'
          }
        },
        {
          element: '#terminal',
          popover: {
            title: '🖥️ Live Terminal',
            description: 'Scrollable log view with timestamps, event types, users, and details. Auto-updates every 10 seconds.',
            side: 'top'
          }
        },
        {
          element: '.quick-actions',
          popover: {
            title: '⚙️ Quick Actions',
            description: 'Administrative controls: Force sync stats, export logs, or purge old data.',
            side: 'top'
          }
        },
        {
          element: '.action-btn[onclick*="fetchStats"]',
          popover: {
            title: '🔄 Force Sync',
            description: 'Manually refresh all statistics and logs from the server.',
            side: 'top'
          }
        },
        {
          element: '.action-btn[onclick*="exportLogs"]',
          popover: {
            title: '📥 Export Logs',
            description: 'Download current logs as JSON for external analysis or archiving.',
            side: 'top'
          }
        },
        {
          element: '.action-btn.danger',
          popover: {
            title: '🗑️ Purge Logs',
            description: 'Permanently delete all system logs. Use with caution - requires confirmation.',
            side: 'top'
          }
        },
        {
          element: '.btn[onclick*="exitMonitor"]',
          popover: {
            title: '✕ Exit Monitor',
            description: 'Leave God Mode and return to login. Your admin session will be cleared.',
            side: 'left'
          }
        }
      ]
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  function detectCurrentPage() {
    const path = window.location.pathname.toLowerCase();
    const html = document.documentElement.innerHTML.toLowerCase();

    if (path.includes('login') || document.querySelector('.login-container')) return 'login';
    if (path.includes('landing') || document.querySelector('.units-grid')) return 'landing';
    if (path.includes('dashboard') || document.querySelector('.dash-content')) return 'dashboard';
    if (path.includes('oncall') || document.querySelector('.oncall-content')) return 'oncall';
    if (path.includes('ai_assistant') || document.querySelector('.chat-container')) return 'aiAssistant';
    if (path.includes('antibiotic') || document.querySelector('.antibiotic-guide')) return 'antibiotic';
    if (path.includes('handover') || document.querySelector('.handover-content')) return 'handover';
    if (path.includes('monitor') || document.querySelector('.main-grid') && document.getElementById('latencyGraph')) return 'monitor';

    // Fallback: check for specific elements
    if (document.getElementById('patientProfile')?.classList.contains('active')) return 'patientProfile';
    if (document.getElementById('mainTabs')) return 'dashboard';

    return 'dashboard'; // Default
  }

  function hasSeenTour(page) {
    return localStorage.getItem(TOUR_CONFIG.pageKey + page) === 'true';
  }

  function markTourSeen(page) {
    localStorage.setItem(TOUR_CONFIG.pageKey + page, 'true');
    localStorage.setItem(TOUR_CONFIG.storageKey, 'true');
  }

  function resetAllTours() {
    Object.keys(TOURS).forEach(page => {
      localStorage.removeItem(TOUR_CONFIG.pageKey + page);
    });
    localStorage.removeItem(TOUR_CONFIG.storageKey);
  }

  function filterStepsForPage(steps) {
    return steps.filter(step => {
      if (!step.element) return true; // Non-element steps always show

      try {
        const el = document.querySelector(step.element);
        return el && el.offsetParent !== null; // Element exists and is visible
      } catch (error) {
        // If querySelector fails (invalid selector), log the error and exclude this step
        console.warn(`⚠️ Invalid selector or querySelector error for step:`, step.element, error.message);
        return false;
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN TOUR FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  function startTour(forcePage = null, force = false) {
    // Check if driver.js is loaded (can be either a function or an object)
    if (typeof window.driver === 'undefined') {
      console.error('❌ Driver.js not loaded. Make sure to include the library.');
      alert('Tour system not available. Please refresh the page.');
      return;
    }

    // Get the driver function (handle both old and new versions)
    let driverFunction;
    if (typeof window.driver === 'function') {
      // Old version: window.driver is directly a function
      driverFunction = window.driver;
    } else if (typeof window.driver === 'object' && window.driver !== null && typeof window.driver.driver === 'function') {
      // New version: window.driver is an object with a driver method
      driverFunction = window.driver.driver;
    } else {
      console.error('❌ window.driver exists but is not usable. Type:', typeof window.driver, 'Value:', window.driver);
      alert('Tour system error. Driver.js is not properly initialized.');
      return;
    }

    const page = forcePage || detectCurrentPage();
    const tourConfig = TOURS[page];

    if (!tourConfig) {
      console.warn(`⚠️ No tour defined for page: ${page}`);
      return;
    }

    // Check if already seen (unless forced)
    if (!force && hasSeenTour(page)) {
      console.log(`ℹ️ Tour for ${page} already seen. Use startTour('${page}', true) to force.`);
      return;
    }

    // Filter steps to only include visible elements
    const filteredSteps = filterStepsForPage(tourConfig.steps);

    if (filteredSteps.length === 0) {
      console.warn(`⚠️ No visible elements for tour: ${page}`);
      return;
    }

    try {
      // Initialize driver.js - call the driver function
      const driverObj = driverFunction({
        showProgress: TOUR_CONFIG.showProgress,
        animate: TOUR_CONFIG.animate,
        allowClose: TOUR_CONFIG.allowClose,
        overlayColor: TOUR_CONFIG.overlayColor,
        stagePadding: TOUR_CONFIG.stagePadding,
        stageRadius: TOUR_CONFIG.stageRadius,
        popoverClass: TOUR_CONFIG.popoverClass,
        doneBtnText: TOUR_CONFIG.doneBtnText,
        nextBtnText: TOUR_CONFIG.nextBtnText,
        prevBtnText: TOUR_CONFIG.prevBtnText,
        closeBtnText: TOUR_CONFIG.closeBtnText,
        steps: filteredSteps,
        onDestroyStarted: () => {
          markTourSeen(page);
          console.log(`✅ Tour completed for: ${page}`);
        }
      });

      // Verify the driver object was created successfully
      if (!driverObj || typeof driverObj.drive !== 'function') {
        throw new Error('Driver object was not created properly or does not have a drive method');
      }

      // Start the tour
      console.log(`🚀 Starting tour: ${tourConfig.name}`);
      driverObj.drive();
    } catch (error) {
      console.error('❌ Error starting tour:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        driverType: typeof window.driver
      });
      alert('Failed to start tour. Please check the console for details.');
    }
  }

  function startFullTour(force = false) {
    // Start the tour for the current page
    const page = detectCurrentPage();
    startTour(page, force);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTO-LAUNCH LOGIC
  // ═══════════════════════════════════════════════════════════════════════════

  function autoLaunchTour() {
    const page = detectCurrentPage();
    
    // Only auto-launch if never seen any tour
    if (!localStorage.getItem(TOUR_CONFIG.storageKey)) {
      setTimeout(() => {
        startTour(page, false);
      }, 1500); // Wait for UI to settle
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INJECT CUSTOM STYLES
  // ═══════════════════════════════════════════════════════════════════════════

  function injectTourStyles() {
    const styles = `
      /* MedWard Tour Custom Styles */
      .medward-tour-popover {
        --djs-bg: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
        --djs-title-color: #005eb8;
        --djs-text-color: #334155;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      }
      
      .medward-tour-popover .driver-popover {
        background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%) !important;
        border: 1px solid rgba(0, 94, 184, 0.2) !important;
        border-radius: 16px !important;
        box-shadow: 0 20px 40px rgba(0, 30, 60, 0.2), 0 0 0 1px rgba(0, 94, 184, 0.05) !important;
        padding: 0 !important;
        overflow: hidden;
        max-width: 340px;
      }
      
      .medward-tour-popover .driver-popover-title {
        font-size: 1.1rem !important;
        font-weight: 700 !important;
        color: #005eb8 !important;
        padding: 20px 20px 8px !important;
        margin: 0 !important;
        background: linear-gradient(135deg, rgba(0, 94, 184, 0.06) 0%, rgba(0, 94, 184, 0.02) 100%);
        border-bottom: 1px solid rgba(0, 94, 184, 0.1);
      }
      
      .medward-tour-popover .driver-popover-description {
        font-size: 0.9rem !important;
        color: #475569 !important;
        line-height: 1.6 !important;
        padding: 16px 20px !important;
        margin: 0 !important;
      }
      
      .medward-tour-popover .driver-popover-footer {
        padding: 12px 16px !important;
        background: #f8fafc;
        border-top: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      
      .medward-tour-popover .driver-popover-progress-text {
        font-size: 0.75rem !important;
        color: #94a3b8 !important;
        font-weight: 500;
      }
      
      .medward-tour-popover .driver-popover-navigation-btns {
        display: flex;
        gap: 8px;
      }
      
      .medward-tour-popover .driver-popover-prev-btn,
      .medward-tour-popover .driver-popover-next-btn {
        padding: 8px 16px !important;
        border-radius: 8px !important;
        font-size: 0.85rem !important;
        font-weight: 600 !important;
        border: none !important;
        cursor: pointer !important;
        transition: all 0.2s !important;
      }
      
      .medward-tour-popover .driver-popover-prev-btn {
        background: #f1f5f9 !important;
        color: #475569 !important;
      }
      
      .medward-tour-popover .driver-popover-prev-btn:hover {
        background: #e2e8f0 !important;
      }
      
      .medward-tour-popover .driver-popover-next-btn {
        background: linear-gradient(135deg, #005eb8 0%, #003087 100%) !important;
        color: #ffffff !important;
      }
      
      .medward-tour-popover .driver-popover-next-btn:hover {
        background: linear-gradient(135deg, #0077cc 0%, #005eb8 100%) !important;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 94, 184, 0.3);
      }
      
      .medward-tour-popover .driver-popover-close-btn {
        position: absolute !important;
        top: 12px !important;
        right: 12px !important;
        width: 28px !important;
        height: 28px !important;
        border-radius: 8px !important;
        background: rgba(0, 0, 0, 0.05) !important;
        color: #64748b !important;
        border: none !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 1rem !important;
        transition: all 0.2s !important;
      }
      
      .medward-tour-popover .driver-popover-close-btn:hover {
        background: rgba(239, 68, 68, 0.1) !important;
        color: #ef4444 !important;
      }
      
      .medward-tour-popover .driver-popover-arrow {
        border-color: #ffffff !important;
      }
      
      /* Dark mode support */
      body.dark-theme .medward-tour-popover .driver-popover {
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%) !important;
        border-color: rgba(96, 165, 250, 0.2) !important;
      }
      
      body.dark-theme .medward-tour-popover .driver-popover-title {
        color: #60a5fa !important;
        background: linear-gradient(135deg, rgba(96, 165, 250, 0.1) 0%, rgba(96, 165, 250, 0.02) 100%);
        border-bottom-color: rgba(96, 165, 250, 0.1);
      }
      
      body.dark-theme .medward-tour-popover .driver-popover-description {
        color: #cbd5e1 !important;
      }
      
      body.dark-theme .medward-tour-popover .driver-popover-footer {
        background: #0f172a;
        border-top-color: #334155;
      }
      
      body.dark-theme .medward-tour-popover .driver-popover-progress-text {
        color: #64748b !important;
      }
      
      body.dark-theme .medward-tour-popover .driver-popover-prev-btn {
        background: #334155 !important;
        color: #cbd5e1 !important;
      }
      
      body.dark-theme .medward-tour-popover .driver-popover-prev-btn:hover {
        background: #475569 !important;
      }
      
      body.dark-theme .medward-tour-popover .driver-popover-next-btn {
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
      }
      
      body.dark-theme .medward-tour-popover .driver-popover-close-btn {
        background: rgba(255, 255, 255, 0.05) !important;
        color: #94a3b8 !important;
      }
      
      body.dark-theme .medward-tour-popover .driver-popover-arrow {
        border-color: #1e293b !important;
      }
      
      /* Help button floating style */
      .medward-help-btn {
        position: fixed;
        bottom: 80px;
        right: 16px;
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: linear-gradient(135deg, #005eb8 0%, #003087 100%);
        color: white;
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 16px rgba(0, 94, 184, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.4rem;
        z-index: 9998;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      .medward-help-btn:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 24px rgba(0, 94, 184, 0.5);
      }
      
      .medward-help-btn:active {
        transform: scale(0.95);
      }
      
      body.dark-theme .medward-help-btn {
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        box-shadow: 0 4px 16px rgba(59, 130, 246, 0.4);
      }
    `;

    const styleEl = document.createElement('style');
    styleEl.id = 'medward-tour-styles';
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE HELP BUTTON
  // ═══════════════════════════════════════════════════════════════════════════

  function createHelpButton() {
    // Check if button already exists
    if (document.querySelector('.medward-help-btn')) return;

    const btn = document.createElement('button');
    btn.className = 'medward-help-btn';
    btn.innerHTML = '?';
    btn.title = 'App Tour - Click to start';
    btn.setAttribute('aria-label', 'Start guided tour');
    btn.onclick = () => {
      if (typeof window.driver === 'undefined') {
        alert('Tour system is loading... Please try again in a moment.');
        return;
      }
      // Check if driver is available (either as function or object with driver method)
      const isDriverAvailable =
        (typeof window.driver === 'function') ||
        (typeof window.driver === 'object' && window.driver !== null && typeof window.driver.driver === 'function');

      if (!isDriverAvailable) {
        alert('Tour system error. Please refresh the page and try again.');
        console.error('window.driver is not usable. Type:', typeof window.driver);
        return;
      }
      startTour(null, true);
    };

    document.body.appendChild(btn);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  function waitForDriver(callback, maxAttempts = 20, attempt = 0) {
    // Check if driver exists (can be either a function or an object with driver property)
    const isDriverAvailable =
      (typeof window.driver === 'function') ||
      (typeof window.driver === 'object' && window.driver !== null && typeof window.driver.driver === 'function');

    if (isDriverAvailable) {
      console.log('✅ Driver.js loaded successfully (type:', typeof window.driver + ')');
      callback();
    } else if (attempt < maxAttempts) {
      // Log progress every 5 attempts
      if (attempt % 5 === 0 && attempt > 0) {
        console.log(`⏳ Waiting for driver.js... (attempt ${attempt}/${maxAttempts})`);
      }
      setTimeout(() => waitForDriver(callback, maxAttempts, attempt + 1), 200);
    } else {
      console.error('❌ Driver.js failed to load after multiple attempts');
      console.error('window.driver type:', typeof window.driver);
      console.error('window.driver value:', window.driver);
    }
  }

  function init() {
    // Wait for driver.js to be available
    waitForDriver(() => {
      // Inject styles
      injectTourStyles();

      // Create floating help button
      createHelpButton();

      // Auto-launch for first-time users
      autoLaunchTour();

      console.log('✅ MedWard Tour Guide initialized');
    });
  }

  // Run initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPOSE GLOBAL API
  // ═══════════════════════════════════════════════════════════════════════════

  window.MedWardTour = {
    start: startTour,
    startFull: startFullTour,
    reset: resetAllTours,
    detectPage: detectCurrentPage,
    tours: TOURS
  };

  // Legacy support
  window.startTour = startTour;

})();
