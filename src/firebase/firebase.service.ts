import { Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private auth!: admin.auth.Auth;
  private db!: admin.firestore.Firestore;

  constructor(private configService: ConfigService) { }

  private formatPrivateKey(key: string): string {
    // Remove all whitespace and newlines
    const cleanKey = key.replace(/\s/g, '');

    // Add proper newlines and format
    const formatted = [
      '-----BEGIN PRIVATE KEY-----',
      ...cleanKey.match(/.{1,64}/g) || [],
      '-----END PRIVATE KEY-----'
    ].join('\n');

    return formatted;
  }

  async onModuleInit() {
    try {
      this.logger.log('🔄 Inicializando Firebase...');

      const base64Config = this.configService.get<string>('FIREBASE_CONFIG_BASE64');
      if (!base64Config) {
        throw new Error('FIREBASE_CONFIG_BASE64 no está configurado');
      }

      let serviceAccount: admin.ServiceAccount;
      try {
        const decodedConfig = Buffer.from(base64Config, 'base64').toString('utf8');
        const parsedConfig = JSON.parse(decodedConfig);

        // Asegúrate de que la clave privada tenga el formato correcto
        if (parsedConfig.private_key) {
          parsedConfig.private_key = this.formatPrivateKey(parsedConfig.private_key);
        }

        serviceAccount = {
          projectId: parsedConfig.project_id,
          clientEmail: parsedConfig.client_email,
          privateKey: parsedConfig.private_key
        };

        // Log para debugging
        this.logger.debug('Service Account Structure:', {
          projectId: serviceAccount.projectId,
          clientEmail: serviceAccount.clientEmail,
          privateKeyLength: serviceAccount.privateKey?.length,
          hasPrivateKey: !!serviceAccount.privateKey
        });

      } catch (error) {
        this.logger.error('Error parsing config:', error);
        throw new Error('Error en el formato de configuración');
      }

      if (!admin.apps.length) {
        const app = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
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
