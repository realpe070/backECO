import * as admin from 'firebase-admin';
import { Injectable, OnModuleInit, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private db!: FirebaseFirestore.Firestore;
  private auth!: admin.auth.Auth;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    try {
      if (admin.apps.length === 0) {
        const serviceAccountPath = path.join(__dirname, '../../config/ecobreack-5dfe5-firebase-adminsdk-5ltxh-c1ed0666d0.json');
        
        // Verificar si el archivo de credenciales existe
        if (!fs.existsSync(serviceAccountPath)) {
          this.logger.error(`Firebase credentials file not found at path: ${serviceAccountPath}`);
          throw new Error('Firebase credentials file is missing');
        }

        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });

        this.logger.log('✅ Firebase initialized successfully');
      } else {
        this.logger.log('Firebase app already initialized');
      }

      this.db = admin.firestore();
      this.auth = admin.auth();
    } catch (error) {
      this.logger.error('❌ Firebase initialization error:', error);
      throw error;
    }
  }

  getFirestore(): FirebaseFirestore.Firestore {
    return this.db;
  }

  getAuth(): admin.auth.Auth {
    return this.auth;
  }

  async verifyToken(token: string) {
    try {
      this.logger.debug(`Verifying token: ${token.substring(0, 20)}...`);
      const decodedToken = await this.auth.verifyIdToken(token);
      const userRecord = await this.auth.getUser(decodedToken.uid);

      return {
        uid: userRecord.uid,
        email: userRecord.email,
        role: userRecord.email === 'ecoecobreack@gmail.com' ? 'admin' : 'user',
        disabled: userRecord.disabled,
        metadata: userRecord.metadata,
        verified: userRecord.emailVerified,
      };
    } catch (error) {
      this.logger.error('Error verifying Firebase ID token:', error);
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }

  async getUsers() {
    try {
      const users = await this.auth.listUsers();
      return users.users.map(user => ({
        uid: user.uid,
        name: user.displayName,
        email: user.email,
        registerDate: user.metadata.creationTime,
        lastAccess: user.metadata.lastSignInTime,
        status: user.disabled ? 'Inactivo' : 'Activo',
        role: 'usuario', // Aquí podrías agregar roles si es necesario
      }));
    } catch (error) {
      this.logger.error('Error getting users from Firebase:', error);
      throw new Error('Error fetching users');
    }
  }
}
