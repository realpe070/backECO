import { Module } from '@nestjs/common';
import { UserService } from './services/user.service';
import { UserController } from './controllers/user.controller';
import { UserActivitiesController } from './controllers/activities.controller';
import { FirebaseModule } from '../../firebase/firebase.module';
import { SyncService } from '../../services/sync.service';

@Module({
  imports: [FirebaseModule],
  controllers: [UserController, UserActivitiesController],
  providers: [UserService, SyncService],
})
export class UserModule {}
