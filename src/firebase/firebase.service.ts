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
    return key.includes('-----BEGIN PRIVATE KEY-----') &&
      key.includes('-----END PRIVATE KEY-----') &&
      key.includes('\n');
  }

  private normalizePrivateKey(key: string): string {
    // Si la clave ya tiene el formato correcto, devolverla tal cual
    if (this.validatePrivateKey(key)) {
      return key;
    }

    // Limpiar la clave de caracteres no deseados
    let cleanKey = key
      .replace(/\\n/g, '\n')
      .replace(/\s+/g, '\n')
      .trim();

    // Asegurar que tiene los delimitadores correctos
    if (!cleanKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
      cleanKey = '-----BEGIN PRIVATE KEY-----\n' + cleanKey;
    }
    if (!cleanKey.endsWith('-----END PRIVATE KEY-----')) {
      cleanKey = cleanKey + '\n-----END PRIVATE KEY-----';
    }

    return cleanKey;
  }

  async onModuleInit() {
    try {
      const base64Config = this.configService.get<string>('FIREBASE_CONFIG_BASE64');

      if (!base64Config) {
        throw new Error('FIREBASE_CONFIG_BASE64 is not set');
      }

      let serviceAccount;
      try {
        // Decodificar el base64 asegurando que no hay caracteres extra
        const cleanBase64 = base64Config.replace(/\s/g, '');
        const decodedConfig = Buffer.from(cleanBase64, 'base64').toString('utf8');
        serviceAccount = JSON.parse(decodedConfig);

        if (!serviceAccount.private_key) {
          throw new Error('Private key is missing in the service account configuration');
        }

        // Normalizar la clave privada
        serviceAccount.private_key = this.normalizePrivateKey(serviceAccount.private_key);

        // Validar que la clave tenga el formato correcto
        if (!this.validatePrivateKey(serviceAccount.private_key)) {
          throw new Error('Invalid private key format');
        }

        this.logger.debug('Private key format validated successfully');
      } catch (parseError) {
        this.logger.error('Error processing service account:', parseError);
        throw new Error('Invalid service account configuration');
      }

      if (!admin.apps.length) {
        const app = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount as admin.ServiceAccount)
        });

        this.auth = app.auth();
        this.db = app.firestore();

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
