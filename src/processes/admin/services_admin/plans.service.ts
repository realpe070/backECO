import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { FirebaseService } from '../../../firebase/firebase.service';
import { CreatePlanDto, Plan } from '../dto/plan.dto';
import { PlanActivityDto } from '../dto/plan-activity.dto';

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(private readonly firebaseService: FirebaseService) { }

  async createPlan(createPlanDto: CreatePlanDto): Promise<Plan> {
    try {
      this.logger.debug(JSON.stringify(createPlanDto));

      const db = this.firebaseService.getFirestore();
      const planRef = db.collection('plans');

      const now = new Date().toISOString();

      // Crear actividades con el constructor de PlanActivityDto
      const activities = createPlanDto.activities.map(activity =>
        new PlanActivityDto(activity.activityId, activity.order)
      );

      const planData = {
        name: createPlanDto.name,
        description: createPlanDto.description,
        activities: activities.map(activity => activity.toJSON()),
        createdAt: now,
        updatedAt: now,
        status: 'active'
      };

      const docRef = await planRef.add(planData);

      return {
        id: docRef.id,
        name: planData.name,
        description: planData.description,
        activities: activities,
        createdAt: planData.createdAt,
        updatedAt: planData.updatedAt,
        status: planData.status
      };
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

      if (!id) {
        throw new BadRequestException('El ID del plan es requerido');
      }

      const db = this.firebaseService.getFirestore();
      const planRef = db.collection('plans').doc(id);

      // Verify plan exists
      const planDoc = await planRef.get();
      if (!planDoc.exists) {
        throw new BadRequestException('Plan no encontrado');
      }

      const now = new Date().toISOString();

      // Crear actividades con el constructor de PlanActivityDto
      const activities = updatePlanDto.activities.map(activity =>
        new PlanActivityDto(activity.activityId, activity.order)
      );

      const planData = {
        name: updatePlanDto.name,
        description: updatePlanDto.description,
        activities: activities.map(activity => activity.toJSON()),
        updatedAt: now,
      };

      await planRef.update(planData);
      const existingData = planDoc.data();

      return {
        id,
        ...planData,
        createdAt: existingData?.createdAt || now,
        status: existingData?.status || 'active'
      } as Plan;
    } catch (error) {
      this.logger.error('Error actualizando plan:', error);
      throw error;
    }
  }

  async deletePlan(id: string): Promise<void> {
    try {
      this.logger.debug('Eliminando plan:', id);

      if (!id) {
        throw new BadRequestException('El ID del plan es requerido');
      }

      const db = this.firebaseService.getFirestore();
      const planRef = db.collection('plans').doc(id);

      // Verificar que el plan existe
      const planDoc = await planRef.get();
      if (!planDoc.exists) {
        throw new BadRequestException('Plan no encontrado');
      }

      // Eliminar el plan
      await planRef.delete();

      this.logger.debug('Plan eliminado exitosamente');
    } catch (error) {
      this.logger.error('Error eliminando plan:', error);
      throw error;
    }
  }
}
