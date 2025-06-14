import { Controller, Get, Logger, Req } from '@nestjs/common';
import { Request } from 'express';

@Controller()
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  @Get()
  getRoot() {
    return {
      status: true,
      message: '✅ Backend de ECO está en funcionamiento',
    };
  }

  @Get('health')
  checkHealth(@Req() request: Request) {
    const clientInfo = {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      clientType: request.headers['x-client-type'],
    };

    this.logger.debug(`💓 Health check requested from: ${JSON.stringify(clientInfo)}`);

    return {
      status: true,
      message: '🩺 Health check passed',
      timestamp: new Date().toISOString(),
      service: 'mobile-app-backend',
      clientInfo,
    };
  }
}
