/**
 * Clinical Tools Hub Page
 * Central page linking to all AI-powered clinical tools
 */
import { Router } from '../../core/router.js';

const TOOLS = [
  {
    id: 'drug-info',
    icon: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 1.5l-8 8a5 5 0 0 0 7.07 7.07l8-8a5 5 0 0 0-7.07-7.07z"></path><path d="M6.5 9.5l7-7"></path></svg>',
    label: 'Drug Lookup',
    description: 'Search drug info, dosing, interactions',
    path: '/drug-info',
    color: 'var(--color-primary-500)'
  },
  {
    id: 'antibiotic-guide',
    icon: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>',
    label: 'Antibiotic Guide',
    description: 'Empiric antibiotic guidance by condition',
    path: '/antibiotic-guide',
    color: 'var(--color-success-500)'
  },
  {
    id: 'lab-scanner',
    icon: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>',
    label: 'Lab Scanner',
    description: 'Scan and analyze lab reports with AI vision',
    path: '/lab-scanner',
    color: 'var(--color-info-500)'
  },
  {
    id: 'differential',
    icon: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
    label: 'Differential Diagnosis',
    description: 'Generate structured differential from symptoms',
    path: '/differential',
    color: 'var(--color-warning-500)'
  },
  {
    id: 'electrolyte-check',
    icon: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>',
    label: 'Electrolyte Check',
    description: 'Verify electrolyte correction plans',
    path: '/electrolyte-check',
    color: 'var(--color-danger-500)'
  },
  {
    id: 'oncall',
    icon: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>',
    label: 'On-Call Assistant',
    description: 'Quick guidance for on-call scenarios',
    path: '/oncall',
    color: 'var(--color-neutral-600)'
  }
];

export function renderClinicalTools(container) {
  container.innerHTML = `
    <div class="page-tools">
      <header class="page-header">
        <h2>Clinical Tools</h2>
        <p class="page-subtitle">AI-powered tools for clinical decision support.</p>
      </header>

      <div class="ai-disclaimer">
        <span class="disclaimer-icon">\u26A0\uFE0F</span>
        <span>All AI tools are for educational support only. Always apply clinical judgment.</span>
      </div>

      <main class="tools-grid">
        ${TOOLS.map(tool => `
          <a href="#${tool.path}" class="tool-card card card-interactive" data-path="${tool.path}">
            <div class="tool-card-icon" style="color: ${tool.color}">${tool.icon}</div>
            <div class="tool-card-info">
              <h4 class="tool-card-label">${tool.label}</h4>
              <p class="tool-card-desc">${tool.description}</p>
            </div>
            <svg class="tool-card-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"></path></svg>
          </a>
        `).join('')}
      </main>
    </div>
  `;
}
