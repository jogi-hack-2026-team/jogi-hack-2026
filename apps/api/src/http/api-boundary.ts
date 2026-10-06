export type ApiBoundary = 'outside' | 'public' | 'auth' | 'protected';

// Public exceptions belong to registered routes. Business routes use the router's
// canonical pattern, so a differently written URL cannot change their boundary.
export function apiBoundary(routePath: string | undefined, rawURL: string): ApiBoundary {
  if (routePath === '/api/health') return 'public';
  if (routePath === '/api/auth/*') return 'auth';
  if (routePath === '/api' || routePath?.startsWith('/api/')) return 'protected';
  let path: string;
  try {
    path = decodeURIComponent(rawURL.split(/[?#]/)[0] ?? '');
  } catch {
    return 'protected';
  }
  return path === '/api' || path.startsWith('/api/') ? 'protected' : 'outside';
}
