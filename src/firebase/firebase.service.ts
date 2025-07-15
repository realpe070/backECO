import { Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private auth!: admin.auth.Auth;
  private db!: admin.firestore.Firestore;

  constructor(private configService: ConfigService) { }

  private validatePrivateKey(key: string): boolean {
    return key.startsWith('-----BEGIN PRIVATE KEY-----') &&
      key.endsWith('-----END PRIVATE KEY-----') &&
      key.includes('\n');
  }

  private normalizePrivateKey(key: string): string {
    const cleanKey = key.replace(/\\n/g, '\n').trim();
    if (!this.validatePrivateKey(cleanKey)) {
      throw new Error('Invalid private key format');
    }
    return cleanKey;
  }

  async onModuleInit() {
    try {
      this.logger.log('🔄 Inicializando Firebase...');

      const base64Config = this.configService.get<string>('FIREBASE_CONFIG_BASE64');
      if (!base64Config) {
        throw new Error('FIREBASE_CONFIG_BASE64 no está configurado');
      }

      const decodedConfig = Buffer.from(base64Config, 'base64').toString('utf8');
      const serviceAccount = JSON.parse(decodedConfig);

      serviceAccount.private_key = this.normalizePrivateKey(serviceAccount.private_key);

      if (!admin.apps.length) {
        this.logger.debug('📦 Creando nueva aplicación Firebase...');
        const app = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
        });

        this.auth = app.auth();
        this.db = app.firestore();

        // Verificar que auth se inicializó correctamente
        if (!this.auth || typeof this.auth.listUsers !== 'function') {
          throw new Error('Firebase Auth no se inicializó correctamente');
        }

        this.logger.log('✅ Firebase inicializado correctamente');

        // Verificar conectividad
        await this.auth.listUsers(1);
        this.logger.log('✅ Conexión a Firebase Auth verificada');
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
