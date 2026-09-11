export type AppTheme = 'dark' | 'high-contrast';

const STORAGE_KEY = 'binance_harvest_theme';

export function getStoredTheme(): AppTheme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'high-contrast' || saved === 'dark') {
      return saved;
    }
  } catch (e) {
    console.warn('Could not read theme from localStorage:', e);
  }
  return 'dark';
}

export function applyTheme(theme: AppTheme): void {
  if (typeof document === 'undefined') return;
  try {
    const isHighContrast = theme === 'high-contrast';
    
    if (isHighContrast) {
      document.documentElement.classList.add('high-contrast');
      if (document.body) {
        document.body.classList.add('high-contrast');
      }
      document.documentElement.setAttribute('data-theme', 'high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
      if (document.body) {
        document.body.classList.remove('high-contrast');
      }
      document.documentElement.setAttribute('data-theme', 'dark');
    }

    localStorage.setItem(STORAGE_KEY, theme);

    // Notify any active components listening for theme changes
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
  } catch (e) {
    console.warn('Could not apply theme:', e);
  }
}

export function toggleTheme(): AppTheme {
  const current = getStoredTheme();
  const next: AppTheme = current === 'dark' ? 'high-contrast' : 'dark';
  applyTheme(next);
  return next;
}
