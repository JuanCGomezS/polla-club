import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import axios from "axios";
import admin from "firebase-admin";

if (admin.apps.length === 0) {
    admin.initializeApp();
}

// REEMPLAZA ESTOS VALORES CON LOS DE TU PANEL DE META
const WHATSAPP_TOKEN = "EAAMXqaULMtABRF6oECq7Gxy0zCNKmTOscqNKrm9j3OmCTZBYBK7DCoBZChB4PAqFYgibVF9u8DnfWSY9g5s6sygZCZCCOvtOfM8q24kGckdkDzyf9a3XGySXYgGRZBbCYcwPyyLb29TNzdf4CU4FVflwGfJlXsquZCZBWc1UhAmvtSivkWuyFpG0oJb7K4lZCQZDZD";
const PHONE_NUMBER_ID = "977909532082603"; // El ID que sale en tu imagen
const VERSION = "v22.0";

type GroupData = {
    id: string;
    adminUid: string;
    participants?: string[];
    competitionId: string;
    settings: {
        pointsExactScore: number;
        pointsWinner: number;
        pointsGoalDifference?: number;
    };
};

type PredictionData = {
    id: string;
    userId: string;
    matchId: string;
    team1Score: number;
    team2Score: number;
    points?: number;
};

type MatchData = {
    id: string;
    result?: {
        team1Score: number;
        team2Score: number;
    };
};

function calculatePredictionPoints(
    prediction: PredictionData,
    matchResult: { team1Score: number; team2Score: number },
    settings: GroupData["settings"]
) {
    let points = 0;
    const predDiff = prediction.team1Score - prediction.team2Score;
    const resultDiff = matchResult.team1Score - matchResult.team2Score;
    const predWinner = predDiff > 0 ? 1 : predDiff < 0 ? 2 : 0;
    const resultWinner = resultDiff > 0 ? 1 : resultDiff < 0 ? 2 : 0;

    if (
        prediction.team1Score === matchResult.team1Score &&
        prediction.team2Score === matchResult.team2Score
    ) {
        points += settings.pointsExactScore;
        if (settings.pointsWinner > 0 && resultWinner !== 0) points += settings.pointsWinner;
        if (settings.pointsGoalDifference) points += settings.pointsGoalDifference;
        return points;
    }

    if (predWinner === resultWinner && resultWinner !== 0) points += settings.pointsWinner;
    if (settings.pointsGoalDifference && predDiff === resultDiff) points += settings.pointsGoalDifference;
    return points;
}

