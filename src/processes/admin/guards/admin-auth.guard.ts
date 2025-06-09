import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { FirebaseService } from '../../../firebase/firebase.service';

@Injectable()
export class AdminAuthGuard implements CanActivate {
    constructor(private firebaseService: FirebaseService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const token = request.headers.authorization;

        if (!token) {
            throw new UnauthorizedException('No authorization header found');
        }

        try {
            const decodedToken = await this.firebaseService.verifyToken(token);
            request.user = decodedToken;
            return decodedToken.role === 'admin';
        } catch (error) {
            throw new UnauthorizedException('Invalid token');
        }
    }
}
