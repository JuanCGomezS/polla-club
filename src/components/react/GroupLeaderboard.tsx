import { useEffect, useState, useMemo } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { batchGetUsers, getCurrentUser } from '../../lib/auth';
import { calculateUserTotalPoints, calculatePredictionPoints } from '../../lib/points';
import PointsHistoryModal from './PointsHistoryModal';
import type { Group, Match, Prediction, User as UserType } from '../../lib/types';
import type { GroupLeaderboardEntry } from '../../lib/points';
import type { BonusPrediction } from '../../lib/types';

interface LeaderboardAggregateEntry extends GroupLeaderboardEntry {
  avatarUrl?: string;
}

interface LeaderboardAggregate {
  entries?: LeaderboardAggregateEntry[];
}

function getInitial(nameOrEmail: string): string {
  const s = (nameOrEmail || 'U').trim();
  return s[0].toUpperCase();
}

interface GroupLeaderboardProps {
  groupId: string;
  group: Group;
}

interface FinishedMatchesData {
  ids: Set<string>;
  map: Map<string, Match>;
}

export default function GroupLeaderboard({ groupId, group }: GroupLeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<GroupLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [finishedMatches, setFinishedMatches] = useState<FinishedMatchesData>({ ids: new Set(), map: new Map() });
  const [usersMap, setUsersMap] = useState<Map<string, UserType>>(new Map());
  const [avatarsByUser, setAvatarsByUser] = useState<Map<string, string>>(new Map());
  const [selectedEntry, setSelectedEntry] = useState<GroupLeaderboardEntry | null>(null);
  const [loadingHistoryUserId, setLoadingHistoryUserId] = useState<string | null>(null);
  const [predictionsByUser, setPredictionsByUser] = useState<Map<string, Prediction[]>>(new Map());
  const [bonusByUser, setBonusByUser] = useState<Map<string, BonusPrediction>>(new Map());

  const allUserIds = useMemo(
    () => [...new Set([...group.participants, group.adminUid])],
    [group.participants, group.adminUid]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadLeaderboard() {
      setLoading(true);
      setError('');

      try {
        const aggregateSnapshot = await getDoc(doc(db, 'groups', groupId, 'leaderboard', 'main'));
        if (aggregateSnapshot.exists()) {
          const aggregate = aggregateSnapshot.data() as LeaderboardAggregate;
          if (Array.isArray(aggregate.entries) && aggregate.entries.length > 0) {
            console.info('[GroupLeaderboard] Using aggregate leaderboard', {
              groupId,
              entries: aggregate.entries.length
            });

            const entries = aggregate.entries
              .map((entry, index) => ({
                userId: entry.userId,
                userName: entry.userName,
                totalPoints: Number(entry.totalPoints ?? 0),
                predictionsCount: Number(entry.predictionsCount ?? 0),
                rank: Number(entry.rank ?? index + 1)
              }))
              .sort((a, b) =>
                b.totalPoints !== a.totalPoints
                  ? b.totalPoints - a.totalPoints
                  : a.userName.localeCompare(b.userName)
              );
            entries.forEach((entry, index) => {
              entry.rank = index + 1;
            });

            const nextAvatars = new Map<string, string>();
            aggregate.entries.forEach((entry) => {
              if (entry.avatarUrl) nextAvatars.set(entry.userId, entry.avatarUrl);
            });

            setUsersMap(new Map());
            setAvatarsByUser(nextAvatars);
            setFinishedMatches({ ids: new Set(), map: new Map() });
            setPredictionsByUser(new Map());
            setBonusByUser(new Map());
            setLeaderboard(entries);
            return;
          }
        }

        console.warn('[GroupLeaderboard] Falling back to full collection scan', { groupId });

        const usersPromise = batchGetUsers(allUserIds);
        const matchesPromise = getDocs(
          query(
            collection(db, 'competitions', group.competitionId, 'matches'),
            where('status', '==', 'finished')
          )
        );
        const predictionsPromise = getDocs(collection(db, 'groups', groupId, 'predictions'));
        const bonusPromise = getDocs(collection(db, 'groups', groupId, 'bonusPredictions'));

        const [resolvedUsersMap, matchesSnapshot, predictionsSnapshot, bonusSnapshot] = await Promise.all([
          usersPromise,
          matchesPromise,
          predictionsPromise,
          bonusPromise
        ]);

        if (cancelled) return;

        const finishedMap = new Map<string, Match>();
        matchesSnapshot.forEach((doc) => {
          const match = { id: doc.id, ...doc.data() } as Match;
          finishedMap.set(match.id, match);
        });

        const finishedIds = new Set(finishedMap.keys());
        const nextPredictionsByUser = new Map<string, Prediction[]>();
        predictionsSnapshot.forEach((doc) => {
          const prediction = { id: doc.id, ...doc.data() } as Prediction;
          if (!finishedIds.has(prediction.matchId)) return;

          const match = finishedMap.get(prediction.matchId);
          if (match?.result) {
            const calculated = calculatePredictionPoints(prediction, match.result, group.settings);
            prediction.points = calculated.points;
            prediction.pointsBreakdown = calculated.breakdown;
          }

          const userId = prediction.userId;
          if (!nextPredictionsByUser.has(userId)) nextPredictionsByUser.set(userId, []);
          nextPredictionsByUser.get(userId)!.push(prediction);
        });

        const nextBonusByUser = new Map<string, BonusPrediction>();
        bonusSnapshot.forEach((doc) => {
          const bonus = { id: doc.id, ...doc.data() } as BonusPrediction;
          if (bonus.userId != null) {
            nextBonusByUser.set(bonus.userId, bonus);
          }
        });

        const entries: GroupLeaderboardEntry[] = allUserIds.map((userId) => {
          const user = resolvedUsersMap.get(userId);
          const userName = user?.displayName ?? `Usuario ${userId.substring(0, 8)}...`;
          const userPredictions = nextPredictionsByUser.get(userId) ?? [];
          const matchPoints = calculateUserTotalPoints(userPredictions);
          const bonusPoints = nextBonusByUser.get(userId)?.points ?? 0;

          return {
            userId,
            userName,
            totalPoints: matchPoints + bonusPoints,
            predictionsCount: 0,
            rank: 0
          };
        });

        entries.sort((a, b) =>
          b.totalPoints !== a.totalPoints
            ? b.totalPoints - a.totalPoints
            : a.userName.localeCompare(b.userName)
        );
        entries.forEach((entry, index) => {
          entry.rank = index + 1;
        });

        setUsersMap(resolvedUsersMap);
        setAvatarsByUser(new Map());
        setFinishedMatches({ ids: finishedIds, map: finishedMap });
        setPredictionsByUser(nextPredictionsByUser);
        setBonusByUser(nextBonusByUser);
        setLeaderboard(entries);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error al cargar tabla general');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadLeaderboard();

    return () => {
      cancelled = true;
    };
  }, [groupId, group.competitionId, allUserIds.join(','), group.settings]);

  async function openPointsHistory(entry: GroupLeaderboardEntry) {
    if (predictionsByUser.has(entry.userId) || bonusByUser.has(entry.userId)) {
      setSelectedEntry(entry);
      return;
    }

    setLoadingHistoryUserId(entry.userId);
    try {
      const [matchesSnapshot, predictionsSnapshot, bonusSnapshot] = await Promise.all([
        getDocs(
          query(
            collection(db, 'competitions', group.competitionId, 'matches'),
            where('status', '==', 'finished')
          )
        ),
        getDocs(
          query(
            collection(db, 'groups', groupId, 'predictions'),
            where('userId', '==', entry.userId)
          )
        ),
        getDocs(
          query(
            collection(db, 'groups', groupId, 'bonusPredictions'),
            where('userId', '==', entry.userId)
          )
        )
      ]);

      const finishedMap = new Map<string, Match>();
      matchesSnapshot.forEach((doc) => {
        const match = { id: doc.id, ...doc.data() } as Match;
        finishedMap.set(match.id, match);
      });

      const predictions: Prediction[] = [];
      predictionsSnapshot.forEach((doc) => {
        const prediction = { id: doc.id, ...doc.data() } as Prediction;
        const match = finishedMap.get(prediction.matchId);
        if (!match?.result) return;
        const calculated = calculatePredictionPoints(prediction, match.result, group.settings);
        prediction.points = calculated.points;
        prediction.pointsBreakdown = calculated.breakdown;
        predictions.push(prediction);
      });

      let bonus: BonusPrediction | undefined;
      bonusSnapshot.forEach((doc) => {
        bonus = { id: doc.id, ...doc.data() } as BonusPrediction;
      });

      const actualTotal =
        predictions.reduce((sum, prediction) => sum + (prediction.points ?? 0), 0) +
        (bonus?.points ?? 0);

      if (actualTotal !== entry.totalPoints) {
        console.warn('[GroupLeaderboard] Aggregate total is stale; updating row locally', {
          groupId,
          userId: entry.userId,
          aggregateTotal: entry.totalPoints,
          actualTotal
        });

        setLeaderboard((prev) => {
          const next = prev.map((item) =>
            item.userId === entry.userId ? { ...item, totalPoints: actualTotal } : item
          );
          next.sort((a, b) =>
            b.totalPoints !== a.totalPoints
              ? b.totalPoints - a.totalPoints
              : a.userName.localeCompare(b.userName)
          );
          next.forEach((item, index) => {
            item.rank = index + 1;
          });
          return next;
        });
      }

      setFinishedMatches({ ids: new Set(finishedMap.keys()), map: finishedMap });
      setPredictionsByUser((prev) => new Map(prev).set(entry.userId, predictions));
      setBonusByUser((prev) => {
        const next = new Map(prev);
        if (bonus) next.set(entry.userId, bonus);
        return next;
      });
      setSelectedEntry(entry);
    } catch (err) {
      console.error('[GroupLeaderboard] Error loading points history:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar historial de puntos');
    } finally {
      setLoadingHistoryUserId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color:var(--pc-accent)] mx-auto" />
          <p className="mt-4 text-[color:var(--pc-muted)]">Cargando tabla de posiciones...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-xl border border-red-500/60 bg-red-900/40 text-red-100">
        <p>{error}</p>
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="text-center py-12 rounded-xl border border-dashed border-[color:var(--pc-main-dark)]/60 bg-[color:var(--pc-surface)]/60">
        <p className="text-[color:var(--pc-muted)]">No hay participantes en este grupo.</p>
      </div>
    );
  }

  const currentUserId = getCurrentUser()?.uid;

  return (
    <div className="overflow-x-auto rounded-xl border border-[color:var(--pc-main-dark)]/60 bg-[color:var(--pc-surface)]/80 shadow-sm">
      <table className="min-w-full divide-y divide-[color:var(--pc-main-dark)]/60">
        <thead className="bg-[color:var(--pc-main-dark)]/60">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[color:var(--pc-muted)] uppercase tracking-wider">
              #
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[color:var(--pc-muted)] uppercase tracking-wider">
              Participante
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-[color:var(--pc-muted)] uppercase tracking-wider">
              Puntos Totales
            </th>
          </tr>
        </thead>
        <tbody className="bg-[color:var(--pc-surface)] divide-y divide-[color:var(--pc-main-dark)]/40">
          {leaderboard.map((entry) => {
            const isCurrentUser = currentUserId === entry.userId;
            
            return (
              <tr
                key={entry.userId}
                className={`${
                  isCurrentUser
                    ? 'bg-[color:var(--pc-main)]/20'
                    : entry.rank === 1
                      ? 'bg-[color:var(--pc-accent)]/10'
                      : entry.rank <= 3
                        ? 'bg-white/5'
                        : ''
                }`}
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-[color:var(--pc-text-on-dark)]">
                  {entry.rank === 1 && '🥇'}
                  {entry.rank === 2 && '🥈'}
                  {entry.rank === 3 && '🥉'}
                  {entry.rank > 3 && entry.rank}
                </td>
                <td className={`px-4 py-3 whitespace-nowrap text-sm ${isCurrentUser ? 'font-bold text-[color:var(--pc-text-on-dark)]' : 'text-[color:var(--pc-text-on-dark)]'}`}>
                  <div className="flex items-center gap-3">
                    <span className="h-9 w-9 shrink-0 flex items-center justify-center rounded-full overflow-hidden bg-[color:var(--pc-main-dark)]/60 text-[color:var(--pc-muted)] font-semibold text-sm">
                      {(() => {
                        const avatarUrl = usersMap.get(entry.userId)?.avatarUrl ?? avatarsByUser.get(entry.userId);
                        if (avatarUrl) {
                          return (
                            <img
                              src={avatarUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          );
                        }
                        return getInitial(entry.userName);
                      })()}
                    </span>
                    <span>{entry.userName}</span>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                  <button
                    type="button"
                    onClick={() => openPointsHistory(entry)}
                    disabled={loadingHistoryUserId === entry.userId}
                    className="inline-flex items-center gap-1.5 text-[color:var(--pc-accent)] hover:text-[color:var(--pc-accent-dark)] focus:outline-none focus:ring-2 focus:ring-[color:var(--pc-accent)] focus:ring-offset-1 rounded disabled:opacity-60"
                    title="Ver historial de puntos"
                  >
                    <span className={`font-bold text-lg ${entry.totalPoints > 0 ? 'text-[color:var(--pc-accent)]' : 'text-[color:var(--pc-muted)]'}`}>
                      {loadingHistoryUserId === entry.userId ? '...' : entry.totalPoints}
                    </span>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {selectedEntry && (
        <PointsHistoryModal
          isOpen={!!selectedEntry}
          onClose={() => setSelectedEntry(null)}
          userName={selectedEntry.userName}
          avatarUrl={usersMap.get(selectedEntry.userId)?.avatarUrl ?? avatarsByUser.get(selectedEntry.userId)}
          predictions={predictionsByUser.get(selectedEntry.userId) ?? []}
          bonus={bonusByUser.get(selectedEntry.userId)}
          matchesMap={finishedMatches.map}
          competitionId={group.competitionId}
        />
      )}
    </div>
  );
}
