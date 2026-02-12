/**
 * Pobla partidos de mundial-2026 desde partidos.txt.
 * Borra los actuales, crea con team1Id/team2Id, scheduledTime y startTime (misma hora).
 * Hora: la que dice el partido (2 p.m. → 2 p.m.); se guarda en UTC con offset +5.
 */

import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID;
if (!projectId) {
  console.error('❌ Error: PUBLIC_FIREBASE_PROJECT_ID is missing.');
  process.exit(1);
}

let serviceAccount: admin.ServiceAccount | null = null;
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (serviceAccountPath) {
  try {
    serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8')) as admin.ServiceAccount;
  } catch {
    //
  }
}
if (!serviceAccount) {
  try {
    const keyPath = join(__dirname, 'service-account-key.json');
    serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8')) as admin.ServiceAccount;
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

const COMPETITION_ID = 'mundial-2026';

const TEAM_NAME_ALIASES: Record<string, string> = {
  'Arabia Saudí': 'Arabia Saudita',
  'República de Corea': 'Corea del Sur',
  'Sarabia Saudí': 'Arabia Saudita',
  'FIFA 1': 'Ganador FIFA 1',
};

interface ParsedMatch {
  day: number;
  month: number;
  team1: string;
  team2: string;
  hour: number;
  minute: number;
}

// Hora local del partido → UTC. +5 para que 2 p.m. se vea como 2 p.m.
function toUTC(year: number, month: number, day: number, hour: number, minute: number): Date {
  const utcHour = hour + 5;
  let utcDay = day;
  if (utcHour >= 24) utcDay += 1;
  if (utcHour < 0) utcDay -= 1;
  const h = ((utcHour % 24) + 24) % 24;
  return new Date(Date.UTC(year, month - 1, utcDay, h, minute, 0, 0));
}

function parseTime(s: string): { hour: number; minute: number } {
  const m = s.match(/(\d{1,2}):(\d{2})\s*(a\.?\s*m\.?|p\.?\s*m\.?)/i);
  if (!m) return { hour: 14, minute: 0 };
  let hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  const isPM = /p\.?\s*m\.?/i.test(m[3]);
  if (isPM && hour !== 12) hour += 12;
  if (!isPM && hour === 12) hour = 0;
  return { hour, minute };
}

function parsePartidosTxt(content: string): ParsedMatch[] {
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  const out: ParsedMatch[] = [];
  let currentDay = 0;
  const currentMonth = 6;

  for (const line of lines) {
    const jun = line.match(/^Junio\s+(\d{1,2})$/i);
    if (jun) {
      currentDay = parseInt(jun[1], 10);
      continue;
    }
    if (line.startsWith('Lean también') || currentDay === 0) continue;

    const vsIndex = line.toLowerCase().indexOf(' vs. ');
    if (vsIndex === -1) continue;

    const team1 = line.slice(0, vsIndex).trim();
    const right = line.slice(vsIndex + 5).trim();
    const parts = right.split('/').map((p) => p.trim());
    const team2 = parts[0] ?? '';
    let hour = 14;
    let minute = 0;
    const timePart = parts.find((p) => /\d{1,2}:\d{2}\s*(a\.|p\.)/i.test(p));
    if (timePart) {
      const t = parseTime(timePart);
      hour = t.hour;
      minute = t.minute;
    }

    out.push({ day: currentDay, month: currentMonth, team1, team2, hour, minute });
  }

  return out;
}

function normalizeTeamName(name: string): string {
  return TEAM_NAME_ALIASES[name.trim()] ?? name.trim();
}

async function seedMundialMatches() {
  const partidosPath = join(__dirname, '..', 'src', 'lib', 'partidos.txt');
  const jsonPath = join(__dirname, '..', 'data', 'mundial-2026.json');

  console.log('\n🌍 Actualizando partidos: competitions/mundial-2026/matches\n');

  const json = JSON.parse(readFileSync(jsonPath, 'utf8')) as {
    teams: Array<{ id: string; shortName: string }>;
  };
  const validTeamIds = new Set(json.teams.map((t) => t.id));
  const teamShortById = new Map(json.teams.map((t) => [t.id, t.shortName]));
  console.log(`  ✓ ${validTeamIds.size} equipos desde data/mundial-2026.json\n`);

  const parsed = parsePartidosTxt(readFileSync(partidosPath, 'utf8'));
  console.log(`  ✓ ${parsed.length} partidos desde partidos.txt\n`);

  const matchesRef = db
    .collection('competitions')
    .doc(COMPETITION_ID)
    .collection('matches');

  const existing = await matchesRef.get();
  const BATCH_SIZE = 500;
  for (let i = 0; i < existing.docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    existing.docs.slice(i, i + BATCH_SIZE).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  console.log(`  🗑️  ${existing.size} partidos borrados\n`);

  const now = admin.firestore.Timestamp.now();
  let matchNumber = 0;
  let batch = db.batch();
  let batchCount = 0;
  const omitted: Array<{ index: number; line: string; missing: string }> = [];

  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i];
    const team1Id = normalizeTeamName(p.team1);
    const team2Id = normalizeTeamName(p.team2);
    const lineDesc = `${p.team1} Vs. ${p.team2} (Junio ${p.day})`;

    if (!validTeamIds.has(team1Id)) {
      omitted.push({ index: i + 1, line: lineDesc, missing: p.team1 });
      continue;
    }
    if (!validTeamIds.has(team2Id)) {
      omitted.push({ index: i + 1, line: lineDesc, missing: p.team2 });
      continue;
    }

    matchNumber += 1;
    const short1 = teamShortById.get(team1Id) ?? team1Id.slice(0, 3).toUpperCase();
    const short2 = teamShortById.get(team2Id) ?? team2Id.slice(0, 3).toUpperCase();
    const matchId = `match-${String(matchNumber).padStart(3, '0')}-${short1}vs${short2}`;
    const matchDate = toUTC(2026, p.month, p.day, p.hour, p.minute);
    const scheduledTime = admin.firestore.Timestamp.fromDate(matchDate);
    const startTime = scheduledTime;

    const matchData = {
      id: matchId,
      competitionId: COMPETITION_ID,
      matchNumber,
      round: 'group' as const,
      team1Id,
      team2Id,
      scheduledTime,
      startTime,
      status: 'scheduled' as const,
      result: { team1Score: 0, team2Score: 0 },
      extraTime1: 0,
      extraTime2: 0,
      halftimeDuration: 15,
      createdAt: now,
      updatedAt: now,
    };

    batch.set(matchesRef.doc(matchId), matchData);
    batchCount += 1;

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) await batch.commit();

  if (omitted.length > 0) {
    console.log(`  ⚠️  Omitidos (${omitted.length}):\n`);
    omitted.forEach(({ index, line, missing }) => {
      console.log(`     #${index}: ${line} → no en teams: "${missing}"`);
    });
    console.log('');
  }

  console.log(`  ✓ ${matchNumber} partidos creados (hora = la del partido, offset +5)\n`);
  console.log('✅ Listo.\n');
}

seedMundialMatches()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
