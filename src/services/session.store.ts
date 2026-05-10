import session, { SessionData } from 'express-session';
import { sessionRepository } from '../database/sequelize';

type SessionCallback<T = any> = (_error?: any, _result?: T) => void;
type SessionDataWithAuth = SessionData & {
  auth?: {
    userId?: string;
  };
};

const getUserIdFromSession = (sessionData: SessionData): string | undefined => {
  const auth = (sessionData as SessionDataWithAuth).auth;
  return auth?.userId;
};

const getExpiresAt = (sessionData: SessionData): Date => {
  const cookieExpiry = sessionData.cookie?.expires;

  if (cookieExpiry) {
    return new Date(cookieExpiry);
  }

  return new Date(Date.now() + 1000 * 60 * 60 * 8);
};

export class SequelizeSessionStore extends session.Store {
  public get = async (
    sid: string,
    callback: SessionCallback<SessionData | null>
  ): Promise<void> => {
    try {
      const storedSession = await sessionRepository.findByPk(sid);

      if (!storedSession) {
        callback(undefined, null);
        return;
      }

      if (storedSession.expires_at <= new Date()) {
        await sessionRepository.destroy({ where: { id: sid } });
        callback(undefined, null);
        return;
      }

      callback(undefined, storedSession.data as SessionData);
    } catch (error) {
      callback(error);
    }
  };

  public set = async (
    sid: string,
    sessionData: SessionData,
    callback?: SessionCallback
  ): Promise<void> => {
    try {
      const existingSession = await sessionRepository.findByPk(sid);
      const userId = getUserIdFromSession(sessionData);

      const expiresAt = getExpiresAt(sessionData);

      if (existingSession) {
        await existingSession.update({
          user_id: userId,
          data: sessionData,
          expires_at: expiresAt
        });
      } else {
        await sessionRepository.create({
          id: sid,
          user_id: userId,
          data: sessionData,
          expires_at: expiresAt
        });
      }

      callback?.();
    } catch (error) {
      callback?.(error);
    }
  };

  public destroy = async (
    sid: string,
    callback?: SessionCallback
  ): Promise<void> => {
    try {
      await sessionRepository.destroy({ where: { id: sid } });
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  };

  public touch = async (
    sid: string,
    sessionData: SessionData,
    callback?: SessionCallback
  ): Promise<void> => {
    try {
      const existingSession = await sessionRepository.findByPk(sid);

      if (!existingSession) {
        callback?.();
        return;
      }

      await existingSession.update({
        expires_at: getExpiresAt(sessionData),
        user_id: getUserIdFromSession(sessionData),
        data: sessionData
      });

      callback?.();
    } catch (error) {
      callback?.(error);
    }
  };
}

export default SequelizeSessionStore;
