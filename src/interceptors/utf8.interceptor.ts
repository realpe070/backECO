import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface SanitizedObject {
    [key: string]: any;
}

@Injectable()
export class Utf8Interceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        return next.handle().pipe(
            map(data => {
                if (typeof data === 'object') {
                    return this.sanitizeObject(data);
                }
                return data;
            }),
        );
    }

    private sanitizeObject(obj: any): any {
        if (obj === null || obj === undefined) return obj;

        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeObject(item));
        }

        if (typeof obj === 'object') {
            const sanitized: SanitizedObject = {};
            for (const [key, value] of Object.entries(obj)) {
                if (value !== null && value !== undefined) {
                    sanitized[key] = this.sanitizeObject(value);
                }
            }
            return sanitized;
        }

        if (typeof obj === 'string') {
            return obj
                .normalize('NFKD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^\x20-\x7E]/g, '')
                .trim();
        }

        return obj;
    }
}
