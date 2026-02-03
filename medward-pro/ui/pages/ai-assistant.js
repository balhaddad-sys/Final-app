/**
 * AI Assistant Chat Interface
 */
import { AIService } from '../../services/ai.service.js';
import { EventBus, Events } from '../../core/events.js';

let messagesContainer = null;

export function renderAIAssistant(container) {
  container.innerHTML = `
    <div class="page-ai">
      <header class="ai-header">
        <h1>AI Assistant</h1>
        <p>Clinical decision support</p>
      </header>

      <div class="ai-messages" id="ai-messages">
        <!-- Messages render here -->
      </div>

      <div class="ai-input-container">
        <textarea
          class="ai-input"
          id="ai-input"
          placeholder="Ask a clinical question..."
          rows="1"
        ></textarea>
        <button class="ai-send-btn" id="ai-send" aria-label="Send message">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    </div>
  `;

  messagesContainer = container.querySelector('#ai-messages');
  const input = container.querySelector('#ai-input');
  const sendBtn = container.querySelector('#ai-send');

  // Render existing history
  renderMessages();

  // Show suggestions if no history
  if (AIService.getHistory().length === 0) {
    renderSuggestions();
  }

  // Auto-resize textarea
  input?.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });

  // Send on Enter (not Shift+Enter)
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Send button
  sendBtn?.addEventListener('click', sendMessage);

  async function sendMessage() {
    const text = input?.value?.trim();
    if (!text) return;

    // Clear input
    input.value = '';
    input.style.height = 'auto';

    // Add user message
    addMessageToUI('user', text);

    // Show typing indicator
    showTyping();

    // Disable input while processing
    input.disabled = true;
    sendBtn.disabled = true;

    try {
      const response = await AIService.sendMessage(text);
      hideTyping();
      addMessageToUI('assistant', response.content);
    } catch (error) {
      hideTyping();
      addMessageToUI('assistant', 'Sorry, I encountered an error. Please try again.', true);
    } finally {
      input.disabled = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }
}

function renderMessages() {
  if (!messagesContainer) return;

  const history = AIService.getHistory();

  history.forEach(msg => {
    addMessageToUI(msg.role, msg.content, msg.isError);
  });
}

function renderSuggestions() {
  if (!messagesContainer) return;

  const suggestions = AIService.getSuggestions();

  const welcomeEl = document.createElement('div');
  welcomeEl.className = 'ai-welcome';
  welcomeEl.style.cssText = 'text-align: center; padding: var(--space-8) var(--space-4);';

  welcomeEl.innerHTML = `
    <div style="font-size: 2rem; margin-bottom: var(--space-4);">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.5">
        <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z"></path>
      </svg>
    </div>
    <h3 style="margin-bottom: var(--space-2);">Clinical AI Assistant</h3>
    <p style="color: var(--text-secondary); font-size: var(--text-sm); margin-bottom: var(--space-6);">
      Ask questions about your patients, get clinical suggestions, or generate handover notes.
    </p>
    <div style="display: flex; flex-direction: column; gap: var(--space-2); max-width: 300px; margin: 0 auto;">
      ${suggestions.map(s => `
        <button class="btn btn-secondary btn-sm suggestion-btn" style="text-align: left; white-space: normal; line-height: var(--leading-normal);">
          ${escapeHtml(s)}
        </button>
      `).join('')}
    </div>
  `;

  // Click suggestion to send
  welcomeEl.querySelectorAll('.suggestion-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById('ai-input');
      if (input) {
        input.value = btn.textContent.trim();
        welcomeEl.remove();
        // Trigger send
        document.getElementById('ai-send')?.click();
      }
    });
  });

  messagesContainer.appendChild(welcomeEl);
}

function addMessageToUI(role, content, isError = false) {
  if (!messagesContainer) return;

  // Remove welcome/suggestions if present
  const welcome = messagesContainer.querySelector('.ai-welcome');
  if (welcome) welcome.remove();

  const msgEl = document.createElement('div');
  msgEl.className = `ai-message ai-message-${role}`;
  if (isError) msgEl.style.borderLeft = '3px solid var(--danger)';

  msgEl.textContent = content;

  messagesContainer.appendChild(msgEl);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showTyping() {
  if (!messagesContainer) return;

  const typing = document.createElement('div');
  typing.className = 'ai-message ai-message-assistant ai-message-typing';
  typing.id = 'ai-typing';
  typing.innerHTML = `
    <div class="ai-typing-dot"></div>
    <div class="ai-typing-dot"></div>
    <div class="ai-typing-dot"></div>
  `;

  messagesContainer.appendChild(typing);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function hideTyping() {
  document.getElementById('ai-typing')?.remove();
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
