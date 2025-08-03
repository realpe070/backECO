import { Injectable, CanActivate, ExecutionContext, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { FirebaseService } from '../../../firebase/firebase.service';

@Injectable()
export class AdminAuthGuard implements CanActivate {
    private readonly logger = new Logger(AdminAuthGuard.name);
    private readonly JWT_SECRET: string;

    constructor(
        private readonly firebaseService: FirebaseService,
        private readonly configService: ConfigService,
    ) {
        this.JWT_SECRET = this.configService.get<string>('JWT_SECRET') || 'default_secret_key';
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const token = this.extractToken(request);

        if (!token) {
            throw new UnauthorizedException('No token provided');
        }

        try {
            // First try to verify as a custom JWT token
            try {
                const decoded = jwt.verify(token, this.JWT_SECRET) as any;
                if (decoded.role === 'admin') {
                    request.user = decoded;
                    return true;
                }
            } catch (jwtError) {
                this.logger.debug('Not a custom JWT token, trying Firebase...');
            }

            // If not a custom token, try Firebase
            const decodedToken = await this.firebaseService.verifyToken(token);
            request.user = decodedToken;
            return true;
        } catch (error) {
            this.logger.error('❌ Error verifying token:', error);
            throw new UnauthorizedException('Invalid token');
        }
    }

    private extractToken(request: any): string | null {
        const authHeader = request.headers.authorization;
        if (!authHeader) {
            return null;
        }
        const [type, token] = authHeader.split(' ');
        return type === 'Bearer' ? token : null;
    }
}
