// ui/components/ai-feedback.js
// AI Feedback Component
// Captures doctor's feedback on AI responses for RLHF

import { AI } from '../../services/ai/ai-service.js';
import { EventBus } from '../../core/core.events.js';

export function AIFeedback(interactionId, queryType) {
  const container = document.createElement('div');
  container.className = 'ai-feedback';

  container.innerHTML = `
    <div class="ai-feedback-header">
      <span>Was this helpful?</span>
      <div class="ai-feedback-rating" id="rating-stars">
        ${[1,2,3,4,5].map(n => `
          <button class="star-btn" data-rating="${n}" aria-label="${n} star">
            &#9734;
          </button>
        `).join('')}
      </div>
    </div>

    <div class="ai-feedback-details hidden" id="feedback-details">
      <div class="feedback-options">
        <p class="feedback-label">What could be improved?</p>
        <div class="feedback-chips" id="issue-chips">
          <button class="chip" data-issue="too_long">Too long</button>
          <button class="chip" data-issue="too_brief">Too brief</button>
          <button class="chip" data-issue="too_technical">Too technical</button>
          <button class="chip" data-issue="missed_key_point">Missed key point</button>
          <button class="chip" data-issue="no_trends">No trend analysis</button>
          <button class="chip" data-issue="no_red_flags">Missing red flags</button>
        </div>

        <p class="feedback-label">What was good?</p>
        <div class="feedback-chips" id="positive-chips">
          <button class="chip" data-positive="concise">Concise</button>
          <button class="chip" data-positive="clinical_correlation">Good clinical correlation</button>
          <button class="chip" data-positive="actionable">Actionable</button>
          <button class="chip" data-positive="good_format">Good format</button>
        </div>
      </div>

      <div class="feedback-correction">
        <label class="feedback-label">Correction (optional)</label>
        <textarea
          id="correction-text"
          class="input"
          placeholder="If the AI was wrong, what should it have said?"
          rows="3"
        ></textarea>
      </div>

      <button class="btn btn-primary" id="submit-feedback">Submit Feedback</button>
    </div>
  `;

  let selectedRating = 0;
  const selectedIssues = new Set();
  const selectedPositives = new Set();

  // Rating stars
  container.querySelector('#rating-stars').addEventListener('click', (e) => {
    const btn = e.target.closest('.star-btn');
    if (!btn) return;

    selectedRating = parseInt(btn.dataset.rating);

    // Update stars display
    container.querySelectorAll('.star-btn').forEach((star, i) => {
      star.innerHTML = i < selectedRating ? '&#9733;' : '&#9734;';
      star.classList.toggle('active', i < selectedRating);
    });

    // Show details for any rating
    container.querySelector('#feedback-details').classList.remove('hidden');
  });

  // Issue chips
  container.querySelector('#issue-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;

    const issue = chip.dataset.issue;
    if (selectedIssues.has(issue)) {
      selectedIssues.delete(issue);
      chip.classList.remove('chip-active');
    } else {
      selectedIssues.add(issue);
      chip.classList.add('chip-active');
    }
  });

  // Positive chips
  container.querySelector('#positive-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;

    const positive = chip.dataset.positive;
    if (selectedPositives.has(positive)) {
      selectedPositives.delete(positive);
      chip.classList.remove('chip-active');
    } else {
      selectedPositives.add(positive);
      chip.classList.add('chip-active');
    }
  });

  // Submit
  container.querySelector('#submit-feedback').addEventListener('click', async () => {
    if (selectedRating === 0) {
      EventBus.emit('toast:warning', 'Please select a rating');
      return;
    }

    const correction = container.querySelector('#correction-text').value.trim();

    try {
      await AI.recordFeedback({
        interactionId,
        rating: selectedRating,
        feedbackType: selectedRating >= 4 ? 'helpful' : 'unhelpful',
        issues: [...selectedIssues],
        positives: [...selectedPositives],
        correction: correction || null,
        queryType
      });

      EventBus.emit('toast:success', 'Thanks for your feedback!');
      container.innerHTML = '<p class="text-muted">Feedback recorded</p>';

    } catch (error) {
      EventBus.emit('toast:error', 'Failed to submit feedback');
    }
  });

  return container;
}
