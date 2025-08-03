import { Controller, Get, Logger, Req } from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';

@Controller()
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly configService: ConfigService) { }

  @Get('health')
  checkHealth(@Req() request: Request) {
    try {
      const clientInfo = {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        clientType: request.headers['x-client-type']
      };

      this.logger.debug(`💓 Health check requested from: ${JSON.stringify(clientInfo)}`);

      return {
        status: true,
        message: 'Backend server is running',
        timestamp: new Date().toISOString(),
        service: 'mobile-app-backend',
        environment: this.configService.get('NODE_ENV'),
        clientInfo
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      throw error;
    }
  }
}
