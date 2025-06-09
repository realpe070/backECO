import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { FirebaseService } from '../../../firebase/firebase.service';
import * as jwt from 'jsonwebtoken';
import { JwtPayload } from 'jsonwebtoken';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name);
  private readonly publicPaths = [
    { path: '/admin/login', method: 'POST' },
    { path: '/health', method: 'GET' },
    { path: '/admin/health', method: 'GET' },
    { path: '/admin/check', method: 'GET' },
  ];

  constructor(private firebaseService: FirebaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { path, method } = request;

    this.logger.debug(`👉 [Auth] Checking ${method} ${path}`);
    this.logger.debug(`📨 [Auth] Headers: ${JSON.stringify(request.headers)}`);

    // Verificar si es ruta pública
    const isPublicRoute = this.publicPaths.some(
      route => route.path === path && route.method === method
    );

    if (isPublicRoute) {
      this.logger.debug(`✅ [Auth] Public route accessed: ${path}`);
      return true;
    }

    // Agregar logs específicos para rutas admin
    if (path.startsWith('/admin')) {
      this.logger.debug(`
👨‍💼 [Admin Auth] Request details:
- Path: ${path}
- Method: ${method}
- Headers: ${JSON.stringify(request.headers)}
- Origin: ${request.headers.origin}
      `);
    }

    // Mejorar logging para rutas de historial
    if (path.includes('pause-history')) {
      this.logger.debug(`
📊 [History Auth] Request details:
- Path: ${path}
- Method: ${method}
- Headers: ${JSON.stringify(request.headers)}
- Query: ${JSON.stringify(request.query)}
      `);
    }

    this.logger.debug(`🔒 [Auth] Request: ${method} ${path}`);
    this.logger.debug(`🔑 [Auth] Headers: ${JSON.stringify(request.headers)}`);

    const authHeader = request.headers.authorization;
    this.logger.debug(`🔑 [Auth] Verifying token for ${path}`);
    this.logger.debug(`Auth header present: ${!!authHeader}`);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.logger.error(`❌ [Auth] No authorization header for ${path}`);
      throw new UnauthorizedException({
        status: false,
        message: 'No authorization header found',
        error: 'AUTH_REQUIRED',
      });
    }

    const token = authHeader.split('Bearer ')[1]?.trim();

    try {
      if (!token) {
        throw new Error('No token provided');
      }

      const decodedToken = await this.verifyToken(token);
      request.user = decodedToken;

      this.logger.debug(`✅ [Auth] Authentication successful for user: ${decodedToken.email}`);
      return true;
    } catch (error) {
      this.logger.error('❌ [Auth] Authentication failed:', error);
      throw new UnauthorizedException({
        status: false,
        message: 'Invalid or expired token',
        error: 'INVALID_TOKEN',
      });
    }
  }

  private async verifyToken(token: string) {
    try {
      if (token.includes('.')) {
        const decoded = jwt.decode(token, { complete: true });
        if (decoded?.header?.kid) {
          return await this.firebaseService.verifyToken(token);
        }
      }

      const jwtSecret = process.env.JWT_SECRET || 'default_secret_key';
      return jwt.verify(token, jwtSecret) as JwtPayload;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
