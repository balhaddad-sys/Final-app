// features/tasks/task.service.js
// Task management service

import { Data } from '../../core/app.data.js';
import { Store } from '../../core/store.js';
import { EventBus } from '../../core/core.events.js';
import { Monitor } from '../../monitor/monitor.core.js';

export const TaskService = {
  // Get all tasks for a patient
  getByPatient(patientId) {
    return Data.Tasks.getByPatient(patientId);
  },

  // Get pending tasks for a patient
  getPendingByPatient(patientId) {
    return Data.Tasks.getByPatient(patientId).filter(t => !t.completed);
  },

  // Get completed tasks for a patient
  getCompletedByPatient(patientId) {
    return Data.Tasks.getByPatient(patientId).filter(t => t.completed);
  },

  // Get all tasks
  getAll() {
    return Data.Tasks.getAll();
  },

  // Get all pending tasks
  getAllPending() {
    return Data.Tasks.getPending();
  },

  // Get tasks by category
  getByCategory(category) {
    return Data.Tasks.getAll().filter(t => t.category === category);
  },

  // Get urgent tasks
  getUrgent() {
    return Data.Tasks.getAll().filter(t => t.priority === 'urgent' && !t.completed);
  },

  // Add a new task
  async add(patientId, text, options = {}) {
    const { category = 'general', priority = 'routine' } = options;

    try {
      const result = await Data.Tasks.addWithDetails({
        patientId,
        text,
        category,
        priority
      });

      EventBus.emit('toast:success', 'Task added');
      Monitor.log('TASK', `Added task for patient ${patientId}`);

      return result;
    } catch (error) {
      EventBus.emit('toast:error', `Failed to add task: ${error.message}`);
      throw error;
    }
  },

  // Add multiple tasks at once
  async addBulk(patientId, tasks) {
    const results = [];

    for (const task of tasks) {
      try {
        const result = await this.add(patientId, task.text, {
          category: task.category,
          priority: task.priority
        });
        results.push(result);
      } catch (error) {
        Monitor.logError('TASK_BULK_ADD', error, { patientId, task });
      }
    }

    if (results.length > 0) {
      EventBus.emit('toast:success', `Added ${results.length} tasks`);
    }

    return results;
  },

  // Toggle task completion
  async toggle(taskId) {
    const task = Data.Tasks.getById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    const newStatus = !task.completed;

    try {
      await Data.Tasks.toggle(taskId, newStatus);

      if (newStatus) {
        EventBus.emit('toast:info', 'Task completed');
      }

      return { success: true, completed: newStatus };
    } catch (error) {
      EventBus.emit('toast:error', 'Failed to update task');
      throw error;
    }
  },

  // Mark task as complete
  async complete(taskId) {
    return Data.Tasks.toggle(taskId, true);
  },

  // Mark task as incomplete
  async uncomplete(taskId) {
    return Data.Tasks.toggle(taskId, false);
  },

  // Update task
  async update(taskId, updates) {
    try {
      await Data.Tasks.update(taskId, updates);
      return { success: true };
    } catch (error) {
      EventBus.emit('toast:error', 'Failed to update task');
      throw error;
    }
  },

  // Delete task
  async delete(taskId) {
    try {
      await Data.Tasks.delete(taskId);
      EventBus.emit('toast:info', 'Task deleted');
      return { success: true };
    } catch (error) {
      EventBus.emit('toast:error', 'Failed to delete task');
      throw error;
    }
  },

  // Delete all completed tasks for a patient
  async deleteCompleted(patientId) {
    const completed = this.getCompletedByPatient(patientId);
    let deleted = 0;

    for (const task of completed) {
      try {
        await Data.Tasks.delete(task.id);
        deleted++;
      } catch (error) {
        Monitor.logError('TASK_DELETE_COMPLETED', error, { taskId: task.id });
      }
    }

    if (deleted > 0) {
      EventBus.emit('toast:info', `Deleted ${deleted} completed tasks`);
    }

    return { deleted };
  },

  // Get task statistics for a patient
  getStats(patientId) {
    const tasks = this.getByPatient(patientId);
    const pending = tasks.filter(t => !t.completed);
    const completed = tasks.filter(t => t.completed);
    const urgent = pending.filter(t => t.priority === 'urgent');

    // Group by category
    const byCategory = {};
    for (const task of tasks) {
      const cat = task.category || 'general';
      byCategory[cat] = byCategory[cat] || { total: 0, completed: 0, pending: 0 };
      byCategory[cat].total++;
      if (task.completed) {
        byCategory[cat].completed++;
      } else {
        byCategory[cat].pending++;
      }
    }

    return {
      total: tasks.length,
      pending: pending.length,
      completed: completed.length,
      urgent: urgent.length,
      completionRate: tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0,
      byCategory
    };
  },

  // Get global task statistics
  getGlobalStats() {
    const tasks = this.getAll();
    const pending = tasks.filter(t => !t.completed);
    const completed = tasks.filter(t => t.completed);
    const urgent = pending.filter(t => t.priority === 'urgent');

    return {
      total: tasks.length,
      pending: pending.length,
      completed: completed.length,
      urgent: urgent.length,
      completionRate: tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0
    };
  },

  // Copy tasks from one patient to another
  async copyTasks(fromPatientId, toPatientId, options = {}) {
    const { includeCompleted = false } = options;

    const sourceTasks = this.getByPatient(fromPatientId);
    const tasksToCopy = includeCompleted
      ? sourceTasks
      : sourceTasks.filter(t => !t.completed);

    const results = [];

    for (const task of tasksToCopy) {
      try {
        const result = await this.add(toPatientId, task.text, {
          category: task.category,
          priority: task.priority
        });
        results.push(result);
      } catch (error) {
        Monitor.logError('TASK_COPY', error, { fromPatientId, toPatientId });
      }
    }

    if (results.length > 0) {
      EventBus.emit('toast:success', `Copied ${results.length} tasks`);
    }

    return results;
  }
};
