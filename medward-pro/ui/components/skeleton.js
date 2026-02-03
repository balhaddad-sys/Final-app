/**
 * Skeleton Loader Components
 */

export function SkeletonText(width = '100%', height = '1em') {
  const el = document.createElement('div');
  el.className = 'skeleton skeleton-text';
  el.style.width = width;
  el.style.height = height;
  return el;
}

export function SkeletonAvatar(size = 44) {
  const el = document.createElement('div');
  el.className = 'skeleton skeleton-avatar';
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  return el;
}

export function SkeletonCard() {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.padding = 'var(--space-4)';

  card.innerHTML = `
    <div style="display: flex; gap: var(--space-3); align-items: center; margin-bottom: var(--space-3);">
      <div class="skeleton" style="width: 8px; height: 8px; border-radius: 50%;"></div>
      <div class="skeleton" style="width: 60%; height: 20px;"></div>
    </div>
    <div class="skeleton" style="width: 40%; height: 14px; margin-bottom: var(--space-2);"></div>
    <div class="skeleton" style="width: 80%; height: 14px;"></div>
  `;

  return card;
}

export function SkeletonList(count = 5) {
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = 'var(--space-3)';

  for (let i = 0; i < count; i++) {
    container.appendChild(SkeletonCard());
  }

  return container;
}
