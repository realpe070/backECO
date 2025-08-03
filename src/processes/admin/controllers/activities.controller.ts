import { Controller, Post, Body, UseGuards, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { CreateActivityDto } from '../dto/create-activity.dto';
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

      // Validar que todos los campos requeridos estén presentes
      const requiredFields = [
        'name', 'description', 'type', 'minTime', 'maxTime',
        'category', 'videoUrl', 'sensorEnabled', 'duration'
      ];

      for (const field of requiredFields) {
        if (!(field in createActivityDto)) {
          throw new HttpException(
            `Missing required field: ${field}`,
            HttpStatus.BAD_REQUEST
          );
        }
      }

      const { videoUrl } = createActivityDto;
      this.logger.debug(`Processing video URL: ${videoUrl}`);

      // 1. For simple filenames, skip Drive validation
      if (!videoUrl.includes('drive.google.com')) {
        // Just validate it's a video filename
        if (!/\.(mp4|webm|mov|avi)$/i.test(videoUrl)) {
          throw new HttpException('Invalid video filename', HttpStatus.BAD_REQUEST);
        }
      } else {
        // 2. For Drive URLs, perform full validation
        if (!DriveService.isValidDriveUrl(videoUrl)) {
          throw new HttpException('Invalid Google Drive URL', HttpStatus.BAD_REQUEST);
        }

        const fileId = DriveService.extractFileId(videoUrl);
        if (!fileId) {
          throw new HttpException('Invalid video ID', HttpStatus.BAD_REQUEST);
        }

        // Validate video exists in Drive only for Drive URLs
        const fileInfo = await this.driveService.getFileInfo(fileId);
        if (!fileInfo || !fileInfo.id) {
          throw new HttpException('Video not found in Google Drive', HttpStatus.NOT_FOUND);
        }

        // Validate folder only for Drive URLs
        const parents = fileInfo.parents || [];
        const validFolders = [
          '1iSJMKnKE0oXp3QxlY03nsKQsv1KHMbhc',
          '1PKmm05PopK40UjKrQaBQpiAL8bb2Nx-V'
        ];

        if (!parents.some((parent: string) => validFolders.includes(parent))) {
          throw new HttpException('Video must be in a valid EcoBreack folder', HttpStatus.BAD_REQUEST);
        }
      }

      // 3. Validate time constraints
      if (createActivityDto.maxTime <= createActivityDto.minTime) {
        throw new HttpException(
          'El tiempo máximo debe ser mayor que el tiempo mínimo',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 4. Create activity with timestamps
      const now = new Date().toISOString();
      const activityData: CreateActivityDto = {
        ...createActivityDto,
        createdAt: createActivityDto.createdAt || now,
        updatedAt: now,
        sensorEnabled: createActivityDto.sensorEnabled ?? false,
        duration: createActivityDto.duration || 300,
        minTime: createActivityDto.minTime || 15,
        maxTime: createActivityDto.maxTime || 30,
        category: createActivityDto.category || 'Estiramientos Generales'
      };

      const activity = await this.adminService.createActivity(activityData);

      return {
        status: true,
        message: 'Actividad creada exitosamente',
        data: activity,
      };
    } catch (error) {
      this.logger.error('Error creando actividad:', error);
      throw new HttpException(
        {
          status: false,
          message: error instanceof Error ? error.message : 'Error desconocido',
        },
        error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
