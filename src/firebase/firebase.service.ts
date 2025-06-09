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
      // Obtener y formatear la clave privada
      let privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

      // Asegurarse de que la clave privada tenga el formato correcto
      if (privateKey) {
        privateKey = privateKey
          .replace(/\\n/g, '\n')
          .replace(/\"/g, '')
          .trim();
      }

      // Configuración de Firebase
      const config = {
        type: 'service_account',
        projectId: this.configService.get<string>('FIREBASE_PROJECT_ID'),
        clientEmail: this.configService.get<string>('FIREBASE_CLIENT_EMAIL'),
        privateKey
      };

      // Validación más detallada de la configuración
      if (!config.privateKey) {
        throw new Error('Firebase private key is missing');
      }
      if (!config.clientEmail) {
        throw new Error('Firebase client email is missing');
      }
      if (!config.projectId) {
        throw new Error('Firebase project ID is missing');
      }

      // Verificar formato de la clave privada
      if (!config.privateKey.includes('BEGIN PRIVATE KEY') || !config.privateKey.includes('END PRIVATE KEY')) {
        throw new Error('Invalid private key format');
      }

      // Inicializar Firebase
      if (!admin.apps.length) {
        const app = admin.initializeApp({
          credential: admin.credential.cert(config as admin.ServiceAccount)
        });

        this.auth = app.auth();
        this.db = app.firestore();

        // Verificar conexión
        await this.auth.listUsers(1);
        this.logger.log('✅ Firebase initialized successfully');
        this.logger.debug(`📦 Connected to project: ${config.projectId}`);
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
