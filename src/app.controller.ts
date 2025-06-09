import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello() {
    return {
      status: true,
      message: 'API is running',
      timestamp: new Date().toISOString()
    };
  }

  @Get('health')
  healthCheck() {
    return {
      status: true,
      service: 'Ecobreack API',
      timestamp: new Date().toISOString()
    };
  }
}
