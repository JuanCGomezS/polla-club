# Firebase Cloud Functions - PollaClub

Cloud Functions para automatizar notificaciones y cálculos.

## 🚀 Setup

```bash
npm install
```

## 📦 Funciones disponibles

### `notifyMatchStarting`
- **Trigger:** Programada cada 5 minutos
- **Descripción:** Notifica a usuarios cuando un partido inicia en ≤15 minutos, solo si no han hecho pronóstico
- **Plan requerido:** Spark (gratis) ✅

## 🛠️ Desarrollo local

```bash
npm run serve
```

## 🚢 Deploy

```bash
npm run build
firebase deploy --only functions
```

## 📊 Ver logs

```bash
npm run logs
```
