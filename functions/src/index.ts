import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Inicializar Firebase Admin
admin.initializeApp();

/**
 * Cloud Function programada: Notificar partidos que empiezan en 15 minutos o menos
 * .schedule('0 12,18,22 * * *')
 * .timeZone('America/Bogota')
 */
export const notifyMatchStarting = functions.pubsub
  .schedule('every 5 minutes')
  .timeZone('UTC')
  .onRun(async () => {
    const startTime = Date.now();
    console.log('🚀 Iniciando notifyMatchStarting...');

    try {
      const now = admin.firestore.Timestamp.now();
      const in15Minutes = admin.firestore.Timestamp.fromMillis(
        now.toMillis() + 15 * 60 * 1000
      );


      // 1. Obtener todas las competiciones
      const competitionsSnapshot = await admin
        .firestore()
        .collection('competitions')
        .get();


      let matchesForNotification: Array<{doc: FirebaseFirestore.DocumentSnapshot; competitionId: string}> = [];

      // 2. Para cada competición, buscar sus matches
      for (const compDoc of competitionsSnapshot.docs) {
        const competitionId = compDoc.id;

        const matchesSnapshot = await compDoc.ref
          .collection('matches')
          .where('scheduledTime', '>=', now)
          .where('scheduledTime', '<=', in15Minutes)
          .where('status', '==', 'scheduled')
          .get();

        console.log(`  └─ Encontrados ${matchesSnapshot.size} partidos en rango`);
        matchesSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          const scheduledTime = data.scheduledTime?.toDate?.() || data.scheduledTime;
          console.log(`    - Partido ${doc.id}: ${data.team1} vs ${data.team2}, hora: ${scheduledTime}, status: ${data.status}`);
          matchesForNotification.push({doc, competitionId});
        });
      }

      if (matchesForNotification.length === 0) {
        console.log('✅ No hay partidos próximos en los siguientes 15 minutos');
        return { success: true, matchesChecked: 0 };
      }

      console.log(`📋 Encontrados ${matchesForNotification.length} partidos próximos`);

      let totalNotificationsSent = 0;

      // 3. Para cada partido encontrado
      for (const {doc: matchDoc, competitionId} of matchesForNotification) {
        const match = matchDoc.data() as FirebaseFirestore.DocumentData;
        const matchId = matchDoc.id;

        console.log(
          `⚽ Procesando partido: ${match.team1} vs ${match.team2} (ID: ${matchId})`
        );

        // 4. Buscar grupos de esta competición
        const groupsSnapshot = await admin
          .firestore()
          .collection('groups')
          .where('competitionId', '==', competitionId)
          .where('isActive', '==', true)
          .get();

        console.log(
          `  📂 Encontrados ${groupsSnapshot.size} grupos activos para esta competición`
        );

        // 5. Para cada grupo
        for (const groupDoc of groupsSnapshot.docs) {
          const group = groupDoc.data();
          const groupId = groupDoc.id;
          const participants = group.participants || [];

          if (participants.length === 0) {
            console.log(`  ⚠️  Grupo ${groupId} sin participantes`);
            continue;
          }

          // 6. Buscar pronósticos de este partido en este grupo
          const predictionsSnapshot = await groupDoc.ref
            .collection('predictions')
            .where('matchId', '==', matchId)
            .get();

          const predictedUserIds = predictionsSnapshot.docs.map(
            (doc) => doc.data().userId
          );

          // 7. Identificar usuarios SIN pronóstico
          const usersWithoutPrediction = participants.filter(
            (uid: string) => !predictedUserIds.includes(uid)
          );

          if (usersWithoutPrediction.length === 0) {
            console.log(
              `  ✅ Todos los participantes del grupo ${groupId} ya hicieron pronóstico`
            );
            continue;
          }

          console.log(
            `  📤 ${usersWithoutPrediction.length} usuarios sin pronóstico en grupo ${groupId}`
          );

          // 8. Enviar notificación a cada usuario sin pronóstico
          for (const userId of usersWithoutPrediction) {
            try {
              // Obtener tokens FCM del usuario
              const userDoc = await admin
                .firestore()
                .collection('users')
                .doc(userId)
                .get();

              if (!userDoc.exists) {
                console.log(`    ⚠️  Usuario ${userId} no encontrado`);
                continue;
              }

              const userData = userDoc.data();
              const fcmTokens = userData?.fcmTokens || [];

              if (fcmTokens.length === 0) {
                console.log(
                  `    ⚠️  Usuario ${userData?.displayName || userId} sin tokens FCM`
                );
                continue;
              }

              // Calcular minutos restantes
              const minutesLeft = Math.round(
                (match.scheduledTime.toMillis() - now.toMillis()) / 60000
              );

              // Construir mensaje
              const message = {
                notification: {
                  title: '⚽ ¡Partido por empezar!',
                  body: `${match.team1} vs ${match.team2} en ${minutesLeft} minutos. ¡Haz tu pronóstico!`,
                },
                data: {
                  matchId: matchId,
                  groupId: groupId,
                  type: 'match_reminder',
                },
                webpush: {
                  fcmOptions: {
                    link: `${process.env.WEBAPP_URL || 'https://juancgomezs.github.io/polla-club'}/groups/${groupId}`,
                  },
                },
                tokens: fcmTokens,
              };

              // Enviar notificación
              const response = await admin.messaging().sendEachForMulticast(message);

              console.log(
                `    ✅ Notificación enviada a ${userData?.displayName || userId}: ${response.successCount} éxito, ${response.failureCount} fallos`
              );

              totalNotificationsSent += response.successCount;

              // Limpiar tokens inválidos
              if (response.failureCount > 0) {
                const tokensToRemove: string[] = [];
                response.responses.forEach((resp, idx) => {
                  if (!resp.success) {
                    tokensToRemove.push(fcmTokens[idx]);
                  }
                });

                if (tokensToRemove.length > 0) {
                  await userDoc.ref.update({
                    fcmTokens: admin.firestore.FieldValue.arrayRemove(
                      ...tokensToRemove
                    ),
                  });
                  console.log(
                    `    🗑️  Eliminados ${tokensToRemove.length} tokens inválidos`
                  );
                }
              }
            } catch (error) {
              console.error(
                `    ❌ Error enviando notificación a ${userId}:`,
                error
              );
            }
          }
        }
      }

      const duration = Date.now() - startTime;
      console.log(
        `✅ Proceso completado en ${duration}ms. Notificaciones enviadas: ${totalNotificationsSent}`
      );

      return {
        success: true,
        matchesChecked: matchesForNotification.length,
        notificationsSent: totalNotificationsSent,
        duration,
      };
    } catch (error) {
      console.error('❌ Error en notifyMatchStarting:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
