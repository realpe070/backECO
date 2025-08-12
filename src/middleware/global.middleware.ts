import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class GlobalMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        // Configurar headers CORS adicionales si es necesario
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, Origin');
        res.header('Access-Control-Allow-Credentials', 'true');

        // Manejar preflight OPTIONS
        if (req.method === 'OPTIONS') {
            res.sendStatus(204);
            return;
        }
        next();
    }
}
