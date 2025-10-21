import * as admin from 'firebase-admin';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';


@Injectable()
export class NotifierService {
  constructor(private readonly configService: ConfigService) {
    if (!admin.apps.length) {
      const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
      const clientEmail = this.configService.get<string>(
        'FIREBASE_CLIENT_EMAIL',
      );
      let privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

      if (!projectId || !clientEmail || !privateKey) {
        throw new Error('❌ Faltan variables de entorno para Firebase');
      }

      privateKey = privateKey.replace(/\\n/g, '\n');

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }
  }
  private readonly logger = new Logger(NotifierService.name);

  @Cron('*/5 * * * *', {
    timeZone: 'America/Bogota', // ajusta a tu zona
  })
  async handleDailyNotifications() {
    const db = admin.firestore();
    const now = new Date();
    this.logger.debug('⏰ Cron cada 5 minutos:', new Date().toISOString());
    // Fecha de hoy en formato YYYY-MM-DD
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const fechaHoy = `${yyyy}-${mm}-${dd}T00:00:00.000`;

    // Hora actual en formato HH:mm
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes(),
    ).padStart(2, '0')}`;

    this.sendNotification(fechaHoy, currentTime, db, now);
    this.sendActiviesNotifications(fechaHoy, currentTime, db, now);
  }

  private async sendNotification(
    fechaHoy: string,
    currentTime: string,
    db: FirebaseFirestore.Firestore,
    now: Date,
  ) {
    console.log(`⏰ Verificando planes para: ${fechaHoy} a las ${currentTime}`);

    const snapshot = await db
      .collection('notificationPlans')
      .where('isActive', '==', true)
      .where('startDate', '<=', fechaHoy)
      .where('endDate', '>=', fechaHoy)
      .get();

    let planesToDesactivar: string[] = [];

    for (const doc of snapshot.docs) {
      const plan = doc.data();
      const planId = doc.id;
      const cronograma = plan.assignedPlans || [];

      let tokens: string[] = [];

      for (const fecha in cronograma) {
        if (cronograma.hasOwnProperty(fecha)) {
          const planes = cronograma[fecha];
          this.logger.log(`🔔 Procesando plan: ${fecha}`);
          this.logger.log(`🔔 Plan details: ${fechaHoy}`);
          for (const p of planes) {
            if (fecha === fechaHoy) {
              // ----  calcular una hora antes ----
              const [h, m] = p.time.split(':').map(Number);
              const planDate = new Date();
              planDate.setHours(h, m, 0, 0);
              planDate.setHours(planDate.getHours() - 1); // restar 1 hora

              // --- calcular una hora antes en joirnada de la tarde ---
              const [h2, m2] = p.timeSecond.split(':').map(Number);
              const planDateSecond = new Date();
              planDateSecond.setHours(h2, m2, 0, 0);
              planDateSecond.setHours(planDateSecond.getHours() - 1); // restar 1 hora

              const planTimeMinusOneHour = `${String(
                planDate.getHours(),
              ).padStart(
                2,
                '0',
              )}:${String(planDate.getMinutes()).padStart(2, '0')}`;

              this.logger.log(
                `🔔 Plan time (1h before): ${planTimeMinusOneHour}`,
              );

              const planTimeSecondOneHour = `${String(
                planDateSecond.getHours(),
              ).padStart(
                2,
                '0',
              )}:${String(planDateSecond.getMinutes()).padStart(2, '0')}`;

              this.logger.log(
                `🔔 Plan time second (1h before): ${planTimeSecondOneHour}`,
              );

              // Si la hora actual coincide con la hora - 1h → enviar
              // Si la hora actual coincide con la hora - 1h o la hora - 6h → enviar

              const diffInMinutes = (timeA: string, timeB: string) => {
                const [hA, mA] = timeA.split(':').map(Number);
                const [hB, mB] = timeB.split(':').map(Number);
                return Math.abs(hA * 60 + mA - (hB * 60 + mB));
              };

              if (
                diffInMinutes(currentTime, planTimeMinusOneHour) <= 5 ||
                diffInMinutes(currentTime, planTimeSecondOneHour) <= 5
              ) {
                console.log(
                  `🚀 Ejecutando plan ${p.id}: notificación ${currentTime === planTimeMinusOneHour ? '1h' : '6h'
                  } antes (${p.time})`,
                );

                // Buscar usuarios del grupo
                let usersSnap = await db
                  .collection('users')
                  .where('groupId', '==', p.group)
                  .get();

                const userRefs = usersSnap.docs.map((d) => d.id);

                this.logger.log(
                  `Found ${userRefs.length} users for group ${p.group}.`,
                );

                // Filtrar usuarios que tienen pausas activas hoy entre las 8:00 y las 23:00
                const currentHourStr = `${this.pad(now.getHours())}:${this.pad(now.getMinutes())}`; // Ej: "09:05"

                this.logger.log(`Current hour string: ${currentHourStr}`);

                const userPauseSnap = await db
                  .collection('notificationPauses')
                  .where('idUser', 'in', userRefs)
                  .where('notifiActive', '==', true)
                  .where('dateStart', '<=', currentHourStr) // dateStart <= currentHourStr
                  .where('dateEnd', '>=', currentHourStr) // dateEnd >= currentHourStr
                  .get();

                this.logger.log(
                  `Found ${userPauseSnap.docs.length} active pauses for users.`,
                );

                // Solo considerar usuarios que tienen pausas activas en el rango horario actual
                const pausedUsers = userPauseSnap.docs.map(
                  (doc) => doc.data().idUser,
                );

                this.logger.log(
                  `Found ${pausedUsers.length} paused users for group ${p.group}.`,
                );
                const usersDisponibles = userRefs.filter((id) =>
                  pausedUsers.includes(id),
                );

                this.logger.log(
                  `Found ${usersDisponibles.length} active users for group ${p.group}.`,
                );

                for (const userId of usersDisponibles) {
                  const devicesSnap = await db
                    .collection('devices')
                    .where('userId', '==', userId)
                    .get();

                  this.logger.log(
                    `Found ${devicesSnap.docs.length} devices for user ${userId}.`,
                  );

                  devicesSnap.forEach((d) => {
                    const device = d.data();
                    if (device.deviceToken) tokens.push(device.deviceToken);
                  });
                }

                if (tokens.length === 0) {
                  console.log(`⚠️ Plan ${p.id} no tiene tokens para enviar`);
                  continue;
                }

                const dataDay = plan.endDate.split('-')[2];
                const dataDay2 = plan.startDate.split('-')[2];

                let bodyMessage = '';

                if (
                  currentTime >= planTimeMinusOneHour &&
                  currentTime < planTimeSecondOneHour
                )
                  bodyMessage = `⏰ En 1 hora tienes ${p.name} (${p.time}) disponible del ${dataDay2.split('T')[0]} al ${dataDay.split('T')[0]}.`;
                if (
                  currentTime >= planTimeSecondOneHour &&
                  currentTime > planTimeMinusOneHour
                )
                  bodyMessage = `⏰ En 1 hora tienes ${p.name} (${p.timeSecond}) disponible del ${dataDay2.split('T')[0]} al ${dataDay.split('T')[0]}.`;

                const message = {
                  notification: {
                    title: `Realiza las actividades de ${p.name} 🏋️‍♂️`,
                    body: bodyMessage,
                  },
                  data: {
                    customKey: '',
                  },
                  tokens,
                };

                planesToDesactivar.push(p.id);

                const response = await admin
                  .messaging()
                  .sendEachForMulticast(message);
                const successCount = response.responses.filter(
                  (r) => r.success,
                ).length;
                console.log(`✅ Plan ${p.id}: enviados ${successCount}`);
              }
            }
          }
        }
      }

      // Desactivar planes vencidos
      // Desactivar planes si la fecha de hoy es igual o posterior a la fecha de finalización
      const fechaHoyDate = new Date(fechaHoy);
      const endDateDate = new Date(plan.endDate + 'T00:00:00.000');
      if (fechaHoyDate > endDateDate) {
        await db.collection('notificationPlans').doc(planId).update({
          isActive: false,
        });

        console.log(`Desactivando planes: ${planesToDesactivar.join(', ')}`);
        for (const id of planesToDesactivar) {
          await db.collection('plans').doc(id).update({
            estado: false,
          });
          console.log(`❌ Plan ${id} desactivado (ya venció)`);
        }
      }
    }
  }

  private async sendActiviesNotifications(
    fechaHoy: string,
    currentTime: string,
    db: FirebaseFirestore.Firestore,
    now: Date,
  ) {
    console.log(
      `⏰ Verificando actividades para: ${fechaHoy} a las ${currentTime}`,
    );
    // Obtener todas las actividades disponibles
    const snapshot = await db.collection('exercises').get();
    const actividades = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as { nombre?: string }),
    }));


    // Obtener las frecuencias programadas de notificación
    const programadosFrecuencias = await db
      .collection('notificationPauses')
      .where('notifiActive', '==', true) // Solo activas
      .where('frecuencia', '>', '0') // Solo con frecuencia válida
      .get();


    for (const doc of programadosFrecuencias.docs) {
      const frecuenciaData = doc.data();
      const userId = frecuenciaData.idUser;
      const frecuenciaHoras = frecuenciaData.frecuencia; // frecuencia en horas (int)
      const notifiActive = frecuenciaData.notifiActive;

      if (!notifiActive || !frecuenciaHoras) continue;

      // Calcular si corresponde enviar notificación en este momento
      // Ejemplo: si frecuencia = 3, enviar cada 3 horas desde las 8:00 hasta las 23:00
      const horaInicio = parseInt(frecuenciaData.dateStart.split(':')[0]); // "02:00" -> 2
      const horaFin = parseInt(frecuenciaData.dateEnd.split(':')[0]); // "19:00" -> 19
      const horaActual = now.getHours();
      const minutosActuales = now.getMinutes();

      // Verificar si la hora actual está dentro del rango
      if (horaActual < horaInicio || horaActual > horaFin) {
        this.logger.log(`⏭️ Usuario ${userId}: Fuera del rango horario`);
        continue;
      }

      const horasTranscurridas = horaActual - horaInicio;
      const esHoraDeEnvio = horasTranscurridas % frecuenciaHoras === 0;
      const esMinutoValido = minutosActuales <= 4; // Enviar en los primeros 5 minutos de la hora

      if (esHoraDeEnvio && esMinutoValido) {
        this.logger.log(`🚀 Enviando notificación a usuario: ${userId}`);

        // Seleccionar una actividad aleatoria
        const actividadAleatoria =
          actividades[Math.floor(Math.random() * actividades.length)];

        this.logger.log(`🎯 Actividad seleccionada: ${actividadAleatoria?.nombre || 'Desconocida'}`);

        // Buscar los dispositivos del usuario
        const devicesSnap = await db
          .collection('devices')
          .where('userId', '==', userId)
          .get();


        const tokens: string[] = [];
        devicesSnap.forEach((d) => {
          const device = d.data();
          if (device.deviceToken) {
            tokens.push(device.deviceToken);
            this.logger.log(`🔑 Token agregado para ${userId}: ${device.deviceToken.substring(0, 20)}...`);
          }
        });

        if (tokens.length === 0) {
          this.logger.warn(`⚠️ Usuario ${userId}: No hay tokens de dispositivos disponibles`);
          continue;
        }

        // Enviar notificación
        const message = {
          notification: {
            title: `¡Hora de moverse! 💪`,
            body: `Tienes una actividad pendiente: ${actividadAleatoria?.nombre || 'Apresúrate a hacer ejercicio'}.`,
          },
          data: {
            actividadId: actividadAleatoria?.id || '',
            type: 'activity_reminder',
            timestamp: now.toISOString(),
          },
          tokens,
        };

        try {
          const response = await admin.messaging().sendEachForMulticast(message);
          const successCount = response.responses.filter((r) => r.success).length;
          const failureCount = response.responses.filter((r) => !r.success).length;

          this.logger.log(
            `✅ Notificación enviada a ${userId}: ${successCount} éxitos, ${failureCount} fallos`
          );

          // Log de errores específicos
          response.responses.forEach((resp, index) => {
            if (!resp.success) {
              this.logger.error(`❌ Error enviando a token ${index}: ${resp.error?.message}`);
            }
          });

        } catch (error) {
          this.logger.error(`❌ Error enviando notificación a ${userId}:`, error);
        }
      } else {
        this.logger.log(`⏭️ Usuario ${userId}: No es momento de enviar (hora: ${esHoraDeEnvio}, minuto: ${esMinutoValido})`);
      }
    }
  }

  private pad(num: number): string {
    return num.toString().padStart(2, '0');
  }
}
