/**
 * Actualiza (upsert) jugadores destacados para Mundial 2026.
 *
 * - Lee equipos existentes en `competitions/{competitionId}/teams`
 * - Escribe jugadores en `competitions/{competitionId}/players`
 * - Opcionalmente elimina jugadores no incluidos (prune)
 *
 * Uso:
 *   npx tsx scripts/update-mundial-players.ts
 *   npx tsx scripts/update-mundial-players.ts --competitionId=mundial-2026
 *   npx tsx scripts/update-mundial-players.ts --dry-run
 *   npx tsx scripts/update-mundial-players.ts --prune
 */
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ==============================
// Configuración Firebase Admin
// ==============================
const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID;

if (!projectId) {
  console.error('❌ Error: PUBLIC_FIREBASE_PROJECT_ID is missing. Please check your .env file.');
  process.exit(1);
}

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
let serviceAccount: any = null;

if (serviceAccountPath) {
  try {
    const fileContent = readFileSync(serviceAccountPath, 'utf8');
    serviceAccount = JSON.parse(fileContent);
    console.log('✅ Usando credenciales de servicio desde GOOGLE_APPLICATION_CREDENTIALS');
  } catch {
    console.warn('⚠️  No se pudo cargar el archivo de credenciales desde GOOGLE_APPLICATION_CREDENTIALS');
  }
}

if (!serviceAccount) {
  try {
    const keyPath = join(__dirname, 'service-account-key.json');
    const fileContent = readFileSync(keyPath, 'utf8');
    serviceAccount = JSON.parse(fileContent);
    console.log('✅ Usando credenciales de servicio desde scripts/service-account-key.json');
  } catch {
    console.error('❌ Error: No se encontraron credenciales de servicio.');
    console.error('   Configura GOOGLE_APPLICATION_CREDENTIALS o coloca service-account-key.json en scripts/');
    process.exit(1);
  }
}

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId
  });
}

const db = admin.firestore();

// ==============================
// CLI args
// ==============================
function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;
    const s = raw.slice(2);
    const eq = s.indexOf('=');
    if (eq === -1) {
      args[s] = true;
      continue;
    }
    args[s.slice(0, eq)] = s.slice(eq + 1);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const competitionId =
  (typeof args.competitionId === 'string' && args.competitionId) || 'mundial-2026';
const dryRun = args['dry-run'] === true || args.dryRun === true;
const prune = args.prune === true;

// ==============================
// Datos de jugadores
// ==============================
interface MundialPlayer {
  name: string;
  teamName: string;
  position: string;
}

