import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserActivitiesController } from './activities.controller';
import { SyncService } from 'src/procesos_cargados/process-sync.service';
import { UserService } from './user.service';
import { FirebaseModule } from '@firebase/firebase.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';
import { MailService } from './email.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule, // 👈 asegúrate de importar ConfigModule
    FirebaseModule,
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        transport: {
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: {
            user: configService.get<string>('ADMIN_EMAIL'),
            pass: configService.get<string>('ADMIN_PASS'),
          },
          connectionTimeout: 10000, // 10 segundos
          greetingTimeout: 5000, // 5 segundos
          socketTimeout: 10000, // 10 segundos
          pool: true, // Usar pool de conexiones
          maxConnections: 3, // Máximo 3 conexiones simultáneas
          maxMessages: 100, // Máximo 100 mensajes por conexión
        },
        defaults: {
          from: '"EcoBreak App" <noreply@ecobreak.com>',
        },
        template: {
          dir: join(__dirname, './templates/'),
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
    }),
  ],
  controllers: [UserController, UserActivitiesController],
  providers: [UserService, SyncService, MailService],
  exports: [UserService],
})
export class UserModule {}
