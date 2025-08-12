import { Controller, Post, Put, Body, Param, UseGuards, HttpException, HttpStatus, Logger, Req, Delete } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { CreateActivityDto } from '../dto/create-activity.dto';
import { UpdateActivityDto } from '../dto/update-activity.dto';
import { DriveService } from '../../../services/drive.service';
import { AdminService } from '../services_admin/admin.service';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { ActivitiesService } from '../services_admin/activities.service';

@Controller('admin/activities')
@UseGuards(AdminAuthGuard)
export class ActivitiesController {
  private readonly logger = new Logger(ActivitiesController.name);

  constructor(
    private readonly driveService: DriveService,
    private readonly adminService: AdminService,
    private readonly activitiesService: ActivitiesService,
  ) { }

  @Post()
  async createActivity(@Body() createActivityDto: CreateActivityDto) {
    try {
      this.logger.debug(`Creating activity: ${JSON.stringify(createActivityDto)}`);

      // Validate required fields
      if (!createActivityDto.name || !createActivityDto.description) {
        throw new HttpException('Missing required fields', HttpStatus.BAD_REQUEST);
      }

      const activity = await this.adminService.createActivity(createActivityDto);

      return {
        status: true,
        message: 'Actividad creada exitosamente',
        data: activity,
      };
    } catch (error) {
      this.logger.error('Error creating activity:', error);
      throw new HttpException(
        {
          status: false,
          message: error instanceof Error ? error.message : 'Error creating activity',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':id')
  async updateActivity(
    @Param('id') id: string,
    @Body() updateActivityDto: UpdateActivityDto
  ) {
    try {
      const activity = await this.adminService.updateActivity(id, updateActivityDto);
      return {
        status: true,
        message: 'Actividad actualizada exitosamente',
        data: activity
      };
    } catch (error) {
      this.logger.error('Error actualizando actividad:', error);
      throw new HttpException(
        {
          status: false,
          message: error instanceof Error ? error.message : 'Error actualizando actividad',
          error: 'ACTIVITY_UPDATE_ERROR'
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete(':id')
  @ApiResponse({ status: 200, description: 'Actividad eliminada exitosamente' })
  async deleteActivity(@Param('id') id: string) {
    try {
      this.logger.debug(`🗑️ Eliminando actividad: ${id}`);
      await this.activitiesService.deleteActivity(id);

      return {
        status: true,
        message: 'Actividad eliminada exitosamente'
      };
    } catch (error) {
      this.logger.error('Error eliminando actividad:', error);
      throw new HttpException(
        {
          status: false,
          message: error instanceof Error ? error.message : 'Error desconocido',
          error: 'ACTIVITY_DELETE_ERROR'
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete()
  @ApiResponse({ status: 200, description: 'Actividades eliminadas exitosamente' })
  async deleteMultipleActivities(@Body() data: { ids: string[] }) {
    try {
      this.logger.debug(`🗑️ Eliminando múltiples actividades: ${data.ids.length}`);
      await this.activitiesService.deleteMultipleActivities(data.ids);

      return {
        status: true,
        message: `${data.ids.length} actividades eliminadas exitosamente`
      };
    } catch (error) {
      this.logger.error('Error eliminando actividades:', error);
      throw new HttpException(
        {
          status: false,
          message: error instanceof Error ? error.message : 'Error desconocido',
          error: 'ACTIVITIES_DELETE_ERROR'
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
