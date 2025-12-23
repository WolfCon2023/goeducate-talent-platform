export const ACCESS_TOKEN_STORAGE_KEY = "goeducate.accessToken";

function hasWindow() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function setAccessToken(token: string) {
  if (!hasWindow()) return;
  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
}

export function getAccessToken(): string | null {
  if (!hasWindow()) return null;
  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function clearAccessToken() {
  if (!hasWindow()) return;
  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
}

type JwtPayload = {
  sub?: string;
  role?: string;
  exp?: number;
  iat?: number;
  [k: string]: unknown;
};

function base64UrlDecode(input: string) {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const str = b64 + pad;

  // Browser
  if (typeof atob === "function") return atob(str);
  // Node / edge
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return Buffer.from(str, "base64").toString("utf8");
}

export function decodeJwtPayload(token: string | null): JwtPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    return JSON.parse(base64UrlDecode(parts[1])) as JwtPayload;
  } catch {
    return null;
  }
}

export function getTokenRole(token?: string | null): string | undefined {
  return decodeJwtPayload(token ?? getAccessToken())?.role as string | undefined;
}

export function getTokenSub(token?: string | null): string | undefined {
  return decodeJwtPayload(token ?? getAccessToken())?.sub as string | undefined;
}


