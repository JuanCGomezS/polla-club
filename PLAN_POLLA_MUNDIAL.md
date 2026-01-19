# Plan de trabajo — Sistema de Pronósticos Deportivos
## PollaClub - Sistema de pronósticos deportivos entre amigos

## 0) Objetivo
Sistema multi-competición y multi-grupo donde cada grupo de amigos:
- Participa independientemente en pronósticos de cualquier competición deportiva (Mundial, Copa América, Champions League, etc.)
- Cada participante hace sus pronósticos de forma privada (no visibles hasta inicio del partido)
- Los puntos se calculan en tiempo real según resultados actualizados
- Tabla de posiciones visible en todo momento para todos los participantes
- Super administrador gestiona competiciones, partidos y resultados globalmente
- Administrador de grupo gestiona participantes y configuración inicial

**Características clave:**
- Soporte para múltiples competiciones simultáneas
- Cada grupo está asociado a una competición específica
- Los partidos están organizados por competición
- Pronósticos bonus configurables según el tipo de competición

**Competiciones soportadas:**
- Mundial de Fútbol (Copa del Mundo)
- Copas continentales (Copa América, Eurocopa, etc.)
- Competiciones de clubes (Champions League, Libertadores, etc.)
- Ligas nacionales
- Cualquier otro torneo deportivo con estructura similar

**Nota:** Este plan usa **PollaClub** como nombre del proyecto. Todas las referencias están configuradas con este nombre.

**Stack técnico:**
- Frontend: Astro + React (página estática)
- Hosting: GitHub Pages
- Backend: Firebase (Firestore + Auth)
- Tiempo real: Firestore listeners

---

## 1) Modelo de datos (Firestore)

### 1.1 Colecciones principales

#### **`competitions`** (colección global, gestionada por super admin)
```typescript
{
  id: string
  name: string                      // Nombre de la competición (ej: "Mundial 2026", "Copa América 2024", "Champions League 2024-25")
  type: "world_cup" | "continental" | "club" | "league" | "other"
  startDate: timestamp              // Fecha de inicio de la competición
  endDate: timestamp                // Fecha de finalización
  status: "upcoming" | "active" | "finished"
  bonusSettings: {
    hasWinner: boolean              // Si tiene ganador final
    hasRunnerUp: boolean            // Si tiene segundo lugar
    hasThirdPlace: boolean          // Si tiene tercer lugar
    hasTopScorer: boolean           // Si tiene máximo goleador
    hasTopAssister: boolean         // Si tiene máximo asistidor
    bonusLockDate?: timestamp       // Fecha límite para pronósticos bonus (ej: antes de octavos)
  }
  createdAt: timestamp
  updatedAt: timestamp
}
```

**Nota:** El super admin crea competiciones. Cada grupo se asocia a una competición.

---

#### **`matches`** (colección global, gestionada por super admin)
```typescript
{
  id: string
  competitionId: string            // ID de la competición (referencia a competitions)
  matchNumber: number              // Número único del partido dentro de la competición
  round: "group" | "round16" | "round8" | "quarter" | "semifinal" | "third" | "final"
  team1: string                     // Nombre del equipo (ej: "Argentina")
  team2: string                     // Nombre del equipo (ej: "Brasil")
  scheduledTime: timestamp          // Hora de inicio del partido
  status: "scheduled" | "live" | "finished"
  result?: {
    team1Score: number
    team2Score: number
  }
  groupStage?: {
    group: "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H"
    matchDay: number                 // Día 1, 2, 3 de la fase de grupos
  }
  createdAt: timestamp
  updatedAt: timestamp
}
```

**Nota:** Solo el super admin puede crear/actualizar partidos. Los usuarios solo leen. Cada partido pertenece a una competición específica.

---

#### **`groups`** (colección de grupos independientes)
```typescript
{
  id: string
  competitionId: string            // ID de la competición (referencia a competitions)
  name: string                      // Nombre del grupo (ej: "Amigos del trabajo")
  code: string                      // Código único para unirse (ej: "PD-ABC123" - genérico)
  adminUid: string                  // UID del administrador del grupo
  participants: string[]            // Array de UIDs de participantes
  isActive: boolean                 // true = grupo activo, false = desactivado
  settings: {
    pointsExactScore: number        // Puntos por acertar marcador exacto (ej: 5)
    pointsWinner: number            // Puntos por acertar ganador (ej: 2)
    pointsGoalDifference?: number   // Puntos por acertar diferencia de goles (ej: 1, opcional)
    // Pronósticos bonus (solo si la competición los tiene habilitados)
    pointsWinner?: number           // Puntos por acertar ganador de la competición (opcional)
    pointsRunnerUp?: number         // Puntos por acertar segundo lugar (opcional)
    pointsThirdPlace?: number       // Puntos por acertar tercer lugar (opcional)
    pointsTopScorer?: number        // Puntos por acertar máximo goleador (opcional)
    pointsTopAssister?: number      // Puntos por acertar máximo asistidor (opcional)
  }
  createdAt: timestamp
  updatedAt: timestamp
}
```

**Reglas:**
- El `adminUid` puede agregar/remover participantes
- Los `settings` solo se pueden modificar al crear el grupo (no después, por integridad)
- `isActive` puede ser modificado por el admin

---

#### **`users`** (colección de perfiles de usuario)
```typescript
{
  uid: string                       // ID de Firebase Auth (usado como document ID)
  displayName: string               // Nombre para mostrar
  email: string
  groups: string[]                  // Array de groupIds a los que pertenece
  createdAt: timestamp
}
```

**Nota:** Se crea automáticamente al registrarse. Se actualiza cuando el usuario se une a un grupo.

---

#### **`predictions`** (subcolección: `groups/{groupId}/predictions`)
```typescript
{
  id: string
  userId: string                    // UID del participante
  matchId: string                   // ID del partido (referencia a matches)
  team1Score: number
  team2Score: number
  submittedAt: timestamp
  points?: number                   // Puntos obtenidos (calculado después del partido)
  pointsBreakdown?: {
    exactScore: number              // Puntos por marcador exacto
    winner: number                  // Puntos por acertar ganador
    goalDifference: number          // Puntos por acertar diferencia
  }
  calculatedAt?: timestamp          // Cuándo se calculó el puntaje
}
```

**Reglas de privacidad:**
- Solo el dueño (`userId`) puede leer/escribir antes de que el partido inicie
- Una vez que `matches.status != "scheduled"`, todos los participantes del grupo pueden leer
- No se puede crear/actualizar si el partido ya inició (`matches.status != "scheduled"`)

