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
    // Convierte saltos de línea escapados en reales y remueve espacios extra
    return key.replace(/\\n/g, '\n').trim();
  }

  async onModuleInit() {
    try {
      this.logger.log('🔄 Inicializando Firebase...');

      const base64Config = this.configService.get<string>('FIREBASE_CONFIG_BASE64');
      if (!base64Config) {
        throw new Error('FIREBASE_CONFIG_BASE64 no está definido');
      }

      const jsonConfigString = Buffer.from(base64Config, 'base64').toString('utf8');
      const parsedConfig = JSON.parse(jsonConfigString);

      // Formateamos y limpiamos la clave privada
      parsedConfig.private_key = this.formatPrivateKey(parsedConfig.private_key);
      this.logger.debug(`Longitud de clave privada: ${parsedConfig.private_key.length}`);

      // Validamos el formato PEM
      if (!parsedConfig.private_key.startsWith('-----BEGIN PRIVATE KEY-----')) {
        throw new Error('❌ Clave privada inválida o mal formateada');
      }

      const serviceAccount: admin.ServiceAccount = {
        projectId: parsedConfig.project_id,
        clientEmail: parsedConfig.client_email,
        privateKey: parsedConfig.private_key,
      };

      // Inicializamos Firebase solo una vez
      if (!admin.apps.length) {
        const app = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        this.auth = app.auth();
        this.db = app.firestore();
        this.logger.log('✅ Firebase inicializado correctamente');
      }
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('❌ Error inicializando Firebase:', error.message);
      } else {
        this.logger.error('❌ Error inicializando Firebase:', error);
      }
      throw error;
    }
  }

  getAuth(): admin.auth.Auth {
    if (!this.auth) {
      throw new Error('Firebase Auth no inicializado');
    }
    return this.auth;
  }

  getFirestore(): admin.firestore.Firestore {
    if (!this.db) {
      throw new Error('Firebase Firestore no inicializado');
    }
    return this.db;
  }

  async verifyToken(token: string): Promise<{ uid: string; email: string; role: string }> {
    try {
      if (!token || !token.startsWith('Bearer ')) {
        throw new UnauthorizedException('Token inválido');
      }
      const tokenId = token.split('Bearer ')[1].trim();
      this.logger.debug(`🔍 Verificando token: ${tokenId.slice(0, 20)}...`);
      const decodedToken = await this.auth.verifyIdToken(tokenId);
      if (!decodedToken.email) {
        throw new Error('Email not found in decoded token');
      }
      return {
        uid: decodedToken.uid,
        email: decodedToken.email,
        role: decodedToken.email === this.configService.get('ADMIN_EMAIL') ? 'admin' : 'user',
      };
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('❌ Error verificando token:', error.message);
      } else {
        this.logger.error('❌ Error verificando token:', error);
      }
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}