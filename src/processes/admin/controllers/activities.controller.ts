import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { CreateActivityDto } from '../dto/create-activity.dto';
import { DriveService } from '../../../services/drive.service';
import { FirebaseAuthGuard } from '../../auth/guards/firebase-auth.guard';
import { AdminService } from '../services_admin/admin.service';

@Controller('admin/activities')
export class ActivitiesController {
  private readonly logger = new Logger(ActivitiesController.name);

  constructor(
    private readonly driveService: DriveService,
    private readonly adminService: AdminService,
  ) {}

  @Post('create')
  @UseGuards(FirebaseAuthGuard)
  async createActivity(@Body() createActivityDto: CreateActivityDto) {
    try {
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

      // 4. Create activity
      const activity = await this.adminService.createActivity(createActivityDto);

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
