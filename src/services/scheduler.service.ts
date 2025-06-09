import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(private readonly firebaseService: FirebaseService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async activateScheduledProcesses() {
    try {
      const db = this.firebaseService.getFirestore();
      const now = new Date();
      
      // Get all scheduled processes that should be active
      const snapshot = await db
        .collection('processes')
        .where('status', '==', 'scheduled')
        .where('startDate', '<=', now.toISOString())
        .get();

      const batch = db.batch();
      
      for (const doc of snapshot.docs) {
        batch.update(doc.ref, { 
          status: 'active',
          updatedAt: now.toISOString()
        });
      }

      await batch.commit();
      
      this.logger.log(`Activated ${snapshot.size} scheduled processes`);
    } catch (error) {
      this.logger.error('Error activating scheduled processes:', error);
    }
  }
}
