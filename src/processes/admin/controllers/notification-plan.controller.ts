import { Controller, Post, Get, Put, Delete, Body, Param, UseGuards, Logger, HttpException, HttpStatus, Req } from '@nestjs/common';
import { FirebaseAuthGuard } from '../../auth/guards/firebase-auth.guard';
import { NotificationPlanService } from '../services_admin/notification-plan.service';
import { NotificationPlanDto } from '../dto/notification-plan.dto';
import { ApiTags, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';

@ApiTags('Notification Plans')
@Controller('admin/notification-plans')
@UseGuards(FirebaseAuthGuard)
export class NotificationPlanController {
  private readonly logger = new Logger(NotificationPlanController.name);

  constructor(private readonly notificationPlanService: NotificationPlanService) { }

  @Post()
  @ApiResponse({ status: 201, description: 'Plan de notificación creado' })
  async createNotificationPlan(@Body() createPlanDto: NotificationPlanDto) {
    this.logger.log(`Creating notification plan: ${createPlanDto.name}`);
    const plan = await this.notificationPlanService.createNotificationPlan(createPlanDto);
    return {
      status: true,
      message: 'Plan de notificación creado exitosamente',
      data: plan
    };
  }

  @Get()
  async getNotificationPlans(@Req() request: Request) {
    try {
      this.logger.debug(`🔍 Getting notification plans for user: ${request.user?.email}`);
      const plans = await this.notificationPlanService.getNotificationPlans();

      return {
        status: true,
        message: 'Planes obtenidos exitosamente',
        data: plans
      };
    } catch (error: unknown) {
      this.logger.error('Error getting notification plans:', error);
      throw new HttpException(
        {
          status: false,
          message: error instanceof Error ? error.message : 'Error desconocido',
          error: 'NOTIFICATION_PLANS_FETCH_ERROR'
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Put(':id/status')
  @ApiResponse({ status: 200, description: 'Estado del plan actualizado' })
  async updatePlanStatus(
    @Param('id') id: string,
    @Body() updateData: { isActive: boolean }
  ) {
    this.logger.log(`Updating plan status: ${id} -> ${updateData.isActive}`);
    const plan = await this.notificationPlanService.updatePlanStatus(id, updateData.isActive);
    return {
      status: true,
      message: 'Estado del plan actualizado exitosamente',
      data: plan
    };
  }

  @Delete(':id')
  @ApiResponse({ status: 200, description: 'Plan de notificación eliminado' })
  async deletePlan(@Param('id') id: string) {
    this.logger.debug(`🗑️ Deleting notification plan: ${id}`);
    await this.notificationPlanService.deletePlan(id);
    return {
      status: true,
      message: 'Plan de notificación eliminado exitosamente'
    };
  }
}
