import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import * as os from 'os';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { Logger, ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as bodyParser from 'body-parser';
import { Request, Response, NextFunction } from 'express';
import { Utf8Interceptor } from './interceptors/utf8.interceptor';

// Cargar el archivo de entorno correcto
const environment = process.env.NODE_ENV || 'development';
dotenv.config({ path: `.env.${environment}` });

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
      server.once('error', (err: NodeJS.ErrnoException) => {
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
      logger: ['error', 'warn', 'debug', 'log', 'verbose'],
    });
    const configService = app.get(ConfigService);
    const networkIP = getNetworkInfo();
    const logger = new Logger('Bootstrap');
    const initialPort = configService.get('PORT') || 4300;
    const environment = configService.get('NODE_ENV') || 'development';

    // Force response JSON with UTF-8 charset
    app.use((req: Request, res: Response, next: NextFunction) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      next();
    });

    // Ensure body parsing uses UTF-8 (if not already set)
    app.use(bodyParser.json({ type: 'application/json', limit: '50mb' }));

    // Force JSON response encoding
    app.use((req: Request, res: Response, next: NextFunction) => {
      const originalJson = res.json;
      res.json = function (body: any): Response {
        if (body && typeof body === 'object') {
          // Ensure all strings are properly encoded
          const processValue = (value: any): any => {
            if (typeof value === 'string') {
              return value
                .normalize('NFKD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^\x20-\x7E]/g, '')
                .trim();
            }
            if (Array.isArray(value)) {
              return value.map(processValue);
            }
            if (value && typeof value === 'object') {
              return Object.fromEntries(
                Object.entries(value).map(([k, v]) => [k, processValue(v)])
              );
            }
            return value;
          };
          body = processValue(body);
        }
        return originalJson.call(this, body);
      };
      next();
    });

    // Try to find an available port
    let port: number;
    try {
      port = await findAvailablePort(initialPort);
      logger.log(`Found available port: ${port}`);
    } catch (error: unknown) {
      const err = error as Error;
      logger.error(`Failed to find available port: ${err.message}`);
      process.exit(1);
    }

    const corsOrigins = configService.get('CORS_ORIGINS')?.split(',') || ['*'];

    // Actualizar configuración CORS
    app.enableCors({
      origin: true, // Permite todas las origenes en desarrollo
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
    app.use((req: Request, res: Response, next: NextFunction) => {
      const origin = req.headers.origin;
      res.header('Access-Control-Allow-Origin', origin || '*');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
      res.header(
        'Access-Control-Allow-Headers',
        'Content-Type, Accept, Authorization, x-client-type, Origin, Access-Control-Allow-Origin, Access-Control-Allow-Credentials, Access-Control-Allow-Methods, X-Requested-With'
      );

      // Manejo especial para preflight requests
      if (req.method === 'OPTIONS') {
        res.header('Access-Control-Max-Age', '3600');
        res.status(204).end();
        return;
      }

      next();
    });

    // Middleware para logging mejorado
    app.use((req: Request, res: Response, next: NextFunction) => {
      const clientType = req.headers['x-client-type'] || 'unknown';
      const origin = req.headers.origin || 'unknown';
      logger.debug(`📡 [${clientType}] ${req.method} ${req.path} from ${origin}`);
      next();
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(
      new TransformInterceptor(),
      new Utf8Interceptor(),
    );

    console.log(`
🔍 Server Configuration:
- Public URL: http://${networkIP}:${port}
- Local URL: http://localhost:${port}
- Environment: ${environment}
- Admin Email: ${configService.get('ADMIN_EMAIL')}
- Firebase Project: ${configService.get('FIREBASE_PROJECT_ID')}
    `);

    await app.listen(port, '0.0.0.0');
    logger.log(`🚀 Server running on port ${port} in ${environment} mode`);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('❌ Server startup error:', err);
    process.exit(1);
  }
}
bootstrap();

// Manejo de errores no capturados
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
});

