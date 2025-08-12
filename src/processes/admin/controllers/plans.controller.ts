import { Controller, Post, Body, Get, Put, Delete, Param, Query, UseGuards, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PlansService } from '../services_admin/plans.service';
import { CreatePlanDto } from '../dto/plan.dto';
import { AdminAuthGuard } from '../guards/admin-auth.guard';

@Controller('admin/plans')
@UseGuards(AdminAuthGuard)
export class PlansController {
  private readonly logger = new Logger(PlansController.name);

  constructor(private readonly plansService: PlansService) { }

  @Post()
  async createPlan(@Body() createPlanDto: CreatePlanDto) {
    try {
      this.logger.log('📝 Creando nuevo plan de pausas');
      const plan = await this.plansService.createPlan(createPlanDto);

      return {
        status: true,
        message: 'Plan creado exitosamente',
        data: plan
      };
    } catch (error: any) {
      this.logger.error('Error creando plan:', error);
      throw new HttpException(
        {
          status: false,
          message: 'Error al crear el plan',
          error: error?.message || 'Error desconocido'
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get()
  async getPlans(@Query('includeDetails') includeDetails?: string) {
    try {
      this.logger.log('📋 Obteniendo lista de planes');
      const plans = await this.plansService.getPlans();

      return {
        status: true,
        message: 'Planes obtenidos exitosamente',
        data: plans
      };
    } catch (error) {
      this.logger.error('Error obteniendo planes:', error);
      throw error;
    }
  }

  @Put(':id')
  async updatePlan(@Param('id') id: string, @Body() updatePlanDto: CreatePlanDto) {
    try {
      this.logger.log(`📝 Actualizando plan: ${id}`);
      const plan = await this.plansService.updatePlan(id, updatePlanDto);

      return {
        status: true,
        message: 'Plan actualizado exitosamente',
        data: plan
      };
    } catch (error: any) {
      this.logger.error('Error actualizando plan:', error);
      throw new HttpException(
        {
          status: false,
          message: 'Error al actualizar el plan',
          error: error?.message || 'Error desconocido'
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete(':id')
  async deletePlan(@Param('id') id: string) {
    try {
      this.logger.log(`🗑️ Eliminando plan: ${id}`);
      await this.plansService.deletePlan(id);

      return {
        status: true,
        message: 'Plan eliminado exitosamente'
      };
    } catch (error: any) {
      this.logger.error('Error eliminando plan:', error);
      throw new HttpException(
        {
          status: false,
          message: 'Error al eliminar el plan',
          error: error?.message || 'Error desconocido'
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
