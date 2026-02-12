import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID;

if (!projectId) {
  console.error('❌ Error: PUBLIC_FIREBASE_PROJECT_ID is missing. Please check your .env file.');
  process.exit(1);
}

let serviceAccount: admin.ServiceAccount | null = null;
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (serviceAccountPath) {
  try {
    const fileContent = readFileSync(serviceAccountPath, 'utf8');
    serviceAccount = JSON.parse(fileContent) as admin.ServiceAccount;
    console.log('✅ Usando credenciales desde GOOGLE_APPLICATION_CREDENTIALS');
  } catch {
    console.warn('⚠️  No se pudo cargar credenciales desde GOOGLE_APPLICATION_CREDENTIALS');
  }
}

if (!serviceAccount) {
  try {
    const keyPath = join(__dirname, 'service-account-key.json');
    const fileContent = readFileSync(keyPath, 'utf8');
    serviceAccount = JSON.parse(fileContent) as admin.ServiceAccount;
    console.log('✅ Usando credenciales desde scripts/service-account-key.json');
  } catch {
    console.error('❌ No se encontraron credenciales de servicio.');
    process.exit(1);
  }
}

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount!),
    projectId,
  });
}

const db = admin.firestore();

/**
 * Convierte un valor de Firestore a algo serializable en JSON.
 * Timestamps -> ISO string; demás valores se mantienen.
 */
function toJsonValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = toJsonValue(v);
    }
    return out;
  }
  if (Array.isArray(value)) {
    return value.map(toJsonValue);
  }
  return value;
}

async function exportCompetitionToJson(competitionId: string) {
  console.log(`\n📥 Exportando competición "${competitionId}" desde Firebase...\n`);

  const compRef = db.collection('competitions').doc(competitionId);

  // 1. Documento de la competición
  const compSnap = await compRef.get();
  if (!compSnap.exists) {
    console.error(`❌ No existe la competición "${competitionId}"`);
    process.exit(1);
  }

  const competition = toJsonValue({ id: competitionId, ...compSnap.data() }) as Record<string, unknown>;
  console.log(`  ✓ Competición: ${(competition.name as string) ?? competitionId}`);

  // 2. Equipos
  const teamsSnap = await compRef.collection('teams').get();
  const teams = teamsSnap.docs.map((d) => toJsonValue({ id: d.id, ...d.data() }));
  console.log(`  ✓ Equipos: ${teams.length}`);

  // 3. Jugadores
  const playersSnap = await compRef.collection('players').get();
  const players = playersSnap.docs.map((d) => toJsonValue({ id: d.id, ...d.data() }));
  console.log(`  ✓ Jugadores: ${players.length}`);

  // 4. Partidos
  const matchesSnap = await compRef.collection('matches').get();
  const matches = matchesSnap.docs.map((d) => toJsonValue({ id: d.id, ...d.data() }));
  console.log(`  ✓ Partidos: ${matches.length}`);

  // 5. Resultados (si existe)
  let results: unknown = null;
  const resultsSnap = await compRef.collection('results').doc('main').get();
  if (resultsSnap.exists) {
    results = toJsonValue(resultsSnap.data());
    console.log(`  ✓ Resultados: main`);
  }

  const output = {
    competitionId,
    exportedAt: new Date().toISOString(),
    competition,
    teams,
    players,
    matches,
    ...(results !== null && { results }),
  };

  const outDir = join(__dirname, '..', 'data');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${competitionId}.json`);
  writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');

  console.log(`\n✅ Exportado en: ${outPath}\n`);
  return outPath;
}

const competitionId = process.argv[2] ?? 'mundial-2026';

exportCompetitionToJson(competitionId)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
