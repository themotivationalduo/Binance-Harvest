/**
 * Utility functions for capturing, validating, and normalizing referral codes
 * across varying URL formats, query parameters, hashes, and pathnames.
 */

export const VALID_TABS = ['dashboard', 'tiers', 'treasury', 'leaderboard', 'history', 'help', 'wallet', 'admin'] as const;
export type ValidTab = typeof VALID_TABS[number];

export const AUTH_ROUTES = ['auth', 'login', 'register', 'signin', 'signup'] as const;

/**
 * Checks if a string is a strictly valid 42-character EVM / BEP-20 address.
 */
export function isValidEvmAddress(address: string | null | undefined): boolean {
  if (!address || typeof address !== 'string') return false;
  return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
}

/**
 * Normalizes an address to lower-case '0x...' format if valid, or returns null.
 */
export function normalizeEvmAddress(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const clean = raw.trim();

  // Standard 0x format
  if (/^0x[a-fA-F0-9]{40}$/i.test(clean)) {
    return clean.toLowerCase();
  }

  // Missing 0x prefix format (40 hex chars)
  if (/^[a-fA-F0-9]{40}$/i.test(clean)) {
    return `0x${clean.toLowerCase()}`;
  }

  return null;
}

/**
 * Extracts and validates an EVM referral address from any source (URL, search params, path, hash, or raw string).
 * Handles malformed strings, encoding, delimiters, and varying formats gracefully.
 */
export function extractReferralAddress(source?: string | Location | null): string | null {
  if (typeof window === 'undefined') return null;

  try {
    let inputStr = '';

    if (!source) {
      inputStr = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    } else if (typeof source === 'string') {
      inputStr = source;
    } else {
      inputStr = `${source.pathname || ''}${source.search || ''}${source.hash || ''}`;
    }

    // Decode URI components safely
    let decoded = inputStr;
    try {
      decoded = decodeURIComponent(inputStr);
    } catch {
      decoded = inputStr;
    }

    // 1. Check Query Parameters (?ref=, ?r=, ?referrer=, ?invite=, ?code=, ?referral=)
    if (typeof window !== 'undefined' && window.location.search) {
      const searchParams = new URLSearchParams(window.location.search);
      const queryKeys = ['ref', 'r', 'referrer', 'invite', 'code', 'referral', 'u', 'user'];
      for (const key of queryKeys) {
        const val = searchParams.get(key);
        if (val) {
          const directMatch = normalizeEvmAddress(val);
          if (directMatch) return directMatch;
          
          // Try matching inside value if surrounded by extra characters
          const innerMatch = val.match(/0x[a-fA-F0-9]{40}/i);
          if (innerMatch) {
            return innerMatch[0].toLowerCase();
          }
        }
      }
    }

    // 2. Check for explicit 0x pattern with 40 hex digits anywhere in string
    const hexWith0xMatches = decoded.match(/0x[a-fA-F0-9]{40}/gi);
    if (hexWith0xMatches && hexWith0xMatches.length > 0) {
      return hexWith0xMatches[0].toLowerCase();
    }

    // 3. Check for pattern after referral prefixes (e.g. ref-..., ref/..., invite/...) without 0x
    const prefixMatch = decoded.match(/(?:ref|invite|r|join|referrer)[=/:_-]([a-fA-F0-9]{40})/i);
    if (prefixMatch && prefixMatch[1]) {
      return `0x${prefixMatch[1].toLowerCase()}`;
    }

    // No valid EVM address found
    return null;
  } catch (err) {
    console.warn('Error parsing referral address from URL:', err);
    return null;
  }
}

/**
 * Analyzes the current location and URL prefix:
 * - If a user enters with a wrong/invalid URL prefix (e.g. /walleting, /anything-else):
 *   - Automatically redirects to /dashboard if authenticated
 *   - Automatically redirects to /auth (authentication page) if not authenticated
 * - Normalizes referral parameters and tab states seamlessly.
 */
export function resolveInitialRoute(isAuthenticatedOverride?: boolean): {
  activeTab: ValidTab;
  referralCode: string | null;
  targetUrl: string;
  showAuth: boolean;
  needsHistoryReplace: boolean;
  isInvalidPrefix: boolean;
} {
  if (typeof window === 'undefined') {
    return {
      activeTab: 'dashboard',
      referralCode: null,
      targetUrl: '/dashboard',
      showAuth: false,
      needsHistoryReplace: false,
      isInvalidPrefix: false,
    };
  }

  const rawPathname = window.location.pathname.toLowerCase();
  const cleanPath = rawPathname.replace(/^\/+|\/+$/g, '');
  const search = window.location.search;

  // Detect authentication status from localStorage or explicit override
  const isAuthenticated = isAuthenticatedOverride !== undefined
    ? isAuthenticatedOverride
    : Boolean(localStorage.getItem('binance_harvest_active_wallet'));

  // 1. Extract potential referral code from full URL
  const referralCode = extractReferralAddress();

  // 2. Determine if the path matches a valid application tab
  const isValidTab = VALID_TABS.includes(cleanPath as ValidTab);

  // 3. Determine if the path is an explicit auth route (/auth, /login, etc.)
  const isAuthRoute = AUTH_ROUTES.includes(cleanPath as any);

  let activeTab: ValidTab = 'dashboard';
  let targetUrl = '/dashboard';
  let showAuth = !isAuthenticated;
  let isInvalidPrefix = false;
  let needsHistoryReplace = false;

  if (isValidTab) {
    activeTab = cleanPath as ValidTab;
    targetUrl = `/${cleanPath}`;
    showAuth = !isAuthenticated;
    const hasArtifacts = Boolean(referralCode) || search.includes('ref=') || search.includes('r=');
    needsHistoryReplace = hasArtifacts;
  } else if (isAuthRoute) {
    if (isAuthenticated) {
      // Authenticated users navigating to /auth are automatically forwarded to /dashboard
      activeTab = 'dashboard';
      targetUrl = '/dashboard';
      showAuth = false;
      needsHistoryReplace = true;
    } else {
      activeTab = 'dashboard';
      targetUrl = '/auth';
      showAuth = true;
      needsHistoryReplace = cleanPath !== 'auth';
    }
  } else {
    // Wrong prefix or malformed URL (e.g. /walleting, /tiers123, /mining, /random, or empty root /)
    isInvalidPrefix = cleanPath !== '';
    if (isAuthenticated) {
      // Automatically redirect wrong prefixes to dashboard if authenticated
      activeTab = 'dashboard';
      targetUrl = '/dashboard';
      showAuth = false;
      needsHistoryReplace = true;
    } else {
      // Automatically redirect wrong prefixes to authentication page if not authenticated
      activeTab = 'dashboard';
      targetUrl = '/auth';
      showAuth = true;
      needsHistoryReplace = true;
    }
  }

  // Always require auth display if a referral code was clicked
  if (referralCode) {
    showAuth = true;
  }

  return {
    activeTab,
    referralCode,
    targetUrl,
    showAuth,
    needsHistoryReplace,
    isInvalidPrefix,
  };
}
