import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './processes/user/user.module';
import { AuthModule } from './processes/auth/auth.module';
import { FirebaseModule } from './firebase/firebase.module';
import { AdminModule } from './processes/admin/admin.module';
import { HealthController } from './controllers/health.controller';
import { HealthAppController } from './controllers/health-app.controller';
import { NetworkInfoController } from './controllers/network-info.controller';
import { DriveService } from './services/drive.service';
import { DriveController } from './controllers/drive.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AdminModule,
    FirebaseModule,
    UserModule,
    AuthModule,
  ],
  controllers: [
    HealthController,
    HealthAppController,
    NetworkInfoController,
    DriveController
  ],
  providers: [
    DriveService,
  ],
})
export class AppModule { }
