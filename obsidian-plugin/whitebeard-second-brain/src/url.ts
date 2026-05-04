/** Alinha com `joinWebUiBaseUrl` do backend (vault-web-path). */
export function joinWebUiBaseUrl(baseUrl: string, webPath: string): string {
  const base = baseUrl.trim().replace(/\/+$/, "");
  const path = webPath.startsWith("/") ? webPath : `/${webPath}`;
  return `${base}${path}`;
}
