// ═══════════════════════════════════════════════════════════════════════════════
// MEDWARD ERROR ANALYZER - POST HOC BUG DIAGNOSTIC SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
// Captures and analyzes runtime errors, providing detailed diagnostic information
// Displays a comprehensive error popup when the help button is pressed
// ═══════════════════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // ERROR STORAGE AND TRACKING
  // ═══════════════════════════════════════════════════════════════════════════

  const ERROR_STORAGE_KEY = 'MEDWARD_ERROR_LOG';
  const MAX_ERRORS_STORED = 50;

  let errorLog = [];
  let isHelpButtonVisible = false;

  // ═══════════════════════════════════════════════════════════════════════════
  // ERROR CAPTURE FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  function captureError(error, context = {}) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      message: error.message || String(error),
      stack: error.stack || 'No stack trace available',
      type: error.name || 'Error',
      url: window.location.href,
      userAgent: navigator.userAgent,
      page: detectCurrentPage(),
      context: context,
      browserInfo: getBrowserInfo(),
      domState: getDOMState()
    };

    errorLog.push(errorEntry);

    // Limit stored errors
    if (errorLog.length > MAX_ERRORS_STORED) {
      errorLog = errorLog.slice(-MAX_ERRORS_STORED);
    }

    // Save to localStorage
    try {
      localStorage.setItem(ERROR_STORAGE_KEY, JSON.stringify(errorLog));
    } catch (e) {
      console.warn('Failed to save error log to localStorage:', e);
    }

    // Show help button
    showErrorHelpButton();

    console.error('🐛 Error captured by analyzer:', errorEntry);

    return errorEntry;
  }

  function detectCurrentPage() {
    try {
      if (window.MedWardTour && window.MedWardTour.detectPage) {
        return window.MedWardTour.detectPage();
      }
    } catch (e) {
      // Fallback detection
    }

    const path = window.location.pathname.toLowerCase();
    if (path.includes('login')) return 'login';
    if (path.includes('landing')) return 'landing';
    if (path.includes('dashboard')) return 'dashboard';
    if (path.includes('oncall')) return 'oncall';
    if (path.includes('ai_assistant')) return 'aiAssistant';
    if (path.includes('antibiotic')) return 'antibiotic';
    if (path.includes('handover')) return 'handover';
    if (path.includes('monitor')) return 'monitor';
    return 'unknown';
  }

  function getBrowserInfo() {
    return {
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      colorDepth: window.screen.colorDepth,
      pixelRatio: window.devicePixelRatio
    };
  }

  function getDOMState() {
    return {
      readyState: document.readyState,
      elementsCount: document.querySelectorAll('*').length,
      scriptsCount: document.scripts.length,
      hasDriver: typeof window.driver !== 'undefined',
      driverType: typeof window.driver,
      hasMedWardTour: typeof window.MedWardTour !== 'undefined',
      bodyClasses: Array.from(document.body.classList),
      documentTitle: document.title
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GLOBAL ERROR HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  // Capture uncaught JavaScript errors
  window.addEventListener('error', function(event) {
    const error = event.error || new Error(event.message);
    captureError(error, {
      type: 'uncaught',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', function(event) {
    const error = event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason));

    captureError(error, {
      type: 'unhandledPromiseRejection',
      promise: 'Promise rejection'
    });
  });

  // Intercept console.error to capture additional context
  const originalConsoleError = console.error;
  console.error = function(...args) {
    // Check if this is a tour-related error
    const errorMessage = args.join(' ');
    if (errorMessage.includes('Driver') ||
        errorMessage.includes('tour') ||
        errorMessage.includes('medward')) {

      const error = args[0] instanceof Error
        ? args[0]
        : new Error(errorMessage);

      captureError(error, {
        type: 'console.error',
        arguments: args.map(arg => String(arg))
      });
    }

    // Call original console.error
    originalConsoleError.apply(console, args);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // WRAP TOUR FUNCTIONS TO CAPTURE ERRORS
  // ═══════════════════════════════════════════════════════════════════════════

  function wrapTourFunctions() {
    // Wait for MedWardTour to be available
    if (typeof window.MedWardTour === 'undefined') {
      setTimeout(wrapTourFunctions, 100);
      return;
    }

    // Wrap the start function
    const originalStart = window.MedWardTour.start;
    window.MedWardTour.start = function(...args) {
      try {
        return originalStart.apply(this, args);
      } catch (error) {
        captureError(error, {
          type: 'tourStart',
          function: 'MedWardTour.start',
          arguments: args
        });
        throw error;
      }
    };

    // Wrap driver.js if available
    if (typeof window.driver !== 'undefined') {
      const originalDriver = window.driver;
      window.driver = function(...args) {
        try {
          const driverObj = originalDriver.apply(this, args);

          // Wrap driver methods
          if (driverObj && typeof driverObj.drive === 'function') {
            const originalDrive = driverObj.drive;
            driverObj.drive = function(...driveArgs) {
              try {
                return originalDrive.apply(this, driveArgs);
              } catch (error) {
                captureError(error, {
                  type: 'driverDrive',
                  function: 'driver.drive',
                  arguments: driveArgs
                });
                throw error;
              }
            };
          }

          return driverObj;
        } catch (error) {
          captureError(error, {
            type: 'driverInit',
            function: 'window.driver',
            arguments: args
          });
          throw error;
        }
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ERROR HELP BUTTON
  // ═══════════════════════════════════════════════════════════════════════════

  function showErrorHelpButton() {
    if (isHelpButtonVisible) return;

    // Check if help button already exists
    let helpBtn = document.querySelector('.medward-error-help-btn');

    if (!helpBtn) {
      helpBtn = document.createElement('button');
      helpBtn.className = 'medward-error-help-btn';
      helpBtn.innerHTML = '🐛';
      helpBtn.title = 'View Error Details - Click for diagnostic information';
      helpBtn.setAttribute('aria-label', 'Show error analyzer');
      helpBtn.onclick = showErrorAnalyzer;
      document.body.appendChild(helpBtn);
    }

    // Animate button appearance
    setTimeout(() => {
      helpBtn.classList.add('visible');
      isHelpButtonVisible = true;
    }, 100);
  }

  function hideErrorHelpButton() {
    const helpBtn = document.querySelector('.medward-error-help-btn');
    if (helpBtn) {
      helpBtn.classList.remove('visible');
      setTimeout(() => {
        helpBtn.remove();
        isHelpButtonVisible = false;
      }, 300);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ERROR ANALYZER POPUP
  // ═══════════════════════════════════════════════════════════════════════════

  function showErrorAnalyzer() {
    // Load errors from localStorage
    try {
      const stored = localStorage.getItem(ERROR_STORAGE_KEY);
      if (stored) {
        errorLog = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load error log from localStorage');
    }

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'error-analyzer-overlay';
    overlay.onclick = (e) => {
      if (e.target === overlay) closeErrorAnalyzer();
    };

    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'error-analyzer-modal';

    modal.innerHTML = `
      <div class="error-analyzer-header">
        <div class="error-analyzer-title">
          <span class="error-icon">🐛</span>
          <h2>Error Diagnostic Analyzer</h2>
        </div>
        <button class="error-close-btn" onclick="window.closeErrorAnalyzer()">✕</button>
      </div>

      <div class="error-analyzer-body">
        <div class="error-summary">
          <div class="error-stat">
            <div class="error-stat-value">${errorLog.length}</div>
            <div class="error-stat-label">Total Errors</div>
          </div>
          <div class="error-stat">
            <div class="error-stat-value">${getRecentErrorCount()}</div>
            <div class="error-stat-label">Last 5 Minutes</div>
          </div>
          <div class="error-stat">
            <div class="error-stat-value">${getCurrentPage()}</div>
            <div class="error-stat-label">Current Page</div>
          </div>
        </div>

        <div class="error-tabs">
          <button class="error-tab active" data-tab="recent">Recent Errors</button>
          <button class="error-tab" data-tab="details">Detailed View</button>
          <button class="error-tab" data-tab="diagnostics">System Diagnostics</button>
          <button class="error-tab" data-tab="solutions">Common Solutions</button>
        </div>

        <div class="error-content">
          <div class="error-tab-content active" data-content="recent">
            ${renderRecentErrors()}
          </div>

          <div class="error-tab-content" data-content="details">
            ${renderDetailedErrors()}
          </div>

          <div class="error-tab-content" data-content="diagnostics">
            ${renderDiagnostics()}
          </div>

          <div class="error-tab-content" data-content="solutions">
            ${renderSolutions()}
          </div>
        </div>
      </div>

      <div class="error-analyzer-footer">
        <button class="error-btn error-btn-secondary" onclick="window.copyErrorReport()">
          📋 Copy Report
        </button>
        <button class="error-btn error-btn-secondary" onclick="window.downloadErrorLog()">
          💾 Download Log
        </button>
        <button class="error-btn error-btn-danger" onclick="window.clearErrorLog()">
          🗑️ Clear Errors
        </button>
        <button class="error-btn error-btn-primary" onclick="window.closeErrorAnalyzer()">
          Close
        </button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Add tab switching functionality
    setupTabSwitching();

    // Add keyboard shortcut to close (Escape)
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        closeErrorAnalyzer();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
  }

  function closeErrorAnalyzer() {
    const overlay = document.querySelector('.error-analyzer-overlay');
    if (overlay) {
      overlay.classList.add('closing');
      setTimeout(() => overlay.remove(), 300);
    }
  }

  function setupTabSwitching() {
    const tabs = document.querySelectorAll('.error-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', function() {
        const targetTab = this.dataset.tab;

        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        this.classList.add('active');

        // Update active content
        const contents = document.querySelectorAll('.error-tab-content');
        contents.forEach(c => c.classList.remove('active'));
        document.querySelector(`[data-content="${targetTab}"]`).classList.add('active');
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  function renderRecentErrors() {
    if (errorLog.length === 0) {
      return '<div class="no-errors">✅ No errors detected. System is running smoothly!</div>';
    }

    const recentErrors = errorLog.slice(-10).reverse();

    return `
      <div class="error-list">
        ${recentErrors.map((error, index) => `
          <div class="error-item ${index === 0 ? 'latest' : ''}">
            <div class="error-item-header">
              <span class="error-type-badge ${error.type.toLowerCase()}">${error.type}</span>
              <span class="error-time">${formatTimestamp(error.timestamp)}</span>
            </div>
            <div class="error-message">${escapeHtml(error.message)}</div>
            <div class="error-meta">
              <span class="error-page">📄 ${error.page}</span>
              ${error.context.type ? `<span class="error-context">🔍 ${error.context.type}</span>` : ''}
            </div>
            <details class="error-stack-details">
              <summary>View Stack Trace</summary>
              <pre class="error-stack">${escapeHtml(error.stack)}</pre>
            </details>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderDetailedErrors() {
    if (errorLog.length === 0) {
      return '<div class="no-errors">✅ No errors to display</div>';
    }

    const latestError = errorLog[errorLog.length - 1];

    return `
      <div class="detailed-error">
        <h3>Latest Error Details</h3>

        <div class="detail-section">
          <h4>Error Information</h4>
          <table class="detail-table">
            <tr><td><strong>Type:</strong></td><td>${escapeHtml(latestError.type)}</td></tr>
            <tr><td><strong>Message:</strong></td><td>${escapeHtml(latestError.message)}</td></tr>
            <tr><td><strong>Timestamp:</strong></td><td>${latestError.timestamp}</td></tr>
            <tr><td><strong>Page:</strong></td><td>${latestError.page}</td></tr>
            <tr><td><strong>URL:</strong></td><td>${escapeHtml(latestError.url)}</td></tr>
          </table>
        </div>

        <div class="detail-section">
          <h4>Context</h4>
          <pre class="detail-json">${JSON.stringify(latestError.context, null, 2)}</pre>
        </div>

        <div class="detail-section">
          <h4>Stack Trace</h4>
          <pre class="error-stack">${escapeHtml(latestError.stack)}</pre>
        </div>

        <div class="detail-section">
          <h4>DOM State</h4>
          <pre class="detail-json">${JSON.stringify(latestError.domState, null, 2)}</pre>
        </div>
      </div>
    `;
  }

  function renderDiagnostics() {
    const browserInfo = getBrowserInfo();
    const domState = getDOMState();

    return `
      <div class="diagnostics-panel">
        <div class="diagnostic-section">
          <h3>🖥️ Browser Information</h3>
          <table class="detail-table">
            <tr><td><strong>User Agent:</strong></td><td>${escapeHtml(navigator.userAgent)}</td></tr>
            <tr><td><strong>Platform:</strong></td><td>${browserInfo.platform}</td></tr>
            <tr><td><strong>Language:</strong></td><td>${browserInfo.language}</td></tr>
            <tr><td><strong>Online:</strong></td><td>${browserInfo.onLine ? '✅' : '❌'}</td></tr>
            <tr><td><strong>Cookies:</strong></td><td>${browserInfo.cookieEnabled ? '✅' : '❌'}</td></tr>
            <tr><td><strong>Screen:</strong></td><td>${browserInfo.screenResolution}</td></tr>
            <tr><td><strong>Viewport:</strong></td><td>${browserInfo.viewportSize}</td></tr>
          </table>
        </div>

        <div class="diagnostic-section">
          <h3>📦 Dependencies Status</h3>
          <table class="detail-table">
            <tr>
              <td><strong>Driver.js:</strong></td>
              <td>${domState.hasDriver ? '✅ Loaded' : '❌ Not Found'}</td>
            </tr>
            <tr>
              <td><strong>Driver Type:</strong></td>
              <td>${domState.driverType}</td>
            </tr>
            <tr>
              <td><strong>MedWardTour:</strong></td>
              <td>${domState.hasMedWardTour ? '✅ Loaded' : '❌ Not Found'}</td>
            </tr>
          </table>
        </div>

        <div class="diagnostic-section">
          <h3>📄 Document State</h3>
          <table class="detail-table">
            <tr><td><strong>Ready State:</strong></td><td>${domState.readyState}</td></tr>
            <tr><td><strong>Elements:</strong></td><td>${domState.elementsCount}</td></tr>
            <tr><td><strong>Scripts:</strong></td><td>${domState.scriptsCount}</td></tr>
            <tr><td><strong>Body Classes:</strong></td><td>${domState.bodyClasses.join(', ') || 'none'}</td></tr>
          </table>
        </div>

        <div class="diagnostic-section">
          <h3>💾 LocalStorage</h3>
          <table class="detail-table">
            <tr><td><strong>Available:</strong></td><td>${checkLocalStorage() ? '✅' : '❌'}</td></tr>
            <tr><td><strong>Used Keys:</strong></td><td>${getLocalStorageKeys()}</td></tr>
          </table>
        </div>
      </div>
    `;
  }

  function renderSolutions() {
    const solutions = analyzeProblem();

    return `
      <div class="solutions-panel">
        <h3>🔧 Common Solutions</h3>

        ${solutions.map(solution => `
          <div class="solution-card ${solution.priority}">
            <div class="solution-header">
              <span class="solution-icon">${solution.icon}</span>
              <h4>${solution.title}</h4>
              <span class="solution-priority-badge">${solution.priority}</span>
            </div>
            <p>${solution.description}</p>
            <div class="solution-steps">
              <strong>Steps:</strong>
              <ol>
                ${solution.steps.map(step => `<li>${step}</li>`).join('')}
              </ol>
            </div>
          </div>
        `).join('')}

        <div class="solution-card info">
          <div class="solution-header">
            <span class="solution-icon">💡</span>
            <h4>Still Having Issues?</h4>
          </div>
          <p>If the error persists after trying these solutions:</p>
          <ul>
            <li>Copy the error report and share it with your administrator</li>
            <li>Clear your browser cache and reload the page</li>
            <li>Try accessing the site in an incognito/private window</li>
            <li>Check if other users are experiencing similar issues</li>
          </ul>
        </div>
      </div>
    `;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ANALYSIS AND UTILITY FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  function analyzeProblem() {
    const solutions = [];
    const domState = getDOMState();

    // Check if driver.js is missing
    if (!domState.hasDriver) {
      solutions.push({
        priority: 'critical',
        icon: '🚨',
        title: 'Driver.js Library Not Loaded',
        description: 'The tour system requires driver.js to be loaded. This is the most likely cause of tour failures.',
        steps: [
          'Refresh the page (Ctrl+F5 or Cmd+Shift+R)',
          'Check your internet connection',
          'Verify that driver.js CDN is accessible',
          'Check browser console for network errors',
          'Clear browser cache and try again'
        ]
      });
    }

    // Check if MedWardTour is missing
    if (!domState.hasMedWardTour) {
      solutions.push({
        priority: 'high',
        icon: '⚠️',
        title: 'MedWard Tour System Not Initialized',
        description: 'The tour guide system has not been initialized properly.',
        steps: [
          'Ensure medward-tour.js is loaded after driver.js',
          'Check browser console for JavaScript errors',
          'Verify script loading order in your HTML',
          'Reload the page'
        ]
      });
    }

    // Check for element not found errors
    const hasElementErrors = errorLog.some(e =>
      e.message.includes('querySelector') ||
      e.message.includes('element') ||
      e.message.includes('null')
    );

    if (hasElementErrors) {
      solutions.push({
        priority: 'medium',
        icon: '🎯',
        title: 'Tour Elements Not Found',
        description: 'Some elements that the tour tries to highlight may not exist on the current page.',
        steps: [
          'Ensure you\'re on the correct page for this tour',
          'Wait for the page to fully load before starting the tour',
          'Check if dynamic content has finished loading',
          'Some page-specific tours may not work on all pages'
        ]
      });
    }

    // Check for promise rejection errors
    const hasPromiseErrors = errorLog.some(e =>
      e.context.type === 'unhandledPromiseRejection'
    );

    if (hasPromiseErrors) {
      solutions.push({
        priority: 'medium',
        icon: '⏱️',
        title: 'Async Operation Failed',
        description: 'An asynchronous operation (promise) was rejected.',
        steps: [
          'Check your internet connection',
          'Ensure the server is accessible',
          'Look for API or network errors in browser console',
          'Try reloading the page'
        ]
      });
    }

    // Generic refresh solution
    solutions.push({
      priority: 'low',
      icon: '🔄',
      title: 'Standard Troubleshooting',
      description: 'Basic steps that often resolve common issues.',
      steps: [
        'Refresh the page (F5)',
        'Clear browser cache (Ctrl+Shift+Delete)',
        'Try in incognito/private mode',
        'Update your browser to the latest version',
        'Disable browser extensions temporarily'
      ]
    });

    return solutions;
  }

  function getRecentErrorCount() {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    return errorLog.filter(e => new Date(e.timestamp).getTime() > fiveMinutesAgo).length;
  }

  function getCurrentPage() {
    return detectCurrentPage();
  }

  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

    return date.toLocaleString();
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function checkLocalStorage() {
    try {
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
      return true;
    } catch (e) {
      return false;
    }
  }

  function getLocalStorageKeys() {
    try {
      return Object.keys(localStorage).length;
    } catch (e) {
      return 0;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT AND UTILITY ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  function copyErrorReport() {
    const report = generateErrorReport();

    navigator.clipboard.writeText(report).then(() => {
      alert('✅ Error report copied to clipboard!');
    }).catch(() => {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = report;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      alert('✅ Error report copied to clipboard!');
    });
  }

  function downloadErrorLog() {
    const data = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      errors: errorLog,
      diagnostics: {
        browserInfo: getBrowserInfo(),
        domState: getDOMState()
      }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medward-error-log-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearErrorLog() {
    if (confirm('Are you sure you want to clear all error logs?')) {
      errorLog = [];
      localStorage.removeItem(ERROR_STORAGE_KEY);
      hideErrorHelpButton();
      closeErrorAnalyzer();
      alert('✅ Error log cleared!');
    }
  }

  function generateErrorReport() {
    const latest = errorLog.length > 0 ? errorLog[errorLog.length - 1] : null;

    let report = '═══════════════════════════════════════════════════\n';
    report += 'MEDWARD ERROR REPORT\n';
    report += '═══════════════════════════════════════════════════\n\n';

    report += `Generated: ${new Date().toISOString()}\n`;
    report += `Total Errors: ${errorLog.length}\n`;
    report += `Current Page: ${detectCurrentPage()}\n`;
    report += `URL: ${window.location.href}\n\n`;

    if (latest) {
      report += '─────────────────────────────────────────────────\n';
      report += 'LATEST ERROR\n';
      report += '─────────────────────────────────────────────────\n\n';
      report += `Type: ${latest.type}\n`;
      report += `Message: ${latest.message}\n`;
      report += `Timestamp: ${latest.timestamp}\n`;
      report += `Page: ${latest.page}\n\n`;
      report += `Stack Trace:\n${latest.stack}\n\n`;
    }

    report += '─────────────────────────────────────────────────\n';
    report += 'SYSTEM DIAGNOSTICS\n';
    report += '─────────────────────────────────────────────────\n\n';

    const domState = getDOMState();
    report += `Driver.js Loaded: ${domState.hasDriver ? 'Yes' : 'No'}\n`;
    report += `MedWardTour Loaded: ${domState.hasMedWardTour ? 'Yes' : 'No'}\n`;
    report += `Browser: ${navigator.userAgent}\n`;
    report += `Platform: ${navigator.platform}\n`;
    report += `Online: ${navigator.onLine ? 'Yes' : 'No'}\n\n`;

    return report;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INJECT STYLES
  // ═══════════════════════════════════════════════════════════════════════════

  function injectStyles() {
    const styles = `
      /* Error Analyzer Styles */

      .medward-error-help-btn {
        position: fixed;
        bottom: 20px;
        right: 16px;
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        color: white;
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 16px rgba(239, 68, 68, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.6rem;
        z-index: 9999;
        opacity: 0;
        transform: scale(0.8);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        animation: pulse 2s infinite;
      }

      .medward-error-help-btn.visible {
        opacity: 1;
        transform: scale(1);
      }

      .medward-error-help-btn:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 24px rgba(239, 68, 68, 0.5);
      }

      @keyframes pulse {
        0%, 100% { box-shadow: 0 4px 16px rgba(239, 68, 68, 0.4); }
        50% { box-shadow: 0 4px 24px rgba(239, 68, 68, 0.7); }
      }

      .error-analyzer-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.3s ease-out;
        padding: 20px;
      }

      .error-analyzer-overlay.closing {
        animation: fadeOut 0.3s ease-out;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }

      .error-analyzer-modal {
        background: white;
        border-radius: 16px;
        max-width: 900px;
        width: 100%;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease-out;
      }

      @keyframes slideUp {
        from { transform: translateY(50px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      .error-analyzer-header {
        padding: 24px;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
        border-radius: 16px 16px 0 0;
      }

      .error-analyzer-title {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .error-icon {
        font-size: 2rem;
        animation: bounce 2s infinite;
      }

      @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-5px); }
      }

      .error-analyzer-title h2 {
        margin: 0;
        font-size: 1.5rem;
        color: #1f2937;
      }

      .error-close-btn {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        border: none;
        background: #f3f4f6;
        color: #6b7280;
        cursor: pointer;
        font-size: 1.2rem;
        transition: all 0.2s;
      }

      .error-close-btn:hover {
        background: #fee2e2;
        color: #ef4444;
      }

      .error-analyzer-body {
        padding: 24px;
        overflow-y: auto;
        flex: 1;
      }

      .error-summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
      }

      .error-stat {
        background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
        padding: 20px;
        border-radius: 12px;
        text-align: center;
        border: 1px solid #e5e7eb;
      }

      .error-stat-value {
        font-size: 2rem;
        font-weight: 700;
        color: #ef4444;
        margin-bottom: 8px;
      }

      .error-stat-label {
        font-size: 0.875rem;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .error-tabs {
        display: flex;
        gap: 8px;
        margin-bottom: 24px;
        border-bottom: 2px solid #e5e7eb;
      }

      .error-tab {
        padding: 12px 20px;
        border: none;
        background: transparent;
        color: #6b7280;
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 600;
        border-bottom: 3px solid transparent;
        transition: all 0.2s;
      }

      .error-tab:hover {
        color: #374151;
        background: #f9fafb;
      }

      .error-tab.active {
        color: #ef4444;
        border-bottom-color: #ef4444;
      }

      .error-tab-content {
        display: none;
      }

      .error-tab-content.active {
        display: block;
        animation: fadeIn 0.3s ease-out;
      }

      .error-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .error-item {
        background: #f9fafb;
        padding: 16px;
        border-radius: 12px;
        border-left: 4px solid #ef4444;
      }

      .error-item.latest {
        background: #fef2f2;
        border-left-color: #dc2626;
      }

      .error-item-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }

      .error-type-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        background: #fee2e2;
        color: #991b1b;
      }

      .error-time {
        font-size: 0.875rem;
        color: #6b7280;
      }

      .error-message {
        font-size: 0.95rem;
        color: #374151;
        margin-bottom: 12px;
        font-weight: 500;
      }

      .error-meta {
        display: flex;
        gap: 16px;
        font-size: 0.875rem;
        color: #6b7280;
        margin-bottom: 8px;
      }

      .error-stack-details {
        margin-top: 12px;
      }

      .error-stack-details summary {
        cursor: pointer;
        font-size: 0.875rem;
        color: #6b7280;
        padding: 8px;
        border-radius: 6px;
        transition: background 0.2s;
      }

      .error-stack-details summary:hover {
        background: #f3f4f6;
      }

      .error-stack {
        background: #1f2937;
        color: #f9fafb;
        padding: 16px;
        border-radius: 8px;
        font-size: 0.75rem;
        line-height: 1.6;
        overflow-x: auto;
        margin-top: 8px;
        font-family: 'Monaco', 'Courier New', monospace;
      }

      .no-errors {
        text-align: center;
        padding: 60px 20px;
        font-size: 1.1rem;
        color: #059669;
      }

      .detailed-error h3,
      .diagnostics-panel h3 {
        font-size: 1.1rem;
        color: #1f2937;
        margin-bottom: 16px;
      }

      .detail-section,
      .diagnostic-section {
        background: #f9fafb;
        padding: 20px;
        border-radius: 12px;
        margin-bottom: 16px;
      }

      .detail-section h4 {
        font-size: 0.95rem;
        color: #374151;
        margin-bottom: 12px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .detail-table {
        width: 100%;
        font-size: 0.875rem;
      }

      .detail-table td {
        padding: 8px 0;
        vertical-align: top;
      }

      .detail-table td:first-child {
        width: 150px;
        color: #6b7280;
      }

      .detail-table td:last-child {
        color: #374151;
        word-break: break-word;
      }

      .detail-json {
        background: #1f2937;
        color: #f9fafb;
        padding: 16px;
        border-radius: 8px;
        font-size: 0.75rem;
        line-height: 1.6;
        overflow-x: auto;
        font-family: 'Monaco', 'Courier New', monospace;
      }

      .solutions-panel {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .solution-card {
        border-left: 4px solid #6b7280;
        background: #f9fafb;
        padding: 20px;
        border-radius: 12px;
      }

      .solution-card.critical {
        border-left-color: #dc2626;
        background: #fef2f2;
      }

      .solution-card.high {
        border-left-color: #f59e0b;
        background: #fffbeb;
      }

      .solution-card.medium {
        border-left-color: #3b82f6;
        background: #eff6ff;
      }

      .solution-card.low {
        border-left-color: #10b981;
        background: #f0fdf4;
      }

      .solution-card.info {
        border-left-color: #6366f1;
        background: #eef2ff;
      }

      .solution-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }

      .solution-icon {
        font-size: 1.5rem;
      }

      .solution-header h4 {
        flex: 1;
        margin: 0;
        font-size: 1rem;
        color: #1f2937;
      }

      .solution-priority-badge {
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        background: #e5e7eb;
        color: #374151;
      }

      .solution-card.critical .solution-priority-badge {
        background: #fecaca;
        color: #991b1b;
      }

      .solution-card.high .solution-priority-badge {
        background: #fed7aa;
        color: #92400e;
      }

      .solution-card.medium .solution-priority-badge {
        background: #bfdbfe;
        color: #1e40af;
      }

      .solution-card.low .solution-priority-badge {
        background: #bbf7d0;
        color: #166534;
      }

      .solution-card p {
        color: #4b5563;
        margin-bottom: 16px;
        line-height: 1.6;
      }

      .solution-steps {
        font-size: 0.9rem;
      }

      .solution-steps strong {
        color: #374151;
      }

      .solution-steps ol {
        margin: 8px 0 0 0;
        padding-left: 20px;
      }

      .solution-steps li {
        margin: 6px 0;
        color: #4b5563;
        line-height: 1.5;
      }

      .solution-card ul {
        margin: 8px 0 0 0;
        padding-left: 20px;
      }

      .solution-card li {
        margin: 6px 0;
        color: #4b5563;
      }

      .error-analyzer-footer {
        padding: 20px 24px;
        border-top: 1px solid #e5e7eb;
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        background: #f9fafb;
        border-radius: 0 0 16px 16px;
      }

      .error-btn {
        padding: 10px 20px;
        border-radius: 8px;
        border: none;
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }

      .error-btn-primary {
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        color: white;
      }

      .error-btn-primary:hover {
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
      }

      .error-btn-secondary {
        background: #f3f4f6;
        color: #374151;
      }

      .error-btn-secondary:hover {
        background: #e5e7eb;
      }

      .error-btn-danger {
        background: #fee2e2;
        color: #991b1b;
      }

      .error-btn-danger:hover {
        background: #fecaca;
      }

      /* Dark theme support */
      body.dark-theme .error-analyzer-modal {
        background: #1f2937;
      }

      body.dark-theme .error-analyzer-header {
        background: linear-gradient(135deg, #374151 0%, #1f2937 100%);
        border-bottom-color: #374151;
      }

      body.dark-theme .error-analyzer-title h2 {
        color: #f9fafb;
      }

      body.dark-theme .error-stat {
        background: #374151;
        border-color: #4b5563;
      }

      body.dark-theme .error-stat-label {
        color: #9ca3af;
      }

      body.dark-theme .error-tabs {
        border-bottom-color: #374151;
      }

      body.dark-theme .error-tab {
        color: #9ca3af;
      }

      body.dark-theme .error-tab:hover {
        color: #d1d5db;
        background: #374151;
      }

      body.dark-theme .error-item {
        background: #374151;
      }

      body.dark-theme .error-item.latest {
        background: #3f1d1d;
      }

      body.dark-theme .detail-section,
      body.dark-theme .diagnostic-section {
        background: #374151;
      }

      body.dark-theme .error-analyzer-footer {
        background: #374151;
        border-top-color: #4b5563;
      }
    `;

    const styleEl = document.createElement('style');
    styleEl.id = 'error-analyzer-styles';
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  function init() {
    // Load existing errors from localStorage
    try {
      const stored = localStorage.getItem(ERROR_STORAGE_KEY);
      if (stored) {
        errorLog = JSON.parse(stored);
        if (errorLog.length > 0) {
          showErrorHelpButton();
        }
      }
    } catch (e) {
      console.warn('Failed to load error log from localStorage');
    }

    // Inject styles
    injectStyles();

    // Wrap tour functions
    setTimeout(wrapTourFunctions, 500);

    console.log('✅ MedWard Error Analyzer initialized');
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

  window.MedWardErrorAnalyzer = {
    captureError: captureError,
    showAnalyzer: showErrorAnalyzer,
    clearLog: clearErrorLog,
    getErrors: () => errorLog
  };

  // Expose functions for UI
  window.showErrorAnalyzer = showErrorAnalyzer;
  window.closeErrorAnalyzer = closeErrorAnalyzer;
  window.copyErrorReport = copyErrorReport;
  window.downloadErrorLog = downloadErrorLog;
  window.clearErrorLog = clearErrorLog;

})();
