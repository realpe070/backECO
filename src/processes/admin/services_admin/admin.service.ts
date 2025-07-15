import { Injectable, UnauthorizedException, Logger, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { AdminLoginDto } from '../dto/admin-login.dto';
import { FirebaseService } from '../../../firebase/firebase.service';
import { UserResponseDto } from '../dto/user-response.dto';
import { UserStats } from '../dto/user-stats.dto';
import { CreateActivityDto, Activity } from '../dto/activity.dto';
import { DriveService } from '../../../services/drive.service';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private readonly ADMIN_EMAIL: string;
  private readonly ADMIN_PASSWORD: string;
  private readonly JWT_SECRET: string;

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly configService: ConfigService,
  ) {
    this.ADMIN_EMAIL = this.configService.get<string>('ADMIN_EMAIL') || 'default_admin_email';
    this.ADMIN_PASSWORD = this.configService.get<string>('ADMIN_PASSWORD') || 'default_admin_password';
    this.JWT_SECRET = this.configService.get<string>('JWT_SECRET') || 'default_secret_key';
  }

  async validateAdmin(loginDto: AdminLoginDto): Promise<{ status: boolean; message: string; data: any }> {
    this.logger.debug(`Intento de login administrativo para: ${loginDto.email}`);

    if (loginDto.email !== this.ADMIN_EMAIL || loginDto.password !== this.ADMIN_PASSWORD) {
      this.logger.warn('Invalid admin credentials');
      throw new UnauthorizedException('Credenciales inválidas');
    }

    try {
      // Generate custom JWT token
      const token = jwt.sign(
        { uid: 'admin-uid', email: loginDto.email, role: 'admin' },
        this.JWT_SECRET,
        { expiresIn: '1h' },
      );

      this.logger.log('Admin login successful');
      return {
        status: true,
        message: 'Login administrativo exitoso',
        data: {
          email: loginDto.email,
          role: 'admin',
          permissions: ['full_access'],
          token,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error('Error en validación de admin:', error);
      throw new UnauthorizedException('Error en la autenticación');
    }
  }

  async getFirebaseUsers(): Promise<UserResponseDto[]> {
    try {
      this.logger.debug('🔍 Iniciando obtención de usuarios de Firebase...');

      const auth = this.firebaseService.getAuth();
      if (!auth) {
        this.logger.error('❌ Firebase Auth no está inicializado');
        throw new Error('Firebase Auth no está inicializado');
      }

      if (typeof auth.listUsers !== 'function') {
        this.logger.error('🔥 Firebase Auth no tiene el método listUsers');
        throw new Error('Firebase Auth no está correctamente configurado');
      }

      this.logger.debug('📨 Llamando a auth.listUsers()...');
      const listUsersResult = await auth.listUsers();

      if (!listUsersResult || !listUsersResult.users) {
        this.logger.error('❌ listUsers() no devolvió un resultado válido');
        throw new Error('No se pudo obtener la lista de usuarios');
      }

      this.logger.debug(`✅ Se encontraron ${listUsersResult.users.length} usuarios`);

      const db = this.firebaseService.getFirestore();

      const usersData = await Promise.all(listUsersResult.users.map(async (user) => {
        try {
          const userDoc = await db.collection('users').doc(user.uid).get();
          const userData = userDoc.data() || {};

          const userResponse: UserResponseDto = {
            uid: user.uid,
            email: user.email || null,
            displayName: user.displayName || userData.name || null,
            photoURL: user.photoURL || null,
            disabled: user.disabled,
            metadata: {
              creationTime: user.metadata.creationTime,
              lastSignInTime: user.metadata.lastSignInTime
            },
            creationTime: user.metadata.creationTime,
            lastSignInTime: user.metadata.lastSignInTime,
            status: user.disabled ? 'disabled' : 'active'
          };

          return userResponse;
        } catch (error) {
          this.logger.error(`Error obteniendo datos de usuario ${user.uid}:`, error);
          return null;
        }
      }));

      return usersData.filter((user): user is UserResponseDto => user !== null);

    } catch (error) {
      this.logger.error('❌ Error obteniendo usuarios de Firebase:', error);
      throw new Error(`Error al obtener usuarios de Firebase: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  async getUserStats(userId: string): Promise<UserStats> {
    try {
      this.logger.debug(`Obteniendo estadísticas del usuario ${userId}`);

      const db = this.firebaseService.getFirestore();
      const userDoc = await db.collection('users').doc(userId).get();

      if (!userDoc.exists) {
        this.logger.warn(`Usuario ${userId} no encontrado, retornando estadísticas vacías`);
        return {
          activities_done: 0,
          total_activities: 0,
          total_time: 0
        };
      }

      const userData = userDoc.data() || {};

      const stats = {
        activities_done: Number(userData.activities_done) || 0,
        total_activities: Number(userData.total_activities) || 0,
        total_time: Number(userData.total_time) || 0
      };

      this.logger.debug('Estadísticas obtenidas:', stats);
      return stats;

    } catch (error: unknown) {
      this.logger.error(`Error obteniendo estadísticas para usuario ${userId}:`, error);
      throw new HttpException({
        status: false,
        message: 'Error al obtener estadísticas del usuario',
        error: error instanceof Error ? error.message : 'Error desconocido'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async createActivity(createActivityDto: CreateActivityDto): Promise<Activity> {
    try {
      this.logger.debug('Creando nueva actividad:', createActivityDto);

      const db = this.firebaseService.getFirestore();
      const activitiesRef = db.collection('activities');

      // Extract the file ID from the video URL
      const driveFileId = DriveService.extractFileId(createActivityDto.videoUrl);

      // If driveFileId is null, it means the URL is invalid
      if (!driveFileId) {
        throw new HttpException({
          status: false,
          message: 'Invalid video URL',
          error: 'INVALID_VIDEO_URL',
        }, HttpStatus.BAD_REQUEST);
      }

      const now = new Date().toISOString();
      const activityData = {
        ...createActivityDto,
        createdAt: now,
        updatedAt: now,
        driveFileId: driveFileId, // Store the extracted file ID
      };

      const docRef = await activitiesRef.add(activityData);

      return {
        id: docRef.id,
        ...activityData,
      } as Activity;
    } catch (error) {
      this.logger.error('Error creando actividad:', error);
      throw new HttpException({
        status: false,
        message: error instanceof Error ? error.message : 'Error creando actividad',
        error: 'ACTIVITY_CREATE_ERROR',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async deleteActivity(activityId: string): Promise<void> {
    try {
      this.logger.debug(`Eliminando actividad: ${activityId}`);

      const db = this.firebaseService.getFirestore();
      const activityRef = db.collection('activities').doc(activityId);

      const doc = await activityRef.get();
      if (!doc.exists) {
        throw new NotFoundException('Actividad no encontrada');
      }

      await activityRef.delete();
      this.logger.debug('Actividad eliminada exitosamente');

    } catch (error) {
      this.logger.error('Error eliminando actividad:', error);
      throw error;
    }
  }

  async getActivities(): Promise<Activity[]> {
    try {
      const db = this.firebaseService.getFirestore();
      const snapshot = await db.collection('activities').get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Activity));

    } catch (error) {
      this.logger.error('Error obteniendo actividades:', error);
      throw new Error('Error al obtener actividades');
    }
  }
}
