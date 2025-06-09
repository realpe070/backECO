import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import * as os from 'os';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { Logger } from '@nestjs/common';

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
      logger: ['error', 'warn', 'debug', 'log', 'verbose'],
    });
    const configService = app.get(ConfigService);
    const networkIP = getNetworkInfo();
    const logger = new Logger('Bootstrap');
    const port = configService.get('PORT') || 4300;
    const environment = configService.get('NODE_ENV') || 'development';

    // Actualizar configuración CORS
    app.enableCors({
      origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
        const allowedOrigins = [
          'http://localhost:3000',
          'http://localhost:4200',
          'http://localhost:4300',
          'http://localhost:54991',
          'http://127.0.0.1:54991',
          'http://localhost:*',
          'http://127.0.0.1:*'
        ];

        if (!origin || allowedOrigins.some(allowed =>
          origin.match(new RegExp(allowed.replace('*', '.*')))
        )) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
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
      const origin = req.headers.origin;
      res.header('Access-Control-Allow-Origin', origin);
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

    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

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
  } catch (error) {
    console.error('❌ Server startup error:', error);
    process.exit(1);
  }
}
bootstrap();

