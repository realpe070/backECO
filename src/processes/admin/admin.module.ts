import { Module } from '@nestjs/common';
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

@Module({
  imports: [FirebaseModule],
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
    PlansService,
    HistoryService,
    NotificationPlanService,
    ProcessGroupService,
    ProcessUploadService,
    SyncService,
  ],
  exports: [AdminService, PlansService, HistoryService, NotificationPlanService, ProcessGroupService, ProcessUploadService, SyncService],
})
export class AdminModule { }