---

#### **`bonusPredictions`** (subcolección: `groups/{groupId}/bonusPredictions`)
```typescript
{
  id: string
  userId: string                    // UID del participante
  winner?: string                   // Nombre del equipo ganador
  runnerUp?: string                 // Nombre del equipo segundo lugar
  thirdPlace?: string               // Nombre del equipo tercer lugar
  topScorer?: string                // Nombre del jugador máximo goleador
  topAssister?: string              // Nombre del jugador máximo asistidor
  submittedAt: timestamp
  points?: number                   // Puntos totales obtenidos
  pointsBreakdown?: {
    winner: number
    runnerUp: number
    thirdPlace: number
    topScorer: number
    topAssister: number
  }
  calculatedAt?: timestamp
}
```

**Reglas:**
- Solo se pueden crear/actualizar antes de la fecha límite definida en `competitions.bonusSettings.bonusLockDate`
- Se bloquea cuando se alcanza la fecha límite o cuando la competición lo indica
- Todos los participantes del grupo pueden leer después de ser bloqueados
- Los campos disponibles dependen de `competitions.bonusSettings` (ej: si `hasThirdPlace` es false, no se puede ingresar `thirdPlace`)

---

#### **`competitionResults`** (subcolección: `competitions/{competitionId}/results`)
```typescript
{
  id: string
  competitionId: string            // ID de la competición (usado como document ID: "main")
  winner?: string                  // Resultado real: equipo ganador
  runnerUp?: string                // Resultado real: segundo lugar
  thirdPlace?: string              // Resultado real: tercer lugar
  topScorer?: string               // Resultado real: máximo goleador
  topAssister?: string             // Resultado real: máximo asistidor
  isLocked: boolean                // true = ya no se pueden hacer pronósticos bonus
  lockedAt?: timestamp             // Cuándo se bloqueó
  updatedAt: timestamp
}
```

**Nota:** El super admin actualiza estos valores cuando se conocen los resultados reales. Cada competición tiene su propio documento de resultados.

---

### 1.2 Índices de Firestore necesarios

Los índices se crearán automáticamente cuando Firestore detecte una query que los requiera, pero es mejor crearlos manualmente para evitar errores en producción.

#### Índices requeridos:

**1. Colección `matches`:**
```javascript
// Query: partidos por competición, estado y fecha
Collection: matches
Fields: competitionId (Ascending), status (Ascending), scheduledTime (Ascending)
Query scope: Collection

// Query: partidos por competición y ronda
Collection: matches
Fields: competitionId (Ascending), round (Ascending), scheduledTime (Ascending)
Query scope: Collection
```

**2. Colección `competitions`:**
```javascript
// Query: competiciones activas
Collection: competitions
Fields: status (Ascending), startDate (Ascending)
Query scope: Collection
```

**3. Colección `groups`:**

**2. Subcolección `groups/{groupId}/predictions`:**
```javascript
// Query: pronósticos por usuario
Collection: groups/{groupId}/predictions
Fields: userId (Ascending), submittedAt (Descending)
Query scope: Collection group

// Query: pronósticos por partido (para tabla de resultados)
Collection: groups/{groupId}/predictions
Fields: matchId (Ascending), points (Descending)
Query scope: Collection group

// Query: pronósticos por usuario y partido (verificar si ya existe)
Collection: groups/{groupId}/predictions
Fields: userId (Ascending), matchId (Ascending)
Query scope: Collection group
```

**4. Colección `groups`:**
```javascript
// Query: grupos por competición y admin
Collection: groups
Fields: competitionId (Ascending), adminUid (Ascending), createdAt (Descending)
Query scope: Collection

// Query: grupos por competición y estado
Collection: groups
Fields: competitionId (Ascending), isActive (Ascending), createdAt (Descending)
Query scope: Collection

// Query: grupos por participante (para listar grupos del usuario)
// Nota: Esto requiere un índice compuesto o query por array-contains en participants
```

**4. Colección `users`:**
```javascript
// Query: usuarios por email (si se necesita buscar)
Collection: users
Fields: email (Ascending)
Query scope: Collection
```

#### Cómo crear índices:

**Opción 1: Automático (recomendado para desarrollo)**
- Cuando ejecutes una query que requiera índice, Firestore mostrará un error con un link
- Click en el link para crear el índice automáticamente

**Opción 2: Manual en Firebase Console**
1. Ir a Firestore → Indexes
2. Click en "Create Index"
3. Seleccionar colección y campos
4. Configurar orden (Ascending/Descending)
5. Click en "Create"

