// services/ai/feedback-store.js
// Stores all feedback signals from clinicians for RLHF
// Uses Storage.meta for persistence (key-value based)

import { Storage } from '../storage.adapter.js';

const FEEDBACK_KEY = 'ai_feedback_data';

export const FeedbackStore = {
  async getAll() {
    const data = await Storage.meta.get(FEEDBACK_KEY);
    return data || [];
  },

  async add(feedback) {
    const entry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      ...feedback
    };

    const all = await this.getAll();
    all.push(entry);

    // Keep last 1000 entries to prevent unbounded growth
    const trimmed = all.length > 1000 ? all.slice(-1000) : all;
    await Storage.meta.set(FEEDBACK_KEY, trimmed);

    return entry.id;
  },

  async getByType(queryType) {
    const all = await this.getAll();
    return all.filter(f => f.queryType === queryType);
  },

  async clear() {
    await Storage.meta.set(FEEDBACK_KEY, []);
  }
};
