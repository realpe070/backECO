import { Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private auth!: admin.auth.Auth;
  private db!: admin.firestore.Firestore;

  constructor(private configService: ConfigService) { }

  async onModuleInit() {
    try {
      const keyPath = path.join(__dirname, '..', '..', 'config', 'firebase-key.json');
      this.logger.debug(`📁 Loading Firebase config from: ${keyPath}`);

      // Leer directamente del archivo .env
      const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
      const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
      const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');

      if (!privateKey || !clientEmail || !projectId) {
        throw new Error('Missing Firebase configuration in .env');
      }

      const serviceAccount = {
        projectId,
        clientEmail,
        private_key: privateKey.replace(/\\n/g, '\n')
      };

      if (!admin.apps.length) {
        const app = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount as admin.ServiceAccount)
        });

        this.auth = app.auth();
        this.db = app.firestore();
        this.logger.log('✅ Firebase initialized with env credentials');
      } else {
        this.auth = admin.auth();
        this.db = admin.firestore();
      }

      // Verificar la conexión
      await this.auth.listUsers(1);
      this.logger.log('✅ Firebase connection verified');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('❌ Firebase connection error:', errorMessage);
      if (error instanceof Error && error.stack) {
        this.logger.error('Stack trace:', error.stack);
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
