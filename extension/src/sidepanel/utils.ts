// Shared pure helpers used across hooks and App. These are 1:1 ports of
// the same-named helpers from the legacy main.js.

const CHROME_API: typeof chrome | undefined = (globalThis as unknown as { chrome?: typeof chrome }).chrome;

export function getChromeApi(): typeof chrome | undefined {
  return CHROME_API;
}

/** Whether this code is running as a real MV3 extension (vs. plain web demo). */
export function hasChromeApi(): boolean {
  return Boolean(CHROME_API?.runtime?.id);
}

export const DEFAULT_DAEMON_PORT = '47823';
export const HEARTBEAT_MS = 5_000;
export const RUN_POLL_MS = 5_000;
export const FETCH_TIMEOUT_MS = 2_500;
export const TRANSIENT_LABEL_MS = 1_800;

/** Job-board aggregator pages where importing the company apply page is usually better. */
export const AGGREGATOR_PLATFORMS = [
  {
    name: 'LinkedIn',
    matches: (url: URL) =>
      hostnameEndsWith(url.hostname, 'linkedin.com') && url.pathname.includes('/jobs/'),
  },
  {
    name: 'Indeed',
    matches: (url: URL) =>
      hostnameEndsWith(url.hostname, 'indeed.com') &&
      (url.pathname.includes('/viewjob') || url.pathname.includes('/jobs')),
  },
  {
    name: 'Glassdoor',
    matches: (url: URL) =>
      hostnameEndsWith(url.hostname, 'glassdoor.com') &&
      (url.pathname.toLowerCase().includes('/job') || url.searchParams.has('jl')),
  },
];

/** True when a hostname is exactly a suffix or one of its subdomains. */
export function hostnameEndsWith(hostname: string, suffix: string): boolean {
  return hostname === suffix || hostname.endsWith(`.${suffix}`);
}

/** Detects job aggregator URLs where company apply pages are usually better input. */
export function detectAggregatorPlatform(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    return AGGREGATOR_PLATFORMS.find((platform) => platform.matches(url)) ?? null;
  } catch {
    return null;
  }
}

/** Normalizes URLs for current-page-to-job matching without dropping query identity. */
export function normalizeActionUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return rawUrl.replace(/\/$/, '');
  }
}

/** Converts a URL to a Chrome host-permission pattern; null for non-http(s). */
export function hostPermissionPattern(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return `${parsed.protocol}//${parsed.host}/*`;
  } catch {
    return null;
  }
}

export function normalizeStoredPort(value: unknown): string {
  if (typeof value !== 'string' || !value) return DEFAULT_DAEMON_PORT;
  return value;
}

/** Validates a daemon port string (4-5 digits). */
export function isValidPort(value: string): boolean {
  return /^[0-9]{4,5}$/.test(value);
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Reasons for visible-but-unimplemented features. Used by FeatureCard /
// disabled buttons to render tooltips.
export const AUTOFILL_BLOCKED_REASON =
  'Stagehand observe, cache, and replay form filling is not implemented yet.';
export const OUTREACH_BLOCKED_REASON =
  'Outreach draft generation is not implemented yet.';
export const PROCESS_DELETE_BLOCKED_REASON =
  'Clearing processed jobs from the companion UI is not implemented yet.';
export const TAILOR_DELETE_BLOCKED_REASON =
  'Clearing tailored artifacts from the companion UI is not implemented yet.';
export const QUEUE_COMING_SOON_MESSAGE =
  'Application queue is not implemented yet. Coming soon.';
export const INCOMPLETE_TOOLTIP = 'Not implemented yet';
