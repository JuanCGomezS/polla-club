import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ quiet: true });

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_GROUP_ID = 'LxlkofzvAVMRS2dplF7Z';
const DEFAULT_MATCH_ID = 'match-031-BRAvsHAI';

const groupId = process.argv[2] ?? DEFAULT_GROUP_ID;
const matchId = process.argv[3] ?? DEFAULT_MATCH_ID;
const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;

if (!projectId) {
  console.error('PUBLIC_FIREBASE_PROJECT_ID or VITE_FIREBASE_PROJECT_ID is missing.');
  process.exit(1);
}

function loadServiceAccount(): admin.ServiceAccount {
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (credentialPath) {
    return JSON.parse(readFileSync(credentialPath, 'utf8')) as admin.ServiceAccount;
  }

  return JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf8')) as admin.ServiceAccount;
}

function toJsonValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate().toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(toJsonValue);
  }

  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      output[key] = toJsonValue(nestedValue);
    }
    return output;
  }

  return value;
}

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(loadServiceAccount()),
    projectId,
  });
}

const db = admin.firestore();

async function main() {
  const snapshot = await db
    .collection('groups')
    .doc(groupId)
    .collection('predictions')
    .where('matchId', '==', matchId)
    .get();

  const predictions = snapshot.docs
    .map((doc) => toJsonValue({ id: doc.id, ...doc.data() }))
    .sort((a, b) => {
      const userA = String((a as { userId?: unknown }).userId ?? '');
      const userB = String((b as { userId?: unknown }).userId ?? '');
      return userA.localeCompare(userB);
    });

  const output = {
    groupId,
    matchId,
    count: predictions.length,
    predictions,
  };

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
