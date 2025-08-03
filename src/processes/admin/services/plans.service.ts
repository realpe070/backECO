import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../../../firebase/firebase.service';
import { CreatePlanDto } from '../dto/create-plan.dto';

@Injectable()
export class PlansService {
    private readonly logger = new Logger(PlansService.name);

    constructor(private readonly firebaseService: FirebaseService) { }

    async createPlan(createPlanDto: CreatePlanDto) {
        try {
            this.logger.debug('Creando nuevo plan:');
            this.logger.debug(JSON.stringify(createPlanDto));

            const db = this.firebaseService.getFirestore();
            const planRef = db.collection('plans');

            // Convert to plain object for Firestore
            const planData = createPlanDto.toFirestore();

            const docRef = await planRef.add(planData);

            return {
                id: docRef.id,
                ...planData
            };
        } catch (error) {
            this.logger.error('Error creando plan:', error);
            throw error;
        }
    }
}