**Opción 3: Archivo `firestore.indexes.json` (recomendado para producción)**
```json
{
  "indexes": [
    {
      "collectionGroup": "matches",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "scheduledTime", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "matches",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "round", "order": "ASCENDING" },
        { "fieldPath": "scheduledTime", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "predictions",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "submittedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "predictions",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "matchId", "order": "ASCENDING" },
        { "fieldPath": "points", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "predictions",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "matchId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "groups",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "adminUid", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "groups",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "isActive", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Para usar este archivo con Firebase CLI:
```bash
firebase deploy --only firestore:indexes
```

---

## 2) Firebase: configuración

### 2.1 Proyecto Firebase

#### Paso a paso detallado:

1. **Crear proyecto:**
   - Ir a [Firebase Console](https://console.firebase.google.com/)
   - Click en "Add project" o "Crear un proyecto"
   - Nombre: `polla-mundial-2026` (o el que prefieras)
   - Click en "Continue"
   - **Desactivar Google Analytics** (opcional, no necesario para MVP)
   - Click en "Create project"
   - Esperar a que se cree (30-60 segundos)
   - Click en "Continue"

2. **Agregar app web:**
   - En el dashboard, click en el ícono `</>` (Web)
   - Nombre de la app: `polla-mundial-2026-web`
   - **NO marcar** "Also set up Firebase Hosting" (usamos GitHub Pages)
   - Click en "Register app"
   - **Copiar la configuración** (firebaseConfig) - la necesitarás para `src/lib/firebase.ts`
   - Click en "Continue to console"

3. **Habilitar Authentication:**
   - En el menú lateral, ir a "Build" → "Authentication"
   - Click en "Get started"
   - Click en "Email/Password"
   - Activar "Email/Password" (primer toggle)
   - **NO activar** "Email link (passwordless sign-in)" por ahora
   - Click en "Save"
   - (Opcional) Configurar dominio autorizado si usas dominio personalizado

4. **Habilitar Firestore:**
   - En el menú lateral, ir a "Build" → "Firestore Database"
   - Click en "Create database"
   - Seleccionar modo: **"Start in production mode"** (importante para usar reglas)
   - Click en "Next"
   - Seleccionar ubicación: Elegir la más cercana a tus usuarios
     - Ejemplos: `us-central1` (Iowa), `europe-west1` (Bélgica), `southamerica-east1` (São Paulo)
   - Click en "Enable"
   - Esperar a que se cree (30-60 segundos)

5. **Configurar reglas de seguridad:**
   - En Firestore Database, ir a la pestaña "Rules"
   - Copiar las reglas de la sección 2.2 de este plan
   - Click en "Publish"
   - Verificar que no haya errores de sintaxis

6. **Crear primera competición (opcional, se puede hacer después):**
   - Ir a Firestore Database → "Data"
   - Click en "Start collection"
   - Collection ID: `competitions`
   - Document ID: (generar automáticamente o usar un ID descriptivo)
   - Agregar campos según el modelo de datos de `competitions`
   - Nota: Esto se puede hacer después desde el panel admin

#### Configuración adicional (opcional):

- **Storage**: No necesario para MVP, pero si quieres agregar avatares de usuarios en el futuro
- **Functions**: Solo si decides usar Cloud Functions para cálculo de puntos (recomendado pero no obligatorio)
- **Analytics**: Opcional, útil para métricas de uso

### 2.2 Reglas de seguridad (Firestore Rules)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isGroupParticipant(groupId) {
      let group = get(/databases/$(database)/documents/groups/$(groupId));
      return request.auth.uid in group.data.participants || 
             request.auth.uid == group.data.adminUid;
    }
    
    function isGroupAdmin(groupId) {
      let group = get(/databases/$(database)/documents/groups/$(groupId));
      return request.auth.uid == group.data.adminUid;
    }
    
    function isMatchScheduled(matchId) {
      let match = get(/databases/$(database)/documents/matches/$(matchId));
      return match.data.status == 'scheduled';
    }
    
    function isBonusLocked(competitionId) {
      // Verificar si los pronósticos bonus están bloqueados para esta competición
      let competition = get(/databases/$(database)/documents/competitions/$(competitionId));
      let results = get(/databases/$(database)/documents/competitions/$(competitionId)/results/main);
      return results.data.isLocked || 
             (competition.data.bonusSettings.bonusLockDate != null && 
              competition.data.bonusSettings.bonusLockDate < request.time);
    }
    
    // ============================================
    // COMPETITIONS (lectura pública, escritura solo super admin)
    // ============================================
    match /competitions/{competitionId} {
      allow read: if true;  // Cualquiera puede leer competiciones
      allow write: if false;  // Solo super admin manual
      
      // Resultados de la competición
      match /results/{resultId} {
        allow read: if true;  // Lectura pública
        allow write: if false;  // Solo super admin manual
      }
    }
    
    // ============================================
    // MATCHES (lectura pública, escritura solo super admin)
    // ============================================
    match /matches/{matchId} {
      allow read: if true;  // Cualquiera puede leer partidos
      allow write: if false;  // Solo desde Cloud Functions o super admin manual
    }
    
    // ============================================
    // GROUPS
    // ============================================
    match /groups/{groupId} {
      // Leer: solo participantes y admin del grupo
      allow read: if isAuthenticated() && isGroupParticipant(groupId);
      
      // Crear: cualquier usuario autenticado
      allow create: if isAuthenticated() && 
                       request.resource.data.adminUid == request.auth.uid;
      
      // Actualizar: solo admin del grupo (pero no puede cambiar settings después de crear)
      allow update: if isAuthenticated() && isGroupAdmin(groupId) &&
                      // No permitir cambiar settings si ya existen
                      (!resource.data.exists() || 
                       resource.data.settings == request.resource.data.settings);
      
      // ============================================
      // PREDICTIONS (pronósticos de partidos)
      // ============================================
      match /predictions/{predictionId} {
        // Leer:
        // - El dueño siempre puede leer
        // - Cualquier participante puede leer si el partido ya inició
        allow read: if isAuthenticated() && isGroupParticipant(groupId) && (
          resource.data.userId == request.auth.uid ||
          !isMatchScheduled(resource.data.matchId)
        );
        
        // Crear/Actualizar:
        // - Solo el dueño
        // - Solo si el partido está scheduled
        allow create, update: if isAuthenticated() && 
                                 isGroupParticipant(groupId) &&
                                 request.resource.data.userId == request.auth.uid &&
                                 isMatchScheduled(request.resource.data.matchId);
        
        // No permitir eliminar (por integridad)
        allow delete: if false;
      }
      
      // ============================================
      // BONUS PREDICTIONS (pronósticos bonus)
      // ============================================
      match /bonusPredictions/{bonusId} {
        // Leer: todos los participantes del grupo
        allow read: if isAuthenticated() && isGroupParticipant(groupId);
        
        // Crear/Actualizar:
        // - Solo el dueño
        // - Solo si aún no se bloqueó (según configuración de la competición)
        allow create, update: if isAuthenticated() && 
                                 isGroupParticipant(groupId) &&
                                 request.resource.data.userId == request.auth.uid &&
                                 !isBonusLocked(get(/databases/$(database)/documents/groups/$(groupId)).data.competitionId);
        
        allow delete: if false;
      }
    }
    
    // ============================================
    // USERS
    // ============================================
    match /users/{userId} {
      // Leer: cualquier usuario autenticado (para ver nombres)
      allow read: if isAuthenticated();
      
      // Crear: solo el mismo usuario al registrarse
      allow create: if isAuthenticated() && request.auth.uid == userId;
      
      // Actualizar: solo el mismo usuario o admin de grupo (para agregar grupos)
      allow update: if isAuthenticated() && (
        request.auth.uid == userId ||
        // Permitir que admin agregue el grupo al array groups del usuario
        request.resource.data.groups.hasAny([groupId where isGroupAdmin(groupId)])
      );
    }
    
  }
}
```

---

## 3) Estructura de la aplicación

### 3.1 Rutas principales

```
/                          → Landing page / Login
/login                     → Login / Registro
/competitions               → Lista de competiciones disponibles (opcional)
/groups                     → Lista de grupos del usuario (primera pantalla después de login)
/groups/[groupId]           → Dashboard del grupo (menú: Pronósticos, Participantes, Configuración)
/groups/[groupId]/predictions  → Vista de pronósticos (partidos pasados, en curso, próximos)
/groups/[groupId]/participants → Tabla general de posiciones
/groups/[groupId]/settings    → Configuración del grupo (solo admin)
/admin                      → Panel super admin (crear/editar competiciones, partidos, resultados)
```

