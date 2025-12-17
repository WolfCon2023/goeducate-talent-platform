export const ACCESS_TOKEN_STORAGE_KEY = "goeducate_access_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function setAccessToken(token: string) {
  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
}

export function clearAccessToken() {
  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
}


