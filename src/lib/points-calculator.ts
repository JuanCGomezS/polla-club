import type { Prediction, Match, Group } from './types';

/**
 * Calcula los puntos de un pronóstico comparándolo con el resultado real
 */
export function calculateMatchPoints(
  prediction: Prediction,
  matchResult: Match['result'],
  settings: Group['settings']
): { points: number; breakdown: Prediction['pointsBreakdown'] } {
  if (!matchResult) {
    return { points: 0, breakdown: { exactScore: 0, winner: 0, goalDifference: 0 } };
  }

  let points = 0;
  const breakdown: Prediction['pointsBreakdown'] = {
    exactScore: 0,
    winner: 0,
    goalDifference: 0
  };

  const predDiff = prediction.team1Score - prediction.team2Score;
  const resultDiff = matchResult.team1Score - matchResult.team2Score;
  const predWinner = predDiff > 0 ? 1 : (predDiff < 0 ? 2 : 0);
  const resultWinner = resultDiff > 0 ? 1 : (resultDiff < 0 ? 2 : 0);

  // Marcador exacto (suma todo lo demás también)
  if (
    prediction.team1Score === matchResult.team1Score &&
    prediction.team2Score === matchResult.team2Score
  ) {
    points += settings.pointsExactScore;
    breakdown.exactScore = settings.pointsExactScore;

    // Si hay puntos por ganador, también se suman
    if (settings.pointsWinner > 0 && resultWinner !== 0) {
      points += settings.pointsWinner;
      breakdown.winner = settings.pointsWinner;
    }

    // Si hay puntos por diferencia, también se suman
    if (settings.pointsGoalDifference && Math.abs(resultDiff) > 0) {
      points += settings.pointsGoalDifference;
      breakdown.goalDifference = settings.pointsGoalDifference;
    }
  } else {
    // Solo ganador
    if (predWinner === resultWinner && resultWinner !== 0) {
      points += settings.pointsWinner;
      breakdown.winner = settings.pointsWinner;
    }

    // Solo diferencia de goles (si aplica y no es empate)
    if (
      settings.pointsGoalDifference &&
      predDiff === resultDiff &&
      resultDiff !== 0
    ) {
      points += settings.pointsGoalDifference;
      breakdown.goalDifference = settings.pointsGoalDifference;
    }
  }

  return { points, breakdown };
}

/**
 * Calcula los puntos totales de un usuario en un grupo
 */
export async function calculateUserTotalPoints(
  groupId: string,
  userId: string,
  getUserPredictions: (groupId: string, userId: string) => Promise<Prediction[]>
): Promise<number> {
  try {
    const predictions = await getUserPredictions(groupId, userId);
    
    // Sumar puntos de pronósticos
    const matchPoints = predictions.reduce((total, pred) => {
      return total + (pred.points || 0);
    }, 0);
    
    // TODO: Agregar puntos de bonus predictions cuando se implemente
    // const bonusPoints = await getBonusPoints(groupId, userId);
    
    return matchPoints;
  } catch (error) {
    console.error('Error calculando puntos totales:', error);
    return 0;
  }
}
