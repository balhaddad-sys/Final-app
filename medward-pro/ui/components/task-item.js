/**
 * Task Item Component
 */
import { Data } from '../../core/data.js';
import { EventBus, Events } from '../../core/events.js';

export function TaskItem(task) {
  const item = document.createElement('div');
  item.className = `task-item ${task.completed ? 'completed' : ''}`;
  item.dataset.taskId = task.id;

  const priorityClass = `task-priority-${task.priority || 'normal'}`;

  item.innerHTML = `
    <div class="task-priority ${priorityClass}"></div>
    <div class="task-checkbox">
      ${task.completed ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>` : ''}
    </div>
    <span class="task-text">${escapeHtml(task.text)}</span>
    ${task.category && task.category !== 'general' ? `
      <span class="task-category">${escapeHtml(task.category)}</span>
    ` : ''}
  `;

  // Toggle completion on click
  item.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await Data.tasks.toggle(task.id);
    } catch (error) {
      EventBus.emit(Events.TOAST_SHOW, { type: 'error', message: error.message });
    }
  });

  return item;
}

export function AddTaskForm(patientId, onAdded) {
  const form = document.createElement('form');
  form.className = 'add-task-form';
  form.style.display = 'flex';
  form.style.gap = 'var(--space-2)';

  form.innerHTML = `
    <input
      type="text"
      class="input"
      placeholder="Add a task..."
      name="taskText"
      style="flex: 1;"
      required
    >
    <button type="submit" class="btn btn-primary btn-sm">Add</button>
  `;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = form.querySelector('input');
    const text = input.value.trim();

    if (!text) return;

    try {
      await Data.tasks.add(patientId, { text });
      input.value = '';
      if (onAdded) onAdded();
    } catch (error) {
      EventBus.emit(Events.TOAST_SHOW, { type: 'error', message: error.message });
    }
  });

  return form;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