const MUNDIAL_PLAYERS_RAW: MundialPlayer[] = [
  // Goleadores
  { name: 'Jonathan David', teamName: 'Canadá', position: 'Delantero' },
  { name: 'Lionel Messi', teamName: 'Argentina', position: 'Delantero' },
  { name: 'Cyle Larin', teamName: 'Canadá', position: 'Delantero' },
  { name: 'Johan Manzambi', teamName: 'Suiza', position: 'Delantero' },
  { name: 'Yasin Ayari', teamName: 'Suecia', position: 'Delantero' },
  { name: 'Elijah Just', teamName: 'Nueva Zelanda', position: 'Delantero' },
  { name: 'Erling Haaland', teamName: 'Noruega', position: 'Delantero' },
  { name: 'Kylian Mbappé', teamName: 'Francia', position: 'Delantero' },
  { name: 'Kai Havertz', teamName: 'Alemania', position: 'Delantero' },
  { name: 'Harry Kane', teamName: 'Inglaterra', position: 'Delantero' },
  { name: 'Folarin Balogun', teamName: 'Estados Unidos', position: 'Delantero' },
  { name: 'Teboho Mokoena', teamName: 'Sudáfrica', position: 'Delantero' },
  { name: 'Ladislav Krejcí', teamName: 'Chequia', position: 'Delantero' },
  { name: 'Granit Xhaka', teamName: 'Suiza', position: 'Delantero' },
  { name: 'Breel Embolo', teamName: 'Suiza', position: 'Delantero' },
  { name: 'Hwang In-Beom', teamName: 'Corea del Sur', position: 'Delantero' },
  { name: 'Julián Quiñones', teamName: 'México', position: 'Delantero' },
  { name: 'Raúl Jiménez', teamName: 'México', position: 'Delantero' },
  { name: 'Rubén Vargas', teamName: 'Suiza', position: 'Delantero' },
  { name: 'Michal Sadílek', teamName: 'Chequia', position: 'Delantero' },
  { name: 'Jovo Lukic', teamName: 'Bosnia y Herzegovina', position: 'Delantero' },
  { name: 'Oh Hyeon-Gyu', teamName: 'Corea del Sur', position: 'Delantero' },
  { name: 'Caleb Yirenkyi', teamName: 'Ghana', position: 'Delantero' },
  { name: 'João Neves', teamName: 'Portugal', position: 'Delantero' },
  { name: 'Ali Olwan', teamName: 'Jordania', position: 'Delantero' },
  { name: 'Livano Comenencia', teamName: 'Curacao', position: 'Delantero' },
  { name: 'Omar Rekik', teamName: 'Túnez', position: 'Delantero' },
  { name: 'Mohammad Mohebbi', teamName: 'Irán', position: 'Delantero' },
  { name: 'Nico Schlotterbeck', teamName: 'Alemania', position: 'Delantero' },
  { name: 'Keito Nakamura', teamName: 'Japón', position: 'Delantero' },
  { name: 'Connor Metcalfe', teamName: 'Australia', position: 'Delantero' },
  { name: 'Viktor Gyökeres', teamName: 'Suecia', position: 'Delantero' },
  { name: 'Abdulelah Al-Amri', teamName: 'Arabia Saudita', position: 'Delantero' },
  { name: 'Vinícius Júnior', teamName: 'Brasil', position: 'Delantero' },
  { name: 'Aymen Hussein', teamName: 'Irak', position: 'Delantero' },
  { name: 'Yoane Wissa', teamName: 'República Democrática del Congo', position: 'Delantero' },
  { name: 'Daichi Kamada', teamName: 'Japón', position: 'Delantero' },
  { name: 'Ramin Rezaeian', teamName: 'Irán', position: 'Delantero' },
  { name: 'Virgil van Dijk', teamName: 'Países Bajos', position: 'Delantero' },
  { name: 'Daniel Muñoz', teamName: 'Colombia', position: 'Delantero' },
  { name: 'Ismael Saibari', teamName: 'Marruecos', position: 'Delantero' },
  { name: 'Luis Díaz', teamName: 'Colombia', position: 'Delantero' },
  { name: 'Alexander Isak', teamName: 'Suecia', position: 'Delantero' },
  { name: 'Romano Schmid', teamName: 'Austria', position: 'Delantero' },
  { name: 'John McGinn', teamName: 'Escocia', position: 'Delantero' },
  { name: 'Maxi Araújo', teamName: 'Uruguay', position: 'Delantero' },
  { name: 'Jude Bellingham', teamName: 'Inglaterra', position: 'Delantero' },
  { name: 'Martin Baturina', teamName: 'Croacia', position: 'Delantero' },
  { name: 'Abbosbek Fayzullaev', teamName: 'Uzbekistán', position: 'Delantero' },
  { name: 'Felix Nmecha', teamName: 'Alemania', position: 'Delantero' },

  // Asistencias
  { name: 'Chris Wood', teamName: 'Nueva Zelanda', position: 'Delantero' },
  { name: 'Alexander Isak', teamName: 'Suecia', position: 'Delantero' },
  { name: 'Joshua Kimmich', teamName: 'Alemania', position: 'Delantero' },
  { name: 'Ryan Gravenberch', teamName: 'Países Bajos', position: 'Delantero' },
  { name: 'Deniz Undav', teamName: 'Alemania', position: 'Delantero' },
  { name: 'Lee Kang-In', teamName: 'Corea del Sur', position: 'Delantero' },
  { name: 'Vladimír Coufal', teamName: 'Chequia', position: 'Delantero' },
  { name: 'Breel Embolo', teamName: 'Suiza', position: 'Delantero' },
  { name: 'Hwang In-Beom', teamName: 'Corea del Sur', position: 'Delantero' },
  { name: 'Sead Kolasinac', teamName: 'Bosnia y Herzegovina', position: 'Delantero' },
  { name: 'Roberto Alvarado', teamName: 'México', position: 'Delantero' },
  { name: 'Érik Lira', teamName: 'México', position: 'Delantero' },
  { name: 'Alexandr Sojka', teamName: 'Chequia', position: 'Delantero' },
  { name: 'Rubén Vargas', teamName: 'Suiza', position: 'Delantero' },
  { name: 'Petar Sucic', teamName: 'Croacia', position: 'Delantero' },
  { name: 'Amir Al-Ammari', teamName: 'Irak', position: 'Delantero' },
  { name: 'Florian Wirtz', teamName: 'Alemania', position: 'Delantero' },
  { name: 'Hannibal Mejbri', teamName: 'Túnez', position: 'Delantero' },
  { name: 'Noor Al-Rawabdeh', teamName: 'Jordania', position: 'Delantero' },
  { name: 'Michael Olise', teamName: 'Francia', position: 'Delantero' },
  { name: 'Wilfried Singo', teamName: 'Costa de Marfil', position: 'Delantero' },
  { name: 'Viktor Gyökeres', teamName: 'Suecia', position: 'Delantero' },
  { name: 'Alex Freeman', teamName: 'Estados Unidos', position: 'Delantero' },
  { name: 'Elliot Anderson', teamName: 'Inglaterra', position: 'Delantero' },
  { name: 'Ramin Rezaeian', teamName: 'Irán', position: 'Delantero' },
  { name: 'Adrien Rabiot', teamName: 'Francia', position: 'Delantero' },
  { name: 'Rodrigo De Paul', teamName: 'Argentina', position: 'Delantero' },
  { name: 'Ivan Perisic', teamName: 'Croacia', position: 'Delantero' },
  { name: 'Julio Enciso', teamName: 'Paraguay', position: 'Delantero' },
  { name: 'Luis Díaz', teamName: 'Colombia', position: 'Delantero' },
  { name: 'Paul Okon-Engstler', teamName: 'Australia', position: 'Delantero' },
  { name: 'Malik Tillman', teamName: 'Estados Unidos', position: 'Delantero' },
  { name: 'Martin Ødegaard', teamName: 'Noruega', position: 'Delantero' },
  { name: 'Gustavo Puerta', teamName: 'Colombia', position: 'Delantero' },
  { name: 'Bruno Guimarães', teamName: 'Brasil', position: 'Delantero' },
  { name: 'Mohamed Salah', teamName: 'Egipto', position: 'Delantero' },
  { name: 'Takefusa Kubo', teamName: 'Japón', position: 'Delantero' },
  { name: 'Arthur Masuaku', teamName: 'República Democrática del Congo', position: 'Delantero' },
  { name: 'David Møller Wolfe', teamName: 'Noruega', position: 'Delantero' },
  { name: 'Nathaniel Brown', teamName: 'Alemania', position: 'Delantero' },
  { name: 'Declan Rice', teamName: 'Inglaterra', position: 'Delantero' },
  { name: 'Pedro Neto', teamName: 'Portugal', position: 'Delantero' },
  { name: 'Brahim Díaz', teamName: 'Marruecos', position: 'Delantero' },
  { name: 'Xaver Schlager', teamName: 'Austria', position: 'Delantero' },
  { name: 'Christian Pulisic', teamName: 'Estados Unidos', position: 'Delantero' },
  { name: 'Nico González', teamName: 'Argentina', position: 'Delantero' },
  { name: 'Nathan Saliba', teamName: 'Canadá', position: 'Delantero' },
  { name: 'Brandon Thomas-Asante', teamName: 'Ghana', position: 'Delantero' },
  { name: 'Promise David', teamName: 'Canadá', position: 'Delantero' },
  { name: 'Lucas Bergvall', teamName: 'Suecia', position: 'Delantero' }
];

