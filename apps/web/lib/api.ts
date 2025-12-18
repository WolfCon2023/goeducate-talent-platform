export type ApiError = {
  error?: { code?: string; message?: string; details?: unknown };
};

function getApiBaseUrl() {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error("Missing NEXT_PUBLIC_API_URL");
  return url.replace(/\/+$/, "");
}

export async function apiFetch<T>(path: string, init?: RequestInit & { token?: string }): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");
  if (init?.token) headers.set("authorization", `Bearer ${init.token}`);

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    cache: "no-store"
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    const msg = body.error?.message ?? `Request failed: ${res.status}`;
    throw new Error(msg);
  }
  return (await res.json()) as T;
}



