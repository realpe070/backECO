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
      this.logger.log('🔄 Inicializando Firebase...');

      const serviceAccount = {
        type: "service_account",
        project_id: this.configService.get('FIREBASE_PROJECT_ID'),
        private_key_id: this.configService.get('FIREBASE_PRIVATE_KEY_ID'),
        private_key: this.configService.get('FIREBASE_PRIVATE_KEY'),
        client_email: this.configService.get('FIREBASE_CLIENT_EMAIL'),
        client_id: this.configService.get('FIREBASE_CLIENT_ID'),
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: this.configService.get('FIREBASE_CLIENT_CERT_URL'),
      };

      if (!admin.apps.length) {
        const app = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount as admin.ServiceAccount)
        });

        this.auth = app.auth();
        this.db = app.firestore();

        this.logger.log('✅ Firebase inicializado correctamente');
      }

    } catch (error) {
      this.logger.error('❌ Error inicializando Firebase:', error);
      throw error;
    }
  }

  getAuth(): admin.auth.Auth {
    if (!this.auth || typeof this.auth.listUsers !== 'function') {
      this.logger.error('❌ Firebase Auth no está inicializado correctamente');
      throw new Error('Firebase Auth no está inicializado o configurado correctamente');
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
