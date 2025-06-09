import { Controller, Post, Get, Param, Body, UseGuards, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { FirebaseAuthGuard } from '../../auth/guards/firebase-auth.guard';
import { ProcessUploadService } from '../services_admin/process-upload.service';
import { ProcessUploadDto } from '../dto/process-upload.dto';
import { ApiTags, ApiResponse } from '@nestjs/swagger';
import { SyncService } from '../../../services/sync.service';

@ApiTags('Process Upload')
@Controller('admin/process-upload')
@UseGuards(FirebaseAuthGuard)
export class ProcessUploadController {
  private readonly logger = new Logger(ProcessUploadController.name);

  constructor(
    private readonly processUploadService: ProcessUploadService,
    private readonly syncService: SyncService,
  ) {}

  @Post()
  @ApiResponse({ status: 201, description: 'Proceso creado exitosamente' })
  async uploadProcess(@Body() data: ProcessUploadDto) {
    try {
      this.logger.log(`📤 Subiendo proceso: ${data.processName}`);
      const process = await this.processUploadService.uploadProcess(data);

      this.logger.log(`🔄 Sincronizando proceso con usuarios del grupo: ${data.groupId}`);
      await this.syncService.syncProcessToUsers(process.id, data.groupId);

      return {
        status: true,
        message: 'Proceso subido y sincronizado correctamente',
        data: process,
      };
    } catch (error) {
      this.logger.error('❌ Error subiendo proceso:', error);
      throw new HttpException({
        status: false,
        message: error instanceof Error ? error.message : 'Error subiendo proceso',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('active')
  @ApiResponse({ status: 200, description: 'Lista de procesos activos obtenida' })
  async getActiveProcesses() {
    try {
      this.logger.log('📋 Obteniendo procesos activos...');
      const processes = await this.processUploadService.getActiveProcesses();
      
      return {
        status: true,
        data: processes,
      };
    } catch (error) {
      this.logger.error('Error getting active processes:', error);
      throw new HttpException({
        status: false,
        message: error instanceof Error ? error.message : 'Error getting active processes',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post(':id/deactivate')
  @ApiResponse({ status: 200, description: 'Proceso desactivado exitosamente' })
  async deactivateProcess(@Param('id') id: string) {
    try {
      this.logger.log(`🔄 Desactivando proceso ${id}...`);
      await this.processUploadService.deactivateProcess(id);
      
      return {
        status: true,
        message: 'Proceso desactivado exitosamente'
      };
    } catch (error) {
      this.logger.error('Error deactivating process:', error);
      throw new HttpException({
        status: false,
        message: error instanceof Error ? error.message : 'Error deactivating process',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
