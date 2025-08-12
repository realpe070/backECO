import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import * as os from 'os';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { Logger } from '@nestjs/common';
import cors from 'cors';  // Actualizado para usar import ES6
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

    // Configurar CORS antes que cualquier otro middleware
    app.enableCors({
      origin: [
        'http://localhost:3000',     // Flutter web en desarrollo
        'http://localhost:4200',     // Flutter web alternativo
        'https://sst-admin.web.app', // Flutter web en producción
      ],
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      credentials: true,
    });

    // Health check endpoint antes de cualquier middleware o configuración
    app.use('/health', (req: Request, res: Response) => {
      res.json({
        status: true,
        message: 'Backend server is running',
        timestamp: new Date().toISOString(),
        service: 'mobile-app-backend',
        environment: process.env.NODE_ENV || 'development'
      });
    });

    // Configuración de prefijo global para la API
    app.setGlobalPrefix('api');

    // Optimizations for production
    if (process.env.NODE_ENV === 'production') {
      app.enableShutdownHooks();
      app.enableCors({
        origin: [
          'http://localhost:3000',
          'http://localhost:8080',
          'http://localhost:4200',
          'https://ecoadmin.onrender.com',  // Ajusta según tu dominio real del admin
          'https://ecoapp.onrender.com'     // Ajusta según tu dominio real de la app
        ],
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
        allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
      });
    } else {
      // Actualizar configuración CORS
      app.enableCors({
        origin: '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        allowedHeaders: [
          'Content-Type',
          'Accept',
          'Authorization',
          'x-client-type',
          'Origin',
          'Access-Control-Allow-Origin',
          'Access-Control-Allow-Credentials',
          'Access-Control-Allow-Methods',
          'X-Requested-With'
        ],
        exposedHeaders: ['Authorization'],
        credentials: true,
        maxAge: 3600
      });

      // Middleware mejorado para autenticación y CORS
      app.use((req: any, res: any, next: any) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
        res.header(
          'Access-Control-Allow-Headers',
          'Content-Type, Accept, Authorization, x-client-type, Origin, Access-Control-Allow-Origin, X-Requested-With'
        );

        // Manejo especial para preflight requests
        if (req.method === 'OPTIONS') {
          res.header('Access-Control-Max-Age', '3600');
          res.status(204).end();
          return;
        }

        // Logging de token para debugging
        const token = req.headers.authorization;
        if (token) {
          logger.debug(`🔑 Token received: ${token.substring(0, 20)}...`);
        }

        next();
      });

      // Middleware para logging mejorado
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

