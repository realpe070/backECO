import { Controller, Post, Get, Body, UseGuards, Logger, Query } from '@nestjs/common';
import { PlansService } from '../services_admin/plans.service';
import { CreatePlanDto } from '../dto/plan.dto'; // Actualizar importación
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
    } catch (error) {
      this.logger.error('Error creando plan:', error);
      throw error;
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
}
