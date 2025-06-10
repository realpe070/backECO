import { Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private auth!: admin.auth.Auth;
  private db!: admin.firestore.Firestore;

  constructor(private configService: ConfigService) { }

  async onModuleInit() {
    try {
      // Obtener y decodificar la configuración
      const base64Config = this.configService.get<string>('FIREBASE_CONFIG_BASE64');

      if (!base64Config) {
        throw new Error('FIREBASE_CONFIG_BASE64 is not set');
      }

      const serviceAccount = JSON.parse(
        Buffer.from(base64Config, 'base64').toString('utf8')
      );

      // Inicializar Firebase
      if (!admin.apps.length) {
        const app = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });

        this.auth = app.auth();
        this.db = app.firestore();

        // Verificar conexión
        await this.auth.listUsers(1);
        this.logger.log('✅ Firebase initialized successfully');
        this.logger.debug(`📦 Connected to project: ${serviceAccount.project_id}`);
      } else {
        this.auth = admin.auth();
        this.db = admin.firestore();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('❌ Firebase initialization error:', errorMessage);
      if (error instanceof Error && error.stack) {
        this.logger.debug('Stack trace:', error.stack);
      }
      throw error;
    }
  }

  getAuth(): admin.auth.Auth {
    if (!this.auth) {
      throw new Error('Firebase auth not initialized');
    }
    return this.auth;
  }

  getFirestore(): admin.firestore.Firestore {
    if (!this.db) {
      throw new Error('Firebase Firestore not initialized');
    }
    return this.db;
  }

  async verifyToken(token: string) {
    try {
      if (!token || !token.startsWith('Bearer ')) {
        throw new UnauthorizedException('Token no proporcionado o formato inválido');
      }

      const tokenId = token.split('Bearer ')[1];
      this.logger.debug(`🔍 Verificando token: ${tokenId.substring(0, 20)}...`);

      const decodedToken = await this.auth.verifyIdToken(tokenId);
      return {
        uid: decodedToken.uid,
        email: decodedToken.email,
        role: decodedToken.email === this.configService.get('ADMIN_EMAIL') ? 'admin' : 'user',
      };
    } catch (error) {
      this.logger.error('❌ Error verificando token:', error);
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}
