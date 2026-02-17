declare function gtag(...args: unknown[]): void;

export function trackEvent(name: string, params?: Record<string, unknown>): void {
  try {
    if (typeof gtag === 'function') gtag('event', name, params);
  } catch {
    // gtag unavailable (ad blocker, dev env without network) — silently ignore
  }
}
