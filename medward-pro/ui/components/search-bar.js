/**
 * Global Search Bar Component
 */
import { Store } from '../../core/store.js';

export function SearchBar(options = {}) {
  const {
    placeholder = 'Search patients...',
    onSearch = null,
    debounceMs = 200
  } = options;

  const container = document.createElement('div');
  container.className = 'search-container';

  const input = document.createElement('input');
  input.type = 'search';
  input.className = 'input search-input';
  input.placeholder = placeholder;
  input.autocomplete = 'off';

  let debounceTimer;

  input.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const query = e.target.value;

      if (onSearch) {
        onSearch(query);
      } else {
        Store.set({ searchQuery: query });
      }
    }, debounceMs);
  });

  // Clear search on Escape
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      Store.set({ searchQuery: '' });
      input.blur();
    }
  });

  container.appendChild(input);
  return container;
}