### 3.2 Componentes principales

```
src/
  components/
    react/
      AuthGuard.tsx              → Protege rutas que requieren autenticación
      GroupList.tsx              → Lista de grupos del usuario
      GroupDashboard.tsx         → Dashboard principal del grupo (con menú horizontal)
      PredictionsView.tsx        → Vista de pronósticos (partidos + tabla por partido)
      ParticipantsTable.tsx      → Tabla general de posiciones
      GroupSettings.tsx          → Configuración del grupo (solo admin)
      MatchCard.tsx              → Tarjeta de partido (con formulario de pronóstico)
      PredictionTable.tsx        → Tabla de pronósticos de un partido específico
      AdminPanel.tsx             → Panel super admin (CRUD partidos, resultados, bonus)
  lib/
    firebase.ts                  → Configuración Firebase
    auth.ts                      → Helpers de autenticación
    groups.ts                    → Helpers de grupos
    predictions.ts               → Helpers de pronósticos
    points-calculator.ts         → Lógica de cálculo de puntos
    utils.ts                     → Utilidades generales
  pages/
    index.astro                  → Landing / Login
    login.astro                  → Login / Registro
    groups/
      index.astro                → Lista de grupos
      [groupId].astro            → Dashboard del grupo
    admin/
      index.astro                → Panel super admin
```

---

## 4) Funcionalidades principales

### 4.1 Autenticación
- **Registro/Login**: Email y contraseña (Firebase Auth)
- **Primera pantalla después de login**: Lista de grupos del usuario
- **Si no tiene grupos**: Opción para crear grupo o unirse con código

### 4.2 Gestión de grupos

#### Crear grupo
- Usuario autenticado puede crear un grupo
- Seleccionar competición de la lista de competiciones activas
- Se genera código único automáticamente (ej: `PD-ABC123` - genérico, no específico de competición)
- El creador se convierte en admin
- Configurar puntos iniciales (no modificables después)
- Los puntos bonus disponibles dependen de la competición seleccionada

#### Unirse a grupo
- Ingresar código del grupo
- Se agrega el `uid` al array `participants` del grupo
- Se agrega el `groupId` al array `groups` del usuario

#### Lista de grupos
- Mostrar todos los grupos donde el usuario es participante o admin
- Mostrar nombre, código, número de participantes, estado (activo/inactivo)

### 4.3 Dashboard del grupo

**Menú horizontal superior:**
- **Pronósticos**: Vista principal de partidos y pronósticos
- **Participantes**: Tabla general de posiciones
- **Configuración**: Reglas de puntaje y bonus (solo admin)

#### Vista "Pronósticos"
- **Secciones:**
  1. **Próximos partidos**: Partidos con `status == "scheduled"` y `scheduledTime > now()`
     - Mostrar: equipos, fecha/hora, formulario para hacer pronóstico
     - Validación: recordar reglas antes del inicio
  2. **Partidos en curso**: Partidos con `status == "live"`
     - Mostrar: equipos, marcador actual, tabla de pronósticos del grupo
     - Tabla ordenada: más puntos arriba, menos abajo
  3. **Partidos finalizados**: Partidos con `status == "finished"`
     - Mostrar: equipos, resultado final, tabla de pronósticos del grupo
     - Tabla ordenada por puntos obtenidos

- **Tabla de pronósticos por partido:**
  - Columnas: Participante, Pronóstico (ej: "2-1"), Puntos obtenidos
  - Ordenar por puntos (descendente)
  - Solo visible cuando el partido ya inició (`status != "scheduled"`)

- **Pronósticos bonus:**
  - Sección separada para pronósticos bonus disponibles según la competición
  - Solo mostrar campos habilitados en `competitions.bonusSettings`
  - Solo visible si aún no se bloqueó (según fecha límite de la competición)
  - Formulario para ingresar pronósticos

#### Vista "Participantes"
- Tabla general de posiciones del grupo
- Columnas: Posición, Participante, Puntos totales, Partidos pronosticados
- Ordenar por puntos totales (descendente)
- Actualización en tiempo real con Firestore listeners

#### Vista "Configuración" (solo admin)
- Mostrar reglas de puntaje configuradas (solo lectura, no editables)
- Mostrar estado del grupo (activo/inactivo) - editable
- Gestión de participantes:
  - Lista de participantes actuales
  - Agregar participante (por código o email)
  - Remover participante (solo si no ha hecho pronósticos, o con confirmación)

### 4.4 Panel Super Admin

**Rutas protegidas:** Solo accesible para usuarios con rol de super admin (verificar en código o Firestore)

**Funcionalidades:**
1. **Gestión de competiciones:**
   - Crear competición: nombre, tipo, fechas, configuración de bonus
   - Editar competición: cambiar fechas, estado
   - Configurar qué pronósticos bonus están disponibles

2. **Gestión de partidos:**
   - Crear partido: seleccionar competición, equipos, fecha/hora, fase, grupo (si aplica)
   - Editar partido: cambiar fecha, equipos (solo si está scheduled)
   - Actualizar resultado: marcar marcador real, cambiar status (scheduled → live → finished)
   - Filtrar partidos por competición

3. **Gestión de resultados de competición:**
   - Configurar resultados reales: ganador, segundo, tercero, goleador, asistidor (según competición)
   - Bloquear pronósticos bonus (según fecha límite configurada)

4. **Vista de todos los grupos:**
   - Listar grupos por competición, participantes, estado

---

## 5) Cálculo de puntos

### 5.1 Lógica de cálculo

