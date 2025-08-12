import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { AdminController } from './admin.controller';
import { AdminService } from './services_admin/admin.service';
import { FirebaseModule } from '../../firebase/firebase.module';
import { DriveService } from '../../services/drive.service';
import { ActivitiesController } from './controllers/activities.controller';
import { PlansController } from './controllers/plans.controller';
import { PlansService } from './services_admin/plans.service';
import { HistoryController } from './controllers/history.controller';
import { HistoryService } from './services_admin/history.service';
import { NotificationPlanController } from './controllers/notification-plan.controller';
import { NotificationPlanService } from './services_admin/notification-plan.service';
import { ProcessGroupsController } from './controllers/process-groups.controller';
import { ProcessGroupService } from './services_admin/process-group.service';
import { ProcessUploadController } from './controllers/process-upload.controller';
import { ProcessUploadService } from './services_admin/process-upload.service';
import { SyncService } from '../../services/sync.service';
import { ActivitiesService } from './services_admin/activities.service';

@Module({
  imports: [
    FirebaseModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [
    AdminController,
    ActivitiesController,
    PlansController,
    HistoryController,
    NotificationPlanController,
    ProcessGroupsController,
    ProcessUploadController,
  ],
  providers: [
    AdminService,
    DriveService,
    ActivitiesService,
    PlansService,
    HistoryService,
    NotificationPlanService,
    ProcessGroupService,
    ProcessUploadService,
    SyncService,
    {
      provide: 'CLEANUP_SCHEDULE',
      useFactory: (notificationPlanService: NotificationPlanService) => {
        // Ejecutar limpieza cada día a las 00:00
        const job = new CronJob('0 0 * * *', () => {
          notificationPlanService
            .cleanExpiredPlans()
            .catch(error => console.error('Error en limpieza programada:', error));
        });
        job.start();
        return job;
      },
      inject: [NotificationPlanService],
    },
  ],
  exports: [AdminService, PlansService, HistoryService, NotificationPlanService, ProcessGroupService, ProcessUploadService, SyncService],
})
export class AdminModule { }
