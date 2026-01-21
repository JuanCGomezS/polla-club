import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Cargar variables de entorno
dotenv.config();

// Obtener directorio actual (para ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuración de Firebase Admin
const projectId = process.env.VITE_FIREBASE_PROJECT_ID;

if (!projectId) {
  console.error('❌ Error: VITE_FIREBASE_PROJECT_ID is missing. Please check your .env file.');
  process.exit(1);
}

// Inicializar Firebase Admin
// Opción 1: Usar archivo de credenciales de servicio (recomendado)
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

// Opción 2: Intentar cargar desde archivo local (scripts/service-account-key.json)
if (!serviceAccount) {
  try {
    const keyPath = join(__dirname, 'service-account-key.json');
    const fileContent = readFileSync(keyPath, 'utf8');
    serviceAccount = JSON.parse(fileContent);
    console.log('✅ Usando credenciales de servicio desde scripts/service-account-key.json');
  } catch (error) {
    // No hay archivo local, continuar con otras opciones
    console.log('ℹ️  No se encontró service-account-key.json, intentando otras opciones...');
  }
}

if (admin.apps.length === 0) {
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: projectId
    });
    console.log('✅ Firebase Admin inicializado con credenciales de servicio');
  } else {
    // Opción 3: Usar Application Default Credentials (requiere gcloud configurado)
    try {
      admin.initializeApp({
        projectId: projectId
      });
      console.log('✅ Firebase Admin inicializado con Application Default Credentials');
    } catch (error) {
      console.error('\n❌ Error: No se pudo inicializar Firebase Admin.');
      console.error('\n📋 Para usar este script, necesitas configurar credenciales:');
      console.error('\n   Opción 1 (Recomendada):');
      console.error('   1. Ve a Firebase Console → Project Settings → Service Accounts');
      console.error('   2. Click en "Generate new private key"');
      console.error('   3. Guarda el archivo JSON como: scripts/service-account-key.json');
      console.error('   4. Asegúrate de que está en .gitignore (no subirlo a git!)');
      console.error('\n   Opción 2:');
      console.error('   export GOOGLE_APPLICATION_CREDENTIALS=/ruta/a/service-account-key.json');
      console.error('\n   Opción 3:');
      console.error('   gcloud auth application-default login\n');
      process.exit(1);
    }
  }
}

const db = admin.firestore();

