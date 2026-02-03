// ui/theme.js
// Theme management (light/dark mode)

import { EventBus } from '../core/core.events.js';
import { Storage } from '../services/storage.adapter.js';

class ThemeManager {
  constructor() {
    this.currentTheme = 'light';
    this.mediaQuery = null;
  }

  async init() {
    // Load saved theme preference
    const savedTheme = await Storage.meta.get('theme');

    if (savedTheme) {
      this.setTheme(savedTheme);
    } else {
      // Check system preference
      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.setTheme(this.mediaQuery.matches ? 'dark' : 'light');

      // Listen for system preference changes
      this.mediaQuery.addEventListener('change', async (e) => {
        if (!(await Storage.meta.get('theme'))) {
          this.setTheme(e.matches ? 'dark' : 'light');
        }
      });
    }
  }

  async setTheme(theme) {
    this.currentTheme = theme;

    if (theme === 'dark') {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    } else {
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
    }

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'dark' ? '#0f172a' : '#ffffff');
    }

    // Save preference
    await Storage.meta.set('theme', theme);

    EventBus.emit('theme:changed', theme);
  }

  toggle() {
    this.setTheme(this.currentTheme === 'dark' ? 'light' : 'dark');
  }

  get isDark() {
    return this.currentTheme === 'dark';
  }

  get isLight() {
    return this.currentTheme === 'light';
  }

  // Get CSS variable value
  getCSSVariable(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  // Set CSS variable
  setCSSVariable(name, value) {
    document.documentElement.style.setProperty(name, value);
  }

  // Get theme colors
  getColors() {
    return {
      primary: this.getCSSVariable('--primary'),
      primaryDark: this.getCSSVariable('--primary-dark'),
      primaryLight: this.getCSSVariable('--primary-light'),
      bgApp: this.getCSSVariable('--bg-app'),
      bgSurface: this.getCSSVariable('--bg-surface'),
      textMain: this.getCSSVariable('--text-main'),
      textSecondary: this.getCSSVariable('--text-secondary'),
      success: this.getCSSVariable('--success'),
      danger: this.getCSSVariable('--danger'),
      warning: this.getCSSVariable('--warning')
    };
  }
}

export const Theme = new ThemeManager();
