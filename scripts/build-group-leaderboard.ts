/**
 * Builds the cheap leaderboard aggregate used by the client.
 *
 * Usage:
 *   npx tsx scripts/build-group-leaderboard.ts <groupId>
 *   npx tsx scripts/build-group-leaderboard.ts --competition <competitionId>
 */

import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID;

if (!projectId) {
  console.error('❌ PUBLIC_FIREBASE_PROJECT_ID is missing.');
  process.exit(1);
}

function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) return;

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    const serviceAccount = JSON.parse(readFileSync(credPath, 'utf8')) as admin.ServiceAccount;
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId });
    return;
  }

  const serviceAccount = JSON.parse(
    readFileSync(join(__dirname, 'service-account-key.json'), 'utf8')
  ) as admin.ServiceAccount;
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId });
}

type GroupData = {
  id: string;
  adminUid: string;
  participants: string[];
  competitionId: string;
  settings: {
    pointsExactScore: number;
    pointsWinner: number;
    pointsGoalDifference?: number;
  };
};

type PredictionData = {
  id: string;
  userId: string;
  matchId: string;
  team1Score: number;
  team2Score: number;
  points?: number;
};

type MatchData = {
  id: string;
  status: string;
  result?: {
    team1Score: number;
    team2Score: number;
  };
};

function calculatePredictionPoints(
  prediction: PredictionData,
  matchResult: { team1Score: number; team2Score: number },
  settings: GroupData['settings']
) {
  let points = 0;
  const predDiff = prediction.team1Score - prediction.team2Score;
  const resultDiff = matchResult.team1Score - matchResult.team2Score;
  const predWinner = predDiff > 0 ? 1 : predDiff < 0 ? 2 : 0;
  const resultWinner = resultDiff > 0 ? 1 : resultDiff < 0 ? 2 : 0;

  if (
    prediction.team1Score === matchResult.team1Score &&
    prediction.team2Score === matchResult.team2Score
  ) {
    points += settings.pointsExactScore;
    if (settings.pointsWinner > 0 && resultWinner !== 0) points += settings.pointsWinner;
    if (settings.pointsGoalDifference) points += settings.pointsGoalDifference;
    return points;
  }

  if (predWinner === resultWinner && resultWinner !== 0) points += settings.pointsWinner;
  if (settings.pointsGoalDifference && predDiff === resultDiff) points += settings.pointsGoalDifference;
  return points;
}

async function buildGroupLeaderboard(groupId: string) {
  const db = admin.firestore();
  const groupSnap = await db.collection('groups').doc(groupId).get();
  if (!groupSnap.exists) throw new Error(`Group not found: ${groupId}`);

  const group = { id: groupSnap.id, ...groupSnap.data() } as GroupData;
  const userIds = [...new Set([...(group.participants ?? []), group.adminUid].filter(Boolean))];

  const [matchesSnap, predictionsSnap, bonusSnap, usersSnap] = await Promise.all([
    db
      .collection('competitions')
      .doc(group.competitionId)
      .collection('matches')
      .where('status', '==', 'finished')
      .get(),
    db.collection('groups').doc(groupId).collection('predictions').get(),
    db.collection('groups').doc(groupId).collection('bonusPredictions').get(),
    Promise.all(userIds.map((userId) => db.collection('users').doc(userId).get()))
  ]);

  const matches = new Map<string, MatchData>();
  matchesSnap.forEach((doc) => matches.set(doc.id, { id: doc.id, ...doc.data() } as MatchData));

  const totals = new Map<string, { matchPoints: number; bonusPoints: number; predictionsCount: number }>();
  userIds.forEach((userId) => totals.set(userId, { matchPoints: 0, bonusPoints: 0, predictionsCount: 0 }));

  predictionsSnap.forEach((doc) => {
    const prediction = { id: doc.id, ...doc.data() } as PredictionData;
    const match = matches.get(prediction.matchId);
    if (!match?.result) return;
    const total = totals.get(prediction.userId) ?? { matchPoints: 0, bonusPoints: 0, predictionsCount: 0 };
    total.matchPoints += calculatePredictionPoints(prediction, match.result, group.settings);
    total.predictionsCount += 1;
    totals.set(prediction.userId, total);
  });

  bonusSnap.forEach((doc) => {
    const bonus = doc.data() as { userId?: string; points?: number };
    if (!bonus.userId) return;
    const total = totals.get(bonus.userId) ?? { matchPoints: 0, bonusPoints: 0, predictionsCount: 0 };
    total.bonusPoints += bonus.points ?? 0;
    totals.set(bonus.userId, total);
  });

  const users = new Map<string, FirebaseFirestore.DocumentData>();
  usersSnap.forEach((snap) => {
    if (snap.exists) users.set(snap.id, snap.data() ?? {});
  });

  const entries = userIds.map((userId) => {
    const user = users.get(userId);
    const total = totals.get(userId) ?? { matchPoints: 0, bonusPoints: 0, predictionsCount: 0 };
    return {
      userId,
      userName: user?.displayName ?? `Usuario ${userId.substring(0, 8)}...`,
      avatarUrl: user?.avatarUrl ?? null,
      totalPoints: total.matchPoints + total.bonusPoints,
      predictionsCount: total.predictionsCount,
      rank: 0
    };
  });

  entries.sort((a, b) =>
    b.totalPoints !== a.totalPoints ? b.totalPoints - a.totalPoints : a.userName.localeCompare(b.userName)
  );
  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  await db.collection('groups').doc(groupId).collection('leaderboard').doc('main').set({
    entries,
    participantsCount: userIds.length,
    finishedMatchesCount: matches.size,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log(`✅ Leaderboard aggregate written for ${groupId}: ${entries.length} entries.`);
}

async function main() {
  initializeFirebaseAdmin();

  const [, , firstArg, secondArg] = process.argv;
  if (!firstArg) {
    console.error('Usage: npx tsx scripts/build-group-leaderboard.ts <groupId>');
    console.error('   or: npx tsx scripts/build-group-leaderboard.ts --competition <competitionId>');
    process.exit(1);
  }

  if (firstArg === '--competition') {
    if (!secondArg) throw new Error('Competition id is required.');
    const db = admin.firestore();
    const groupsSnap = await db.collection('groups').where('competitionId', '==', secondArg).get();
    for (const groupDoc of groupsSnap.docs) {
      await buildGroupLeaderboard(groupDoc.id);
    }
    return;
  }

  await buildGroupLeaderboard(firstArg);
}

main().catch((error) => {
  console.error('❌ Failed to build leaderboard aggregate:', error);
  process.exit(1);
});
