import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { FirebaseService } from '../../../firebase/firebase.service';

@Injectable()
export class AdminAuthGuard implements CanActivate {
    private readonly logger = new Logger('AdminAuthGuard');

    constructor(private readonly firebaseService: FirebaseService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        try {
            const request = context.switchToHttp().getRequest();
            const authHeader = request.headers.authorization;
            const token = authHeader?.split('Bearer ')?.[1];

            this.logger.debug(`🔒 Validando token para ${request.method} ${request.url}`);

            if (!token) {
                this.logger.warn('❌ No se encontró token de autenticación');
                return false;
            }

            try {
                const decodedToken = await this.firebaseService.getAuth().verifyIdToken(token);
                request.user = decodedToken;

                this.logger.debug(`✅ Token válido para: ${decodedToken.email}`);
                return true;
            } catch (tokenError) {
                this.logger.error('❌ Error validando token JWT:', tokenError);

                // Verificar si es un token personalizado
                if (token.split('.').length === 3) {
                    try {
                        // Verificar contra tu lógica personalizada aquí
                        const customValidation = await this.validateCustomToken(token);
                        if (customValidation) {
                            this.logger.debug('✅ Token personalizado válido');
                            return true;
                        }
                    } catch (customError) {
                        this.logger.error('❌ Error validando token personalizado:', customError);
                    }
                }

                return false;
            }
        } catch (error) {
            this.logger.error('❌ Error en guard:', error);
            return false;
        }
    }

    private async validateCustomToken(token: string): Promise<boolean> {
        try {
            // Implementar validación de token personalizado
            const [header, payload, signature] = token.split('.');
            if (!header || !payload || !signature) {
                return false;
            }

            // Aquí puedes agregar tu lógica de validación personalizada
            // Por ejemplo, verificar contra una clave secreta, etc.

            return true;
        } catch (error) {
            this.logger.error('❌ Error validando token personalizado:', error);
            return false;
        }
    }
}
