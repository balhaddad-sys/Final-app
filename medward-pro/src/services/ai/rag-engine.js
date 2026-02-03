// services/ai/rag-engine.js
// RAG Engine - Retrieval-Augmented Generation
//
// From Enterprise doc:
// "The system retrieves that corrected interaction. It injects this
// 'wisdom' into the prompt for the current patient. This is
// Institutional Memory."

import { LearningStore } from './learning-store.js';

const MAX_EXAMPLES = 5;
const MIN_SIMILARITY = 0.3;

export const RAGEngine = {
  /**
   * Find relevant examples from institutional memory
   * This is the findRelevantExamples function
   *
   * @param {object} scenario - Current clinical scenario
   * @param {string[]} scenario.abnormals - e.g., ['high_calcium', 'low_phosphate']
   * @param {string} scenario.type - 'labs' | 'ecg' | 'echo' | 'clinical'
   * @param {string} scenario.diagnosis - Primary diagnosis if known
   */
  async findRelevantExamples(scenario) {
    const allData = await LearningStore.getAll();

    if (!allData || allData.length === 0) {
      return [];
    }

    // Score each stored interaction
    const scored = allData
      .filter(entry => entry.verified === true)
      .map(entry => ({
        ...entry,
        similarityScore: this.calculateSimilarity(scenario, entry.scenario)
      }))
      .filter(entry => entry.similarityScore >= MIN_SIMILARITY)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, MAX_EXAMPLES);

    return scored;
  },

  /**
   * Calculate similarity score
   * Based on the similarityScore logic in v11.0
   */
  calculateSimilarity(current, stored) {
    let score = 0;
    let maxScore = 0;

    // 1. Abnormal findings overlap (weight: 50%)
    if (current.abnormals?.length && stored.abnormals?.length) {
      maxScore += 0.5;

      const currentSet = new Set(current.abnormals.map(a => a.toLowerCase()));
      const storedSet = new Set(stored.abnormals.map(a => a.toLowerCase()));

      // Jaccard similarity
      const intersection = [...currentSet].filter(x => storedSet.has(x));
      const union = new Set([...currentSet, ...storedSet]);

      if (union.size > 0) {
        score += 0.5 * (intersection.length / union.size);
      }
    }

    // 2. Type match (weight: 20%)
    maxScore += 0.2;
    if (current.type && stored.type && current.type === stored.type) {
      score += 0.2;
    }

    // 3. Diagnosis similarity (weight: 30%)
    maxScore += 0.3;
    if (current.diagnosis && stored.diagnosis) {
      const currDx = current.diagnosis.toLowerCase();
      const storeDx = stored.diagnosis.toLowerCase();

      if (currDx === storeDx) {
        score += 0.3; // Exact match
      } else if (currDx.includes(storeDx) || storeDx.includes(currDx)) {
        score += 0.15; // Partial match
      } else if (this._diagnosisRelated(currDx, storeDx)) {
        score += 0.1; // Related conditions
      }
    }

    return maxScore > 0 ? score / maxScore : 0;
  },

  /**
   * Check if diagnoses are related
   */
  _diagnosisRelated(dx1, dx2) {
    const relatedGroups = [
      ['diabetes', 'dka', 'hhs', 'hyperglycemia', 'hypoglycemia'],
      ['aki', 'ckd', 'renal failure', 'nephropathy'],
      ['mi', 'acs', 'nstemi', 'stemi', 'unstable angina'],
      ['sepsis', 'septic shock', 'bacteremia'],
      ['chf', 'heart failure', 'pulmonary edema'],
      ['pneumonia', 'cap', 'hap', 'respiratory infection'],
      ['cirrhosis', 'liver failure', 'hepatic encephalopathy']
    ];

    for (const group of relatedGroups) {
      const dx1InGroup = group.some(term => dx1.includes(term));
      const dx2InGroup = group.some(term => dx2.includes(term));
      if (dx1InGroup && dx2InGroup) return true;
    }

    return false;
  },

  /**
   * Build context injection for AI prompt
   * This is what gets prepended to make the AI "learn"
   */
  buildContextInjection(relevantExamples) {
    if (!relevantExamples?.length) return '';

    let injection = '\n<institutional_memory>\n';
    injection += 'Relevant cases from this institution:\n\n';

    relevantExamples.forEach((example, i) => {
      injection += `Case ${i + 1} (${Math.round(example.similarityScore * 100)}% match):\n`;
      injection += `Scenario: ${example.scenario.abnormals?.join(', ') || 'N/A'}\n`;

      if (example.correction) {
        // Corrections are gold - prioritize them
        injection += `IMPORTANT CORRECTION: ${example.correction}\n`;
        injection += `(Original incorrect response: ${example.response.substring(0, 100)}...)\n`;
      } else {
        injection += `Verified approach: ${example.response.substring(0, 200)}...\n`;
      }
      injection += '\n';
    });

    injection += '</institutional_memory>\n';
    return injection;
  }
};
