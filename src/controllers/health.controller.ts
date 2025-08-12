import { Controller, Get, Options } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: true,
      message: 'Backend server is running',
      timestamp: new Date().toISOString(),
      service: 'mobile-app-backend',
      environment: process.env.NODE_ENV || 'development',
    };
  }

  @Options()
  handleOptions() {
    return { status: 204 };
  }
}
