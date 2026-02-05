import { Timestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { calculateMatchMinute, formatMatchMinute } from '../../lib/match-time';
import { getBasePath, getTeamImageUrls } from '../../lib/utils';
import MatchLeaderboardModal from './MatchLeaderboardModal';
import type { Match, Prediction, Group } from '../../lib/types';

interface MatchCardProps {
  match: Match;
  groupId: string;
  group: Group;
  userPrediction?: Prediction;
  onSavePrediction: (matchId: string, team1Score: number, team2Score: number) => Promise<void>;
  isSaving: boolean;
  canEdit: boolean;
}

export default function MatchCard({
  match,
  groupId,
  group,
  userPrediction,
  onSavePrediction,
  isSaving,
  canEdit
}: MatchCardProps) {
  const [team1Score, setTeam1Score] = useState<string>(
    userPrediction?.team1Score.toString() || ''
  );
  const [team2Score, setTeam2Score] = useState<string>(
    userPrediction?.team2Score.toString() || ''
  );
  const [team1ImageIndex, setTeam1ImageIndex] = useState(0);
  const [team2ImageIndex, setTeam2ImageIndex] = useState(0);

  const [isEditing, setIsEditing] = useState(!userPrediction && canEdit);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);

  useEffect(() => {
    if (userPrediction) {
      setTeam1Score(userPrediction.team1Score.toString());
      setTeam2Score(userPrediction.team2Score.toString());
      setIsEditing(false);
    } else if (canEdit) {
      setTeam1Score('');
      setTeam2Score('');
      setIsEditing(true);
    } else {
      setTeam1Score('');
      setTeam2Score('');
      setIsEditing(false);
    }
  }, [userPrediction, canEdit]);

  const getTeamShort = (teamName: string, shortName?: string): string => {
    return shortName || teamName.substring(0, 3).toUpperCase();
  };

  const team1Short = getTeamShort(match.team1, match.team1Short);
  const team2Short = getTeamShort(match.team2, match.team2Short);

  const baseUrl = getBasePath() || '/';
  const placeholderUrl = `${baseUrl}team-font.jpg`.replace(/\/+/g, '/');
  const team1ImageUrls = getTeamImageUrls(match.team1Short);
  const team2ImageUrls = getTeamImageUrls(match.team2Short);

  const formatDate = (timestamp: Timestamp | undefined): string => {
    if (!timestamp?.toDate) return '';
    const date = timestamp.toDate();
    return date.toLocaleDateString('es-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const score1 = parseInt(team1Score, 10);
    const score2 = parseInt(team2Score, 10);

    if (isNaN(score1) || isNaN(score2) || score1 < 0 || score2 < 0) {
      alert('Por favor ingresa marcadores válidos (números enteros >= 0)');
      return;
    }

    await onSavePrediction(match.id, score1, score2);
    setIsEditing(false);
  };

  const getStatusBadge = () => {
    if (match.status === 'live') {
      return (
        <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded font-semibold animate-pulse">
          EN VIVO
        </span>
      );
    }
    if (match.status === 'finished') {
      return (
        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-800 rounded">
          Finalizado
        </span>
      );
    }
    return (
      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
        Por Jugar
      </span>
    );
  };

  const isMatchStarted = match.status === 'live' || match.status === 'finished';
  const result = match.result && match.result !== null ? match.result : undefined;

  const [currentTime, setCurrentTime] = useState(new Date());
  const extraTime1 = match.extraTime1 ?? 0;
  const extraTime2 = match.extraTime2 ?? 0;
  const halftimeDuration = match.halftimeDuration ?? 15;

  const calculatedMinute = match.status === 'live'
    ? calculateMatchMinute(match.scheduledTime, match.startTime, extraTime1, extraTime2, currentTime, halftimeDuration)
    : null;

  useEffect(() => {
    if (match.status === 'live') {
      setCurrentTime(new Date());

      const interval = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [match.status, match.scheduledTime, match.startTime]);

  const displayMinute = match.status === 'live'
    ? calculatedMinute?.minute ?? null
    : null;
  const displayExtraTime = match.status === 'live'
    ? calculatedMinute?.extraTime ?? null
    : null;
  const displayExtraTimeTotal = match.status === 'live'
    ? calculatedMinute?.extraTimeTotal ?? null
    : null;
  const displaySeconds = match.status === 'live'
    ? calculatedMinute?.seconds ?? null
    : null;
  const minuteStatus = calculatedMinute?.status;

  return (
    <div className={`p-3 bg-white border rounded-lg ${match.status === 'live' ? 'border-green-300 shadow-sm' : 'border-gray-200'
      }`}>
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs text-gray-500">{formatDate(match.scheduledTime)}</span>
        {getStatusBadge()}
      </div>

      {match.status === 'live' && displayMinute != null && (
        <div className="text-center mb-3">
          <span className="text-sm font-semibold text-green-700">
            {formatMatchMinute(displayMinute, displayExtraTime, displayExtraTimeTotal, displaySeconds, minuteStatus) || displayMinute}
          </span>
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        <div className="flex flex-col items-center">
          <img
            src={team1ImageUrls[team1ImageIndex] || placeholderUrl}
            alt={match.team1}
            className="w-12 h-12 object-contain mb-1"
            onError={() => {
              if (team1ImageIndex < team1ImageUrls.length - 1) {
                setTeam1ImageIndex(team1ImageIndex + 1);
              } else {
                (document.querySelector(`img[alt="${match.team1}"]`) as HTMLImageElement).src = placeholderUrl;
              }
            }}
          />
          <span className="text-sm font-semibold text-gray-900">
            {match.team1}
          </span>
        </div>

        {isMatchStarted && result ? (
          <div>
            <div className="flex items-center rounded-lg px-3 py-2 ">
              <div className="text-center min-w-[60px]">
                <span className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition">
                  {result.team1Score}
                </span>
                {userPrediction && (
                  <span className="text-sm text-gray-500 ml-1">
                    ({userPrediction.team1Score})
                  </span>
                )}
              </div>
              <span className="text-gray-400 font-medium">vs</span>
              <div className="text-center min-w-[60px]">
                <span className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition">
                  {result.team2Score}
                </span>
                {userPrediction && (
                  <span className="text-sm text-gray-500 ml-1">
                    ({userPrediction.team2Score})
                  </span>
                )}
              </div>
            </div>
            <div className="text-sm text-blue-600 mt-1 text-center cursor-pointer" onClick={() => setIsLeaderboardOpen(true)}
              title="Click para ver tabla de posiciones">
              <h3>Mostrar resultados</h3>
            </div>
          </div>
        ) : canEdit && isEditing ? (
          <>
            <input
              type="number"
              min="0"
              value={team1Score}
              onChange={(e) => setTeam1Score(e.target.value)}
              placeholder="0"
              className="w-14 px-2 py-1.5 text-sm border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={isSaving}
            />
            <span className="text-gray-400 font-medium">vs</span>
            <input
              type="number"
              min="0"
              value={team2Score}
              onChange={(e) => setTeam2Score(e.target.value)}
              placeholder="0"
              className="w-14 px-2 py-1.5 text-sm border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={isSaving}
            />
          </>
        ) : userPrediction ? (
          <>
            <div className="text-center min-w-[60px]">
              <span className="text-lg font-bold text-gray-900">
                {userPrediction.team1Score}
              </span>
            </div>
            <span className="text-gray-400 font-medium">vs</span>
            <div className="text-center min-w-[60px]">
              <span className="text-lg font-bold text-gray-900">
                {userPrediction.team2Score}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="text-center min-w-[60px]">
              <span className="text-sm text-gray-400">-</span>
            </div>
            <span className="text-gray-400 font-medium">vs</span>
            <div className="text-center min-w-[60px]">
              <span className="text-sm text-gray-400">-</span>
            </div>
          </>
        )}

        <div className="flex flex-col items-center">
          <img
            src={team2ImageUrls[team2ImageIndex] || placeholderUrl}
            alt={match.team2}
            className="w-12 h-12 object-contain mb-1"
            onError={() => {
              if (team2ImageIndex < team2ImageUrls.length - 1) {
                setTeam2ImageIndex(team2ImageIndex + 1);
              } else {
                (document.querySelector(`img[alt="${match.team2}"]`) as HTMLImageElement).src = placeholderUrl;
              }
            }}
          />
          <span className="text-sm font-semibold text-gray-900">
            {match.team2}
          </span>
        </div>
      </div>

      {canEdit && isEditing && (
        <form onSubmit={handleSubmit} className="mt-4 pt-3 border-t border-gray-200">
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Guardando...' : userPrediction ? 'Actualizar' : 'Guardar'}
            </button>
            {userPrediction && (
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setTeam1Score(userPrediction.team1Score.toString());
                  setTeam2Score(userPrediction.team2Score.toString());
                }}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                disabled={isSaving}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      {canEdit && !isEditing && userPrediction && !isMatchStarted && (
        <button
          onClick={() => setIsEditing(true)}
          className="w-full mt-3 pt-3 border-t border-gray-200 text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          Editar pronóstico
        </button>
      )}

      {canEdit && !isEditing && !userPrediction && !isMatchStarted && (
        <button
          onClick={() => setIsEditing(true)}
          className="w-full mt-3 pt-3 border-t border-gray-200 text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          Agregar pronóstico
        </button>
      )}

      {(match.status === 'live' || match.status === 'finished') && match.result && (
        <MatchLeaderboardModal
          match={match}
          group={group}
          groupId={groupId}
          isOpen={isLeaderboardOpen}
          onClose={() => setIsLeaderboardOpen(false)}
        />
      )}
    </div>
  );
}
