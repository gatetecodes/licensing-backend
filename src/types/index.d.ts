import 'express-session';
import type User from '../database/models/user.model';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      requestId?: string;
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    auth?: {
      userId: string;
    };
    csrfToken?: string;
  }
}
