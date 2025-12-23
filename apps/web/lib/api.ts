export type ApiError = {
  error?: { code?: string; message?: string; details?: unknown };
};

export class ApiFetchError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(opts: { message: string; status: number; code?: string; details?: unknown }) {
    super(opts.message);
    this.name = "ApiFetchError";
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details;
  }
}

function getApiBaseUrl() {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error("Missing NEXT_PUBLIC_API_URL");
  return url.replace(/\/+$/, "");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { token?: string; timeoutMs?: number; retries?: number }
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");
  if (init?.token) headers.set("authorization", `Bearer ${init.token}`);

  const timeoutMs = typeof init?.timeoutMs === "number" ? init.timeoutMs : 15_000;
  const retries = typeof init?.retries === "number" ? Math.max(0, Math.min(2, init.retries)) : 1;

  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers,
        cache: "no-store",
        signal: controller.signal
      });

      if (!res.ok) {
        // Retry on transient upstream errors.
        if ((res.status === 502 || res.status === 503 || res.status === 504) && attempt < retries) {
          await sleep(250 * (attempt + 1));
          continue;
        }

        const body = (await res.json().catch(() => ({}))) as ApiError;
        const baseMsg = body.error?.message ?? `Request failed: ${res.status}`;
        const err = new ApiFetchError({
          message: baseMsg,
          status: res.status,
          code: body.error?.code,
          details: body.error?.details
        });

        // If we get a 401 in browser, encourage re-login.
        if (isBrowser() && res.status === 401) {
          window.dispatchEvent(
            new CustomEvent("goeducate:toast", {
              detail: { kind: "info", title: "Session expired", message: "Please sign in again.", ttlMs: 4500 }
            })
          );
        }

        throw err;
      }

      // 204 No Content
      if (res.status === 204) return undefined as unknown as T;

      // Some endpoints may legitimately return an empty body.
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        const text = await res.text();
        if (!text) return undefined as unknown as T;
        // Best-effort fallback: return raw text.
        return text as unknown as T;
      }

      const text = await res.text();
      if (!text) return undefined as unknown as T;
      return JSON.parse(text) as T;
    } catch (err) {
      lastErr = err;
      // Retry on timeouts / network errors.
      const msg = err instanceof Error ? err.message : "";
      const isAbort = msg.toLowerCase().includes("aborted") || msg.toLowerCase().includes("abort");
      if ((isAbort || err instanceof TypeError) && attempt < retries) {
        await sleep(250 * (attempt + 1));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(t);
    }
  }

  throw lastErr;
}