// Función para generar código único de grupo
function generateGroupCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'PD-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Datos de ejemplo
async function seedDatabase() {
  console.log('🌱 Iniciando seeding de la base de datos...\n');

  try {
    const now = admin.firestore.Timestamp.now();
    
    // ============================================
    // 1. CREAR COMPETICIÓN DE EJEMPLO
    // ============================================
    console.log('📅 Creando competición: Mundial 2026...');
    
    const competitionId = 'mundial-2026';
    const competitionRef = db.collection('competitions').doc(competitionId);
    
    // Fechas: Mundial 2026 (junio-julio 2026)
    const startDate = admin.firestore.Timestamp.fromDate(new Date('2026-06-11T00:00:00Z'));
    const endDate = admin.firestore.Timestamp.fromDate(new Date('2026-07-19T23:59:59Z'));
    const bonusLockDate = admin.firestore.Timestamp.fromDate(new Date('2026-06-28T00:00:00Z')); // Antes de octavos
    
    await competitionRef.set({
      id: competitionId,
      name: 'Mundial 2026',
      type: 'world_cup',
      startDate,
      endDate,
      status: 'upcoming',
      bonusSettings: {
        hasWinner: true,
        hasRunnerUp: true,
        hasThirdPlace: true,
        hasTopScorer: true,
        hasTopAssister: false,
        bonusLockDate
      },
      createdAt: now,
      updatedAt: now
    });
    
    console.log('✅ Competición creada:', competitionId);
    
    // ============================================
    // 2. CREAR RESULTADOS DE COMPETICIÓN (vacío)
    // ============================================
    console.log('\n📊 Creando documento de resultados de competición...');
    
    const resultsRef = db.collection('competitions').doc(competitionId).collection('results').doc('main');
    await resultsRef.set({
      id: 'main',
      competitionId,
      isLocked: false,
      updatedAt: now
    });
    
    console.log('✅ Resultados de competición creados');
    
    // ============================================
    // 3. CREAR PARTIDOS DE FASE DE GRUPOS (Mundial 2026)
    // ============================================
    console.log('\n⚽ Creando partidos de Fase de Grupos (12 grupos, 72 partidos)...');
    
    // Grupos reales del Mundial 2026
    const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const;
    const teams: Record<string, string[]> = {
      A: ['México', 'Sudáfrica', 'República de Corea', 'Ganador Repechaje D'],
      B: ['Canadá', 'Ganador Repechaje A', 'Catar', 'Suiza'],
      C: ['Brasil', 'Marruecos', 'Haití', 'Escocia'],
      D: ['Estados Unidos', 'Paraguay', 'Australia', 'Ganador Repechaje C'],
      E: ['Alemania', 'Curazao', 'Costa de Marfil', 'Ecuador'],
      F: ['Países Bajos', 'Japón', 'Ganador Repechaje B', 'Túnez'],
      G: ['Bélgica', 'Egipto', 'Irán', 'Nueva Zelanda'],
      H: ['España', 'Cabo Verde', 'Arabia Saudita', 'Uruguay'],
      I: ['Francia', 'Senegal', 'Ganador Repechaje Grupo 2', 'Noruega'],
      J: ['Argentina', 'Argelia', 'Austria', 'Jordania'],
      K: ['Portugal', 'Ganador Repechaje Grupo 1', 'Uzbekistán', 'Colombia'],
      L: ['Inglaterra', 'Croacia', 'Ghana', 'Panamá']
    };
    
    let matchNumber = 1;
    const matches: Array<{
      id: string;
      competitionId: string;
      matchNumber: number;
      round: 'group';
      team1: string;
      team2: string;
      scheduledTime: admin.firestore.Timestamp;
      status: 'scheduled';
      groupStage: { group: string; matchDay: number };
      createdAt: Timestamp;
      updatedAt: Timestamp;
    }> = [];
    
    // Fechas base: Fase de grupos del 11 de junio al 30 de junio
    // Distribuir los 12 grupos en ~20 días (11-30 junio)
    // Cada grupo tiene 3 jornadas, distribuidas en diferentes días
    
    // Función para calcular fecha según grupo y jornada
    const getMatchDate = (groupIndex: number, matchDay: number): Date => {
      // Distribuir grupos a lo largo de los días
      // Día base: 11 de junio + (grupo * 1.5 días aproximadamente)
      const baseDay = 11 + Math.floor(groupIndex * 1.5);
      // Jornada 1: día base, Jornada 2: +5 días, Jornada 3: +10 días
      const dayOffset = baseDay + ((matchDay - 1) * 5);
      // Asegurar que no pase del 30 de junio
      const finalDay = Math.min(dayOffset, 30);
      // Horarios variados: 14:00, 17:00, 20:00 UTC
      const hours = [14, 17, 20];
      const hourIndex = (groupIndex + matchDay) % 3;
      return new Date(`2026-06-${String(finalDay).padStart(2, '0')}T${String(hours[hourIndex]).padStart(2, '0')}:00:00Z`);
    };
    
    // Crear partidos para cada grupo (6 partidos por grupo = 3 jornadas × 2 partidos)
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      const group = groups[groupIndex];
      const groupTeams = teams[group];
      
      // Jornada 1: Partido 1 y 2
      matches.push({
        id: `match-${String(matchNumber).padStart(3, '0')}`,
        competitionId,
        matchNumber: matchNumber++,
        round: 'group',
        team1: groupTeams[0],
        team2: groupTeams[1],
        scheduledTime: admin.firestore.Timestamp.fromDate(getMatchDate(groupIndex, 1)),
        status: 'scheduled',
        groupStage: { group, matchDay: 1 },
        createdAt: now,
        updatedAt: now
      });
      
      matches.push({
        id: `match-${String(matchNumber).padStart(3, '0')}`,
        competitionId,
        matchNumber: matchNumber++,
        round: 'group',
        team1: groupTeams[2],
        team2: groupTeams[3],
        scheduledTime: admin.firestore.Timestamp.fromDate(new Date(getMatchDate(groupIndex, 1).getTime() + 3 * 60 * 60 * 1000)), // +3 horas
        status: 'scheduled',
        groupStage: { group, matchDay: 1 },
        createdAt: now,
        updatedAt: now
      });
      
      // Jornada 2: Partido 3 y 4
      matches.push({
        id: `match-${String(matchNumber).padStart(3, '0')}`,
        competitionId,
        matchNumber: matchNumber++,
        round: 'group',
        team1: groupTeams[0],
        team2: groupTeams[2],
        scheduledTime: admin.firestore.Timestamp.fromDate(getMatchDate(groupIndex, 2)),
        status: 'scheduled',
        groupStage: { group, matchDay: 2 },
        createdAt: now,
        updatedAt: now
      });
      
      matches.push({
        id: `match-${String(matchNumber).padStart(3, '0')}`,
        competitionId,
        matchNumber: matchNumber++,
        round: 'group',
        team1: groupTeams[1],
        team2: groupTeams[3],
        scheduledTime: admin.firestore.Timestamp.fromDate(new Date(getMatchDate(groupIndex, 2).getTime() + 3 * 60 * 60 * 1000)), // +3 horas
        status: 'scheduled',
        groupStage: { group, matchDay: 2 },
        createdAt: now,
        updatedAt: now
      });
      
      // Jornada 3: Partido 5 y 6
      matches.push({
        id: `match-${String(matchNumber).padStart(3, '0')}`,
        competitionId,
        matchNumber: matchNumber++,
        round: 'group',
        team1: groupTeams[0],
        team2: groupTeams[3],
        scheduledTime: admin.firestore.Timestamp.fromDate(getMatchDate(groupIndex, 3)),
        status: 'scheduled',
        groupStage: { group, matchDay: 3 },
        createdAt: now,
        updatedAt: now
      });
      
      matches.push({
        id: `match-${String(matchNumber).padStart(3, '0')}`,
        competitionId,
        matchNumber: matchNumber++,
        round: 'group',
        team1: groupTeams[1],
        team2: groupTeams[2],
        scheduledTime: admin.firestore.Timestamp.fromDate(new Date(getMatchDate(groupIndex, 3).getTime() + 3 * 60 * 60 * 1000)), // +3 horas
        status: 'scheduled',
        groupStage: { group, matchDay: 3 },
        createdAt: now,
        updatedAt: now
      });
    }
    
    // Guardar todos los partidos
    for (const match of matches) {
      const matchRef = db.collection('matches').doc(match.id);
      await matchRef.set(match);
    }
    
    console.log(`✅ ${matches.length} partidos creados`);
    
    // ============================================
    // 4. RESUMEN
    // ============================================
    console.log('\n' + '='.repeat(50));
    console.log('✨ Seeding completado exitosamente!');
    console.log('='.repeat(50));
    console.log('\n📋 Resumen:');
    console.log(`   • 1 competición: "${competitionId}"`);
    console.log(`   • 1 documento de resultados`);
    console.log(`   • ${matches.length} partidos de fase de grupos (12 grupos × 6 partidos)`);
    console.log(`   • 48 equipos en 12 grupos`);
    console.log(`   • Fechas: 11 de junio - 30 de junio 2026`);
    console.log('\n💡 Nota: Los partidos están en estado "scheduled"');
    console.log('   Puedes actualizar resultados desde el panel de admin cuando esté listo.');
    console.log('   Los ganadores de repechaje aparecen como "Ganador Repechaje X" y pueden actualizarse después.\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error durante el seeding:', error);
    process.exit(1);
  }
}

// Ejecutar seeding
seedDatabase();
