import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../../auth/guards/firebase-auth.guard';
import { ProcessGroupService } from '../services_admin/process-group.service';
import {
  CreateProcessGroupDto,
  UpdateProcessGroupDto,
  UpdateProcessGroupMembersDto
} from '../dto/process-group.dto';
import { ApiTags, ApiResponse } from '@nestjs/swagger';

@ApiTags('Process Groups')
@Controller('admin/process-groups')
@UseGuards(FirebaseAuthGuard)
export class ProcessGroupsController {
  private readonly logger = new Logger(ProcessGroupsController.name);

  constructor(private readonly processGroupService: ProcessGroupService) { }

  @Get()
  @ApiResponse({ status: 200, description: 'Lista de grupos obtenida correctamente' })
  async getProcessGroups() {
    try {
      const groups = await this.processGroupService.getProcessGroups();
      return {
        status: true,
        message: 'Grupos obtenidos correctamente',
        data: groups,
      };
    } catch (error) {
      throw new HttpException({
        status: false,
        message: error instanceof Error ? error.message : 'Error getting groups',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post()
  @ApiResponse({ status: 201, description: 'Grupo creado correctamente' })
  async createProcessGroup(@Body() data: CreateProcessGroupDto) {
    try {
      const group = await this.processGroupService.createProcessGroup(data);
      return {
        status: true,
        message: 'Grupo creado correctamente',
        data: group,
      };
    } catch (error) {
      throw new HttpException({
        status: false,
        message: error instanceof Error ? error.message : 'Error creating group',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put(':id')
  @ApiResponse({ status: 200, description: 'Grupo actualizado correctamente' })
  async updateProcessGroup(
    @Param('id') id: string,
    @Body() data: UpdateProcessGroupDto,
  ) {
    try {
      const group = await this.processGroupService.updateProcessGroup(id, data);
      return {
        status: true,
        message: 'Grupo actualizado correctamente',
        data: group,
      };
    } catch (error) {
      throw new HttpException({
        status: false,
        message: error instanceof Error ? error.message : 'Error updating group',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete(':id')
  @ApiResponse({ status: 200, description: 'Grupo eliminado exitosamente' })
  async deleteGroup(@Param('id') id: string) {
    try {
      this.logger.debug(`🗑️ Deleting process group: ${id}`);
      await this.processGroupService.deleteGroup(id);
      return {
        status: true,
        message: 'Grupo eliminado exitosamente'
      };
    } catch (error) {
      this.logger.error('Error deleting process group:', error);
      throw new HttpException(
        {
          status: false,
          message: error instanceof Error ? error.message : 'Error desconocido',
          error: 'PROCESS_GROUP_DELETE_ERROR'
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Put(':id/members')
  @ApiResponse({ status: 200, description: 'Miembros del grupo actualizados correctamente' })
  async updateGroupMembers(
    @Param('id') id: string,
    @Body() data: UpdateProcessGroupMembersDto,
  ) {
    try {
      const group = await this.processGroupService.updateGroupMembers(id, data);
      return {
        status: true,
        message: 'Miembros actualizados correctamente',
        data: group,
      };
    } catch (error) {
      throw new HttpException({
        status: false,
        message: error instanceof Error ? error.message : 'Error updating members',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
