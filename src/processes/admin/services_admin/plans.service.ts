import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { FirebaseService } from '../../../firebase/firebase.service';
import { CreatePlanDto, Plan } from '../dto/plan.dto';

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(private readonly firebaseService: FirebaseService) { }

  async createPlan(createPlanDto: CreatePlanDto): Promise<Plan> {
    try {
      this.logger.debug('Creando nuevo plan:');
      this.logger.debug(JSON.stringify(createPlanDto));

      const db = this.firebaseService.getFirestore();
      const planRef = db.collection('plans');

      const planData = createPlanDto.toFirestore();
      const docRef = await planRef.add(planData);

      return {
        id: docRef.id,
        ...planData
      } as Plan;
    } catch (error) {
      this.logger.error('Error creando plan:', error);
      throw error;
    }
  }

  async getPlans(): Promise<Plan[]> {
    try {
      const db = this.firebaseService.getFirestore();
      const snapshot = await db.collection('plans')
        .orderBy('createdAt', 'desc')
        .get();

      // Obtener detalles de las actividades para cada plan
      const plans = await Promise.all(snapshot.docs.map(async doc => {
        const planData = doc.data();
        const activities = planData.activities || [];

        // Obtener detalles de cada actividad
        const activitiesWithDetails = await Promise.all(
          activities.map(async (activity: any) => {
            const activityDoc = await db
              .collection('activities')
              .doc(activity.activityId)
              .get();

            if (activityDoc.exists) {
              return {
                ...activity,
                details: activityDoc.data()
              };
            }
            return activity;
          })
        );

        return {
          id: doc.id,
          ...planData,
          activities: activitiesWithDetails
        } as Plan;
      }));

      return plans;
    } catch (error) {
      this.logger.error('Error obteniendo planes:', error);
      throw error;
    }
  }

  async updatePlan(id: string, updatePlanDto: CreatePlanDto): Promise<Plan> {
    try {
      this.logger.debug('Actualizando plan:', { id, data: updatePlanDto });

      // Validate activities
      if (!id) {
        throw new BadRequestException('El ID del plan es requerido');
      }

      if (updatePlanDto.activities.some(activity => !activity.activityId)) {
        throw new BadRequestException('Todas las actividades deben tener un ID válido');
      }

      const db = this.firebaseService.getFirestore();
      const planRef = db.collection('plans').doc(id);

      // Verify plan exists
      const planDoc = await planRef.get();
      if (!planDoc.exists) {
        throw new BadRequestException('Plan no encontrado');
      }

      // Verify all activities exist
      const activitiesRef = db.collection('activities');
      const activityIds = updatePlanDto.activities.map(a => a.activityId);

      const activityDocs = await Promise.all(
        activityIds.map(actId => activitiesRef.doc(actId).get())
      );

      if (activityDocs.some(doc => !doc.exists)) {
        throw new BadRequestException('Una o más actividades no existen');
      }

      const now = new Date().toISOString();
      const planData = {
        ...updatePlanDto,
        updatedAt: now,
      };

      await planRef.update(planData);

      return {
        id,
        ...planData,
      } as Plan;
    } catch (error) {
      this.logger.error('Error actualizando plan:', error);
      throw error;
    }
  }
}
