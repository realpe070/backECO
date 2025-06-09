import { Controller, Get, Logger, Req } from '@nestjs/common';
import { Request } from 'express';

@Controller('app-health')
export class HealthAppController {
  private readonly logger = new Logger(HealthAppController.name);

  @Get()
  checkAppHealth(@Req() request: Request) {
    const clientInfo = {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      clientType: request.headers['x-client-type'] || 'mobile'
    };

    this.logger.debug(`📱 Mobile app health check: ${JSON.stringify(clientInfo)}`);

    return {
      status: true,
      message: 'Mobile app backend is running',
      timestamp: new Date().toISOString(),
      service: 'mobile-app-backend',
      clientInfo
    };
  }
}
