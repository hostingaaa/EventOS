/**
 * Turns an in-app path ("/transfer-list?code=J303") into a link that works under the site's base path.
 * On GitHub Pages the app lives under /EventOS/, so a bare root-relative path would leave the app entirely.
 * Absolute URLs and paths already under the base are returned unchanged.
 */
export function appHref(path: string, base: string = import.meta.env.BASE_URL ?? '/'): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  const prefix = base.replace(/\/$/, '');
  if (!prefix || path === prefix || path.startsWith(`${prefix}/`)) return path;
  return prefix + path;
}
