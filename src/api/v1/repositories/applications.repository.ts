import crypto from 'crypto';
import { NextFunction, Response } from 'express';
import { Op } from 'sequelize';
import { BaseRepository } from './base.repository';
import ApplicationModel from '../../../database/models/application.model';
import ApplicationReviewModel from '../../../database/models/application-review.model';
import {
  applicationRepository,
  documentRepository,
  applicationReviewRepository
} from '../../../database/sequelize';
import { responseWrapper } from '../../../helpers/response-wrapper';
import { logger, log } from '../../../helpers/logger-helper';
import { LoggerEvents } from '../../../constants/logger-events';
import httpCodes from '../../../constants/http-codes';
import {
  ApplicationReviewOutcomes,
  ApplicationStates,
  IApplicationDraftBody,
  IApplicationDraftUpdateBody,
  IApplicationListQuery,
  IWorkflowActionBody,
  IWorkflowResponseBody,
  IWorkflowRequestItem,
  IWorkflowResponseItem
} from '../../../types/application.types';
import { Roles } from '../../../types/role.types';
import { DocumentTypes } from '../../../types/document.types';
import WorkflowService, {
  WorkflowServiceError
} from '../../../services/workflow.service';
import { AuthenticatedRequest } from '../../../types/common.types';
import { getPrimaryRole } from '../../../helpers/auth-helper';
import {
  buildApplicationCountCacheKey,
  buildApplicationDetailCacheKey,
  buildApplicationListCacheKey,
  getApplicationCountCache,
  getApplicationDetailCache,
  getApplicationsListCache,
  getInternalCacheUserId,
  getListStateForInternalUsers,
  setApplicationCountCache,
  setApplicationDetailCache,
  setApplicationsListCache,
  invalidateApplicationReadCaches
} from '../../../helpers/application-cache.helper';

const requiredSubmissionDocumentTypes = [
  DocumentTypes.BUSINESS_PLAN,
  DocumentTypes.CERTIFICATE_OF_INCORPORATION,
  DocumentTypes.SHAREHOLDING_STRUCTURE,
  DocumentTypes.CAPITAL_ADEQUACY_EVIDENCE,
  DocumentTypes.GOVERNANCE_DOCUMENT
];