**Por partido:**
```typescript
function calculateMatchPoints(prediction, matchResult, settings) {
  let points = 0;
  let breakdown = {
    exactScore: 0,
    winner: 0,
    goalDifference: 0
  };
  
  const predDiff = prediction.team1Score - prediction.team2Score;
  const resultDiff = matchResult.team1Score - matchResult.team2Score;
  const predWinner = predDiff > 0 ? 1 : (predDiff < 0 ? 2 : 0);
  const resultWinner = resultDiff > 0 ? 1 : (resultDiff < 0 ? 2 : 0);
  
  // Marcador exacto (suma todo lo demás también)
  if (prediction.team1Score === matchResult.team1Score &&
      prediction.team2Score === matchResult.team2Score) {
    points += settings.pointsExactScore;
    breakdown.exactScore = settings.pointsExactScore;
    
    // Si hay puntos por ganador, también se suman
    if (settings.pointsWinner > 0 && resultWinner !== 0) {
      points += settings.pointsWinner;
      breakdown.winner = settings.pointsWinner;
    }
    
    // Si hay puntos por diferencia, también se suman
    if (settings.pointsGoalDifference && Math.abs(resultDiff) > 0) {
      points += settings.pointsGoalDifference;
      breakdown.goalDifference = settings.pointsGoalDifference;
    }
  } else {
    // Solo ganador
    if (predWinner === resultWinner && resultWinner !== 0) {
      points += settings.pointsWinner;
      breakdown.winner = settings.pointsWinner;
    }
    
    // Solo diferencia de goles (si aplica y no es empate)
    if (settings.pointsGoalDifference && 
        predDiff === resultDiff && resultDiff !== 0) {
      points += settings.pointsGoalDifference;
      breakdown.goalDifference = settings.pointsGoalDifference;
    }
  }
  
  return { points, breakdown };
}
```

### 5.2 Actualización en tiempo real

**Estrategia:**
- Cuando el super admin actualiza el resultado de un partido, se dispara un cálculo para todos los pronósticos de ese partido en todos los grupos
- Usar Cloud Functions (recomendado) o calcular en cliente cuando se detecta cambio en `matches`

**Cloud Function (recomendado):**
```javascript
// functions/index.js
exports.onMatchUpdated = functions.firestore
  .document('matches/{matchId}')
  .onUpdate(async (change, context) => {
    const newMatch = change.after.data();
    const oldMatch = change.before.data();
    
    // Solo calcular si el resultado cambió o el status cambió a "finished"
    if (newMatch.status === 'finished' && newMatch.result) {
      // Obtener todos los grupos
      const groupsSnapshot = await admin.firestore().collection('groups').get();
      
      for (const groupDoc of groupsSnapshot.docs) {
        const groupId = groupDoc.id;
        const settings = groupDoc.data().settings;
        
        // Obtener todos los pronósticos de este partido en este grupo
        const predictionsSnapshot = await admin.firestore()
          .collection('groups').doc(groupId)
          .collection('predictions')
          .where('matchId', '==', context.params.matchId)
          .get();
        
        // Calcular puntos para cada pronóstico
        for (const predDoc of predictionsSnapshot.docs) {
          const prediction = predDoc.data();
          const { points, breakdown } = calculateMatchPoints(
            prediction,
            newMatch.result,
            settings
          );
          
          // Actualizar el pronóstico con los puntos
          await predDoc.ref.update({
            points,
            pointsBreakdown: breakdown,
            calculatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }
    }
  });
```

**Alternativa (cliente):**
- Usar `onSnapshot` en `matches/{matchId}`
- Cuando cambia el resultado, calcular puntos para todos los pronósticos del grupo actual
- Menos eficiente pero funciona sin Cloud Functions

### 5.3 Cálculo de puntos totales

**Para tabla de participantes:**
- Sumar todos los `points` de los pronósticos del usuario en el grupo
- Sumar puntos de bonus predictions (si ya se calcularon)
- Ordenar por puntos totales descendente

**Query optimizada:**
```typescript
// Agrupar pronósticos por userId y sumar puntos
const predictionsSnapshot = await getDocs(
  collection(db, 'groups', groupId, 'predictions')
);

const userPoints: Record<string, number> = {};

predictionsSnapshot.forEach(doc => {
  const pred = doc.data();
  const userId = pred.userId;
  const points = pred.points || 0;
  userPoints[userId] = (userPoints[userId] || 0) + points;
});

// Agregar puntos de bonus
const bonusSnapshot = await getDocs(
  collection(db, 'groups', groupId, 'bonusPredictions')
);

bonusSnapshot.forEach(doc => {
  const bonus = doc.data();
  const userId = bonus.userId;
  const points = bonus.points || 0;
  userPoints[userId] = (userPoints[userId] || 0) + points;
});
```

---

## 6) Plan de implementación (fases)

### Fase 1: Setup y autenticación
- [ ] 1.1 Crear proyecto Astro + React
- [ ] 1.2 Configurar Firebase (Auth + Firestore)
- [ ] 1.3 Implementar login/registro
- [ ] 1.4 Crear componente `AuthGuard`
- [ ] 1.5 Configurar reglas de seguridad básicas

### Fase 2: Gestión de grupos
- [ ] 2.1 Crear estructura de datos en Firestore (colecciones)
- [ ] 2.2 Implementar creación de grupos
- [ ] 2.3 Implementar unirse a grupo (por código)
- [ ] 2.4 Crear vista de lista de grupos
- [ ] 2.5 Actualizar reglas de seguridad para grupos

### Fase 3: Dashboard del grupo
- [ ] 3.1 Crear layout del dashboard con menú horizontal
- [ ] 3.2 Implementar vista "Participantes" (tabla de posiciones)
- [ ] 3.3 Implementar vista "Configuración" (solo admin)
- [ ] 3.4 Crear helpers para cálculo de puntos

### Fase 4: Pronósticos de partidos
- [ ] 4.1 Crear componente `MatchCard` (mostrar partido + formulario)
- [ ] 4.2 Implementar formulario de pronóstico (solo si está scheduled)
- [ ] 4.3 Crear componente `PredictionTable` (tabla de pronósticos por partido)
- [ ] 4.4 Implementar vista "Pronósticos" (próximos, en curso, finalizados)
- [ ] 4.5 Implementar privacidad (no mostrar pronósticos hasta inicio del partido)
- [ ] 4.6 Actualizar reglas de seguridad para predictions

### Fase 5: Panel Super Admin
- [ ] 5.1 Crear ruta `/admin` protegida
- [ ] 5.2 Implementar CRUD de partidos
- [ ] 5.3 Implementar actualización de resultados
- [ ] 5.4 Implementar gestión de bonus globales
- [ ] 5.5 Implementar cálculo de puntos (Cloud Function o cliente)

### Fase 6: Pronósticos bonus
- [ ] 6.1 Crear formulario de pronósticos bonus
- [ ] 6.2 Implementar bloqueo antes de octavos
- [ ] 6.3 Integrar cálculo de puntos de bonus
- [ ] 6.4 Mostrar pronósticos bonus en vista de participantes

### Fase 7: Tiempo real y optimizaciones
- [ ] 7.1 Implementar listeners de Firestore para actualización en tiempo real
- [ ] 7.2 Optimizar queries con índices
- [ ] 7.3 Agregar loading states y manejo de errores
- [ ] 7.4 Testing básico de flujos principales

