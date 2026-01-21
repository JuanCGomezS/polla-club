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
    try {
      admin.initializeApp({
        projectId: projectId
      });
      console.log('✅ Firebase Admin inicializado con Application Default Credentials');
    } catch (error) {
      console.error('\n❌ Error: No se pudo inicializar Firebase Admin.');
      console.error('   Por favor, configura las credenciales (ver scripts/SETUP_SEED.md)\n');
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

// Crear grupo de prueba
async function createTestGroup() {
  console.log('🌱 Creando grupo de prueba...\n');

  try {
    const now = admin.firestore.Timestamp.now();
    const competitionId = 'mundial-2026';

    // Verificar que la competición existe
    const competitionRef = db.collection('competitions').doc(competitionId);
    const competitionDoc = await competitionRef.get();
    
    if (!competitionDoc.exists) {
      console.error(`❌ Error: La competición "${competitionId}" no existe.`);
      console.error('   Por favor, ejecuta primero: npm run seed');
      process.exit(1);
    }

    console.log(`✅ Competición "${competitionId}" encontrada\n`);

    // ============================================
    // 1. USUARIOS REALES (UIDs proporcionados)
    // ============================================
    console.log('👥 Verificando usuarios...');
    
    // UIDs proporcionados
    const userUids = [
      'G5ixVGAq5VhPRGay1zAUUm7HZ603',
      'zpFijYpE9lMg4oc9qhBEHmTBctv1', // Admin
      '59xBQDkYcNa6iEa92T25JbDODiK2'
    ];
    
    // Admin es el segundo UID (zpFijYpE9lMg4oc9qhBEHmTBctv1)
    const adminUid = 'zpFijYpE9lMg4oc9qhBEHmTBctv1';
    const createdUserIds: string[] = [];
    const userInfo: Array<{ uid: string; displayName: string; email: string }> = [];

    // Intentar obtener datos de usuarios desde Firestore o Firebase Auth
    for (const uid of userUids) {
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();

      if (userDoc.exists) {
        const userData = userDoc.data();
        userInfo.push({
          uid,
          displayName: userData?.displayName || `Usuario ${uid.substring(0, 8)}`,
          email: userData?.email || `${uid.substring(0, 8)}@example.com`
        });
        console.log(`   ✅ Usuario encontrado: ${userData?.displayName || uid} (${uid})`);
        createdUserIds.push(uid);
      } else {
        // Usuario no existe en Firestore, intentar obtener desde Auth
        try {
          const authUser = await admin.auth().getUser(uid);
          const displayName = authUser.displayName || `Usuario ${uid.substring(0, 8)}`;
          const email = authUser.email || `${uid.substring(0, 8)}@example.com`;
          
          // Crear documento en Firestore
          await userRef.set({
            uid,
            displayName,
            email,
            groups: [],
            createdAt: now
          });
          
          userInfo.push({ uid, displayName, email });
          console.log(`   ✅ Usuario creado en Firestore: ${displayName} (${uid})`);
          createdUserIds.push(uid);
        } catch (authError) {
          // Si no existe en Auth, crear con datos genéricos
          const displayName = `Usuario ${uid.substring(0, 8)}`;
          const email = `${uid.substring(0, 8)}@example.com`;
          
          await userRef.set({
            uid,
            displayName,
            email,
            groups: [],
            createdAt: now
          });
          
          userInfo.push({ uid, displayName, email });
          console.log(`   ⚠️  Usuario no encontrado en Auth, creado con datos genéricos: ${displayName} (${uid})`);
          createdUserIds.push(uid);
        }
      }
    }

    console.log(`\n✅ ${createdUserIds.length} usuarios listos\n`);

    // ============================================
    // 2. CREAR GRUPO DE PRUEBA
    // ============================================
    console.log('📦 Creando grupo de prueba...');

    const groupId = 'test-group-1';
    const groupRef = db.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();

    if (groupDoc.exists) {
      console.log(`   ⚠️  El grupo "${groupId}" ya existe. Actualizando participantes...`);
      await groupRef.update({
        participants: createdUserIds,
        updatedAt: now
      });
      console.log(`   ✅ Grupo actualizado con ${createdUserIds.length} participantes`);
    } else {
      const groupCode = generateGroupCode();
      // Admin es zpFijYpE9lMg4oc9qhBEHmTBctv1 (ya definido arriba)

      await groupRef.set({
        id: groupId,
        competitionId,
        name: 'Grupo de Prueba',
        code: groupCode,
        adminUid,
        participants: createdUserIds,
        isActive: true,
        settings: {
          pointsExactScore: 5,
          pointsWinner: 2,
          pointsGoalDifference: 1,
          pointsWinnerBonus: 10,
          pointsRunnerUp: 7,
          pointsThirdPlace: 5,
          pointsTopScorer: 5,
          pointsTopAssister: 3
        },
        createdAt: now,
        updatedAt: now
      });

      console.log(`   ✅ Grupo creado: "Grupo de Prueba"`);
      console.log(`   📝 Código del grupo: ${groupCode}`);
      const adminInfo = userInfo.find(u => u.uid === adminUid);
      console.log(`   👤 Admin: ${adminInfo?.displayName || adminUid} (${adminUid})`);
      console.log(`   👥 Participantes: ${createdUserIds.length}`);
    }

    // ============================================
    // 3. ACTUALIZAR USUARIOS CON EL GRUPO
    // ============================================
    console.log('\n🔄 Actualizando usuarios con referencia al grupo...');

    for (const uid of createdUserIds) {
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        const currentGroups = userData?.groups || [];
        
        if (!currentGroups.includes(groupId)) {
          await userRef.update({
            groups: [...currentGroups, groupId]
          });
          console.log(`   ✅ Usuario ${uid} actualizado`);
        } else {
          console.log(`   ⚠️  Usuario ${uid} ya tiene el grupo`);
        }
      }
    }

    // ============================================
    // 4. RESUMEN
    // ============================================
    const finalGroupDoc = await groupRef.get();
    const finalGroupData = finalGroupDoc.data();

    console.log('\n' + '='.repeat(50));
    console.log('✨ Grupo de prueba creado exitosamente!');
    console.log('='.repeat(50));
    console.log('\n📋 Resumen:');
    console.log(`   • Grupo ID: ${groupId}`);
    console.log(`   • Nombre: ${finalGroupData?.name}`);
    console.log(`   • Código: ${finalGroupData?.code}`);
    console.log(`   • Competición: ${competitionId}`);
    const adminInfo = userInfo.find(u => u.uid === finalGroupData?.adminUid);
    console.log(`   • Admin: ${adminInfo?.displayName || finalGroupData?.adminUid} (${finalGroupData?.adminUid})`);
    console.log(`   • Participantes: ${finalGroupData?.participants.length}`);
    console.log('\n👥 Usuarios del grupo:');
    for (let i = 0; i < createdUserIds.length; i++) {
      const uid = createdUserIds[i];
      const user = userInfo.find(u => u.uid === uid);
      const isAdmin = uid === adminUid;
      console.log(`   ${i + 1}. ${user?.displayName || uid} (${uid})${isAdmin ? ' [ADMIN]' : ''}`);
    }
    console.log('\n💡 Nota: Estos son usuarios de prueba (solo documentos en Firestore)');
    console.log('   Para usar en la app, necesitarías crear usuarios reales en Firebase Auth.\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error durante la creación:', error);
    process.exit(1);
  }
}

// Ejecutar
createTestGroup();
