import { Request } from 'express';

declare module 'express' {
  interface Request {
    user?: {
      uid: string;
      email?: string;
      role?: string;
      disabled?: boolean;
      metadata?: any;
      verified?: boolean;
    };
  }
}