### Fase 8: Deploy y pulido
- [ ] 8.1 Configurar GitHub Pages
- [ ] 8.2 Configurar workflow de deploy
- [ ] 8.3 Validar reglas de seguridad en producción
- [ ] 8.4 Ajustes de UI/UX finales
- [ ] 8.5 Documentación básica

---

## 7) Consideraciones técnicas

### 7.1 Tiempo real con Firestore
- Usar `onSnapshot` para:
  - Partidos (cuando cambia resultado)
  - Pronósticos del grupo (para actualizar tablas)
  - Tabla de participantes (para ranking en tiempo real)

### 7.2 Optimización de queries
- Crear índices compuestos para queries frecuentes
- Limitar resultados cuando sea posible (paginación futura si hay muchos partidos)

### 7.3 Validaciones
- Validar que el usuario no pueda hacer pronóstico después de `scheduledTime`
- Validar formato de marcadores (números enteros >= 0)
- Validar que el admin no modifique settings después de crear grupo

### 7.4 Manejo de errores
- Mostrar mensajes claros cuando no se puede hacer pronóstico (partido iniciado)
- Manejar casos edge: usuario eliminado del grupo, grupo desactivado, etc.

---

## 8) Notas importantes

### 8.1 Privacidad de pronósticos
- **Crítico**: Los pronósticos solo son visibles para el dueño hasta que el partido inicie
- Usar reglas de seguridad estrictas
- Validar en cliente Y en servidor (reglas)

### 8.2 Integridad de la competencia
- Los `settings` del grupo no se pueden modificar después de crear
- Los pronósticos no se pueden eliminar
- Solo el super admin puede modificar resultados de partidos

### 8.3 Multi-grupo
- Un usuario puede estar en múltiples grupos
- Cada grupo es completamente independiente
- La primera pantalla después de login es la lista de grupos

### 8.4 Simplicidad
- No agregar complejidad innecesaria (no notificaciones, no gráficos, no modo espectador)
- Enfocarse en funcionalidad core: pronósticos, puntos, tablas

---

## 9) Estructura de archivos sugerida

```
polla-mundial-2026/
├── .github/
│   └── workflows/
│       └── deploy.yml
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   └── react/
│   │       ├── AuthGuard.tsx
│   │       ├── GroupList.tsx
│   │       ├── GroupDashboard.tsx
│   │       ├── PredictionsView.tsx
│   │       ├── ParticipantsTable.tsx
│   │       ├── GroupSettings.tsx
│   │       ├── MatchCard.tsx
│   │       ├── PredictionTable.tsx
│   │       └── AdminPanel.tsx
│   ├── lib/
│   │   ├── firebase.ts
│   │   ├── auth.ts
│   │   ├── groups.ts
│   │   ├── predictions.ts
│   │   ├── points-calculator.ts
│   │   └── utils.ts
│   ├── layouts/
│   │   └── Layout.astro
│   └── pages/
│       ├── index.astro
│       ├── login.astro
│       ├── groups/
│       │   ├── index.astro
│       │   └── [groupId].astro
│       └── admin/
│           └── index.astro
├── astro.config.mjs
├── package.json
├── tailwind.config.mjs
└── tsconfig.json
```

---

## 10) Setup inicial del proyecto

### 10.1 Crear repositorio en GitHub

1. **Ir a GitHub** y crear un nuevo repositorio:
   - Nombre: `polla-club`
   - Descripción: "Sistema de pronósticos deportivos entre amigos"
   - Visibilidad: Público (para GitHub Pages gratuito) o Privado (si tienes GitHub Pro)
   - **NO** inicializar con README, .gitignore o licencia (lo haremos manualmente)

2. **Copiar la URL del repositorio** (ej: `https://github.com/tu-usuario/polla-club.git`)

---

### 10.2 Crear proyecto local

```bash
# 1. Crear directorio del proyecto
mkdir polla-club
cd polla-club

# 2. Inicializar git
git init
git branch -M main

# 3. Crear proyecto Astro con React
npm create astro@latest . -- --template minimal --yes --install --git false --typescript strict --no-install

# 4. Instalar dependencias base
npm install

# 5. Agregar integraciones necesarias
npx astro add react tailwind --yes

# 6. Instalar Firebase
npm install firebase

# 7. Vincular con repositorio remoto
git remote add origin https://github.com/tu-usuario/polla-club.git
```

---

### 10.3 Configurar estructura base

#### 10.3.1 Crear archivos de configuración

**`.gitignore`**
```gitignore
# Dependencies
node_modules/

# Build output
dist/
.output/

# Environment variables
.env
.env.production

# Logs
*.log
npm-debug.log*

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Firebase
.firebase/
firebase-debug.log
```

**`package.json`** (actualizar scripts y metadata)
```json
{
  "name": "polla-club",
  "type": "module",
  "version": "0.1.0",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "astro": "astro"
  },
  "dependencies": {
    "astro": "^5.16.7",
    "firebase": "^12.7.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@astrojs/tailwind": "^5.1.0",
    "@astrojs/react": "^3.6.1",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.0.0"
  }
}
```

**`astro.config.mjs`** (configurar para GitHub Pages)
```javascript
// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  // Reemplazar con tu usuario/organización de GitHub
  site: 'https://tu-usuario.github.io',
  // Reemplazar con el nombre de tu repositorio
  base: '/polla-club/',
  integrations: [tailwind(), react()],
  output: 'static', // Importante: modo estático para GitHub Pages
});
```

**`tsconfig.json`** (verificar configuración)
```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  }
}
```

---

### 10.4 Crear proyecto Firebase

#### 10.4.1 En Firebase Console

