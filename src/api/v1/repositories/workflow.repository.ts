import { NextFunction, Request, Response } from 'express';
import { Op } from 'sequelize';
import { responseWrapper } from '../../../helpers/response-wrapper';
import { logger, log } from '../../../helpers/logger-helper';
import { LoggerEvents } from '../../../constants/logger-events';
import httpCodes from '../../../constants/http-codes';
import {
  IWorkflowActionBody,
  IWorkflowDecisionBody,
  IWorkflowNotesBody,
  IWorkflowRequestInformationBody
} from '../../../types/application.types';
import { Roles } from '../../../types/role.types';
import WorkflowService, {
  WorkflowServiceError
} from '../../../services/workflow.service';
import ApplicationModel from '../../../database/models/application.model';
import User from '../../../database/models/user.model';
import ApplicationReviewModel from '../../../database/models/application-review.model';
import { applicationReviewRepository } from '../../../database/sequelize';
import { invalidateApplicationReadCaches } from '../../../helpers/application-cache.helper';
import { WorkflowRequestItemInput } from '../../../types/workflow.types';

type AuthenticatedRequest<Params = { id?: string }, Body = unknown> = Request<
  Params,
  {},
  Body
> & {
  user?: User;
  requestId?: string;
};

const serializeApplication = (application: ApplicationModel) => ({
  id: application.id,
  reference_number: application.reference_number,
  applicant_id: application.applicant_id,
  institution_name: application.institution_name,
  institution_type: application.institution_type,
  current_state: application.current_state,
  submitted_at: application.submitted_at,
  reviewed_by_id: application.reviewed_by_id,
  decisioned_by_id: application.decisioned_by_id,
  decision_at: application.decision_at,
  decision_reason: application.decision_reason,
  lock_version: application.lock_version,
  created_at: application.created_at,
  updated_at: application.updated_at
});

const sanitizeReview = (review: ApplicationReviewModel | null) =>
  review
    ? {
        id: review.id,
        reviewer_id: review.reviewer_id,
        cycle_number: review.cycle_number,
        outcome: review.outcome,
        notes: review.notes ?? null,
        completed_at: review.completed_at ?? null,
        request_items: review.request_items ?? [],
        applicant_responses: review.applicant_responses ?? null,
        responded_at: review.responded_at ?? null
      }
    : null;

export class WorkflowRepository {
  private readonly workflowService: WorkflowService;

  constructor() {
    this.workflowService = new WorkflowService();
  }

  public startReview = async (
    req: AuthenticatedRequest<{ id: string }, IWorkflowActionBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    await this.handleMutation({
      req,
      res,
      next,
      initEvent: LoggerEvents.WORKFLOW_START_REVIEW_INIT,
      successEvent: LoggerEvents.WORKFLOW_START_REVIEW_SUCCESS,
      failureEvent: LoggerEvents.WORKFLOW_START_REVIEW_FAILED,
      successMessage: 'Review started successfully',
      run: () =>
        this.workflowService.startReview({
          applicationId: req.params.id,
          lockVersion: req.body.lock_version,
          actingUserId: req.user!.id,
          actingRole: Roles.REVIEWER,
          requestId: req.requestId,
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        })
    });
  };

  public requestInformation = async (
    req: AuthenticatedRequest<{ id: string }, IWorkflowRequestInformationBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    await this.handleMutation({
      req,
      res,
      next,
      initEvent: LoggerEvents.WORKFLOW_REQUEST_INFORMATION_INIT,
      successEvent: LoggerEvents.WORKFLOW_REQUEST_INFORMATION_SUCCESS,
      failureEvent: LoggerEvents.WORKFLOW_REQUEST_INFORMATION_FAILED,
      successMessage: 'Information requested successfully',
      run: () =>
        this.workflowService.requestInformation({
          applicationId: req.params.id,
          lockVersion: req.body.lock_version,
          requestItems: req.body.request_items as WorkflowRequestItemInput[],
          reviewerSummaryNote: req.body.reviewer_summary_note || undefined,
          actingUserId: req.user!.id,
          actingRole: Roles.REVIEWER,
          requestId: req.requestId,
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        })
    });
  };

