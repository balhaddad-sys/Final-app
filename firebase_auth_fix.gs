/**
 * FIREBASE AUTHENTICATION BUG FIX
 * ================================
 * 
 * THE BUG: ensureFirebaseUser_() creates a folder but NOT the required data files
 * (active_data.json, trash_data.json, inbox_data.json, sessions.json, patch_log.json)
 * 
 * This causes subsequent operations like loadUserData() to fail because 
 * reg[u].dataFileId is undefined.
 * 
 * THE FIX: Replace the existing ensureFirebaseUser_() function (lines 606-636)
 * with this corrected version that creates all required files.
 */

function ensureFirebaseUser_(username, tokenResult) {
  var reg = getRegistry();
  
  if (!reg[username]) {
    // ═══════════════════════════════════════════════════════════════════════════
    // 🔥 NEW FIREBASE USER - Create folder AND all required data files
    // ═══════════════════════════════════════════════════════════════════════════
    Logger.log('[Firebase Auth] Auto-creating user: ' + username);
    
    // Get system folder (same as registerUser does)
    var sysFolder = getSystemFolder();
    var userFolder = sysFolder.createFolder("User_" + username.replace(/[@.]/g, '_'));
    
    // Create initial data structure (same as registerUser)
    var initialData = {
      rev: 1,
      checksum: null,
      vectorClock: generateVectorClock_('server'),
      updatedAt: new Date().toISOString(),
      patients: [],
      units: [
        { id: 'unit_1', name: 'Ward 14', code: '1414', icon: '🏥' },
        { id: 'unit_2', name: 'ICU', code: '9999', icon: '🚨' }
      ],
      settings: { adminPassword: 'admin123' },
      trash: { units: [], patients: [] },
      unitRequests: []
    };
    initialData.checksum = calculateChecksum_(initialData);
    
    // ═══════════════════════════════════════════════════════════════════════════
    // ✅ FIX: Create ALL required data files (this was missing!)
    // ═══════════════════════════════════════════════════════════════════════════
    var activeFile = userFolder.createFile("active_data.json", JSON.stringify(initialData));
    var trashFile = userFolder.createFile("trash_data.json", JSON.stringify([]));
    var inboxFile = userFolder.createFile("inbox_data.json", JSON.stringify([]));
    var sessionsFile = userFolder.createFile("sessions.json", JSON.stringify({ active: [], tombstones: [] }));
    var patchLogFile = userFolder.createFile("patch_log.json", "[]");
    
    // Register user with ALL file IDs
    reg[username] = {
      pass: 'FIREBASE_AUTH',
      folderId: userFolder.getId(),
      dataFileId: activeFile.getId(),         // ✅ Now included
      trashFileId: trashFile.getId(),         // ✅ Now included
      inboxFileId: inboxFile.getId(),         // ✅ Now included
      sessionsFileId: sessionsFile.getId(),   // ✅ Now included
      patchLogFileId: patchLogFile.getId(),   // ✅ Now included
      createdAt: new Date().toISOString(),
      firebaseUid: tokenResult.uid,
      displayName: tokenResult.name || username.split('@')[0],
      authMethod: 'firebase'
    };
    
    saveRegistry(reg);
    Logger.log('[Firebase Auth] User created with all data files: ' + username);
    
  } else {
    // ═══════════════════════════════════════════════════════════════════════════
    // 🔄 EXISTING USER - Link to Firebase if needed + ensure all files exist
    // ═══════════════════════════════════════════════════════════════════════════
    var needsSave = false;
    
    // Link Firebase UID if not already linked
    if (!reg[username].firebaseUid && tokenResult.uid) {
      reg[username].firebaseUid = tokenResult.uid;
      needsSave = true;
    }
    
    // Set auth method if not set
    if (!reg[username].authMethod) {
      reg[username].authMethod = 'firebase';
      needsSave = true;
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // ✅ FIX: Ensure all required files exist (handles migration from old users)
    // ═══════════════════════════════════════════════════════════════════════════
    try {
      var folder = DriveApp.getFolderById(reg[username].folderId);
      
      // Ensure active_data.json exists
      if (!reg[username].dataFileId) {
        var files = folder.getFilesByName("active_data.json");
        if (files.hasNext()) {
          reg[username].dataFileId = files.next().getId();
        } else {
          // Create default data file
          var initialData = {
            rev: 1,
            checksum: null,
            vectorClock: generateVectorClock_('server'),
            updatedAt: new Date().toISOString(),
            patients: [],
            units: [
              { id: 'unit_1', name: 'Ward 14', code: '1414', icon: '🏥' },
              { id: 'unit_2', name: 'ICU', code: '9999', icon: '🚨' }
            ],
            settings: { adminPassword: 'admin123' },
            trash: { units: [], patients: [] },
            unitRequests: []
          };
          initialData.checksum = calculateChecksum_(initialData);
          var newFile = folder.createFile("active_data.json", JSON.stringify(initialData));
          reg[username].dataFileId = newFile.getId();
        }
        needsSave = true;
      }
      
      // Ensure trash_data.json exists
      if (!reg[username].trashFileId) {
        var trashFiles = folder.getFilesByName("trash_data.json");
        if (trashFiles.hasNext()) {
          reg[username].trashFileId = trashFiles.next().getId();
        } else {
          var newTrash = folder.createFile("trash_data.json", "[]");
          reg[username].trashFileId = newTrash.getId();
        }
        needsSave = true;
      }
      
      // Ensure inbox_data.json exists
      if (!reg[username].inboxFileId) {
        var inboxFiles = folder.getFilesByName("inbox_data.json");
        if (inboxFiles.hasNext()) {
          reg[username].inboxFileId = inboxFiles.next().getId();
        } else {
          var newInbox = folder.createFile("inbox_data.json", "[]");
          reg[username].inboxFileId = newInbox.getId();
        }
        needsSave = true;
      }
      
      // Ensure sessions.json exists
      if (!reg[username].sessionsFileId) {
        var sessionFiles = folder.getFilesByName("sessions.json");
        if (sessionFiles.hasNext()) {
          reg[username].sessionsFileId = sessionFiles.next().getId();
        } else {
          var newSessions = folder.createFile("sessions.json", JSON.stringify({ active: [], tombstones: [] }));
          reg[username].sessionsFileId = newSessions.getId();
        }
        needsSave = true;
      }
      
      // Ensure patch_log.json exists
      if (!reg[username].patchLogFileId) {
        var patchFiles = folder.getFilesByName("patch_log.json");
        if (patchFiles.hasNext()) {
          reg[username].patchLogFileId = patchFiles.next().getId();
        } else {
          var newPatchLog = folder.createFile("patch_log.json", "[]");
          reg[username].patchLogFileId = newPatchLog.getId();
        }
        needsSave = true;
      }
      
    } catch (e) {
      Logger.log('[Firebase Auth] Error ensuring files for user ' + username + ': ' + e.message);
    }
    
    if (needsSave) {
      saveRegistry(reg);
      Logger.log('[Firebase Auth] Updated existing user: ' + username);
    }
  }
}
