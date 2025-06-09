import { Controller, Post, Body, Get, UseGuards, Logger, HttpStatus, HttpException, Param, Delete, Res, Req } from '@nestjs/common';
import { AdminService } from './services_admin/admin.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CreateActivityDto } from './dto/activity.dto';
import { ApiTags, ApiResponse } from '@nestjs/swagger';
import { DriveService } from '../../services/drive.service';
import { Request } from 'express';

interface AdminError {
  message?: string;
  status?: boolean;
  error?: string;
}

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private readonly adminService: AdminService,
    private readonly driveService: DriveService, // Inject DriveService
  ) {}

  @UseGuards() // Disable guards for this route
  @Post('login')
  async login(@Body() loginDto: AdminLoginDto) {
    try {
      this.logger.log('Intento de login administrativo');
      const result = await this.adminService.validateAdmin(loginDto);

      if (!result.status) {
        throw new HttpException(result, HttpStatus.UNAUTHORIZED);
      }

      return result;
    } catch (error: unknown) {
      this.logger.error('Error en login:', error);
      const adminError: AdminError = {
        status: false,
        message: error instanceof Error ? error.message : 'Error en la autenticación',
        error: 'AUTH_ERROR',
      };
      throw new HttpException(adminError, HttpStatus.UNAUTHORIZED);
    }
  }

  @Get()
  @UseGuards(FirebaseAuthGuard) // Add guard explicitly here
  async validateAdminAccess() {
    return {
      status: true,
      message: 'Acceso administrativo confirmado',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('check')
  async checkAdminConnection() {
    try {
      return {
        status: true,
        message: 'Admin backend connection successful',
        timestamp: new Date().toISOString(),
        endpoint: '/admin/check'
      };
    } catch (error) {
      this.logger.error('Error checking admin connection:', error);
      throw new HttpException({
        status: false,
        message: 'Error checking admin connection',
        error: error instanceof Error ? error.message : 'Unknown error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('users')
  @ApiResponse({ status: 200, description: 'Lista de usuarios obtenida' })
  async getUsers(@Req() request: Request) {
    try {
      this.logger.log('📋 Obteniendo lista de usuarios...');
      this.logger.debug(`Headers recibidos: ${JSON.stringify(request.headers)}`);

      const users = await this.adminService.getFirebaseUsers();
      
      this.logger.debug(`✅ ${users.length} usuarios encontrados`);
      
      return {
        status: true,
        message: 'Usuarios obtenidos correctamente',
        data: users,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('❌ Error getting users:', error);
      throw new HttpException({
        status: false,
        message: error instanceof Error ? error.message : 'Error getting users',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @UseGuards(FirebaseAuthGuard)
  @ApiResponse({ status: 201, description: 'Actividad creada correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @Post('activities')
  async createActivity(@Body() createActivityDto: CreateActivityDto) {
    try {
      this.logger.log('📝 Creando nueva actividad');
      const activity = await this.adminService.createActivity(createActivityDto);

      return {
        status: true,
        message: 'Actividad creada correctamente',
        data: activity,
      };
    } catch (error: unknown) {
      this.logger.error('Error creando actividad:', error);
      throw new HttpException(
        {
          status: false,
          message: error instanceof Error ? error.message : 'Error creando actividad',
          error: 'ACTIVITY_CREATE_ERROR',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @ApiResponse({ status: 200, description: 'Lista de actividades obtenida correctamente' })
  @Get('activities')
  async getActivities() {
    try {
      this.logger.log('📋 Obteniendo lista de actividades');
      const activities = await this.adminService.getActivities();

      return {
        status: true,
        message: 'Actividades obtenidas correctamente',
        data: activities,
      };
    } catch (error: unknown) {
      this.logger.error('Error obteniendo actividades:', error);
      throw new HttpException(
        {
          status: false,
          message: error instanceof Error ? error.message : 'Error obteniendo actividades',
          error: 'ACTIVITIES_FETCH_ERROR',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @ApiResponse({ status: 200, description: 'Actividad eliminada correctamente' })
  @ApiResponse({ status: 404, description: 'Actividad no encontrada' })
  @Delete('activities/:id')
  async deleteActivity(@Param('id') id: string) {
    try {
      this.logger.log(`🗑️ Eliminando actividad: ${id}`);
      await this.adminService.deleteActivity(id);

      return {
        status: true,
        message: 'Actividad eliminada correctamente',
      };
    } catch (error: unknown) {
      this.logger.error('Error eliminando actividad:', error);
      throw new HttpException(
        {
          status: false,
          message: error instanceof Error ? error.message : 'Error eliminando actividad',
          error: 'ACTIVITY_DELETE_ERROR',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @ApiResponse({ status: 200, description: 'Lista de videos obtenida correctamente' })
  @ApiResponse({ status: 404, description: 'No se encontraron videos' })
  @Get('drive/videos')
  async listDriveVideos() {
    try {
      this.logger.log('📂 Listando videos desde Google Drive');
      const videos = await this.driveService.listFolderVideos();

      if (videos.length === 0) {
        this.logger.warn('No se encontraron videos en las carpetas configuradas');
        return {
          status: false,
          message: 'No se encontraron videos',
          data: [],
        };
      }

      return {
        status: true,
        message: 'Videos obtenidos correctamente',
        data: videos,
      };
    } catch (error: unknown) {
      this.logger.error('Error listando videos desde Google Drive:', error);
      throw new HttpException(
        {
          status: false,
          message: 'Error al listar videos',
          error: error instanceof Error ? error.message : 'Error desconocido',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('drive/thumbnail/:id')
  async getVideoThumbnail(@Param('id') fileId: string, @Res() res: any) {
    try {
      const thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400-h300-n`;
      return res.redirect(thumbnailUrl);
    } catch (error) {
      this.logger.error('Error getting thumbnail:', error);
      throw new HttpException(
        {
          status: false,
          message: 'Error getting thumbnail',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
