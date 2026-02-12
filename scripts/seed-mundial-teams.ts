import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

dotenv.config();

// Obtener directorio actual (para ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuración de Firebase Admin
const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID;

if (!projectId) {
  console.error('❌ Error: PUBLIC_FIREBASE_PROJECT_ID is missing. Please check your .env file.');
  process.exit(1);
}

// Inicializar Firebase Admin
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
let serviceAccount: any = null;

if (serviceAccountPath) {
  try {
    const fileContent = readFileSync(serviceAccountPath, 'utf8');
    serviceAccount = JSON.parse(fileContent);
    console.log('✅ Usando credenciales de servicio desde GOOGLE_APPLICATION_CREDENTIALS');
  } catch (error) {
    console.warn('⚠️  No se pudo cargar el archivo de credenciales desde GOOGLE_APPLICATION_CREDENTIALS');
  }
}

if (!serviceAccount) {
  try {
    const keyPath = join(__dirname, 'service-account-key.json');
    const fileContent = readFileSync(keyPath, 'utf8');
    serviceAccount = JSON.parse(fileContent);
    console.log('✅ Usando credenciales de servicio desde scripts/service-account-key.json');
  } catch (error) {
    console.error('❌ Error: No se encontraron credenciales de servicio.');
    console.error('   Configura GOOGLE_APPLICATION_CREDENTIALS o coloca service-account-key.json en scripts/');
    process.exit(1);
  }
}

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: projectId
  });
}

const db = admin.firestore();

// Datos de equipos del Mundial 2026 con códigos ISO para imágenes
const MUNDIAL_TEAMS = [
  { name: 'Alemania', shortName: 'ALE', code: 'GER' },
  { name: 'Arabia Saudita', shortName: 'KSA', code: 'KSA' },
  { name: 'Argelia', shortName: 'ARG', code: 'ALG' },
  { name: 'Argentina', shortName: 'ARG', code: 'ARG' },
  { name: 'Australia', shortName: 'AUS', code: 'AUS' },
  { name: 'Austria', shortName: 'AUT', code: 'AUT' },
  { name: 'Bélgica', shortName: 'BEL', code: 'BEL' },
  { name: 'Brasil', shortName: 'BRA', code: 'BRA' },
  { name: 'Cabo Verde', shortName: 'CPV', code: 'CPV' },
  { name: 'Canadá', shortName: 'CAN', code: 'CAN' },
  { name: 'Catar', shortName: 'QAT', code: 'QAT' },
  { name: 'Colombia', shortName: 'COL', code: 'COL' },
  { name: 'Corea del Sur', shortName: 'KOR', code: 'KOR' },
  { name: 'Costa de Marfil', shortName: 'CIV', code: 'CIV' },
  { name: 'Croacia', shortName: 'CRO', code: 'CRO' },
  { name: 'Curazao', shortName: 'CUW', code: 'CUW' },
  { name: 'Ecuador', shortName: 'ECU', code: 'ECU' },
  { name: 'Egipto', shortName: 'EGY', code: 'EGY' },
  { name: 'Escocia', shortName: 'SCO', code: 'SCO' },
  { name: 'España', shortName: 'ESP', code: 'ESP' },
  { name: 'Estados Unidos', shortName: 'USA', code: 'USA' },
  { name: 'Francia', shortName: 'FRA', code: 'FRA' },
  { name: 'Ghana', shortName: 'GHA', code: 'GHA' },
  { name: 'Haití', shortName: 'HAI', code: 'HAI' },
  { name: 'Inglaterra', shortName: 'ENG', code: 'ENG' },
  { name: 'Irán', shortName: 'IRN', code: 'IRN' },
  { name: 'Japón', shortName: 'JPN', code: 'JPN' },
  { name: 'Jordania', shortName: 'JOR', code: 'JOR' },
  { name: 'Marruecos', shortName: 'MAR', code: 'MAR' },
  { name: 'México', shortName: 'MEX', code: 'MEX' },
  { name: 'Noruega', shortName: 'NOR', code: 'NOR' },
  { name: 'Nueva Zelanda', shortName: 'NZL', code: 'NZL' },
  { name: 'Países Bajos', shortName: 'NED', code: 'NED' },
  { name: 'Panamá', shortName: 'PAN', code: 'PAN' },
  { name: 'Paraguay', shortName: 'PAR', code: 'PAR' },
  { name: 'Portugal', shortName: 'POR', code: 'POR' },
  { name: 'Senegal', shortName: 'SEN', code: 'SEN' },
  { name: 'Sudáfrica', shortName: 'RSA', code: 'RSA' },
  { name: 'Suiza', shortName: 'SUI', code: 'SUI' },
  { name: 'Túnez', shortName: 'TUN', code: 'TUN' },
  { name: 'Uruguay', shortName: 'URU', code: 'URU' },
  { name: 'Uzbekistán', shortName: 'UZB', code: 'UZB' },
  { name: 'Ganador UEFA A', shortName: 'GUFA', code: 'GUFA' },
  { name: 'Ganador UEFA B', shortName: 'GUFB', code: 'GUFB' },
  { name: 'Ganador UEFA C', shortName: 'GUFC', code: 'GUFC' },
  { name: 'Ganador UEFA D', shortName: 'GUFD', code: 'GUFD' },
  { name: 'Ganador FIFA 1', shortName: 'GFI1', code: 'GFI1' },
  { name: 'Ganador FIFA 2', shortName: 'GFI2', code: 'GFI2' },
];

