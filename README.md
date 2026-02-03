# PollaClub - Sistema de Pronósticos Deportivos

Un sistema web completo para organizar pronósticos deportivos entre amigos. Crea grupos, haz predicciones de partidos y compite en tablas de posiciones en tiempo real.

## 🎯 ¿Qué es PollaClub?

PollaClub es una plataforma que permite a grupos de amigos:
- **Crear grupos independientes** para cualquier competición deportiva (Mundial, Copa América, Champions League, etc.)
- **Hacer pronósticos privados** de resultados de partidos antes de que comiencen
- **Competir en tablas de posiciones** actualizadas en tiempo real
- **Ganar puntos** según la precisión de sus predicciones
- **Configurar reglas personalizadas** de puntaje para cada grupo

### Características principales

✅ **Multi-competición**: Soporta simultáneamente múltiples competiciones deportivas  
✅ **Grupos independientes**: Cada grupo gestiona su propia comunidad y reglas  
✅ **Tiempo real**: Actualizaciones instantáneas con Firestore listeners  
✅ **Privacidad**: Pronósticos ocultos hasta que el partido inicia  
✅ **Puntos automáticos**: Cálculo en tiempo real según resultados  
✅ **Pronósticos bonus**: Predicciones especiales configurables por competición  
✅ **Autenticación segura**: Login con email y contraseña (Firebase Auth)  

---

## 🛠️ Stack Tecnológico

### Frontend
- **Astro** - Framework web estático con renderizado híbrido
- **React** - Componentes interactivos (18+)
- **TypeScript** - Tipado estático
- **Tailwind CSS** - Estilos utilitarios
- **Vite** - Bundler rápido

### Backend & Base de datos
- **Firebase Firestore** - Base de datos NoSQL en tiempo real
- **Firebase Authentication** - Gestión de usuarios (Email/Password)

### Deployment
- **GitHub Pages** - Hosting estático gratuito
- **GitHub Actions** - CI/CD automático
- **Environment Secrets** - Variables de entorno seguras

### Desarrollo
- **tsx** - Ejecutor de scripts TypeScript
- **Firebase Admin SDK** - Scripts de migración y administración

---

## 📋 Requisitos previos

- **Node.js** 18+ y **npm** 9+
- **Cuenta en Firebase** (gratis)
- **Cuenta en GitHub** (para deploy automático)

---

## 🚀 Instalación y Setup Local

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/polla-club.git
cd polla-club
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Crea un archivo `.env` en la raíz del proyecto con tu configuración de Firebase:

```env
# Firebase Configuration
PUBLIC_FIREBASE_API_KEY=tu_api_key
PUBLIC_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
PUBLIC_FIREBASE_PROJECT_ID=tu-proyecto
PUBLIC_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef123456
```

**Para obtener estas credenciales:**
1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Settings → Project settings → Your apps → Web app
4. Copia la configuración y guárdala en `.env`

### 4. Ejecutar en desarrollo

```bash
npm run dev
```

La app estará disponible en `http://localhost:4321`

### 5. Build para producción

```bash
npm run build
```

---

## 🌐 Despliegue automático con GitHub Pages

El proyecto está configurado con **GitHub Actions** para deploy automático en cada push a `main`.


## 📖 Uso de la plataforma

### Para usuarios regulares

#### 1. Registro e inicio de sesión
- Ve a `/login`
- Crea una cuenta con email y contraseña
- O inicia sesión si ya tienes cuenta

#### 2. Crear un grupo
- Click en "Crear grupo"
- Selecciona la competición
- Configura las reglas de puntaje
- Se genera un código automáticamente para invitar amigos

#### 3. Unirse a un grupo
- Click en "Unirse a grupo"
- Ingresa el código del grupo
- ¡Listo! Ya estás en la competencia

#### 4. Hacer pronósticos
- En el grupo, ve a "Pronósticos"
- Selecciona un partido
- Ingresa tu predicción (ej: 2-1)
- Click "Guardar"
- **Nota:** Los pronósticos se bloquean cuando el partido inicia

#### 5. Ver tabla de posiciones
- Click en "Participantes"
- Verás el ranking con puntos de todos los jugadores
- Se actualiza en tiempo real

### Reglas de puntuación

El sistema calcula puntos automáticamente según:

#### Por acertar resultado exacto
- **Acertar goles exactos**: 3 puntos (ej: predices 2-1, resultado 2-1)

#### Por acertar ganador
- **Acertar ganador**: 1 puntos (ej: predices 3-1, resultado 2-1)
- **Acertar empate**: 1 puntos (ej: predices 1-1, resultado 2-2)

#### Pronósticos incompletos
- **No acertar ganador**: 0 puntos