const TEAM_NAME_NORMALIZATION: Record<string, string> = {
  Curacao: 'Curazao'
};

function normalizeTeamName(teamName: string): string {
  return TEAM_NAME_NORMALIZATION[teamName] ?? teamName;
}

function dedupeByPlayerName(players: MundialPlayer[]): MundialPlayer[] {
  const byName = new Map<string, MundialPlayer>();
  for (const player of players) {
    if (byName.has(player.name)) continue;
    byName.set(player.name, { ...player, teamName: normalizeTeamName(player.teamName) });
  }
  return Array.from(byName.values());
}

const MUNDIAL_PLAYERS = dedupeByPlayerName(MUNDIAL_PLAYERS_RAW);

function getPlayerDocIdFromName(name: string): string {
  // Firestore document IDs no pueden tener "/"
  return name.replace(/\//g, '-');
}

// ==============================
// Script principal
// ==============================
async function updateMundialPlayers() {
  console.log(`\n🌍 Actualizando jugadores para "${competitionId}"...\n`);
  if (dryRun) console.log('🧪 Modo dry-run (no se escribirá nada)\n');

  const competitionRef = db.collection('competitions').doc(competitionId);
  const teamsSnapshot = await competitionRef.collection('teams').get();

  if (teamsSnapshot.empty) {
    console.error('❌ No hay equipos en la competición. Crea/seed teams primero.');
    process.exit(1);
  }

  const teamIdByName = new Map<string, string>();
  teamsSnapshot.forEach((d) => {
    const data = d.data() as { name?: string };
    if (data?.name) teamIdByName.set(data.name, d.id);
  });

  const playersRef = competitionRef.collection('players');
  const wantedIds = new Set<string>();

  let created = 0;
  let updated = 0;
  let skippedMissingTeam = 0;

  const BATCH_SIZE = 450;
  let batch = db.batch();
  let batchCount = 0;

  for (const player of MUNDIAL_PLAYERS) {
    const teamId = teamIdByName.get(player.teamName);
    if (!teamId) {
      skippedMissingTeam += 1;
      console.warn(`⚠️  Equipo "${player.teamName}" no encontrado para jugador ${player.name}`);
      continue;
    }

    const playerDocId = getPlayerDocIdFromName(player.name);
    wantedIds.add(playerDocId);
    const ref = playersRef.doc(playerDocId);

    if (!dryRun) {
      const existing = await ref.get();
      const payload = {
        name: player.name,
        teamId,
        position: player.position,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(existing.exists ? {} : { createdAt: admin.firestore.FieldValue.serverTimestamp() })
      };
      batch.set(ref, payload, { merge: true });
      if (existing.exists) updated += 1;
      else created += 1;
    } else {
      // En dry-run no hacemos lecturas por jugador; mostramos intención.
      updated += 1;
    }

    batchCount += 1;
    if (batchCount >= BATCH_SIZE) {
      if (!dryRun) await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    if (!dryRun) await batch.commit();
  }

  let pruned = 0;
  if (prune) {
    console.log('\n🧹 Prune habilitado: eliminando jugadores no incluidos en la lista...');
    const existingPlayers = await playersRef.get();
    const deletions: admin.firestore.DocumentReference[] = [];
    existingPlayers.forEach((d) => {
      if (!wantedIds.has(d.id)) deletions.push(d.ref);
    });

    const DEL_BATCH_SIZE = 450;
    for (let i = 0; i < deletions.length; i += DEL_BATCH_SIZE) {
      const delBatch = db.batch();
      deletions.slice(i, i + DEL_BATCH_SIZE).forEach((ref) => delBatch.delete(ref));
      if (!dryRun) await delBatch.commit();
    }

    pruned = deletions.length;
  }

  console.log('\n✅ Jugadores actualizados.');
  console.log(`  - Creados: ${created}`);
  console.log(`  - Actualizados: ${updated}`);
  console.log(`  - Omitidos (equipo no encontrado): ${skippedMissingTeam}`);
  if (prune) console.log(`  - Eliminados (prune): ${pruned}`);
  console.log('');
}

updateMundialPlayers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error actualizando jugadores:', error);
    process.exit(1);
  });
