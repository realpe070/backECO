import { Controller, Post, Put, Body, Param, UseGuards, HttpException, HttpStatus, Logger, Req } from '@nestjs/common';
import { CreateActivityDto } from '../dto/create-activity.dto';
import { UpdateActivityDto } from '../dto/update-activity.dto';
import { DriveService } from '../../../services/drive.service';
import { AdminService } from '../services_admin/admin.service';
import { AdminAuthGuard } from '../guards/admin-auth.guard';

@Controller('admin/activities')
@UseGuards(AdminAuthGuard)
export class ActivitiesController {
  private readonly logger = new Logger(ActivitiesController.name);

  constructor(
    private readonly driveService: DriveService,
    private readonly adminService: AdminService,
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
}
