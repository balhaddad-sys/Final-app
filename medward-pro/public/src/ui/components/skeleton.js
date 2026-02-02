// ui/components/skeleton.js
// Skeleton loading states

export const Skeleton = {
  // Create a single skeleton line
  line(width = '100%', height = '1em') {
    return `<div class="skeleton skeleton-text" style="width: ${width}; height: ${height};"></div>`;
  },

  // Create skeleton paragraph with multiple lines
  paragraph(lines = 3) {
    const widths = ['100%', '90%', '75%', '85%', '60%'];
    return Array.from({ length: lines }, (_, i) =>
      this.line(widths[i % widths.length])
    ).join('');
  },

  // Create circular skeleton (for avatars)
  circle(size = '48px') {
    return `<div class="skeleton skeleton-avatar" style="width: ${size}; height: ${size};"></div>`;
  },

  // Create rectangular skeleton
  rect(width = '100%', height = '100px') {
    return `<div class="skeleton" style="width: ${width}; height: ${height};"></div>`;
  },

  // Patient card skeleton
  patientCard() {
    return `
      <div class="skeleton-card patient-skeleton">
        <div class="skeleton-card-header">
          ${this.circle('48px')}
          <div class="skeleton-card-info">
            ${this.line('60%', '1.2em')}
            ${this.line('40%', '0.9em')}
          </div>
        </div>
        <div class="skeleton-card-body">
          ${this.paragraph(2)}
        </div>
      </div>
    `;
  },

  // Patient list skeleton
  patientList(count = 5) {
    return Array.from({ length: count }, () => this.patientCard()).join('');
  },

  // Task item skeleton
  taskItem() {
    return `
      <div class="skeleton-task">
        <div class="skeleton-checkbox"></div>
        <div class="skeleton-task-content">
          ${this.line('80%')}
        </div>
      </div>
    `;
  },

  // Task list skeleton
  taskList(count = 5) {
    return Array.from({ length: count }, () => this.taskItem()).join('');
  },

  // Unit card skeleton
  unitCard() {
    return `
      <div class="skeleton-unit">
        ${this.circle('64px')}
        ${this.line('70%', '1.1em')}
        ${this.line('40%', '0.85em')}
      </div>
    `;
  },

  // Stats skeleton
  statsRow(count = 4) {
    const stat = `
      <div class="skeleton-stat">
        ${this.line('60%', '2em')}
        ${this.line('80%', '0.8em')}
      </div>
    `;
    return `<div class="skeleton-stats">${Array.from({ length: count }, () => stat).join('')}</div>`;
  },

  // Form skeleton
  form(fields = 3) {
    const field = `
      <div class="skeleton-form-group">
        ${this.line('30%', '0.9em')}
        ${this.rect('100%', '44px')}
      </div>
    `;
    return `<div class="skeleton-form">${Array.from({ length: fields }, () => field).join('')}</div>`;
  },

  // Table skeleton
  table(rows = 5, cols = 4) {
    const header = `<div class="skeleton-table-header">${
      Array.from({ length: cols }, () => this.line('80%')).join('')
    }</div>`;

    const row = `<div class="skeleton-table-row">${
      Array.from({ length: cols }, () => this.line('70%')).join('')
    }</div>`;

    return `
      <div class="skeleton-table">
        ${header}
        ${Array.from({ length: rows }, () => row).join('')}
      </div>
    `;
  },

  // Dashboard skeleton
  dashboard() {
    return `
      <div class="skeleton-dashboard">
        ${this.statsRow(4)}
        <div class="skeleton-dashboard-grid">
          <div class="skeleton-dashboard-main">
            ${this.patientList(3)}
          </div>
          <div class="skeleton-dashboard-sidebar">
            ${this.taskList(5)}
          </div>
        </div>
      </div>
    `;
  },

  // Show skeleton in container
  showIn(containerId, skeletonHtml) {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = `<div class="skeleton-container">${skeletonHtml}</div>`;
    }
  },

  // Remove skeleton from container
  removeFrom(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
      const skeleton = container.querySelector('.skeleton-container');
      if (skeleton) {
        skeleton.remove();
      }
    }
  }
};
