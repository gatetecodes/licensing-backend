import crypto from 'crypto';
import { Transaction } from 'sequelize';
import { userAuditLogRepository } from '../database/sequelize';
import { UserAuditLogActionType } from '../types/user-audit-log.types';

type UserAuditContext = {
  userId: string;
  actionType: UserAuditLogActionType;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  transaction?: Transaction;
};

class UserAuditService {
  public readonly writeAuditEvent = async (
    context: UserAuditContext
  ): Promise<void> => {
    const previousAuditEntry = await userAuditLogRepository.findOne({
      where: {
        user_id: context.userId
      },
      order: [
        ['occurred_at', 'DESC'],
        ['created_at', 'DESC']
      ],
      transaction: context.transaction
    });

    const previousHash = previousAuditEntry?.entry_hash;
    const occurredAt = new Date();
    const requestId = context.requestId || crypto.randomUUID();
    const payload = {
      user_id: context.userId,
      action_type: context.actionType,
      occurred_at: occurredAt.toISOString(),
      request_id: requestId,
      ip_address: context.ipAddress ?? null,
      user_agent: context.userAgent ?? null,
      metadata: context.metadata ?? {},
      previous_hash: previousHash ?? null
    };

    const entryHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');

    await userAuditLogRepository.create(
      {
        user_id: context.userId,
        action_type: context.actionType,
        occurred_at: occurredAt,
        request_id: requestId,
        ip_address: context.ipAddress,
        user_agent: context.userAgent,
        metadata: context.metadata ?? {},
        previous_hash: previousHash,
        entry_hash: entryHash
      },
      { transaction: context.transaction }
    );
  };
}

export const userAuditService = new UserAuditService();