// Jugadores destacados del Mundial 2026 (con equipos)
const MUNDIAL_PLAYERS = [
  { name: 'Lionel Messi', teamName: 'Argentina', position: 'Delantero' },
  { name: 'Kylian Mbappé', teamName: 'Francia', position: 'Delantero' },
  { name: 'Vinicius Jr', teamName: 'Brasil', position: 'Delantero' },
  { name: 'Jude Bellingham', teamName: 'Inglaterra', position: 'Mediocampista' },
  { name: 'Erling Haaland', teamName: 'Noruega', position: 'Delantero' },
  { name: 'Mohamed Salah', teamName: 'Egipto', position: 'Delantero' },
  { name: 'Harry Kane', teamName: 'Inglaterra', position: 'Delantero' },
  { name: 'Kevin De Bruyne', teamName: 'Bélgica', position: 'Mediocampista' },
  { name: 'Rodri', teamName: 'España', position: 'Mediocampista' },
  { name: 'Antoine Griezmann', teamName: 'Francia', position: 'Delantero' },
];

async function seedMundialData() {
  const competitionId = 'mundial-2026';
  console.log(`\n🌍 Poblando datos del Mundial 2026 (${competitionId})...\n`);

  try {
    // 1. Crear equipos
    console.log('📝 Creando equipos...');
    const teamsRef = db.collection('competitions').doc(competitionId).collection('teams');
    const batch = db.batch();
    const teamIds = new Map<string, string>();

    for (const team of MUNDIAL_TEAMS) {
      // ID = nombre del equipo para ubicar fácil en Firebase
      const teamRef = teamsRef.doc(team.name);
      batch.set(teamRef, {
        name: team.name,
        shortName: team.shortName,
        code: team.code,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      teamIds.set(team.name, team.name);
      console.log(`  ✓ ${team.name} (${team.code})`);
    }

    await batch.commit();
    console.log(`\n✅ ${MUNDIAL_TEAMS.length} equipos creados\n`);

    // 2. Crear jugadores
    console.log('📝 Creando jugadores...');
    const playersRef = db.collection('competitions').doc(competitionId).collection('players');
    const playerBatch = db.batch();

    for (const player of MUNDIAL_PLAYERS) {
      const teamId = teamIds.get(player.teamName);
      if (!teamId) {
        console.warn(`  ⚠️  Equipo "${player.teamName}" no encontrado para ${player.name}`);
        continue;
      }

      // ID = nombre del jugador para ubicar fácil en Firebase
      const playerRef = playersRef.doc(player.name);
      playerBatch.set(playerRef, {
        name: player.name,
        teamId: teamId,
        position: player.position,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`  ✓ ${player.name} (${player.teamName})`);
    }

    await playerBatch.commit();
    console.log(`\n✅ ${MUNDIAL_PLAYERS.length} jugadores creados\n`);

    console.log('🎉 ¡Datos del Mundial 2026 poblados exitosamente!\n');
    console.log('📌 Próximos pasos:');
    console.log('   1. Ejecutar script de migración de partidos para agregar teamIds');
    console.log('   2. Probar el caché de localStorage en la aplicación\n');

  } catch (error) {
    console.error('❌ Error al poblar datos:', error);
    process.exit(1);
  }
}

// Ejecutar
seedMundialData().then(() => {
  console.log('✓ Script completado');
  process.exit(0);
}).catch((error) => {
  console.error('Error fatal:', error);
  process.exit(1);
});