async function buildGroupLeaderboard(groupId: string) {
    const db = admin.firestore();
    const groupSnap = await db.collection("groups").doc(groupId).get();
    if (!groupSnap.exists) throw new Error(`Group not found: ${groupId}`);

    const group = { id: groupSnap.id, ...groupSnap.data() } as GroupData;
    const userIds = [...new Set([...(group.participants ?? []), group.adminUid].filter(Boolean))];

    const [matchesSnap, predictionsSnap, bonusSnap, usersSnap] = await Promise.all([
        db
            .collection("competitions")
            .doc(group.competitionId)
            .collection("matches")
            .where("status", "==", "finished")
            .get(),
        db.collection("groups").doc(groupId).collection("predictions").get(),
        db.collection("groups").doc(groupId).collection("bonusPredictions").get(),
        Promise.all(userIds.map((userId) => db.collection("users").doc(userId).get()))
    ]);

    const matches = new Map<string, MatchData>();
    matchesSnap.forEach((doc) => matches.set(doc.id, { id: doc.id, ...doc.data() } as MatchData));

    const totals = new Map<string, { matchPoints: number; bonusPoints: number; predictionsCount: number }>();
    userIds.forEach((userId) => totals.set(userId, { matchPoints: 0, bonusPoints: 0, predictionsCount: 0 }));

    predictionsSnap.forEach((doc) => {
        const prediction = { id: doc.id, ...doc.data() } as PredictionData;
        const match = matches.get(prediction.matchId);
        if (!match?.result) return;
        const total = totals.get(prediction.userId) ?? { matchPoints: 0, bonusPoints: 0, predictionsCount: 0 };
        total.matchPoints += calculatePredictionPoints(prediction, match.result, group.settings);
        total.predictionsCount += 1;
        totals.set(prediction.userId, total);
    });

    bonusSnap.forEach((doc) => {
        const bonus = doc.data() as { userId?: string; points?: number };
        if (!bonus.userId) return;
        const total = totals.get(bonus.userId) ?? { matchPoints: 0, bonusPoints: 0, predictionsCount: 0 };
        total.bonusPoints += bonus.points ?? 0;
        totals.set(bonus.userId, total);
    });

    const users = new Map<string, FirebaseFirestore.DocumentData>();
    usersSnap.forEach((snap) => {
        if (snap.exists) users.set(snap.id, snap.data() ?? {});
    });

    const entries = userIds.map((userId) => {
        const user = users.get(userId);
        const total = totals.get(userId) ?? { matchPoints: 0, bonusPoints: 0, predictionsCount: 0 };
        return {
            userId,
            userName: user?.displayName ?? `Usuario ${userId.substring(0, 8)}...`,
            avatarUrl: user?.avatarUrl ?? null,
            totalPoints: total.matchPoints + total.bonusPoints,
            predictionsCount: total.predictionsCount,
            rank: 0
        };
    });

    entries.sort((a, b) =>
        b.totalPoints !== a.totalPoints ? b.totalPoints - a.totalPoints : a.userName.localeCompare(b.userName)
    );
    entries.forEach((entry, index) => {
        entry.rank = index + 1;
    });

    await db.collection("groups").doc(groupId).collection("leaderboard").doc("main").set({
        entries,
        participantsCount: userIds.length,
        finishedMatchesCount: matches.size,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
}

export const refreshLeaderboards = onCall({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
    }

    const competitionId = String(request.data?.competitionId ?? "").trim();
    if (!competitionId) {
        throw new HttpsError("invalid-argument", "competitionId es requerido.");
    }

    const db = admin.firestore();
    const userSnap = await db.collection("users").doc(request.auth.uid).get();
    if (userSnap.data()?.superAdmin !== true) {
        throw new HttpsError("permission-denied", "No tienes permisos para actualizar tablas.");
    }

    const groupsSnap = await db.collection("groups").where("competitionId", "==", competitionId).get();
    for (const groupDoc of groupsSnap.docs) {
        await buildGroupLeaderboard(groupDoc.id);
    }

    logger.info("Leaderboards refreshed", {
        competitionId,
        groupsUpdated: groupsSnap.size,
        requestedBy: request.auth.uid
    });

    return { groupsUpdated: groupsSnap.size };
});

export const whatsappWebhook = onRequest({ invoker: "public" }, async (req, res) => {
    // 1. VALIDACIÓN GET (Ya la tienes bien)
    if (req.method === "GET") {
        const verifyToken = "polla-club-secret-token";
        if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === verifyToken) {
            res.status(200).send(req.query["hub.challenge"]);
            return;
        }
        res.sendStatus(403);
        return;
    }

    // 2. PROCESAMIENTO DE MENSAJES (POST)
    if (req.method === "POST") {
        const body = req.body;
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const message = value?.messages?.[0];

        if (message) {
            const from = message.from; // Teléfono del usuario
            const messageType = message.type;
            let userText = "";

            // Detectar si es texto o un botón
            if (messageType === "text") {
                userText = message.text.body.toLowerCase();
            } else if (messageType === "interactive") {
                userText = message.interactive.button_reply?.id || "";
            }

            // LÓGICA DE RESPUESTAS
            if (userText.includes("hola") || userText === "menu_principal") {
                await sendMenuPrincipal(from);
            } else if (userText === "ver_instrucciones" || userText.includes("instrucciones")) {
                await sendWhatsAppMessage(from, "¡Es muy fácil! ⚽\n\n1. Crea tu cuenta con tu correo.\n2. Adquiere tu plan preferido.\n3. ¡Invita a tus amigos con el link de la página y el código de tu grupo!");
            } else if (userText === "ver_planes" || userText.includes("planes")) {
                await sendWhatsAppMessage(from, "🏆 *Planes PollaClub* 🏆\n\n⚽️ Básico (hasta 5): $20.000\n⚽️ Amigos (hasta 15): $40.000\n⚽️ Pro (hasta 30): $60.000\n⚽️ Premium (hasta 50): $80.000\n\n¿Cuál se adapta mejor a tu parche?");
            } else if (userText === "ver_pagos" || userText.includes("pago")) {
                await sendWhatsAppMessage(from, "⚡ Para activar tu grupo, puedes realizar el pago por:\n\n🌀 *Bre-B:* 3013971483\n\nEnvía el comprobante por aquí para habilitarte de inmediato. 📩");
            } else {
                // Respuesta por defecto si no entiende
                await sendWhatsAppMessage(from, "No estoy seguro de cómo ayudarte con eso, pero puedes elegir una opción del menú escribiendo *Hola*.");
            }
        }

        res.status(200).send("EVENT_RECEIVED");
        return;
    }

    res.sendStatus(405);
});

// FUNCIÓN PARA ENVIAR TEXTO SIMPLE
async function sendWhatsAppMessage(to: string, text: string) {
    try {
        await axios.post(`https://graph.facebook.com/${VERSION}/${PHONE_NUMBER_ID}/messages`, {
            messaging_product: "whatsapp",
            to: to,
            type: "text",
            text: { body: text }
        }, {
            headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
        });
    } catch (error) {
        logger.error("Error enviando mensaje", error);
    }
}

// FUNCIÓN PARA ENVIAR MENÚ CON BOTONES (Interactivo)
async function sendMenuPrincipal(to: string) {
    try {
        await axios.post(`https://graph.facebook.com/${VERSION}/${PHONE_NUMBER_ID}/messages`, {
            messaging_product: "whatsapp",
            to: to,
            type: "interactive",
            interactive: {
                type: "button",
                header: { type: "text", text: "¡Bienvenido a PollaClub! 🏟️" },
                body: { text: "Aquí demostramos quién sabe de verdad. ¿Qué quieres hacer hoy?" },
                footer: { text: "Selecciona una opción:" },
                action: {
                    buttons: [
                        { type: "reply", reply: { id: "ver_instrucciones", title: "Instrucciones ⚽" } },
                        { type: "reply", reply: { id: "ver_planes", title: "Ver Planes 🏆" } },
                        { type: "reply", reply: { id: "ver_pagos", title: "Formas de Pago ⚡" } }
                    ]
                }
            }
        }, {
            headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
        });
    } catch (error) {
        logger.error("Error enviando menú", error);
    }
}
