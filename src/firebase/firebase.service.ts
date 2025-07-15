import { Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private auth!: admin.auth.Auth;
  private db!: admin.firestore.Firestore;

  constructor(private configService: ConfigService) { }

  private validateAndFormatPrivateKey(key: string): string {
    // 1. Limpiar la clave
    let cleanKey = key.replace(/\\n/g, '\n').trim();

    // 2. Asegurar el formato correcto
    if (!cleanKey.includes('-----BEGIN PRIVATE KEY-----')) {
      cleanKey = '-----BEGIN PRIVATE KEY-----\n' + cleanKey;
    }
    if (!cleanKey.includes('-----END PRIVATE KEY-----')) {
      cleanKey = cleanKey + '\n-----END PRIVATE KEY-----';
    }

    // 3. Verificar formato PEM
    const pemRegex = /^-----BEGIN PRIVATE KEY-----\n[\s\S]+\n-----END PRIVATE KEY-----\n?$/;
    if (!pemRegex.test(cleanKey)) {
      throw new Error('Invalid PEM format after normalization');
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

      let decodedConfig: string;
      try {
        decodedConfig = Buffer.from(base64Config, 'base64').toString('utf8');
      } catch (error) {
        throw new Error('Error decodificando FIREBASE_CONFIG_BASE64');
      }

      let serviceAccount: any;
      try {
        serviceAccount = JSON.parse(decodedConfig);

        // Formatear la clave privada antes de usarla
        if (serviceAccount.private_key) {
          serviceAccount.private_key = this.validateAndFormatPrivateKey(serviceAccount.private_key);
        } else {
          throw new Error('private_key is missing from service account');
        }

        if (!admin.apps.length) {
          const app = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
          });

          this.auth = app.auth();
          this.db = app.firestore();

          // Verificación simple
          await this.auth.getUser('test-connection').catch(error => {
            if (error.code !== 'auth/user-not-found') {
              throw error;
            }
          });

          this.logger.log('✅ Firebase inicializado correctamente');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        this.logger.error('Error parsing service account:', errorMessage);
        throw error;
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
