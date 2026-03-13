/**
 * lib/api.ts - API helper functions for fetching data from the backend.
 *
 * Uses SWR-compatible fetcher pattern.
 * In development, requests are proxied to FastAPI via next.config.js rewrites.
 * In production, set NEXT_PUBLIC_API_URL to the backend URL.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Generic fetcher for SWR hooks.
 * Handles errors and returns JSON data.
 */
export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * PATCH request helper (for updating incidents, etc.)
 */
export async function patchData<T>(url: string, data: object): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

