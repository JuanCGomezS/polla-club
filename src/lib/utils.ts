const FIFA_FLAGS_BASE = 'https://api.fifa.com/api/v3/picture/flags-sq-2';
const BETPLAY_FLAGS_BASE = 'https://static.prisa.com/aside/resizer/resize/img/sports/football/teams/XXXX.png?width=44&height=44';

/**
 * Retorna todas las URLs disponibles para un escudo de equipo (útil para <picture> tags)
 */
export function getTeamImageUrls(shortCode: string | undefined): string[] {
  if (!shortCode || !shortCode.trim()) {
    return [];
  }

  const cleanCode = shortCode.trim().toUpperCase();
  const baseUrl = getBasePath() || '/';
  
  return [
    `${FIFA_FLAGS_BASE}/${encodeURIComponent(cleanCode)}`,
    BETPLAY_FLAGS_BASE.replace('XXXX', cleanCode),
    `${baseUrl}team-font.jpg`.replace(/\/+/g, '/')
  ];
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
