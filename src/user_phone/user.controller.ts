import {
  Controller,
  Get,
  Patch,
  Body,
  Req,
  HttpException,
  HttpStatus,
  Logger,
  UseGuards,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Request } from 'express';
import { UserService } from './user.service';
import { UpdateStatsDto } from '../dto/update-stats.dto';
import { FirebaseService } from '@firebase/firebase.service';
import { UpdateNotificationSettingsDto } from '../dto/update-notification-settings.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { AdminAuthGuard } from 'src/admin/admin-auth.guard';
import { CreateUserDto } from 'src/dto/create-user.dto';
import { MailService } from './email.service';

@Controller('admin/users/')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(
    private readonly userService: UserService,
    private readonly firebaseService: FirebaseService,
    private readonly emailService: MailService,
  ) {}

  @Get()
  @UseGuards(AdminAuthGuard)
  async getUser(@Req() request: Request) {
    this.logger.log(
      '📱 Recibiendo petición GET /user',
      JSON.stringify(request.headers),
    );
    const token = `Bearer ${request.headers.authorization?.split(' ')[1]}`;

    this.logger.debug('👉 Token recibido:', token);

    if (!token) {
      throw new HttpException('No token provided', HttpStatus.UNAUTHORIZED);
    }

    return this.userService.getUser(token);
  }

  @Get(':id/stats')
  //@UseGuards(AdminAuthGuard)
  async getUserStats(@Param('id') userId: string, @Query('date') date: string) {
    try {
      this.logger.log('📊 Recibiendo petición GET /user/stats');
      this.logger.debug('👉 User ID recibido:', userId);
      if (!userId) {
        throw new HttpException('No user ID found', HttpStatus.UNAUTHORIZED);
      }

      const stats = await this.userService.getUserStats(userId, date);

      const response = {
        status: true,
        data: stats,
        message: 'Estadísticas obtenidas correctamente',
      };

      this.logger.log('✅ Respuesta exitosa:');
      return response;
    } catch (error: unknown) {
      this.logger.error('❌ Error en getUserStats:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      throw new HttpException(
        {
          message: 'Error al obtener estadísticas',
          status: false,
          error: errorMessage,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('stats/all')
  @UseGuards(AdminAuthGuard)
  async getAllUserStats() {
    try {
      this.logger.log('📊 Recibiendo petición GET /user/stats/all');

      const stats = await this.userService.getAllUsersStats();

      const response = {
        status: true,
        data: stats,
        message: 'Estadísticas globales obtenidas correctamente',
      };

      this.logger.log('✅ Respuesta exitosa con datos globales');
      return response;
    } catch (error: unknown) {
      this.logger.error('❌ Error en getAllUserStats:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      throw new HttpException(
        {
          message: 'Error al obtener estadísticas globales',
          status: false,
          error: errorMessage,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch('stats')
  @UseGuards(AdminAuthGuard)
  async updateUserStats(
    @Body() statsData: UpdateStatsDto,
    @Req() request: Request,
  ) {
    try {
      const token = `Bearer ${request.headers.authorization?.split(' ')[1]}`;

      this.logger.debug('👉 Token recibido:', token);

      if (!token) {
        throw new HttpException('No token provided', HttpStatus.UNAUTHORIZED);
      }

      const result = await this.userService.updateUserStats(token, statsData);

      this.logger.log('✅ Estadísticas actualizadas');
      return result;
    } catch (error: unknown) {
      this.logger.error('Error en updateUserStats:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      throw new HttpException(
        {
          message: 'Error al actualizar estadísticas',
          status: false,
          error: errorMessage,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch('notification-settings')
  @UseGuards(AdminAuthGuard)
  async updateSettings(@Body() settings: UpdateNotificationSettingsDto) {
    try {
      this.logger.log(
        '📱 Recibiendo petición PATCH /user/notification-settings',
      );
      this.logger.debug(
        'Configuración recibida:',
        JSON.stringify(settings, null, 2),
      );

      // TODO: Reemplazar con el UID del token cuando implementes autenticación
      const uid = 'UIHLeSVc7dbtfys1m5tIqGWaJU73';

      const result = await this.userService.updateNotificationSettings(
        uid,
        settings,
      );

      this.logger.log('✅ Configuración actualizada');
      return result;
    } catch (error: unknown) {
      this.logger.error('Error en updateSettings:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      throw new HttpException(
        {
          message: 'Error al actualizar configuración',
          status: false,
          error: errorMessage,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch('profile')
  @UseGuards(AdminAuthGuard)
  async updateUserProfile(
    @Body() body: UpdateProfileDto,
    @Req() request: Request,
  ) {
    try {
      this.logger.log('📝 Recibiendo petición PATCH /user/profile');
      const token = `Bearer ${request.headers.authorization?.split(' ')[1]}`;

      const result = await this.userService.updateUserProfile(token, body);

      this.logger.log('✅ Perfil actualizado');
      return result;
    } catch (error) {
      this.logger.error('❌ Error en updateUserProfile:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      throw new HttpException(
        {
          message: 'Error al actualizar perfil',
          status: false,
          error: errorMessage,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('register')
  async registerUser(@Body() registerDto: CreateUserDto) {
    try {
      const result = await this.userService.createUser(registerDto);
      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      throw new HttpException(
        {
          message: 'Error al registrar usuario',
          status: false,
          error: errorMessage,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('forgot-password')
  async forgotPassword(@Body('email') email: string) {
    try {
      this.logger.log('📧 Solicitud de recuperación de contraseña');
      const result = await this.emailService.sendPasswordResetEmail(email);
      return result;
    } catch (error) {
      this.logger.error('❌ Error enviando email de recuperación:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      throw new HttpException(
        {
          message: 'Error enviando email de recuperación',
          status: false,
          error: errorMessage,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('reset-password')
  async resetPassword(
    @Body('token') token: string,
    @Body('newPassword') newPassword: string,
  ) {
    try {
      this.logger.log('🔑 Restableciendo contraseña con token');
      const result = await this.emailService.resetPasswordWithToken(
        token,
        newPassword,
      );
      return result;
    } catch (error) {
      this.logger.error('❌ Error restableciendo contraseña:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      throw new HttpException(
        {
          message: 'Error restableciendo contraseña',
          status: false,
          error: errorMessage,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