1. **Ir a [Firebase Console](https://console.firebase.google.com/)**
2. **Crear nuevo proyecto:**
   - Nombre: `polla-club`
   - Desactivar Google Analytics (opcional, no necesario para MVP)
   - Click en "Crear proyecto"

3. **Agregar app web:**
   - Click en el ícono `</>` (Web)
   - Nombre de la app: `polla-club-web`
   - **NO** configurar Firebase Hosting (usamos GitHub Pages)
   - Click en "Registrar app"
   - **Copiar la configuración de Firebase** (firebaseConfig)

#### 10.4.2 Habilitar servicios

1. **Authentication:**
   - Ir a "Authentication" → "Get started"
   - Habilitar "Email/Password"
   - Click en "Email/Password" → Activar "Email/Password" → Guardar

2. **Firestore Database:**
   - Ir a "Firestore Database" → "Create database"
   - Modo: **Producción** (para usar reglas de seguridad)
   - Ubicación: Elegir la más cercana (ej: `us-central1`)
   - Click en "Enable"

3. **Reglas de seguridad:**
   - Ir a "Firestore Database" → "Rules"
   - Copiar las reglas del plan (sección 2.2)
   - Click en "Publish"

#### 10.4.3 Configurar Firebase en el proyecto

**Crear `src/lib/firebase.ts`:**
```typescript
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Reemplazar con tu configuración de Firebase
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "polla-club.firebaseapp.com",
  projectId: "polla-club",
  storageBucket: "polla-club.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;
```

**⚠️ IMPORTANTE:** 
- **NO** subir `firebase.ts` con las credenciales reales al repositorio público
- Usar variables de entorno o mantener el archivo local
- Para producción, las credenciales de Firebase son públicas por diseño (están en el cliente), pero es buena práctica no exponerlas innecesariamente

**Alternativa segura (variables de entorno):**

1. **Crear `.env`** (en `.gitignore`):
```env
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=polla-club.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=polla-club
VITE_FIREBASE_STORAGE_BUCKET=polla-club.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456
```

2. **Actualizar `src/lib/firebase.ts`:**
```typescript
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;
```

3. **Para GitHub Pages, configurar secrets:**
   - Ir a repositorio → Settings → Secrets and variables → Actions
   - Agregar cada variable como secret
   - Actualizar workflow para usar secrets (ver sección 10.6)

---

### 10.5 Configurar GitHub Pages

#### 10.5.1 Habilitar GitHub Pages

1. **Ir a repositorio → Settings → Pages**
2. **Source:** Deploy from a branch
3. **Branch:** `main` → `/ (root)`
4. **Click en "Save"**

#### 10.5.2 Crear workflow de deploy

**Crear `.github/workflows/deploy.yml`:**
```yaml
name: Deploy Astro to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build
        run: npm run build
        env:
          # Si usas variables de entorno, descomenta y configura secrets
          # VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          # VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          # VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          # VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
          # VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
          # VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
      
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
```

---

### 10.6 Estructura inicial de carpetas

```bash
# Crear estructura de directorios
mkdir -p src/components/react
mkdir -p src/lib
mkdir -p src/layouts
mkdir -p src/pages/groups
mkdir -p src/pages/admin
mkdir -p public
```

**Crear archivos base:**

**`src/layouts/Layout.astro`:**
```astro
---
interface Props {
  title?: string;
}

const { title = 'PollaClub' } = Astro.props;
---

<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="description" content="Sistema de pronósticos deportivos entre amigos" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="generator" content={Astro.generator} />
    <title>{title}</title>
  </head>
  <body>
    <slot />
  </body>
</html>
```

**`src/pages/index.astro`:**
```astro
---
import Layout from '../layouts/Layout.astro';
---

<Layout title="PollaClub">
  <main class="min-h-screen bg-gray-50 flex items-center justify-center">
    <div class="text-center">
      <h1 class="text-4xl font-bold text-gray-900 mb-4">
        PollaClub
      </h1>
      <p class="text-gray-600 mb-8">
        Sistema de pronósticos deportivos entre amigos
      </p>
      <a 
        href="/login" 
        class="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
      >
        Iniciar sesión
      </a>
    </div>
  </main>
</Layout>
```

**`public/favicon.svg`** (opcional, crear un favicon simple)

---

### 10.7 Primer commit y push

```bash
# Agregar todos los archivos
git add .

# Commit inicial
git commit -m "Initial commit: Setup proyecto Astro + React + Firebase"

# Push a main
git push -u origin main
```

**Verificar:**
- El workflow debería ejecutarse automáticamente
- Ir a repositorio → Actions para ver el progreso
- Una vez completado, la app estará disponible en: `https://tu-usuario.github.io/polla-club/`

---

### 10.8 Configurar dominio personalizado (opcional)

Si tienes un dominio:

1. **En GitHub Pages:**
   - Settings → Pages → Custom domain
   - Ingresar tu dominio (ej: `pollaclub.tudominio.com`)
   - Seguir instrucciones de DNS

2. **En Firebase (para Auth):**
   - Authentication → Settings → Authorized domains
   - Agregar tu dominio personalizado

---

### 10.9 Configurar primer super admin

Para que el panel `/admin` funcione, necesitas identificar al super administrador. Hay varias formas:

#### Opción 1: Lista hardcodeada (simple, para empezar)

**Crear `src/lib/admin.ts`:**
```typescript
// Lista de UIDs de super admins
export const SUPER_ADMIN_UIDS = [
  'tu-uid-de-firebase-auth', // Reemplazar con tu UID real
];

export function isSuperAdmin(uid: string | null): boolean {
  if (!uid) return false;
  return SUPER_ADMIN_UIDS.includes(uid);
}
```

**Obtener tu UID:**
1. Ejecutar la app localmente: `npm run dev`
2. Crear una cuenta de prueba en `/login`
3. Abrir consola del navegador
4. Ejecutar: `firebase.auth().currentUser.uid` (o usar el helper que crees)
5. Copiar el UID y agregarlo a la lista

#### Opción 2: Colección en Firestore (más flexible)

**Crear colección `admins` en Firestore:**
```typescript
// Estructura del documento
{
  uid: string,  // UID del usuario
  role: "super_admin",
  createdAt: timestamp
}
```

**Actualizar reglas de seguridad:**
```javascript
// Agregar helper
function isSuperAdmin() {
  let adminDoc = get(/databases/$(database)/documents/admins/$(request.auth.uid));
  return adminDoc != null && adminDoc.data.role == 'super_admin';
}

// En matches
match /matches/{matchId} {
  allow read: if true;
  allow write: if isSuperAdmin();
}
```

**Crear documento manualmente en Firestore:**
1. Ir a Firestore → Data
2. Crear colección `admins`
3. Document ID: tu UID de Firebase Auth
4. Campos:
   - `role` (string) → `"super_admin"`
   - `createdAt` (timestamp) → timestamp actual

#### Opción 3: Variable de entorno (recomendado para producción)

**En `.env`:**
```env
VITE_SUPER_ADMIN_EMAIL=tu-email@ejemplo.com
```

**En `src/lib/admin.ts`:**
```typescript
import { auth } from './firebase';

export async function isSuperAdmin(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  
  const superAdminEmail = import.meta.env.VITE_SUPER_ADMIN_EMAIL;
  return user.email === superAdminEmail;
}
```

**Recomendación:** Empezar con Opción 1 para desarrollo, migrar a Opción 2 o 3 para producción.

---

### 10.10 Verificación inicial

#### Checklist de setup:

**Repositorio y Git:**
- [ ] Repositorio creado en GitHub
- [ ] Proyecto local inicializado con Astro
- [ ] Git configurado y vinculado al remoto
- [ ] Primer commit realizado

**Firebase:**
- [ ] Proyecto Firebase creado
- [ ] App web registrada
- [ ] Authentication habilitado (Email/Password)
- [ ] Firestore creado (modo producción)
- [ ] Reglas de seguridad configuradas y publicadas
- [ ] Documento `globalBonusSettings/main` creado
- [ ] Índices creados (o planificados)
- [ ] Configuración Firebase agregada a `src/lib/firebase.ts`

**Proyecto local:**
- [ ] Dependencias instaladas (`npm install`)
- [ ] Estructura de carpetas creada
- [ ] Archivos base creados (`Layout.astro`, `index.astro`)
- [ ] `astro.config.mjs` configurado con `base` y `site`
- [ ] Variables de entorno configuradas (si aplica)

**GitHub Pages:**
- [ ] GitHub Pages habilitado en Settings
- [ ] Workflow `.github/workflows/deploy.yml` creado
- [ ] Primer push realizado
- [ ] Workflow ejecutado exitosamente
- [ ] App desplegada y accesible en la URL

**Super Admin:**
- [ ] Método de super admin elegido e implementado
- [ ] UID o email configurado

#### Pruebas básicas:

1. **Probar build local:**
   ```bash
   npm run build
   ```
   - Debe completarse sin errores
   - Verificar que `dist/` se haya creado

2. **Probar servidor de desarrollo:**
   ```bash
   npm run dev
   ```
   - Abrir `http://localhost:4321`
   - Verificar que la página carga
   - Verificar que no hay errores en consola

3. **Probar Firebase:**
   - Abrir consola del navegador
   - Verificar que no hay errores de Firebase
   - (Después de implementar auth) Probar login/registro

4. **Probar deploy:**
   - Hacer un cambio pequeño (ej: cambiar texto en `index.astro`)
   - Commit y push
   - Verificar que el workflow se ejecuta
   - Verificar que el cambio se refleja en la URL de GitHub Pages

---

### 10.11 Estructura de archivos completa inicial

Después del setup, tu proyecto debería verse así:

```
polla-club/
├── .github/
│   └── workflows/
│       └── deploy.yml
├── .gitignore
├── .env                    # (no en git, solo local)
├── astro.config.mjs
├── package.json
├── package-lock.json
├── tailwind.config.mjs
├── tsconfig.json
├── public/
│   └── favicon.svg
└── src/
    ├── components/
    │   └── react/
    │       └── (vacío por ahora)
    ├── lib/
    │   ├── firebase.ts      # ✅ Configurado
    │   ├── admin.ts         # ✅ Creado (super admin)
    │   └── (otros helpers se crearán después)
    ├── layouts/
    │   └── Layout.astro     # ✅ Creado
    └── pages/
        ├── index.astro     # ✅ Creado
        ├── login.astro     # (crear en Fase 1)
        ├── groups/
        │   ├── index.astro # (crear en Fase 2)
        │   └── [groupId].astro # (crear en Fase 3)
        └── admin/
            └── index.astro # (crear en Fase 5)
```

---

### 10.12 Comandos de verificación rápida

```bash
# Verificar que todo está instalado
npm list --depth=0

# Verificar configuración de Astro
npm run build

# Verificar TypeScript
npx tsc --noEmit

# Verificar que Firebase está configurado
# (abrir src/lib/firebase.ts y verificar que no hay errores)

# Verificar estructura de carpetas
tree -L 3 -I 'node_modules|dist|.astro' # (si tienes tree instalado)
# O usar: find src -type f
```

---

## 11) Comandos útiles durante el desarrollo

### 11.1 Desarrollo local

```bash
# Iniciar servidor de desarrollo
npm run dev

# Build para producción (local)
npm run build

# Preview del build local
npm run preview
```

### 11.2 Git workflow

```bash
# Ver estado
git status

# Agregar cambios
git add .

# Commit
git commit -m "Descripción del cambio"

# Push
git push origin main

# Ver logs
git log --oneline
```

### 11.3 Firebase (si instalas CLI)

```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Inicializar proyecto (solo si usas Firebase Hosting, no necesario para este proyecto)
firebase init

# Desplegar reglas de seguridad
firebase deploy --only firestore:rules

# Ver logs
firebase functions:log
```

---

## 12) Troubleshooting común

### 12.1 Problemas con GitHub Pages

**Error: 404 en rutas**
- Verificar que `base` en `astro.config.mjs` coincida con el nombre del repositorio
- Verificar que `output: 'static'` esté configurado

**Error: Build falla**
- Verificar que todas las dependencias estén en `package.json`
- Verificar que no haya errores de TypeScript
- Revisar logs en Actions

### 12.2 Problemas con Firebase

**Error: Permiso denegado**
- Verificar reglas de seguridad en Firestore
- Verificar que el usuario esté autenticado
- Revisar consola del navegador para errores específicos

**Error: Configuración no encontrada**
- Verificar que `firebase.ts` tenga la configuración correcta
- Verificar variables de entorno (si se usan)

### 12.3 Problemas de desarrollo

**Error: Módulo no encontrado**
- Ejecutar `npm install` nuevamente
- Verificar que las rutas de import sean correctas
- Limpiar cache: `rm -rf node_modules .astro && npm install`

**Error: TypeScript**
- Verificar `tsconfig.json`
- Ejecutar `npm run build` para ver errores completos

---

## 13) Próximos pasos después del setup

1. ✅ **Setup completado** (esta sección)
2. **Fase 1: Autenticación** (ver sección 6)
3. **Fase 2: Gestión de grupos**
4. **Fase 3: Dashboard del grupo**
5. **Fase 4: Pronósticos de partidos**
6. **Fase 5: Panel Super Admin**
7. **Fase 6: Pronósticos bonus**
8. **Fase 7: Tiempo real y optimizaciones**
9. **Fase 8: Deploy y pulido**

---

**Nota:** Este plan está diseñado para ser simple, profesional y enfocado en la funcionalidad core. Se puede iterar y mejorar según necesidades durante el desarrollo.
