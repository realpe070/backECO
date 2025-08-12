import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../../firebase/firebase.service';

@Injectable()
export class ActivitiesService {
    private readonly logger = new Logger(ActivitiesService.name);

    constructor(private readonly firebaseService: FirebaseService) { }

    async deleteActivity(id: string): Promise<void> {
        try {
            this.logger.debug(`🗑️ Eliminando actividad: ${id}`);
            const db = this.firebaseService.getFirestore();
            const activityRef = db.collection('activities').doc(id);

            // Verificar que la actividad existe
            const doc = await activityRef.get();
            if (!doc.exists) {
                throw new NotFoundException(`Actividad con ID ${id} no encontrada`);
            }

            // Eliminar la actividad
            await activityRef.delete();
            this.logger.log(`✅ Actividad ${id} eliminada exitosamente`);
        } catch (error) {
            this.logger.error('❌ Error eliminando actividad:', error);
            throw error;
        }
    }

    async deleteMultipleActivities(ids: string[]): Promise<void> {
        try {
            this.logger.debug(`🗑️ Eliminando múltiples actividades: ${ids.length}`);
            const db = this.firebaseService.getFirestore();
            const batch = db.batch();

            // Verificar y preparar eliminación de actividades
            for (const id of ids) {
                const activityRef = db.collection('activities').doc(id);
                const doc = await activityRef.get();

                if (!doc.exists) {
                    this.logger.warn(`⚠️ Actividad ${id} no encontrada`);
                    continue;
                }

                batch.delete(activityRef);
            }

            // Ejecutar eliminación en batch
            await batch.commit();
            this.logger.log(`✅ ${ids.length} actividades eliminadas exitosamente`);
        } catch (error) {
            this.logger.error('❌ Error eliminando múltiples actividades:', error);
            throw error;
        }
    }
}