import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

@Injectable()
export class PlanService {
  private readonly logger = new Logger(PlanService.name);

  constructor(
    private readonly configService: ConfigService,
  ) {}

  async createPlan(data: {
    name: string;
    description: string;
    activities: Array<{
      activityId: string;
      order: number;
    }>;
  }): Promise<any> {
    try {
      this.logger.debug('Creating plan:', data);

      const planData = {
        ...data,
        createdAt: new Date().toISOString(),
      };

      const response = await axios.post(
        `${this.configService.get('API_URL')}/admin/plans`,
        planData,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.status === 201) {
        return response.data;
      }

      throw new HttpException('Failed to create plan', HttpStatus.BAD_REQUEST);
    } catch (error: unknown) {
      this.logger.error('Error creating plan:', error);
      if (error instanceof AxiosError) {
        throw new HttpException(
          `Error creating plan: ${error.response?.data?.message || error.message}`,
          error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
      throw new HttpException(
        'Error creating plan: Unknown error occurred',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async getPlans(): Promise<any[]> {
    try {
      const response = await axios.get(
        `${this.configService.get('API_URL')}/admin/plans`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data?.data || [];
    } catch (error: unknown) {
      this.logger.error('Error getting plans:', error);
      if (error instanceof AxiosError) {
        throw new HttpException(
          `Error getting plans: ${error.response?.data?.message || error.message}`,
          error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
      throw new HttpException(
        'Error getting plans: Unknown error occurred',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async updatePlan(id: string, data: {
    name: string;
    description: string;
    activities: Array<{
      activityId: string;
      order: number;
    }>;
  }): Promise<any> {
    try {
      const response = await axios.put(
        `${this.configService.get('API_URL')}/admin/plans/${id}`,
        data,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await this.configService.get('ADMIN_TOKEN')}`,
          },
        }
      );

      return response.data;
    } catch (error: unknown) {
      this.logger.error('Error updating plan:', error);
      if (error instanceof AxiosError) {
        throw new HttpException(
          `Error updating plan: ${error.response?.data?.message || error.message}`,
          error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
      throw new HttpException(
        'Error updating plan: Unknown error occurred',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}