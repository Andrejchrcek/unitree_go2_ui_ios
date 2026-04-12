/**
 * Platform detection and URL helpers for Capacitor (iOS) vs web (dev).
 *
 * On web/dev the Vite proxy forwards:
 *   /robot-api/* → robot HTTP server (via X-Robot-Host header)
 *   /unitree-api/* → global-robot-api.unitree.com (CORS bypass)
 *
 * On Capacitor (iOS) there is no Vite dev server, so we call targets directly.
 * CapacitorHttp (enabled in capacitor.config.ts) intercepts all fetch() calls
 * and routes them through native iOS networking — no CORS restrictions.
 */

declare global {
  interface Window {
    Capacitor?: { isNativePlatform(): boolean };
  }
}

export const isCapacitor: boolean =
  typeof window !== 'undefined' &&
  typeof window.Capacitor !== 'undefined' &&
  window.Capacitor.isNativePlatform();

const UNITREE_CLOUD = 'https://global-robot-api.unitree.com';

/** Returns the URL for a Unitree cloud API call. */
export function unitreeApiUrl(path: string): string {
  return isCapacitor ? `${UNITREE_CLOUD}${path}` : `/unitree-api${path}`;
}

/** Returns the URL for a local robot HTTP API call. */
export function robotApiUrl(path: string): string {
  return isCapacitor ? path : `/robot-api${path}`;
}

/**
 * Returns headers for a local robot HTTP request.
 * On web, adds X-Robot-Host so the Vite proxy knows where to forward.
 * On Capacitor, calls the robot directly so no proxy header is needed.
 */
export function robotApiHeaders(
  host: string,
  contentType?: string,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!isCapacitor) headers['X-Robot-Host'] = host;
  if (contentType) headers['Content-Type'] = contentType;
  return headers;
}

/** Returns the full URL for a local robot HTTP request (Capacitor: direct, web: via proxy). */
export function robotUrl(host: string, path: string): string {
  return isCapacitor ? `http://${host}${path}` : `/robot-api${path}`;
}

/**
 * Returns the URL for the custom audio server running on the robot at port 8888.
 * On Capacitor: direct http://<host>:8888<path>
 * On web/dev:   /robot-api<path> with X-Robot-Host: <host>:8888 (proxied by Vite plugin)
 */
export function audioServerUrl(host: string, path: string): string {
  return isCapacitor ? `http://${host}:8888${path}` : `/robot-api${path}`;
}

/** Returns headers for audio server requests (includes X-Robot-Host with port 8888 on web). */
export function audioServerHeaders(
  host: string,
  contentType?: string,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!isCapacitor) headers['X-Robot-Host'] = `${host}:8888`;
  if (contentType) headers['Content-Type'] = contentType;
  return headers;
}
