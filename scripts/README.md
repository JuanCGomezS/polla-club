# Scripts de Utilidad

## Seed Database (`seed.ts`)

Script para poblar Firestore con datos iniciales del Mundial 2026.

### Uso

```bash
npm run seed
```

### Requisitos

1. Tener un archivo `.env` en la raíz del proyecto con las variables de Firebase:
   ```
   VITE_FIREBASE_API_KEY=tu_api_key
   VITE_FIREBASE_AUTH_DOMAIN=tu_auth_domain
   VITE_FIREBASE_PROJECT_ID=tu_project_id
   VITE_FIREBASE_STORAGE_BUCKET=tu_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=tu_messaging_sender_id
   VITE_FIREBASE_APP_ID=tu_app_id
   ```

2. Tener las reglas de Firestore configuradas (ver `lib/firestore.rules`)

### Qué crea el script

- **1 Competición**: "Mundial 2026"
  - Tipo: `world_cup`
  - Fechas: 11 de junio - 19 de julio 2026
  - Estado: `upcoming`
  - Bonus settings: ganador, subcampeón, tercer lugar, máximo goleador
  - Fecha límite bonus: 28 de junio (antes de octavos)

- **1 Documento de resultados**: Para la competición (vacío, listo para llenar)

- **72 Partidos**: Fase de grupos completa
  - 12 grupos (A-L)
  - 48 equipos
  - 3 jornadas por grupo
  - 6 partidos por grupo (4 equipos × 3 partidos cada uno / 2)
  - Fechas distribuidas del 11 al 30 de junio 2026
  - Todos en estado `scheduled`

### Grupos del Mundial 2026

- **Grupo A**: México, Sudáfrica, República de Corea, Ganador Repechaje D
- **Grupo B**: Canadá, Ganador Repechaje A, Catar, Suiza
- **Grupo C**: Brasil, Marruecos, Haití, Escocia
- **Grupo D**: Estados Unidos, Paraguay, Australia, Ganador Repechaje C
- **Grupo E**: Alemania, Curazao, Costa de Marfil, Ecuador
- **Grupo F**: Países Bajos, Japón, Ganador Repechaje B, Túnez
- **Grupo G**: Bélgica, Egipto, Irán, Nueva Zelanda
- **Grupo H**: España, Cabo Verde, Arabia Saudita, Uruguay
- **Grupo I**: Francia, Senegal, Ganador Repechaje Grupo 2, Noruega
- **Grupo J**: Argentina, Argelia, Austria, Jordania
- **Grupo K**: Portugal, Ganador Repechaje Grupo 1, Uzbekistán, Colombia
- **Grupo L**: Inglaterra, Croacia, Ghana, Panamá

### Notas

- El script es **idempotente**: puedes ejecutarlo múltiples veces, pero sobrescribirá los datos existentes
- Los partidos están configurados con fechas simuladas entre el 11 y 30 de junio 2026
- Los ganadores de repechaje aparecen como "Ganador Repechaje X" y pueden actualizarse después cuando se conozcan
- Puedes modificar el script para agregar más datos (octavos, cuartos, semifinales, final) según necesites