  public markReadyForDecision = async (
    req: AuthenticatedRequest<{ id: string }, IWorkflowNotesBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    await this.handleMutation({
      req,
      res,
      next,
      initEvent: LoggerEvents.WORKFLOW_MARK_READY_FOR_DECISION_INIT,
      successEvent: LoggerEvents.WORKFLOW_MARK_READY_FOR_DECISION_SUCCESS,
      failureEvent: LoggerEvents.WORKFLOW_MARK_READY_FOR_DECISION_FAILED,
      successMessage: 'Application marked ready for decision successfully',
      run: () =>
        this.workflowService.markReadyForDecision({
          applicationId: req.params.id,
          lockVersion: req.body.lock_version,
          notes: req.body.notes,
          actingUserId: req.user!.id,
          actingRole: Roles.REVIEWER,
          requestId: req.requestId,
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        })
    });
  };

  public approve = async (
    req: AuthenticatedRequest<{ id: string }, IWorkflowDecisionBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    await this.handleMutation({
      req,
      res,
      next,
      initEvent: LoggerEvents.WORKFLOW_APPROVE_INIT,
      successEvent: LoggerEvents.WORKFLOW_APPROVE_SUCCESS,
      failureEvent: LoggerEvents.WORKFLOW_APPROVE_FAILED,
      successMessage: 'Application approved successfully',
      run: () =>
        this.workflowService.approve({
          applicationId: req.params.id,
          lockVersion: req.body.lock_version,
          decisionReason: req.body.decision_reason,
          actingUserId: req.user!.id,
          actingRole: Roles.APPROVER,
          requestId: req.requestId,
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        })
    });
  };

  public reject = async (
    req: AuthenticatedRequest<{ id: string }, IWorkflowDecisionBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    await this.handleMutation({
      req,
      res,
      next,
      initEvent: LoggerEvents.WORKFLOW_REJECT_INIT,
      successEvent: LoggerEvents.WORKFLOW_REJECT_SUCCESS,
      failureEvent: LoggerEvents.WORKFLOW_REJECT_FAILED,
      successMessage: 'Application rejected successfully',
      run: () =>
        this.workflowService.reject({
          applicationId: req.params.id,
          lockVersion: req.body.lock_version,
          decisionReason: req.body.decision_reason,
          actingUserId: req.user!.id,
          actingRole: Roles.APPROVER,
          requestId: req.requestId,
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        })
    });
  };

  private readonly handleMutation = async ({
    req,
    res,
    next,
    initEvent,
    successEvent,
    failureEvent,
    successMessage,
    run
  }: {
    req: AuthenticatedRequest;
    res: Response;
    next: NextFunction;
    initEvent: string;
    successEvent: string;
    failureEvent: string;
    successMessage: string;
    run: () => Promise<ApplicationModel>;
  }): Promise<void> => {
    logger.info(
      log({
        event: initEvent,
        payload: {
          params: req.params,
          body: req.body
        },
        user: req.user,
        requestId: req.requestId
      })
    );

    try {
      const application = await run();
      await invalidateApplicationReadCaches(application.id);

      const latestReview = await applicationReviewRepository.findOne({
        where: {
          application_id: application.id,
          completed_at: {
            [Op.ne]: null
          }
        },
        order: [['completed_at', 'DESC']]
      });

      logger.info(
        log({
          event: successEvent,
          data: { applicationId: application.id },
          user: req.user,
          requestId: req.requestId
        })
      );

      responseWrapper({
        res,
        status: httpCodes.OK,
        message: successMessage,
        data: {
          application: {
            ...serializeApplication(application),
            latest_review: sanitizeReview(latestReview)
          }
        }
      });
      return;
    } catch (error) {
      if (error instanceof WorkflowServiceError) {
        responseWrapper({
          res,
          status: error.statusCode,
          message: error.message
        });
        return;
      }

      logger.error(
        log({
          event: failureEvent,
          payload: {
            params: req.params,
            body: req.body
          },
          user: req.user,
          requestId: req.requestId,
          error
        })
      );
      return next(error);
    }
  };
}

export default WorkflowRepository;
