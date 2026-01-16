/**
 * MedWard Bug Tracker - Post Hoc Bug Analysis System
 * Captures, stores, and analyzes application errors and events
 * Optimized for mobile devices
 */

const BugTracker = (function() {
    'use strict';

    const DB_NAME = 'MedWardBugTracker';
    const DB_VERSION = 1;
    const STORE_NAME = 'bugs';
    const MAX_BUGS = 1000; // Limit storage on mobile
    const DEDUPE_WINDOW = 5000; // 5 seconds deduplication window

    let db = null;
    let isInitialized = false;
    let recentBugHashes = new Map(); // For deduplication

    /**
     * Safe JSON serialization with circular reference handling
     */
    function safeStringify(obj, maxDepth = 3) {
        const seen = new WeakSet();

        return JSON.stringify(obj, (key, value) => {
            if (typeof value === 'object' && value !== null) {
                if (seen.has(value)) {
                    return '[Circular Reference]';
                }
                seen.add(value);
            }
            return value;
        }, 2);
    }

    /**
     * Generate hash for bug deduplication
     */
    function generateBugHash(bugData) {
        const hashString = `${bugData.type}:${bugData.severity}:${bugData.message}:${bugData.source || ''}:${bugData.line || ''}`;
        return hashString;
    }

    /**
     * Check if bug is duplicate (within deduplication window)
     */
    function isDuplicate(bugHash) {
        const now = Date.now();

        // Clean old entries
        for (const [hash, timestamp] of recentBugHashes.entries()) {
            if (now - timestamp > DEDUPE_WINDOW) {
                recentBugHashes.delete(hash);
            }
        }

        // Check if this bug was recently logged
        if (recentBugHashes.has(bugHash)) {
            return true;
        }

        recentBugHashes.set(bugHash, now);
        return false;
    }

    /**
     * Detect if device is mobile with enhanced accuracy
     */
    function isMobileDevice() {
        // Check user agent
        const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(navigator.userAgent);

        // Check screen size and touch capability
        const smallScreen = window.innerWidth <= 768;
        const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        // Combine checks for better accuracy
        return mobileUA || (smallScreen && hasTouch);
    }

    /**
     * Initialize IndexedDB for bug storage
     */
    async function init() {
        if (isInitialized) return true;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('[BugTracker] Failed to open database:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                db = request.result;
                isInitialized = true;
                console.log('[BugTracker] Database initialized');
                resolve(true);
            };

            request.onupgradeneeded = (event) => {
                const database = event.target.result;

                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    const objectStore = database.createObjectStore(STORE_NAME, {
                        keyPath: 'id',
                        autoIncrement: true
                    });

                    objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                    objectStore.createIndex('severity', 'severity', { unique: false });
                    objectStore.createIndex('type', 'type', { unique: false });
                    objectStore.createIndex('resolved', 'resolved', { unique: false });
                }
            };
        });
    }

    /**
     * Capture and store a bug/error
     */
    async function logBug(bugData) {
        try {
            await init();

            // Check for duplicate
            const bugHash = generateBugHash(bugData);
            if (isDuplicate(bugHash)) {
                console.log('[BugTracker] Duplicate bug ignored:', bugData.type, bugData.message?.substring(0, 50));
                return null;
            }

            const bug = {
                timestamp: Date.now(),
                dateString: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: window.location.href,
                pathname: window.location.pathname,
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                },
                devicePixelRatio: window.devicePixelRatio || 1,
                online: navigator.onLine,
                resolved: false,
                ...bugData
            };

            // Add accurate mobile detection
            bug.isMobile = isMobileDevice();

            // Add device type for more accurate categorization
            bug.deviceType = bug.isMobile ?
                (window.innerWidth < 480 ? 'phone' : 'tablet') :
                'desktop';

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const objectStore = transaction.objectStore(STORE_NAME);
                const request = objectStore.add(bug);

                request.onsuccess = () => {
                    console.log('[BugTracker] Bug logged:', bug.type, bug.severity, '-', bug.message?.substring(0, 50));
                    resolve(request.result);

                    // Cleanup old bugs if exceeding limit
                    cleanupOldBugs();
                };

                request.onerror = () => {
                    console.error('[BugTracker] Failed to log bug:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('[BugTracker] Error in logBug:', error);
            return null;
        }
    }

    /**
     * Remove old bugs when exceeding storage limit
     */
    async function cleanupOldBugs() {
        try {
            const count = await getBugCount();
            if (count > MAX_BUGS) {
                const bugs = await getAllBugs();
                const toDelete = bugs.slice(0, count - MAX_BUGS);

                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const objectStore = transaction.objectStore(STORE_NAME);

                toDelete.forEach(bug => {
                    objectStore.delete(bug.id);
                });
            }
        } catch (error) {
            console.error('[BugTracker] Cleanup error:', error);
        }
    }

    /**
     * Get all bugs from database
     */
    async function getAllBugs() {
        await init();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const objectStore = transaction.objectStore(STORE_NAME);
            const request = objectStore.openCursor(null, 'prev'); // Newest first

            const bugs = [];

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    bugs.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(bugs);
                }
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Get bugs by filter criteria
     */
    async function getBugsBy(filter) {
        const allBugs = await getAllBugs();

        return allBugs.filter(bug => {
            if (filter.severity && bug.severity !== filter.severity) return false;
            if (filter.type && bug.type !== filter.type) return false;
            if (filter.resolved !== undefined && bug.resolved !== filter.resolved) return false;
            if (filter.isMobile !== undefined && bug.isMobile !== filter.isMobile) return false;
            if (filter.startDate && bug.timestamp < filter.startDate) return false;
            if (filter.endDate && bug.timestamp > filter.endDate) return false;
            return true;
        });
    }

    /**
     * Get bug count
     */
    async function getBugCount() {
        await init();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const objectStore = transaction.objectStore(STORE_NAME);
            const request = objectStore.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Mark bug as resolved
     */
    async function markResolved(bugId) {
        await init();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const objectStore = transaction.objectStore(STORE_NAME);
            const getRequest = objectStore.get(bugId);

            getRequest.onsuccess = () => {
                const bug = getRequest.result;
                if (bug) {
                    bug.resolved = true;
                    bug.resolvedAt = Date.now();

                    const updateRequest = objectStore.put(bug);
                    updateRequest.onsuccess = () => resolve(true);
                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    reject(new Error('Bug not found'));
                }
            };

            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    /**
     * Delete a bug
     */
    async function deleteBug(bugId) {
        await init();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const objectStore = transaction.objectStore(STORE_NAME);
            const request = objectStore.delete(bugId);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clear all bugs
     */
    async function clearAll() {
        await init();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const objectStore = transaction.objectStore(STORE_NAME);
            const request = objectStore.clear();

            request.onsuccess = () => {
                console.log('[BugTracker] All bugs cleared');
                resolve(true);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Generate bug analysis report
     */
    async function generateAnalysis() {
        const bugs = await getAllBugs();

        const analysis = {
            total: bugs.length,
            bySeverity: {
                critical: 0,
                error: 0,
                warning: 0,
                info: 0
            },
            byType: {},
            resolved: 0,
            unresolved: 0,
            mobileIssues: 0,
            desktopIssues: 0,
            recentBugs: [],
            topErrors: {},
            timeline: {}
        };

        bugs.forEach(bug => {
            // Severity count
            if (bug.severity) {
                analysis.bySeverity[bug.severity] = (analysis.bySeverity[bug.severity] || 0) + 1;
            }

            // Type count
            if (bug.type) {
                analysis.byType[bug.type] = (analysis.byType[bug.type] || 0) + 1;
            }

            // Resolved status
            if (bug.resolved) {
                analysis.resolved++;
            } else {
                analysis.unresolved++;
            }

            // Platform
            if (bug.isMobile) {
                analysis.mobileIssues++;
            } else {
                analysis.desktopIssues++;
            }

            // Recent bugs (last 24 hours)
            if (Date.now() - bug.timestamp < 86400000) {
                analysis.recentBugs.push(bug);
            }

            // Top errors
            if (bug.message) {
                analysis.topErrors[bug.message] = (analysis.topErrors[bug.message] || 0) + 1;
            }

            // Timeline (by day)
            const day = new Date(bug.timestamp).toISOString().split('T')[0];
            analysis.timeline[day] = (analysis.timeline[day] || 0) + 1;
        });

        // Sort top errors
        analysis.topErrorsList = Object.entries(analysis.topErrors)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([message, count]) => ({ message, count }));

        return analysis;
    }

    /**
     * Export bugs as JSON for sharing/debugging
     */
    async function exportBugs() {
        const bugs = await getAllBugs();
        const analysis = await generateAnalysis();

        return {
            exportDate: new Date().toISOString(),
            appVersion: '3.0',
            device: {
                userAgent: navigator.userAgent,
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                }
            },
            analysis,
            bugs
        };
    }

    /**
     * Global error handler
     */
    function setupGlobalErrorHandler() {
        // Capture unhandled errors
        window.addEventListener('error', (event) => {
            logBug({
                type: 'javascript_error',
                severity: 'error',
                message: event.message,
                source: event.filename,
                line: event.lineno,
                column: event.colno,
                stack: event.error ? event.error.stack : null
            });
        });

        // Capture unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            logBug({
                type: 'promise_rejection',
                severity: 'error',
                message: event.reason ? event.reason.toString() : 'Unhandled promise rejection',
                stack: event.reason ? event.reason.stack : null
            });
        });

        // Capture console errors (override console.error)
        const originalError = console.error;
        console.error = function(...args) {
            originalError.apply(console, args);

            try {
                logBug({
                    type: 'console_error',
                    severity: 'error',
                    message: args.map(arg => {
                        if (arg === null) return 'null';
                        if (arg === undefined) return 'undefined';
                        if (typeof arg === 'object') {
                            try {
                                return safeStringify(arg);
                            } catch (e) {
                                return String(arg);
                            }
                        }
                        return String(arg);
                    }).join(' ')
                });
            } catch (e) {
                // Silently fail to prevent infinite loops
            }
        };

        // Capture console warnings
        const originalWarn = console.warn;
        console.warn = function(...args) {
            originalWarn.apply(console, args);

            try {
                logBug({
                    type: 'console_warning',
                    severity: 'warning',
                    message: args.map(arg => {
                        if (arg === null) return 'null';
                        if (arg === undefined) return 'undefined';
                        if (typeof arg === 'object') {
                            try {
                                return safeStringify(arg);
                            } catch (e) {
                                return String(arg);
                            }
                        }
                        return String(arg);
                    }).join(' ')
                });
            } catch (e) {
                // Silently fail to prevent infinite loops
            }
        };

        console.log('[BugTracker] Global error handlers installed');
    }

    /**
     * Generate test bugs for validation
     */
    async function generateTestBugs() {
        const testBugs = [
            {
                type: 'javascript_error',
                severity: 'critical',
                message: 'Test Critical Error: Uncaught TypeError',
                source: 'test.js',
                line: 42,
                stack: 'Error: Test error\n  at testFunction (test.js:42:15)\n  at main (test.js:100:5)'
            },
            {
                type: 'javascript_error',
                severity: 'error',
                message: 'Test Error: Cannot read property of undefined',
                source: 'app.js',
                line: 123
            },
            {
                type: 'console_warning',
                severity: 'warning',
                message: 'Test Warning: Deprecated API usage detected'
            },
            {
                type: 'console_error',
                severity: 'info',
                message: 'Test Info: API response time exceeded threshold'
            },
            {
                type: 'promise_rejection',
                severity: 'error',
                message: 'Test Promise Rejection: Failed to fetch data',
                stack: 'UnhandledPromiseRejection\n  at fetch (network.js:50:10)'
            }
        ];

        console.log('[BugTracker] Generating test bugs...');

        for (const bug of testBugs) {
            await logBug(bug);
            await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
        }

        console.log('[BugTracker] Test bugs generated successfully');
        return testBugs.length;
    }

    /**
     * Validate bug tracker functionality
     */
    async function runValidation() {
        const results = {
            passed: [],
            failed: [],
            warnings: []
        };

        try {
            // Test 1: Database initialization
            try {
                await init();
                results.passed.push('Database initialization');
            } catch (e) {
                results.failed.push(`Database initialization: ${e.message}`);
            }

            // Test 2: Bug logging
            try {
                const testBug = {
                    type: 'validation_test',
                    severity: 'info',
                    message: 'Validation test bug'
                };
                const id = await logBug(testBug);
                if (id) {
                    results.passed.push('Bug logging');
                    await deleteBug(id);
                } else {
                    results.warnings.push('Bug logging returned null (possible duplicate)');
                }
            } catch (e) {
                results.failed.push(`Bug logging: ${e.message}`);
            }

            // Test 3: Bug retrieval
            try {
                const bugs = await getAllBugs();
                if (Array.isArray(bugs)) {
                    results.passed.push(`Bug retrieval (${bugs.length} bugs stored)`);
                } else {
                    results.failed.push('Bug retrieval: Invalid return type');
                }
            } catch (e) {
                results.failed.push(`Bug retrieval: ${e.message}`);
            }

            // Test 4: Analysis generation
            try {
                const analysis = await generateAnalysis();
                if (analysis && typeof analysis.total === 'number') {
                    results.passed.push('Analysis generation');
                } else {
                    results.failed.push('Analysis generation: Invalid analysis object');
                }
            } catch (e) {
                results.failed.push(`Analysis generation: ${e.message}`);
            }

            // Test 5: Mobile detection
            try {
                const mobile = isMobileDevice();
                results.passed.push(`Mobile detection: ${mobile ? 'Mobile' : 'Desktop'}`);
            } catch (e) {
                results.failed.push(`Mobile detection: ${e.message}`);
            }

        } catch (error) {
            results.failed.push(`Validation error: ${error.message}`);
        }

        return results;
    }

    // Public API
    return {
        init,
        logBug,
        getAllBugs,
        getBugsBy,
        getBugCount,
        markResolved,
        deleteBug,
        clearAll,
        generateAnalysis,
        exportBugs,
        setupGlobalErrorHandler,
        generateTestBugs,
        runValidation
    };
})();

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        BugTracker.init();
        BugTracker.setupGlobalErrorHandler();
    });
} else {
    BugTracker.init();
    BugTracker.setupGlobalErrorHandler();
}
