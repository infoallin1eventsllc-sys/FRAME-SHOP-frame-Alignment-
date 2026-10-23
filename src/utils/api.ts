export function getApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (
    typeof window !== 'undefined' &&
    window.location &&
    window.location.origin &&
    window.location.origin !== 'null' &&
    window.location.origin.startsWith('http')
  ) {
    return `${window.location.origin}${cleanPath}`;
  }
  return cleanPath;
}

export async function safeFetch(path: string, options?: RequestInit): Promise<Response> {
  const url = getApiUrl(path);
  const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("shop_admin_token") : null;
  const authHeaders: Record<string, string> = token ? { "x-shop-secret": token } : {};
  const res = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders,
      ...options?.headers,
    },
  });
  // Owner logins expire. Tell the portal so it asks for the PIN again,
  // instead of every button failing with "Unauthorized".
  if (res.status === 401 && token && !path.includes("/api/auth/pin")) {
    try { sessionStorage.removeItem("shop_admin_token"); } catch { /* ignore */ }
    if (typeof window !== "undefined") window.dispatchEvent(new Event("shop-session-expired"));
  }
  return res;
}
