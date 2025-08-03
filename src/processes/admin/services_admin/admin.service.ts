import { Injectable, UnauthorizedException, Logger, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { AdminLoginDto } from '../dto/admin-login.dto';
import { FirebaseService } from '../../../firebase/firebase.service';
import { UserResponseDto } from '../dto/user-response.dto';
import { UserStats } from '../dto/user-stats.dto';
import { CreateActivityDto, Activity } from '../dto/activity.dto';
import { DriveService } from '../../../services/drive.service';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { UpdateActivityDto } from '../dto/update-activity.dto';

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
    try {
      this.logger.debug(`Intento de login administrativo para: ${loginDto.email}`);

      if (loginDto.email !== this.ADMIN_EMAIL || loginDto.password !== this.ADMIN_PASSWORD) {
        this.logger.warn('Invalid admin credentials');
        throw new UnauthorizedException('Credenciales inválidas');
      }

      // Generate custom JWT token with longer expiration
      const token = jwt.sign(
        {
          uid: 'admin-uid',
          email: loginDto.email,
          role: 'admin',
          iat: Math.floor(Date.now() / 1000),
        },
        this.JWT_SECRET,
        { expiresIn: '24h' }, // Increased token lifetime
      );

      this.logger.log('✅ Admin login successful');
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
      this.logger.error('❌ Error en validación de admin:', error);
      throw new UnauthorizedException('Error en la autenticación');
    }
  }

  async getFirebaseUsers(): Promise<UserResponseDto[]> {
    try {
      this.logger.debug('Obteniendo usuarios de Firebase');

      const auth = this.firebaseService.getAuth();
      const { users } = await auth.listUsers();
      const db = this.firebaseService.getFirestore();

      const usersData = await Promise.all(users.map(async (user) => {
        try {
          const userDoc = await db.collection('users').doc(user.uid).get();
          const userData = userDoc.data() || {};

          return {
            uid: user.uid,
            email: user.email || null,
            displayName: user.displayName || userData.name || null,
            photoURL: user.photoURL || null,
            creationTime: user.metadata.creationTime || '',
            lastSignInTime: user.metadata.lastSignInTime || '',
            status: user.disabled ? 'disabled' : 'active',
            name: userData.name || null,
            lastName: userData.lastName || null,
            gender: userData.gender || null,
            avatarColor: userData.avatarColor || null,
            createdAt: userData.createdAt ? userData.createdAt.toDate().toISOString() : null
          } as UserResponseDto;
        } catch (error) {
          this.logger.error(`Error obteniendo datos de usuario ${user.uid}:`, error);
          return null;
        }
      }));

      return usersData.filter((user): user is UserResponseDto => user !== null);

    } catch (error: unknown) {
      this.logger.error('Error obteniendo usuarios de Firebase:', error);
      throw new Error('Error al obtener usuarios de Firebase');
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

      const now = new Date().toISOString();
      const activityData = {
        ...createActivityDto,
        createdAt: now,
        updatedAt: now,
        // Add default values if not provided
        minTime: createActivityDto.minTime || 30,
        maxTime: createActivityDto.maxTime || 60,
        sensorEnabled: createActivityDto.sensorEnabled ?? false,
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

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: this.sanitizeString(data.name),
          description: this.sanitizeString(data.description),
          minTime: data.minTime,
          maxTime: data.maxTime,
          category: this.sanitizeString(data.category),
          videoUrl: this.sanitizeString(data.videoUrl),
          sensorEnabled: !!data.sensorEnabled,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          type: data.type || 'exercise',
          duration: data.duration || 300,
          driveFileId: data.driveFileId ? this.sanitizeString(data.driveFileId) : null
        } as Activity;
      });
    } catch (error) {
      this.logger.error('Error obteniendo actividades:', error);
      throw new Error('Error al obtener actividades');
    }
  }

  private sanitizeString(value: string | null | undefined): string {
    if (!value) return '';
    return value
      .normalize('NFKD') // Descompone los caracteres acentuados
      .replace(/[\u0300-\u036f]/g, '') // Elimina diacríticos
      .replace(/[^\x20-\x7E]/g, '') // Solo mantiene caracteres ASCII imprimibles
      .trim();
  }

  async updateActivity(id: string, updateActivityDto: UpdateActivityDto) {
    try {
      const db = this.firebaseService.getFirestore();
      const activityRef = db.collection('activities').doc(id);

      // Verify activity exists
      const doc = await activityRef.get();
      if (!doc.exists) {
        throw new HttpException('Actividad no encontrada', HttpStatus.NOT_FOUND);
      }

      const now = new Date().toISOString();
      const updateData = {
        ...updateActivityDto,
        updatedAt: now
      };

      await activityRef.update(updateData);

      return {
        id,
        ...doc.data(),
        ...updateData
      };
    } catch (error) {
      this.logger.error('Error updating activity:', error);
      throw error;
    }
  }
}
