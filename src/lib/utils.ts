/**
 * Obtiene el base path configurado en Astro
 */
export function getBasePath(): string {
  const baseUrl = (import.meta as any).env?.BASE_URL;
  if (baseUrl) {
    return baseUrl;
  }
  
  if (typeof document !== 'undefined') {
    const base = document.documentElement.getAttribute('data-base');
    if (base) {
      return base.endsWith('/') ? base : base + '/';
    }
  }
  
  return '/';
}

/**
 * Construye una ruta absoluta con el base path
 */
export function getRoute(path: string): string {
  const base = getBasePath();
  const cleanPath = path.startsWith('/') ? path : '/' + path;
  
  if (base === '/') {
    return cleanPath;
  }
  
  const cleanBase = base.replace(/\/$/, '');
  return cleanBase + cleanPath;
}
