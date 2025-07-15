import { Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private auth!: admin.auth.Auth;
  private db!: admin.firestore.Firestore;

  constructor(private configService: ConfigService) { }

  private validateAndFormatPrivateKey(serviceAccount: any): void {
    if (!serviceAccount.private_key) {
      throw new Error('private_key is missing from service account');
    }

    // Asegurar formato correcto de la clave privada
    if (typeof serviceAccount.private_key === 'string') {
      // Reemplazar todos los \\n con \n reales
      serviceAccount.private_key = serviceAccount.private_key
        .replace(/\\n/g, '\n')
        .replace(/\s+/g, '\n')
        .trim();

      // Asegurar formato PEM correcto
      if (!serviceAccount.private_key.startsWith('-----BEGIN PRIVATE KEY-----')) {
        serviceAccount.private_key = `-----BEGIN PRIVATE KEY-----\n${serviceAccount.private_key}`;
      }
      if (!serviceAccount.private_key.endsWith('-----END PRIVATE KEY-----')) {
        serviceAccount.private_key = `${serviceAccount.private_key}\n-----END PRIVATE KEY-----`;
      }
    }

    // Verificación final
    if (!serviceAccount.private_key.includes('-----BEGIN PRIVATE KEY-----') ||
      !serviceAccount.private_key.includes('-----END PRIVATE KEY-----')) {
      throw new Error('Invalid private key format after normalization');
    }
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
      } catch (error) {
        throw new Error('FIREBASE_CONFIG_BASE64 no contiene un JSON válido');
      }

      this.validateAndFormatPrivateKey(serviceAccount);

      if (!admin.apps.length) {
        const app = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount as admin.ServiceAccount)
        });

        this.auth = app.auth();
        this.db = app.firestore();

        // Verificar conexión con una operación simple
        await this.auth.getUser('test-connection')
          .catch(error => {
            // Ignoramos el error específico de usuario no encontrado
            // ya que solo queremos verificar que la conexión funciona
            if (error.code !== 'auth/user-not-found') {
              throw error;
            }
          });

        this.logger.log('✅ Conexión a Firebase verificada');
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
