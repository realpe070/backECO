import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  getHealth() {
    return {
      status: true,
      message: 'Backend server is running',
      timestamp: new Date().toISOString(),
      service: 'mobile-app-backend',
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
