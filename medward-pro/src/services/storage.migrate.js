// services/storage.migrate.js
// Schema migrations for IndexedDB

const MIGRATIONS = [
  {
    version: 1,
    description: 'Initial schema',
    migrate: (db) => {
      // Already handled in storage.db.js onupgradeneeded
      console.log('[Migration] Version 1: Initial schema');
    }
  },
  // Future migrations can be added here
  // {
  //   version: 2,
  //   description: 'Add new fields',
  //   migrate: async (db) => {
  //     // Migration logic
  //   }
  // }
];

export const Migrations = {
  async run(db, oldVersion, newVersion) {
    console.log(`[Migration] Upgrading from v${oldVersion} to v${newVersion}`);

    const pendingMigrations = MIGRATIONS.filter(m =>
      m.version > oldVersion && m.version <= newVersion
    );

    for (const migration of pendingMigrations) {
      console.log(`[Migration] Running: ${migration.description}`);
      try {
        await migration.migrate(db);
        console.log(`[Migration] Completed: v${migration.version}`);
      } catch (error) {
        console.error(`[Migration] Failed: v${migration.version}`, error);
        throw error;
      }
    }
  },

  getCurrentVersion() {
    return MIGRATIONS.length > 0
      ? Math.max(...MIGRATIONS.map(m => m.version))
      : 1;
  }
};
