/**
 * AI Service - Claude API Integration
 */
import { Store } from '../core/store.js';
import { EventBus, Events } from '../core/events.js';
import { CloudFunctions } from './firebase.functions.js';

const MAX_CONTEXT_MESSAGES = 20;

let _conversationHistory = [];

export const AIService = {
  /**
   * Send a message to the AI assistant
   */
  async sendMessage(userMessage) {
    // Add user message to history
    _conversationHistory.push({
      role: 'user',
      content: userMessage,
      timestamp: Date.now()
    });

    // Trim history if too long
    if (_conversationHistory.length > MAX_CONTEXT_MESSAGES) {
      _conversationHistory = _conversationHistory.slice(-MAX_CONTEXT_MESSAGES);
    }

    try {
      // Build context from current patient data
      const context = this._buildContext();

      // Call cloud function
      const result = await CloudFunctions.askAI(userMessage, {
        history: _conversationHistory.slice(-10),
        ...context
      });

      if (result.success) {
        const assistantMessage = {
          role: 'assistant',
          content: result.data.response || result.data.message || 'I apologize, I could not generate a response.',
          timestamp: Date.now()
        };

        _conversationHistory.push(assistantMessage);
        return assistantMessage;
      } else {
        throw new Error(result.error || 'AI request failed');
      }
    } catch (error) {
      console.error('[AIService] Error:', error);

      const errorMessage = {
        role: 'assistant',
        content: 'I apologize, I encountered an error. Please try again.',
        timestamp: Date.now(),
        isError: true
      };

      _conversationHistory.push(errorMessage);
      return errorMessage;
    }
  },

  /**
   * Build context from current app state
   */
  _buildContext() {
    const currentPatient = Store.currentPatient;
    const currentUnit = Store.currentUnit;

    const context = {};

    if (currentUnit) {
      context.unitName = currentUnit.name;
    }

    if (currentPatient) {
      context.patient = {
        name: currentPatient.name,
        diagnosis: currentPatient.diagnosis,
        status: currentPatient.status,
        bed: currentPatient.bed,
        notes: currentPatient.notes
      };

      // Include patient tasks
      const tasks = Store.select('tasks', t => t.patientId === currentPatient.id);
      context.tasks = tasks.map(t => ({
        text: t.text,
        completed: t.completed,
        category: t.category,
        priority: t.priority
      }));
    }

    return context;
  },

  /**
   * Get conversation history
   */
  getHistory() {
    return [..._conversationHistory];
  },

  /**
   * Clear conversation
   */
  clearHistory() {
    _conversationHistory = [];
  },

  /**
   * Get suggested prompts for the current context
   */
  getSuggestions() {
    const currentPatient = Store.currentPatient;

    if (currentPatient) {
      return [
        `Summarize ${currentPatient.name}'s current status`,
        `What labs should I order for ${currentPatient.diagnosis || 'this patient'}?`,
        'Generate a handover note for this patient',
        'What are the key things to monitor overnight?'
      ];
    }

    return [
      'Help me prepare for ward rounds',
      'What are common antibiotic guidelines?',
      'How should I prioritize my patient list?',
      'Generate a shift handover summary'
    ];
  }
};
