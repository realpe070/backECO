import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import * as os from 'os';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { Logger } from '@nestjs/common';
import cors = require('cors'); // Updated to use require syntax
import { Request, Response } from 'express';

function getNetworkInfo() {
  const interfaces = os.networkInterfaces();
  let localIP = 'localhost';
  let wifiIP = '';

  for (const [name, nets] of Object.entries(interfaces)) {
    for (const net of nets || []) {
      // Skip internal and non-IPv4 addresses
      if (!net.internal && net.family === 'IPv4') {
        if (name.toLowerCase().includes('wi-fi')) {
          wifiIP = net.address;
        }
        if (!localIP || localIP === 'localhost') {
          localIP = net.address;
        }
      }
    }
  }

  // Prefer WiFi IP if available
  return wifiIP || localIP;
}

async function findAvailablePort(startPort: number): Promise<number> {
  const net = require('net');

  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();

    const tryPort = (port: number) => {
      server.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          tryPort(port + 1);
        } else {
          reject(err);
        }
      });

      server.once('listening', () => {
        server.close(() => resolve(port));
      });

      server.listen(port, '0.0.0.0');
    };

    tryPort(startPort);
  });
}

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule, {
      logger: process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'debug', 'log', 'verbose'],
    });
    const configService = app.get(ConfigService);
    const networkIP = getNetworkInfo();
    const logger = new Logger('Bootstrap');
    const environment = configService.get('NODE_ENV') || 'development';

    // Procesar CORS_ORIGIN - permite múltiples orígenes separados por coma
    const corsOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
      : ['*'];

    logger.log(`🔒 CORS habilitado para: ${corsOrigins.join(', ')}`);

    // Configurar CORS
    app.enableCors({
      origin: corsOrigins,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin'],
      credentials: true,
      preflightContinue: false,
      optionsSuccessStatus: 204
    });

    // Health check endpoint before any middleware or configuration
    app.use('/health', (req: Request, res: Response) => {
      res.json({
        status: true,
        message: 'Backend server is running',
        timestamp: new Date().toISOString(),
        service: 'mobile-app-backend',
        environment: process.env.NODE_ENV || 'development'
      });
    });

    // Prefix all routes with /api
    app.setGlobalPrefix('api');

    // Optimizations for production
    if (process.env.NODE_ENV === 'production') {
      app.enableShutdownHooks();
    } else {
      // Enhanced middleware for authentication and CORS
      app.use((req: any, res: any, next: any) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
        res.header(
          'Access-Control-Allow-Headers',
          'Content-Type, Accept, Authorization, x-client-type, Origin, Access-Control-Allow-Origin, X-Requested-With'
        );

        // Special handling for preflight requests
        if (req.method === 'OPTIONS') {
          res.header('Access-Control-Max-Age', '3600');
          res.status(204).end();
          return;
        }

        // Token logging for debugging
        const token = req.headers.authorization;
        if (token) {
          logger.debug(`🔑 Token received: ${token.substring(0, 20)}...`);
        }

        next();
      });

      // Enhanced middleware for logging
      app.use((req: any, res: any, next: any) => {
        const clientType = req.headers['x-client-type'] || 'unknown';
        const origin = req.headers.origin || 'unknown';
        logger.debug(`📡 [${clientType}] ${req.method} ${req.path} from ${origin}`);
        next();
      });
    }

    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    console.log(`
🔍 Server Configuration:
- Public URL: http://${networkIP}:${process.env.PORT || 4300}
- Local URL: http://localhost:${process.env.PORT || 4300}
- Environment: ${environment}
- Admin Email: ${configService.get('ADMIN_EMAIL')}
- Firebase Project: ${configService.get('FIREBASE_PROJECT_ID')}
    `);

    const serverPort = process.env.PORT || 4300;
    await app.listen(serverPort, '0.0.0.0');
    logger.log(`🚀 Application is running on: ${await app.getUrl()}`);
  } catch (error) {
    console.error('❌ Server startup error:', error);
    process.exit(1);
  }
}
bootstrap();

