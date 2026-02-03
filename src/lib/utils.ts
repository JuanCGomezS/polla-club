const FIFA_FLAGS_BASE = 'https://api.fifa.com/api/v3/picture/flags-sq-2';

/**
 * URL de bandera FIFA usando el código corto del equipo (team1Short/team2Short, ej. MEX, USA, COL).
 * Si no hay código, devuelve el fallback (ej. imagen genérica).
 */
export function getTeamImageUrl(shortCode: string | undefined, fallback: string): string {
  if (shortCode && shortCode.trim()) {
    return `${FIFA_FLAGS_BASE}/${encodeURIComponent(shortCode.trim().toUpperCase())}`;
  }
  return fallback;
}

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
