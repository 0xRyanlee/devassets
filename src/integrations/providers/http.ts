// Shared by vercel/neon/npm/supabase: they all do a bearer-auth GET with the same timeout,
// ok-check, and unreachable/error mapping — this used to be re-implemented identically in each.
export async function fetchAuthedJson<T>(
  providerLabel: string,
  url: string,
  token: string,
  timeoutMs = 5000,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      return { ok: false, error: `${providerLabel} API ${res.status} — token invalid or expired` };
    }
    return { ok: true, data: await res.json() as T };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : `${providerLabel} unreachable` };
  }
}

// A secondary/optional lookup (teams, projects) whose own failure shouldn't fail the primary
// resolution — vercel's teams list and neon's projects list both follow this shape.
export async function fetchAuthedJsonOptional<T>(
  url: string,
  token: string,
  timeoutMs = 5000,
): Promise<T | undefined> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return undefined;
    return await res.json() as T;
  } catch {
    return undefined;
  }
}
