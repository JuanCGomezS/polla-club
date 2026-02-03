import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { db } from './firebase';
import { getCompetition } from './competitions';
import { getCompetitionResults } from './competitions';
import type { BonusPrediction, Competition } from './types';

/**
 * Comprueba si los pronósticos bonus están bloqueados para esta competición.
 */
export async function isBonusLocked(competitionId: string): Promise<boolean> {
  const [competition, results] = await Promise.all([
    getCompetition(competitionId),
    getCompetitionResults(competitionId)
  ]);
  if (results?.isLocked) return true;
  const lockDate = competition?.bonusSettings?.bonusLockDate;
  if (lockDate && lockDate.toMillis) {
    if (lockDate.toMillis() < Date.now()) return true;
  }
  return false;
}

/**
 * Indica si la competición tiene al menos un bonus habilitado.
 */
export function hasAnyBonus(competition: Competition): boolean {
  const b = competition?.bonusSettings;
  return !!(b?.hasWinner || b?.hasRunnerUp || b?.hasThirdPlace || b?.hasTopScorer || b?.hasTopAssister);
}

/**
 * Obtiene el pronóstico bonus del usuario en el grupo (documento por userId).
 */
export async function getBonusPrediction(
  groupId: string,
  userId: string
): Promise<BonusPrediction | null> {
  const bonusRef = collection(db, 'groups', groupId, 'bonusPredictions');
  const q = query(bonusRef, where('userId', '==', userId));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as BonusPrediction;
}

export interface BonusPredictionInput {
  winner?: string;
  runnerUp?: string;
  thirdPlace?: string;
  topScorer?: string;
  topAssister?: string;
}

/**
 * Guarda o actualiza el pronóstico bonus del usuario.
 * Un solo documento por usuario en bonusPredictions (id = userId o doc único por userId).
 */
export async function saveBonusPrediction(
  groupId: string,
  userId: string,
  data: BonusPredictionInput
): Promise<BonusPrediction> {
  const existing = await getBonusPrediction(groupId, userId);

  if (existing) {
    const ref = doc(db, 'groups', groupId, 'bonusPredictions', existing.id);
    await updateDoc(ref, {
      userId,
      ...data,
      updatedAt: serverTimestamp()
    });
    return { ...existing, ...data } as BonusPrediction;
  }

  const bonusRef = doc(collection(db, 'groups', groupId, 'bonusPredictions'));
  await setDoc(bonusRef, {
    userId,
    ...data,
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  const saved = await getDoc(bonusRef);
  return { id: saved.id, ...saved.data() } as BonusPrediction;
}
