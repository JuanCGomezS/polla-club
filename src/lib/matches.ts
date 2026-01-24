import { collection, doc, getDoc, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { Match, MatchStatus } from './types';

/**
 * Obtiene todos los partidos de una competición
 */
export async function getMatchesByCompetition(competitionId: string): Promise<Match[]> {
  try {
    const matchesRef = collection(db, 'matches');
    const matchesQuery = query(
      matchesRef,
      where('competitionId', '==', competitionId),
      orderBy('scheduledTime', 'asc')
    );

    const snapshot = await getDocs(matchesQuery);
    const result: Match[] = [];

    snapshot.forEach((d) => {
      result.push({ id: d.id, ...d.data() } as Match);
    });

    return result;
  } catch (error: any) {
    // Si falla por falta de índice, intentar sin orderBy
    if (error.code === 'failed-precondition' || error.message?.includes('index')) {
      try {
        const matchesRef = collection(db, 'matches');
        const matchesQuery = query(
          matchesRef,
          where('competitionId', '==', competitionId)
        );

        const snapshot = await getDocs(matchesQuery);
        const result: Match[] = [];

        snapshot.forEach((d) => {
          result.push({ id: d.id, ...d.data() } as Match);
        });

        // Ordenar manualmente
        result.sort((a, b) => {
          const aTime = a.scheduledTime?.toMillis?.() ?? 0;
          const bTime = b.scheduledTime?.toMillis?.() ?? 0;
          return aTime - bTime;
        });

        return result;
      } catch (fallbackError: any) {
        throw new Error(fallbackError.message || 'Error al obtener partidos');
      }
    }
    throw new Error(error.message || 'Error al obtener partidos');
  }
}

/**
 * Obtiene partidos de una competición filtrados por estado
 */
export async function getMatchesByCompetitionAndStatus(
  competitionId: string,
  status: MatchStatus
): Promise<Match[]> {
  try {
    const matchesRef = collection(db, 'matches');
    const matchesQuery = query(
      matchesRef,
      where('competitionId', '==', competitionId),
      where('status', '==', status),
      orderBy('scheduledTime', 'asc')
    );

    const snapshot = await getDocs(matchesQuery);
    const result: Match[] = [];

    snapshot.forEach((d) => {
      result.push({ id: d.id, ...d.data() } as Match);
    });

    return result;
  } catch (error: any) {
    try {
      const matchesRef = collection(db, 'matches');
      const matchesQuery = query(
        matchesRef,
        where('competitionId', '==', competitionId),
        where('status', '==', status)
      );

      const snapshot = await getDocs(matchesQuery);
      const result: Match[] = [];

      snapshot.forEach((d) => {
        result.push({ id: d.id, ...d.data() } as Match);
      });

      result.sort((a, b) => {
        const aTime = a.scheduledTime?.toMillis?.() ?? 0;
        const bTime = b.scheduledTime?.toMillis?.() ?? 0;
        return aTime - bTime;
      });

      return result;
    } catch (fallbackError: any) {
      throw new Error(fallbackError.message || 'Error al obtener partidos');
    }
  }
}

/**
 * Obtiene un partido por ID
 */
export async function getMatch(matchId: string): Promise<Match | null> {
  try {
    const matchRef = doc(db, 'matches', matchId);
    const matchDoc = await getDoc(matchRef);

    if (!matchDoc.exists()) {
      return null;
    }

    return { id: matchDoc.id, ...matchDoc.data() } as Match;
  } catch (error: any) {
    throw new Error(error.message || 'Error al obtener partido');
  }
}

/**
 * Filtra partidos próximos (scheduled y scheduledTime > now)
 */
export function filterUpcomingMatches(matches: Match[]): Match[] {
  const now = Timestamp.now();
  return matches.filter(
    (m) =>
      m.status === 'scheduled' &&
      m.scheduledTime &&
      (m.scheduledTime as Timestamp).toMillis?.() > now.toMillis()
  );
}

/**
 * Filtra partidos en curso (status === 'live')
 */
export function filterLiveMatches(matches: Match[]): Match[] {
  return matches.filter((m) => m.status === 'live');
}

/**
 * Filtra partidos finalizados (status === 'finished')
 */
export function filterFinishedMatches(matches: Match[]): Match[] {
  return matches.filter((m) => m.status === 'finished');
}
