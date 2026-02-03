// services/ai/learning-store.js
// Stores verified clinical interactions for RAG retrieval
// This is the "institutional memory" from v11.0 Code-1.gs
// Uses Storage.meta for persistence (key-value based)

import { Storage } from '../storage.adapter.js';

const LEARNING_KEY = 'ai_learning_data';

export const LearningStore = {
  /**
   * Get all learning data
   */
  async getAll() {
    const data = await Storage.meta.get(LEARNING_KEY);
    return data || [];
  },

  /**
   * Add verified interaction
   * Called when doctor confirms AI response was correct/helpful
   */
  async addVerified(interaction) {
    const entry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      verified: true,

      // Clinical scenario for matching
      scenario: {
        type: interaction.type,           // 'labs' | 'ecg' | 'echo' | 'clinical' | 'drug'
        abnormals: interaction.abnormals, // ['high_potassium', 'low_sodium', 'elevated_troponin']
        diagnosis: interaction.diagnosis,
        keywords: interaction.keywords || []
      },

      // The interaction
      query: interaction.query,
      response: interaction.response,
      correction: interaction.correction || null,

      // Metadata
      userId: interaction.userId,
      unitId: interaction.unitId,
      rating: interaction.rating
    };

    const all = await this.getAll();
    all.push(entry);

    // Keep last 500 entries to prevent unbounded growth
    const trimmed = all.length > 500 ? all.slice(-500) : all;
    await Storage.meta.set(LEARNING_KEY, trimmed);

    return entry.id;
  },

  /**
   * Add correction (when doctor fixes AI mistake)
   * From the doc: "If the AI previously misinterpreted High Calcium in a
   * patient with Sarcoidosis, and a doctor corrected it..."
   */
  async addCorrection(originalId, correction) {
    const all = await this.getAll();
    const original = all.find(entry => entry.id === originalId);
    if (!original) throw new Error('Original interaction not found');

    original.correction = correction;
    original.correctedAt = Date.now();
    original.verified = true; // Corrections are valuable learning

    await Storage.meta.set(LEARNING_KEY, all);
    return original.id;
  },

  /**
   * Clear all learning data
   */
  async clear() {
    await Storage.meta.set(LEARNING_KEY, []);
  }
};
