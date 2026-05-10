import { NextFunction, Response } from 'express';
import {
  auditLogRepository
} from '../../../database/sequelize';
import { BaseRepository } from './base.repository';
import AuditLogModel from '../../../database/models/audit-log.model';
import { AuthenticatedRequest } from '../../../types/common.types';
import { responseWrapper } from '../../../helpers/response-wrapper';
import { logger, log } from '../../../helpers/logger-helper';
import { LoggerEvents } from '../../../constants/logger-events';
import { getReadableApplication } from '../../../helpers/application-access.helper';
import httpCodes from '../../../constants/http-codes';

const sanitizeAuditLog = (auditLog: AuditLogModel) => ({
  id: auditLog.id,
  application_id: auditLog.application_id,
  acting_user_id: auditLog.acting_user_id,
  acting_user_name: auditLog.acting_user?.name || 'System',
  action_type: auditLog.action_type,
  occurred_at: auditLog.occurred_at,
  before_state: auditLog.before_state,
  after_state: auditLog.after_state,
  request_id: auditLog.request_id,
  ip_address: auditLog.ip_address,
  user_agent: auditLog.user_agent,
  metadata: auditLog.metadata,
  previous_hash: auditLog.previous_hash,
  entry_hash: auditLog.entry_hash,
  created_at: auditLog.createdAt
});

export class AuditRepository extends BaseRepository<AuditLogModel> {
  constructor() {
    super(auditLogRepository);
  }

  public getApplicationAuditLog = async (
    req: AuthenticatedRequest<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    logger.info(
      log({
        event: LoggerEvents.AUDIT_LOG_LIST_INIT,
        payload: req.params,
        user: req.user,
        requestId: req.requestId
      })
    );

    try {
      const application = await getReadableApplication(req, req.params.id);

      const logs = await auditLogRepository.findAll({
        where: {
          application_id: application.id
        },
        include: [
          {
            association: 'acting_user',
            attributes: ['name']
          }
        ],
        order: [
          ['occurred_at', 'DESC'],
          ['created_at', 'DESC']
        ]
      });

      logger.info(
        log({
          event: LoggerEvents.AUDIT_LOG_LIST_SUCCESS,
          data: {
            applicationId: application.id,
            count: logs.length
          },
          user: req.user,
          requestId: req.requestId
        })
      );

      responseWrapper({
        res,
        status: httpCodes.OK,
        message: 'Audit log fetched successfully',
        data: {
          items: logs.map(sanitizeAuditLog)
        }
      });
      return;
    } catch (error) {
      logger.error(
        log({
          event: LoggerEvents.AUDIT_LOG_LIST_FAILED,
          payload: req.params,
          user: req.user,
          requestId: req.requestId,
          error
        })
      );
      return next(error);
    }
  };

}

export default AuditRepository;