const sanitizeApplication = (application: ApplicationModel) => ({
  id: application.id,
  reference_number: application.reference_number,
  applicant_id: application.applicant_id,
  institution_name: application.institution_name,
  institution_type: application.institution_type,
  business_address: application.business_address,
  contact_name: application.contact_name,
  contact_email: application.contact_email,
  contact_phone: application.contact_phone,
  license_category: application.license_category,
  license_category_other_details: application.license_category_other_details,
  capital_amount_rwf: application.capital_amount_rwf,
  incorporation_date: application.incorporation_date,
  business_summary: application.business_summary,
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

const sanitizeInfoRequest = (
  review: {
    notes?: string | null;
    completed_at?: Date | null;
    request_items?: IWorkflowRequestItem[] | null;
    applicant_responses?: IWorkflowResponseItem[] | null;
    responded_at?: Date | null;
  } | null
) =>
  review?.completed_at
    ? {
        reviewer_summary_note: review.notes ?? null,
        requested_at: review.completed_at,
        request_items: review.request_items ?? [],
        applicant_responses: review.applicant_responses ?? null,
        responded_at: review.responded_at ?? null
      }
    : null;

export class ApplicationsRepository extends BaseRepository<ApplicationModel> {
  private readonly workflowService: WorkflowService;

  constructor() {
    super(applicationRepository);
    this.workflowService = new WorkflowService();
  }

  /**
   * @description Create a new application draft
   * @param req - The request object
   * @param res - The response object
   * @param next - The next function
   * @returns - The response object
   */

  public createApplication = async (
    req: AuthenticatedRequest<{}, IApplicationDraftBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    logger.info(
      log({
        event: LoggerEvents.APPLICATION_CREATE_INIT,
        payload: req.body,
        user: req.user,
        requestId: req.requestId
      })
    );

    try {
      const application = await applicationRepository.create({
        reference_number: this.generateReferenceNumber(),
        applicant_id: req.user!.id,
        institution_name: req.body.institution_name,
        institution_type: req.body.institution_type,
        business_address: req.body.business_address,
        contact_name: req.body.contact_name,
        contact_email: req.body.contact_email,
        contact_phone: req.body.contact_phone,
        license_category: req.body.license_category,
        license_category_other_details: req.body.license_category_other_details,
        capital_amount_rwf: req.body.capital_amount_rwf,
        incorporation_date: req.body.incorporation_date,
        business_summary: req.body.business_summary,
        current_state: ApplicationStates.DRAFT
      });
      await invalidateApplicationReadCaches(application.id);

      logger.info(
        log({
          event: LoggerEvents.APPLICATION_CREATE_SUCCESS,
          data: { applicationId: application.id },
          user: req.user,
          requestId: req.requestId
        })
      );

      responseWrapper({
        res,
        status: httpCodes.OK,
        message: 'Application draft created successfully',
        data: {
          application: sanitizeApplication(application)
        }
      });
      return;
    } catch (error) {
      logger.error(
        log({
          event: LoggerEvents.APPLICATION_CREATE_FAILED,
          payload: req.body,
          user: req.user,
          requestId: req.requestId,
          error
        })
      );
      return next(error);
    }
  };

  /**
   * @description Get all applications
   * @param req - The request object
   * @param res - The response object
   * @param next - The next function
   * @returns - The response object
   */

  public getApplications = async (
    req: AuthenticatedRequest<
      Record<string, never>,
      Record<string, never>,
      IApplicationListQuery
    >,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    logger.info(
      log({
        event: LoggerEvents.APPLICATION_LIST_INIT,
        payload: req.query,
        user: req.user,
        requestId: req.requestId
      })
    );

    try {
      const role = getPrimaryRole(req);

      if (!role) {
        responseWrapper({
          res,
          status: httpCodes.FORBIDDEN,
          message: 'FORBIDDEN'
        });
        return;
      }

      const currentState = req.query.current_state;

      if (role === Roles.APPLICANT) {
        const listCacheKey = buildApplicationListCacheKey(
          role,
          req.user!.id,
          currentState
        );
        const countCacheKey = buildApplicationCountCacheKey(
          role,
          req.user!.id,
          currentState
        );

        const [cachedItems, cachedCount] = await Promise.all([
          getApplicationsListCache(listCacheKey),
          getApplicationCountCache(countCacheKey)
        ]);

        if (cachedItems && cachedCount !== null) {
          responseWrapper({
            res,
            status: httpCodes.OK,
            message: 'Applications fetched successfully',
            data: {
              items: cachedItems,
              count: cachedCount
            }
          });
          return;
        }

        const applications = await applicationRepository.findAll({
          where: {
            applicant_id: req.user!.id,
            ...(currentState ? { current_state: currentState } : {})
          },
          order: [['updated_at', 'DESC']]
        });
        const items = applications.map(sanitizeApplication);

        await Promise.all([
          setApplicationsListCache(listCacheKey, items),
          setApplicationCountCache(countCacheKey, items.length)
        ]);

        responseWrapper({
          res,
          status: httpCodes.OK,
          message: 'Applications fetched successfully',
          data: {
            items,
            count: items.length
          }
        });
        return;
      }

      if (!this.workflowService.isInternalViewerRole(role)) {
        responseWrapper({
          res,
          status: httpCodes.FORBIDDEN,
          message: 'FORBIDDEN'
        });
        return;
      }

      if (currentState === ApplicationStates.DRAFT) {
        responseWrapper({
          res,
          status: httpCodes.OK,
          message: 'Applications fetched successfully',
          data: {
            items: []
          }
        });
        return;
      }

      const internalState = getListStateForInternalUsers(currentState);
      const internalUserId = getInternalCacheUserId();
      const listCacheKey = buildApplicationListCacheKey(
        role,
        internalUserId,
        internalState
      );
      const countCacheKey = buildApplicationCountCacheKey(
        role,
        internalUserId,
        internalState
      );

      const [cachedItems, cachedCount] = await Promise.all([
        getApplicationsListCache(listCacheKey),
        getApplicationCountCache(countCacheKey)
      ]);

      if (cachedItems && cachedCount !== null) {
        responseWrapper({
          res,
          status: httpCodes.OK,
          message: 'Applications fetched successfully',
          data: {
            items: cachedItems,
            count: cachedCount
          }
        });
        return;
      }

      const applications = await applicationRepository.findAll({
        where: {
          current_state: currentState || {
            [Op.ne]: ApplicationStates.DRAFT
          }
        },
        order: [['updated_at', 'DESC']]
      });
      const items = applications.map(sanitizeApplication);

      await Promise.all([
        setApplicationsListCache(listCacheKey, items),
        setApplicationCountCache(countCacheKey, items.length)
      ]);

      logger.info(
        log({
          event: LoggerEvents.APPLICATION_LIST_SUCCESS,
          data: { count: applications.length },
          user: req.user,
          requestId: req.requestId
        })
      );

      responseWrapper({
        res,
        status: httpCodes.OK,
        message: 'Applications fetched successfully',
        data: {
          items,
          count: items.length
        }
      });
      return;
    } catch (error) {
      logger.error(
        log({
          event: LoggerEvents.APPLICATION_LIST_FAILED,
          payload: req.query,
          user: req.user,
          requestId: req.requestId,
          error
        })
      );
      return next(error);
    }
  };

  /**
   * @description Get an application by id
   * @param req - The request object
   * @param res - The response object
   * @param next - The next function
   * @returns - The response object
   */

  public getApplication = async (
    req: AuthenticatedRequest<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    logger.info(
      log({
        event: LoggerEvents.APPLICATION_DETAIL_INIT,
        payload: req.params,
        user: req.user,
        requestId: req.requestId
      })
    );

    try {
      const detailCacheKey = buildApplicationDetailCacheKey(req.params.id);
      const role = getPrimaryRole(req);
      const cached = await getApplicationDetailCache(detailCacheKey);

      if (cached && typeof cached === 'object') {
        const cachedApplication = cached as ReturnType<
          typeof sanitizeApplication
        > & {
          latest_info_request?: {
            reviewer_summary_note: string | null;
            requested_at: Date;
            request_items: IWorkflowRequestItem[];
            applicant_responses?: IWorkflowResponseItem[] | null;
            responded_at?: Date | null;
          } | null;
        };

        if (
          role === Roles.APPLICANT &&
          cachedApplication.applicant_id !== req.user!.id
        ) {
          responseWrapper({
            res,
            status: httpCodes.NOT_FOUND,
            message: 'Application not found'
          });
          return;
        }

        if (
          role &&
          this.workflowService.isInternalViewerRole(role) &&
          cachedApplication.current_state === ApplicationStates.DRAFT
        ) {
          responseWrapper({
            res,
            status: httpCodes.NOT_FOUND,
            message: 'Application not found'
          });
          return;
        }

        if (
          role !== Roles.APPLICANT &&
          (!role || !this.workflowService.isInternalViewerRole(role))
        ) {
          responseWrapper({
            res,
            status: httpCodes.FORBIDDEN,
            message: 'FORBIDDEN'
          });
          return;
        }

        responseWrapper({
          res,
          status: httpCodes.OK,
          message: 'Application fetched successfully',
          data: {
            application: cachedApplication
          }
        });
        return;
      }

      const application = await applicationRepository.findByPk(req.params.id);

      if (!application) {
        responseWrapper({
          res,
          status: httpCodes.NOT_FOUND,
          message: 'Application not found'
        });
        return;
      }

      //Prevent applicant from accessing an application that is not theirs
      if (
        role === Roles.APPLICANT &&
        application.applicant_id !== req.user!.id
      ) {
        responseWrapper({
          res,
          status: httpCodes.NOT_FOUND,
          message: 'Application not found'
        });
        return;
      }

      //Prevent internal viewers from accessing a draft application
      if (
        role &&
        this.workflowService.isInternalViewerRole(role) &&
        application.current_state === ApplicationStates.DRAFT
      ) {
        responseWrapper({
          res,
          status: httpCodes.NOT_FOUND,
          message: 'Application not found'
        });
        return;
      }

      //Prevent non-applicants and non-internal viewers from accessing an application
      if (
        role !== Roles.APPLICANT &&
        (!role || !this.workflowService.isInternalViewerRole(role))
      ) {
        responseWrapper({
          res,
          status: httpCodes.FORBIDDEN,
          message: 'FORBIDDEN'
        });
        return;
      }

      logger.info(
        log({
          event: LoggerEvents.APPLICATION_DETAIL_SUCCESS,
          data: { applicationId: application.id },
          user: req.user,
          requestId: req.requestId
        })
      );

      const latestInfoRequest = await applicationReviewRepository.findOne({
        where: {
          application_id: application.id,
          outcome: ApplicationReviewOutcomes.INFO_REQUESTED,
          completed_at: {
            [Op.ne]: null
          }
        },
        order: [['completed_at', 'DESC']]
      });

      const latestReview = await applicationReviewRepository.findOne({
        where: {
          application_id: application.id,
          completed_at: {
            [Op.ne]: null
          }
        },
        order: [['completed_at', 'DESC']]
      });

      const serializedApplication = {
        ...sanitizeApplication(application),
        latest_review: sanitizeReview(latestReview),
        latest_info_request: sanitizeInfoRequest(latestInfoRequest)
      };

      responseWrapper({
        res,
        status: httpCodes.OK,
        message: 'Application fetched successfully',
        data: {
          application: serializedApplication
        }
      });
      await setApplicationDetailCache(detailCacheKey, serializedApplication);
      return;
    } catch (error) {
      logger.error(
        log({
          event: LoggerEvents.APPLICATION_DETAIL_FAILED,
          payload: req.params,
          user: req.user,
          requestId: req.requestId,
          error
        })
      );
      return next(error);
    }
  };

  /**
   * @description Update a draft application
   * @param req - The request object
   * @param res - The response object
   * @param next - The next function
   * @returns - The response object
   */
  public updateApplicationDraft = async (
    req: AuthenticatedRequest<{ id: string }, IApplicationDraftUpdateBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    logger.info(
      log({
        event: LoggerEvents.APPLICATION_UPDATE_DRAFT_INIT,
        payload: { ...req.params, ...req.body },
        user: req.user,
        requestId: req.requestId
      })
    );

    try {
      const application = await applicationRepository.findByPk(req.params.id);

      //Prevent non-applicants from updating a draft application
      if (!application || application.applicant_id !== req.user!.id) {
        responseWrapper({
          res,
          status: httpCodes.NOT_FOUND,
          message: 'Application not found'
        });
        return;
      }

      //Prevent updating an application outside editable states
      if (
        application.current_state !== ApplicationStates.DRAFT &&
        application.current_state !== ApplicationStates.INFO_REQUESTED
      ) {
        responseWrapper({
          res,
          status: httpCodes.CONFLICT,
          message:
            application.current_state === ApplicationStates.APPROVED ||
            application.current_state === ApplicationStates.REJECTED
              ? 'Final application decisions are immutable'
              : 'Application can only be edited while drafting or responding to requested information.'
        });
        return;
      }

      //Prevent updating a draft application with an incorrect lock version
      if (application.lock_version !== req.body.lock_version) {
        responseWrapper({
          res,
          status: httpCodes.CONFLICT,
          message: 'Application state changed. Refresh and retry.'
        });
        return;
      }

      await application.update({
        institution_name: req.body.institution_name,
        institution_type: req.body.institution_type,
        business_address: req.body.business_address,
        contact_name: req.body.contact_name,
        contact_email: req.body.contact_email,
        contact_phone: req.body.contact_phone,
        license_category: req.body.license_category,
        license_category_other_details: req.body.license_category_other_details,
        capital_amount_rwf: req.body.capital_amount_rwf,
        incorporation_date: req.body.incorporation_date,
        business_summary: req.body.business_summary,
        lock_version: application.lock_version + 1
      });
      await invalidateApplicationReadCaches(application.id);

      logger.info(
        log({
          event: LoggerEvents.APPLICATION_UPDATE_DRAFT_SUCCESS,
          data: { applicationId: application.id },
          user: req.user,
          requestId: req.requestId
        })
      );

      responseWrapper({
        res,
        status: httpCodes.OK,
        message: 'Application draft updated successfully',
        data: {
          application: sanitizeApplication(application)
        }
      });
      return;
    } catch (error) {
      logger.error(
        log({
          event: LoggerEvents.APPLICATION_UPDATE_DRAFT_FAILED,
          payload: { ...req.params, ...req.body },
          user: req.user,
          requestId: req.requestId,
          error
        })
      );
      return next(error);
    }
  };

  /**
   * @description Submit an application
   * @param req - The request object
   * @param res - The response object
   * @param next - The next function
   * @returns - The response object
   */

  public submitApplication = async (
    req: AuthenticatedRequest<{ id: string }, IWorkflowActionBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const submissionReadinessError = await this.getSubmissionReadinessError(
      req.user!.id,
      req.params.id
    );
    if (submissionReadinessError) {
      responseWrapper({
        res,
        status: httpCodes.UNPROCESSABLE_ENTITY,
        message: submissionReadinessError
      });
      return;
    }

    await this.handleWorkflowMutation({
      req,
      res,
      next,
      initEvent: LoggerEvents.APPLICATION_SUBMIT_INIT,
      successEvent: LoggerEvents.APPLICATION_SUBMIT_SUCCESS,
      failureEvent: LoggerEvents.APPLICATION_SUBMIT_FAILED,
      successMessage: 'Application submitted successfully',
      run: () =>
        this.workflowService.submitApplication({
          applicationId: req.params.id,
          lockVersion: req.body.lock_version,
          actingUserId: req.user!.id,
          actingRole: Roles.APPLICANT,
          requestId: req.requestId,
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        })
    });
  };

  /**
   * @description Resubmit an application
   * @param req - The request object
   * @param res - The response object
   * @param next - The next function
   * @returns - The response object
   */

  public resubmitApplication = async (
    req: AuthenticatedRequest<{ id: string }, IWorkflowResponseBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    await this.handleWorkflowMutation({
      req,
      res,
      next,
      initEvent: LoggerEvents.APPLICATION_RESUBMIT_INIT,
      successEvent: LoggerEvents.APPLICATION_RESUBMIT_SUCCESS,
      failureEvent: LoggerEvents.APPLICATION_RESUBMIT_FAILED,
      successMessage: 'Application resubmitted successfully',
      run: () =>
        this.workflowService.resubmitApplication({
          applicationId: req.params.id,
          lockVersion: req.body.lock_version,
          responses: req.body.responses,
          actingUserId: req.user!.id,
          actingRole: Roles.APPLICANT,
          requestId: req.requestId,
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        })
    });
  };

  /**
   * @description an abstract method to handle workflow mutations
   * @param req - The request object
   * @param res - The response object
   * @param next - The next function
   * @param initEvent - The initial event
   * @param successEvent - The success event
   * @param failureEvent - The failure event
   * @param successMessage - The success message
   * @param run - The function to run
   * @returns
   */
  private readonly handleWorkflowMutation = async ({
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
          application: sanitizeApplication(application)
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

  /**
   * @description Generate a reference number
   * @returns - The reference number
   */
  private readonly generateReferenceNumber = (): string => {
    const year = new Date().getFullYear();
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `BNR/${year}/${random}`;
  };

  private readonly getSubmissionReadinessError = async (
    applicantId: string,
    applicationId: string
  ): Promise<string | null> => {
    const application = await applicationRepository.findByPk(applicationId);
    if (!application || application.applicant_id !== applicantId) {
      return null;
    }

    const missingFields = [
      !application.institution_name ? 'institution_name' : null,
      !application.institution_type ? 'institution_type' : null,
      !application.business_address ? 'business_address' : null,
      !application.contact_name ? 'contact_name' : null,
      !application.contact_email ? 'contact_email' : null,
      !application.contact_phone ? 'contact_phone' : null,
      !application.license_category ? 'license_category' : null,
      application.license_category === 'OTHER' &&
      !application.license_category_other_details
        ? 'license_category_other_details'
        : null,
      application.capital_amount_rwf === null ||
      application.capital_amount_rwf === undefined
        ? 'capital_amount_rwf'
        : null,
      !application.incorporation_date ? 'incorporation_date' : null,
      !application.business_summary ? 'business_summary' : null
    ].filter(Boolean) as string[];

    if (missingFields.length > 0) {
      return `Complete required draft fields before submit: ${missingFields.join(', ')}`;
    }

    const documents = await documentRepository.findAll({
      where: {
        application_id: applicationId
      }
    });
    const uploadedTypes = new Set(documents.map((doc) => doc.document_type));
    const missingDocumentTypes = requiredSubmissionDocumentTypes.filter(
      (type) => !uploadedTypes.has(type)
    );

    if (missingDocumentTypes.length > 0) {
      return `Upload all required documents before submit: ${missingDocumentTypes.join(', ')}`;
    }

    return null;
  };
}

export default ApplicationsRepository;