**Ejemplo:**
- Predicción: 2-1, Resultado: 2-1 → **3 puntos** ✅
- Predicción: 2-1, Resultado: 3-1 → **1 puntos** (acertó ganador)
- Predicción: 2-1, Resultado: 1-1 → **0 puntos** ❌

### Pronósticos Bonus

Algunas competiciones incluyen predicciones bonus (ej: goleador del torneo, finalista):
- Se configuran por competición
- Se bloquean antes de fases eliminatorias
- Cada predicción correcta suma puntos según competición

---

## 🔒 Reglas de seguridad

### Privacidad de pronósticos

- ✅ **Antes del partido**: Solo el autor ve su pronóstico
- 🔓 **Después de iniciar**: Todos los del grupo ven los pronósticos
- 🔒 **No editable**: Una vez hecho el pronóstico, no se puede cambiar

### Integridad de datos

- Pronósticos no se pueden eliminar
- Configuración del grupo no se puede editar después de crear
- Solo administradores pueden remover participantes
- Solo super admin actualiza resultados de partidos

### Permisos por rol

| Acción | Participante | Admin | Super Admin |
|--------|--------------|-------|------------|
| Hacer pronósticos | ✅ | ✅ | ✅ |
| Ver tabla de posiciones | ✅ | ✅ | ✅ |
| Agregar participantes | ❌ | ✅ | ✅ |
| Remover participantes | ❌ | ✅ | ✅ |
| Cambiar settings grupo | ❌ | ❌ | ✅ |
| Crear competiciones | ❌ | ❌ | ✅ |
| Actualizar resultados | ❌ | ❌ | ✅ |

---

## 🏗️ Estructura de carpetas

```
polla-club/
├── .github/
│   └── workflows/
│       └── deploy.yml           # Workflow de GitHub Actions
├── lib/
│   ├── firebase-rules.js        # Reglas de seguridad de Firestore
│   └── firestore.ts            # (migrado a src/lib/)
├── public/
│   └── team-font.jpg           # Imagen de placeholder
├── scripts/
│   ├── migrate-matches-to-competitions.ts
│   ├── migrate-prediction-match-ids.ts
│   └── README.md               # Documentación de scripts
├── src/
│   ├── components/
│   │   └── react/
│   │       ├── AuthGuard.tsx
│   │       ├── MatchCard.tsx
│   │       ├── PredictionsView.tsx
│   │       ├── GroupDashboard.tsx
│   │       ├── GroupLeaderboard.tsx
│   │       └── ...
│   ├── lib/
│   │   ├── firebase.ts         # Inicialización de Firebase
│   │   ├── auth.ts             # Autenticación
│   │   ├── groups.ts           # Gestión de grupos
│   │   ├── predictions.ts      # Pronósticos
│   │   ├── matches.ts          # Partidos
│   │   ├── points.ts           # Cálculo de puntos
│   │   ├── types.ts            # TypeScript types
│   │   └── utils.ts            # Utilidades
│   ├── pages/
│   │   ├── index.astro
│   │   ├── login.astro
│   │   └── groups/
│   │       ├── index.astro
│   │       ├── create.astro
│   │       ├── dashboard.astro
│   │       └── [groupId]/...
│   └── layouts/
│       └── Layout.astro
├── astro.config.mjs
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🔧 Configuración de Firebase

### Colecciones principales

- **`competitions`**: Competiciones disponibles (gestionadas por super admin)
- **`matches`**: Partidos de cada competición
- **`groups`**: Grupos de usuarios
- **`groups/{groupId}/predictions`**: Pronósticos por grupo
- **`groups/{groupId}/bonusPredictions`**: Pronósticos bonus por grupo
- **`users`**: Perfiles de usuarios

### Reglas de seguridad

Las reglas de seguridad están definidas en `lib/firestore-rules.js` y se publican automáticamente en Firestore. Garantizan:

- Autenticación obligatoria
- Privacidad de pronósticos antes de iniciar partido
- Prevención de edición de datos críticos
- Bloqueo de escrituras después de fechas límite

Para actualizar las reglas:
1. Edita `lib/firestore-rules.js`
2. Cópialas manualmente a Firebase Console → Firestore → Rules
3. Haz click en "Publish"

---

## 📝 Licencia

Este proyecto está bajo licencia MIT. Ver [LICENSE](LICENSE) para más detalles.

---

## 👨‍💻 Desarrollo

### Contribuir

1. Fork el repositorio
2. Crea una rama para tu feature: `git checkout -b feature/mi-feature`
3. Haz commit de tus cambios: `git commit -am 'Add my feature'`
4. Push a la rama: `git push origin feature/mi-feature`
5. Abre un Pull Request

Si encuentras problemas:
1. Abre un [issue en GitHub](https://github.com/tu-usuario/polla-club/issues)

---

**¡Que disfrutes tu experiencia con PollaClub! ⚽**
