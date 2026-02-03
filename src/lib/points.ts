import type { Prediction, Group, Match } from './types';

/**
 * Calcula los puntos de un pronóstico basado en el resultado real del partido
 * y la configuración del grupo
 */
export function calculatePredictionPoints(
  prediction: Prediction,
  matchResult: { team1Score: number; team2Score: number },
  groupSettings: Group['settings']
): { points: number; breakdown: Prediction['pointsBreakdown'] } {
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
  if (prediction.team1Score === matchResult.team1Score &&
      prediction.team2Score === matchResult.team2Score) {
    points += groupSettings.pointsExactScore;
    breakdown.exactScore = groupSettings.pointsExactScore;
    
    // Si hay puntos por ganador, también se suman
    if (groupSettings.pointsWinner > 0 && resultWinner !== 0) {
      points += groupSettings.pointsWinner;
      breakdown.winner = groupSettings.pointsWinner;
    }
    
    // Si hay puntos por diferencia, también se suman
    if (groupSettings.pointsGoalDifference && Math.abs(resultDiff) > 0) {
      points += groupSettings.pointsGoalDifference;
      breakdown.goalDifference = groupSettings.pointsGoalDifference;
    }
  } else {
    // Solo ganador
    if (predWinner === resultWinner && resultWinner !== 0) {
      points += groupSettings.pointsWinner;
      breakdown.winner = groupSettings.pointsWinner;
    }
    
    // Solo diferencia de goles (si aplica y no es empate)
    if (groupSettings.pointsGoalDifference && 
        predDiff === resultDiff && resultDiff !== 0) {
      points += groupSettings.pointsGoalDifference;
      breakdown.goalDifference = groupSettings.pointsGoalDifference;
    }
  }

  return { points, breakdown };
}

/**
 * Calcula los puntos totales de un usuario en un grupo
 * Suma todos los puntos de sus pronósticos
 */
export function calculateUserTotalPoints(
  predictions: Prediction[]
): number {
  return predictions.reduce((total, pred) => {
    return total + (pred.points || 0);
  }, 0);
}

/**
 * Interfaz para la tabla de posiciones por partido
 */
export interface MatchLeaderboardEntry {
  userId: string;
  userName: string;
  prediction: Prediction;
  points: number;
  rank: number;
}

/**
 * Interfaz para la tabla general de posiciones
 */
export interface GroupLeaderboardEntry {
  userId: string;
  userName: string;
  totalPoints: number;
  predictionsCount: number;
  rank: number;
}
