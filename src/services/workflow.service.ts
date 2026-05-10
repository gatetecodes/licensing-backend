import crypto from 'crypto';
import { Op, Transaction } from 'sequelize';
import {
  applicationRepository,
  applicationReviewRepository,
  auditLogRepository,
  documentRepository,
  documentVersionRepository,
  sequelize
} from '../database/sequelize';
import ApplicationModel from '../database/models/application.model';
import ApplicationReviewModel from '../database/models/application-review.model';
import { Roles, RoleType, INTERNAL_VIEWER_ROLES } from '../types/role.types';
import {
  ApplicationReviewOutcomes,
  ApplicationState,
  ApplicationStates,
  IWorkflowRequestItem,
  IWorkflowResponseItem,
  WorkflowFieldKey,
  WorkflowRequestItemTypes,
  WorkflowRequestItemType
} from '../types/application.types';
import { AuditLogActionTypes } from '../types/audit-log.types';
import httpCodes from '../constants/http-codes';
import {
  WorkflowActionInput,
  WorkflowContext,
  WorkflowNotesInput,
  WorkflowDecisionInput,
  AuditMetadata,
  WorkflowReadyForDecisionInput,
  WorkflowResubmitInput,
  WorkflowRequestItemInput
} from '../types/workflow.types';
import { workflowNotificationService } from './workflow-notification.service';
import { DocumentTypes } from '../types/document.types';

const CORE_DOCUMENT_TYPES = [
  DocumentTypes.BUSINESS_PLAN,
  DocumentTypes.CERTIFICATE_OF_INCORPORATION,
  DocumentTypes.SHAREHOLDING_STRUCTURE,
  DocumentTypes.CAPITAL_ADEQUACY_EVIDENCE,
  DocumentTypes.GOVERNANCE_DOCUMENT
];

const stringifyComparable = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }

  return String(value).trim();
};

export class WorkflowServiceError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, WorkflowServiceError.prototype);
  }
}

export class WorkflowService {
  public readonly submitApplication = async (
    input: WorkflowActionInput
  ): Promise<ApplicationModel> => {
    const application = await sequelize.transaction(async (transaction) => {
      const application = await this.getApplicationForUpdate(
        input.applicationId,
        transaction
      );

      this.checkApplicantAction(application, input);
      this.checkApplicationState(application, [ApplicationStates.DRAFT]);
      this.checkLockVersion(application, input.lockVersion);

      if (!application.institution_name || !application.institution_type) {
        throw new WorkflowServiceError(
          httpCodes.UNPROCESSABLE_ENTITY,
          'Application must include the required draft fields before submission'
        );
      }

      await application.update(
        {
          current_state: ApplicationStates.SUBMITTED,
          submitted_at: new Date(),
          lock_version: application.lock_version + 1
        },
        { transaction }
      );

      await this.writeAuditLog({
        transaction,
        application,
        context: input,
        actionType: AuditLogActionTypes.APPLICATION_SUBMITTED,
        beforeState: ApplicationStates.DRAFT,
        afterState: ApplicationStates.SUBMITTED,
        metadata: {
          submitted_at: application.submitted_at
        }
      });

      return this.reloadApplication(application.id, transaction);
    });

    await workflowNotificationService.notifyReviewersOnApplicationSubmitted({
      application
    });
    return application;
  };

  public readonly resubmitApplication = async (
    input: WorkflowResubmitInput
  ): Promise<ApplicationModel> =>
    sequelize.transaction(async (transaction) => {
      const application = await this.getApplicationForUpdate(
        input.applicationId,
        transaction
      );

      this.checkApplicantAction(application, input);
      this.checkApplicationState(application, [ApplicationStates.INFO_REQUESTED]);
      this.checkLockVersion(application, input.lockVersion);

      const latestInfoRequestReview = await this.getLatestInfoRequestReview(
        application.id,
        transaction
      );

      const requestItems = this.resolveRequestItems(latestInfoRequestReview);
      const normalizedResponses = this.normalizeResponses(input.responses);
      await this.validateRequiredRequestItems({
        application,
        requestItems,
        responses: normalizedResponses,
        requestedAt: latestInfoRequestReview.completed_at as Date,
        transaction
      });

      await latestInfoRequestReview.update(
        {
          applicant_responses: normalizedResponses,
          responded_at: new Date()
        },
        { transaction }
      );

      await application.update(
        {
          current_state: ApplicationStates.RESUBMITTED,
          lock_version: application.lock_version + 1
        },
        { transaction }
      );

      await this.writeAuditLog({
        transaction,
        application,
        context: input,
        actionType: AuditLogActionTypes.APPLICATION_RESUBMITTED,
        beforeState: ApplicationStates.INFO_REQUESTED,
        afterState: ApplicationStates.RESUBMITTED,
        metadata: {
          review_cycle_id: latestInfoRequestReview.id,
          response_count: normalizedResponses.length
        }
      });

      return this.reloadApplication(application.id, transaction);
    });

  public readonly startReview = async (
    input: WorkflowActionInput
  ): Promise<ApplicationModel> =>
    sequelize.transaction(async (transaction) => {
      const application = await this.getApplicationForUpdate(
        input.applicationId,
        transaction
      );
      const beforeState = application.current_state;

      this.checkUserRole(input.actingRole, [Roles.REVIEWER]);
      this.checkApplicationState(application, [
        ApplicationStates.SUBMITTED,
        ApplicationStates.RESUBMITTED
      ]);
      this.checkLockVersion(application, input.lockVersion);

      const cycleNumber = await this.getNextCycleNumber(application.id, transaction);

      await applicationReviewRepository.create(
        {
          application_id: application.id,
          reviewer_id: input.actingUserId,
          cycle_number: cycleNumber,
          started_at: new Date()
        },
        { transaction }
      );

      await application.update(
        {
          current_state: ApplicationStates.UNDER_REVIEW,
          lock_version: application.lock_version + 1
        },
        { transaction }
      );

      await this.writeAuditLog({
        transaction,
        application,
        context: input,
        actionType: AuditLogActionTypes.REVIEW_STARTED,
        beforeState,
        afterState: ApplicationStates.UNDER_REVIEW,
        metadata: {
          cycle_number: cycleNumber,
          reviewer_id: input.actingUserId
        }
      });

      return this.reloadApplication(application.id, transaction);
    });

  public readonly requestInformation = async (
    input: WorkflowNotesInput
  ): Promise<ApplicationModel> => {
    const application = await this.completeReviewCycleWithInfoRequest(input);

    await workflowNotificationService.notifyApplicantOnInformationRequested({
      application,
      reviewerSummaryNote: input.reviewerSummaryNote,
      requestItems: input.requestItems
    });

    return application;
  };

  public readonly markReadyForDecision = async (
    input: WorkflowReadyForDecisionInput
  ): Promise<ApplicationModel> => {
    const application = await this.completeReviewCycle({
      input,
      targetState: ApplicationStates.READY_FOR_DECISION,
      reviewOutcome: ApplicationReviewOutcomes.READY_FOR_DECISION,
      notes: input.notes,
      auditActionType: AuditLogActionTypes.APPLICATION_MARKED_AS_READY_FOR_DECISION,
      metadata: {
        notes: input.notes,
        reviewer_id: input.actingUserId
      }
    });

    await workflowNotificationService.notifyApproversOnReadyForDecision({
      application,
      notes: input.notes
    });

    return application;
  };

  public readonly approve = async (
    input: WorkflowDecisionInput
  ): Promise<ApplicationModel> =>
    this.finalizeDecision({
      input,
      targetState: ApplicationStates.APPROVED,
      auditActionType: AuditLogActionTypes.APPLICATION_APPROVED
    });

  public readonly reject = async (
    input: WorkflowDecisionInput
  ): Promise<ApplicationModel> =>
    this.finalizeDecision({
      input,
      targetState: ApplicationStates.REJECTED,
      auditActionType: AuditLogActionTypes.APPLICATION_REJECTED
    });

  public readonly isInternalViewerRole = (role: RoleType): boolean =>
    INTERNAL_VIEWER_ROLES.includes(role);

  private readonly completeReviewCycleWithInfoRequest = async (
    input: WorkflowNotesInput
  ): Promise<ApplicationModel> =>
    sequelize.transaction(async (transaction) => {
      const application = await this.getApplicationForUpdate(
        input.applicationId,
        transaction
      );

      this.checkUserRole(input.actingRole, [Roles.REVIEWER]);
      this.checkApplicationState(application, [ApplicationStates.UNDER_REVIEW]);
      this.checkLockVersion(application, input.lockVersion);

      const requestItems = this.buildRequestItems(
        input.requestItems,
        application
      );

      const summaryNote = input.reviewerSummaryNote?.trim() || null;

      const openReview = await this.getOpenReview(
        application.id,
        input.actingUserId,
        transaction
      );

      await openReview.update(
        {
          completed_at: new Date(),
          outcome: ApplicationReviewOutcomes.INFO_REQUESTED,
          notes: summaryNote,
          request_items: requestItems,
          applicant_responses: null,
          responded_at: null
        },
        { transaction }
      );

      await application.update(
        {
          current_state: ApplicationStates.INFO_REQUESTED,
          reviewed_by_id: input.actingUserId,
          lock_version: application.lock_version + 1
        },
        { transaction }
      );

      await this.writeAuditLog({
        transaction,
        application,
        context: input,
        actionType: AuditLogActionTypes.MORE_INFO_REQUESTED,
        beforeState: ApplicationStates.UNDER_REVIEW,
        afterState: ApplicationStates.INFO_REQUESTED,
        metadata: {
          reviewer_summary_note: summaryNote,
          review_cycle_id: openReview.id,
          reviewer_id: input.actingUserId,
          request_items: requestItems
        }
      });

      return this.reloadApplication(application.id, transaction);
    });

  private readonly completeReviewCycle = async ({
    input,
    targetState,
    reviewOutcome,
    notes,
    auditActionType,
    metadata
  }: {
    input: WorkflowReadyForDecisionInput;
    targetState: ApplicationState;
    reviewOutcome: typeof ApplicationReviewOutcomes.READY_FOR_DECISION;
    notes: string;
    auditActionType:
      | typeof AuditLogActionTypes.MORE_INFO_REQUESTED
      | typeof AuditLogActionTypes.APPLICATION_MARKED_AS_READY_FOR_DECISION;
    metadata: AuditMetadata;
  }): Promise<ApplicationModel> =>
    sequelize.transaction(async (transaction) => {
      const application = await this.getApplicationForUpdate(
        input.applicationId,
        transaction
      );

      this.checkUserRole(input.actingRole, [Roles.REVIEWER]);
      this.checkApplicationState(application, [ApplicationStates.UNDER_REVIEW]);
      this.checkLockVersion(application, input.lockVersion);

      const openReview = await this.getOpenReview(
        application.id,
        input.actingUserId,
        transaction
      );

      await openReview.update(
        {
          completed_at: new Date(),
          outcome: reviewOutcome,
          notes
        },
        { transaction }
      );

      await application.update(
        {
          current_state: targetState,
          reviewed_by_id: input.actingUserId,
          lock_version: application.lock_version + 1
        },
        { transaction }
      );

      await this.writeAuditLog({
        transaction,
        application,
        context: input,
        actionType: auditActionType,
        beforeState: ApplicationStates.UNDER_REVIEW,
        afterState: targetState,
        metadata: {
          ...metadata,
          review_cycle_id: openReview.id
        }
      });

      return this.reloadApplication(application.id, transaction);
    });

  private readonly finalizeDecision = async ({
    input,
    targetState,
    auditActionType
  }: {
    input: WorkflowDecisionInput;
    targetState:
      | typeof ApplicationStates.APPROVED
      | typeof ApplicationStates.REJECTED;
    auditActionType:
      | typeof AuditLogActionTypes.APPLICATION_APPROVED
      | typeof AuditLogActionTypes.APPLICATION_REJECTED;
  }): Promise<ApplicationModel> =>
    sequelize.transaction(async (transaction) => {
      const application = await this.getApplicationForUpdate(
        input.applicationId,
        transaction
      );

      this.checkUserRole(input.actingRole, [Roles.APPROVER]);
      this.checkApplicationState(application, [ApplicationStates.READY_FOR_DECISION]);
      this.checkLockVersion(application, input.lockVersion);

      if (!application.reviewed_by_id) {
        throw new WorkflowServiceError(
          httpCodes.UNPROCESSABLE_ENTITY,
          'Application must have a recorded reviewer before final decision'
        );
      }

      if (application.reviewed_by_id === input.actingUserId) {
        throw new WorkflowServiceError(
          httpCodes.FORBIDDEN,
          'You are not allowed to approve or reject your own reviewed application.'
        );
      }

      await application.update(
        {
          current_state: targetState,
          decisioned_by_id: input.actingUserId,
          decision_at: new Date(),
          decision_reason: input.decisionReason,
          lock_version: application.lock_version + 1
        },
        { transaction }
      );

      await this.writeAuditLog({
        transaction,
        application,
        context: input,
        actionType: auditActionType,
        beforeState: ApplicationStates.READY_FOR_DECISION,
        afterState: targetState,
        metadata: {
          decision_reason: input.decisionReason,
          decisioned_by_id: input.actingUserId
        }
      });

      const reloadedApplication = await this.reloadApplication(application.id, transaction);
      void workflowNotificationService.notifyApplicantOnDecision({
        application: reloadedApplication,
        decisionReason: input.decisionReason,
        outcome: targetState === ApplicationStates.APPROVED ? 'APPROVED' : 'REJECTED'
      });

      return reloadedApplication;
    });

  private readonly buildRequestItems = (
    requestItems: WorkflowRequestItemInput[],
    application: ApplicationModel
  ): IWorkflowRequestItem[] => {
    const built = requestItems.map((item) => {
      const normalizedItem: IWorkflowRequestItem = {
        id: item.id || crypto.randomUUID(),
        type: item.type,
        instruction: item.instruction.trim(),
        required: item.required !== false
      };

      if (item.type === WorkflowRequestItemTypes.FIELD_UPDATE) {
        if (!item.field_key) {
          throw new WorkflowServiceError(
            httpCodes.UNPROCESSABLE_ENTITY,
            'field_key is required for FIELD_UPDATE requests'
          );
        }
        normalizedItem.field_key = item.field_key;
        normalizedItem.captured_value = stringifyComparable(
          application[item.field_key as keyof ApplicationModel]
        );
      }

      if (item.type === WorkflowRequestItemTypes.DOCUMENT_REPLACEMENT) {
        if (
          !item.document_type ||
          !CORE_DOCUMENT_TYPES.includes(
            item.document_type as (typeof CORE_DOCUMENT_TYPES)[number]
          )
        ) {
          throw new WorkflowServiceError(
            httpCodes.UNPROCESSABLE_ENTITY,
            'DOCUMENT_REPLACEMENT requests must target an existing core document type'
          );
        }
        normalizedItem.document_type = item.document_type;
      }

      if (item.type === WorkflowRequestItemTypes.ADDITIONAL_DOCUMENT) {
        if (item.document_type !== DocumentTypes.SUPPORTING_DOCUMENT) {
          throw new WorkflowServiceError(
            httpCodes.UNPROCESSABLE_ENTITY,
            'ADDITIONAL_DOCUMENT requests must use SUPPORTING_DOCUMENT type'
          );
        }
        normalizedItem.document_type = item.document_type;
      }

      return normalizedItem;
    });

    if (!built.length) {
      throw new WorkflowServiceError(
        httpCodes.UNPROCESSABLE_ENTITY,
        'At least one request item is required to request information'
      );
    }

    return built;
  };

  private readonly resolveRequestItems = (
    review: ApplicationReviewModel
  ): IWorkflowRequestItem[] => {
    const typedItems = Array.isArray(review.request_items)
      ? review.request_items
      : [];

    if (typedItems.length > 0) {
      return typedItems;
    }

    if (review.notes?.trim()) {
      return [
        {
          id: 'legacy-open-question',
          type: WorkflowRequestItemTypes.OPEN_QUESTION,
          instruction: review.notes.trim(),
          required: true
        }
      ];
    }

    throw new WorkflowServiceError(
      httpCodes.UNPROCESSABLE_ENTITY,
      'Latest information request has no structured request items'
    );
  };

  private readonly normalizeResponses = (
    responses: IWorkflowResponseItem[]
  ): IWorkflowResponseItem[] => {
    if (!Array.isArray(responses)) {
      return [];
    }

    return responses
      .filter((response) => Boolean(response?.request_item_id?.trim()))
      .map((response) => ({
        request_item_id: response.request_item_id.trim(),
        answer_text: response.answer_text?.trim()
      }));
  };

  private readonly validateRequiredRequestItems = async ({
    application,
    requestItems,
    responses,
    requestedAt,
    transaction
  }: {
    application: ApplicationModel;
    requestItems: IWorkflowRequestItem[];
    responses: IWorkflowResponseItem[];
    requestedAt: Date;
    transaction: Transaction;
  }): Promise<void> => {
    const requiredItems = requestItems.filter((item) => item.required !== false);

    const responseById = new Map(
      responses.map((response) => [response.request_item_id, response])
    );

    const requiredDocumentTypes = new Set<string>(
      requiredItems
        .filter((item) => this.isDocumentRequestType(item.type) && item.document_type)
        .map((item) => item.document_type as string)
    );

    const uploadedDocTypes = await this.getUploadedDocumentTypesSince({
      applicationId: application.id,
      requestedAt,
      requiredDocumentTypes,
      transaction
    });

    for (const item of requiredItems) {
      const response = responseById.get(item.id);

      if (item.type === WorkflowRequestItemTypes.OPEN_QUESTION) {
        if (!response?.answer_text?.trim()) {
          throw new WorkflowServiceError(
            httpCodes.UNPROCESSABLE_ENTITY,
            `Response is required for request item: ${item.instruction}`
          );
        }
        continue;
      }

      if (item.type === WorkflowRequestItemTypes.FIELD_UPDATE) {
        const fieldKey = item.field_key as WorkflowFieldKey | undefined;
        if (!fieldKey) {
          throw new WorkflowServiceError(
            httpCodes.UNPROCESSABLE_ENTITY,
            'Invalid field update request item definition'
          );
        }

        const currentValue = stringifyComparable(
          application[fieldKey as keyof ApplicationModel]
        );
        const capturedValue = stringifyComparable(item.captured_value);
        if (currentValue === capturedValue) {
          throw new WorkflowServiceError(
            httpCodes.UNPROCESSABLE_ENTITY,
            `Please update the requested field: ${fieldKey}`
          );
        }
        continue;
      }

      if (this.isDocumentRequestType(item.type)) {
        if (!item.document_type || !uploadedDocTypes.has(item.document_type)) {
          throw new WorkflowServiceError(
            httpCodes.UNPROCESSABLE_ENTITY,
            `Please upload the requested document type: ${item.document_type ?? 'UNKNOWN'}`
          );
        }
      }
    }
  };

  private readonly isDocumentRequestType = (
    type: WorkflowRequestItemType
  ): boolean =>
    type === WorkflowRequestItemTypes.DOCUMENT_REPLACEMENT ||
    type === WorkflowRequestItemTypes.ADDITIONAL_DOCUMENT;

  private readonly getUploadedDocumentTypesSince = async ({
    applicationId,
    requestedAt,
    requiredDocumentTypes,
    transaction
  }: {
    applicationId: string;
    requestedAt: Date;
    requiredDocumentTypes: Set<string>;
    transaction: Transaction;
  }): Promise<Set<string>> => {
    if (requiredDocumentTypes.size === 0) {
      return new Set();
    }

    const documents = await documentRepository.findAll({
      where: {
        application_id: applicationId,
        document_type: {
          [Op.in]: Array.from(requiredDocumentTypes)
        }
      },
      transaction
    });

    if (!documents.length) {
      return new Set();
    }

    const documentIds = documents.map((document) => document.id);
    const matchingVersions = await documentVersionRepository.findAll({
      attributes: ['document_id'],
      where: {
        document_id: {
          [Op.in]: documentIds
        },
        uploaded_at: {
          [Op.gt]: requestedAt
        }
      },
      transaction
    });

    const refreshedTypes = new Set<string>();
    const docTypeById = new Map(
      documents.map((document) => [document.id, document.document_type])
    );

    matchingVersions.forEach((version) => {
      const type = docTypeById.get(version.document_id);
      if (type) {
        refreshedTypes.add(type);
      }
    });

    return refreshedTypes;
  };

  private readonly getLatestInfoRequestReview = async (
    applicationId: string,
    transaction: Transaction
  ): Promise<ApplicationReviewModel> => {
    const latestInfoRequestReview = await applicationReviewRepository.findOne({
      where: {
        application_id: applicationId,
        outcome: ApplicationReviewOutcomes.INFO_REQUESTED,
        completed_at: {
          [Op.ne]: null
        }
      },
      order: [['completed_at', 'DESC']],
      transaction
    });

    if (!latestInfoRequestReview?.completed_at) {
      throw new WorkflowServiceError(
        httpCodes.UNPROCESSABLE_ENTITY,
        'No information request cycle was found for this application'
      );
    }

    return latestInfoRequestReview;
  };

  private readonly getApplicationForUpdate = async (
    applicationId: string,
    transaction: Transaction
  ): Promise<ApplicationModel> => {
    const application = await applicationRepository.findByPk(applicationId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!application) {
      throw new WorkflowServiceError(httpCodes.NOT_FOUND, 'Application not found');
    }

    return application;
  };

  private readonly reloadApplication = async (
    applicationId: string,
    transaction: Transaction
  ): Promise<ApplicationModel> => {
    const application = await applicationRepository.findByPk(applicationId, {
      transaction
    });

    if (!application) {
      throw new WorkflowServiceError(httpCodes.NOT_FOUND, 'Application not found');
    }

    return application;
  };

  private readonly getNextCycleNumber = async (
    applicationId: string,
    transaction: Transaction
  ): Promise<number> => {
    const currentMax = await applicationReviewRepository.max('cycle_number', {
      where: { application_id: applicationId },
      transaction
    });

    return (typeof currentMax === 'number' ? currentMax : 0) + 1;
  };

  private readonly getOpenReview = async (
    applicationId: string,
    reviewerId: string,
    transaction: Transaction
  ): Promise<ApplicationReviewModel> => {
    const openReview = await applicationReviewRepository.findOne({
      where: {
        application_id: applicationId,
        reviewer_id: reviewerId,
        completed_at: null
      },
      order: [['cycle_number', 'DESC']],
      transaction
    });

    if (!openReview) {
      throw new WorkflowServiceError(
        httpCodes.FORBIDDEN,
        'You are not assigned to review this application.'
      );
    }

    return openReview;
  };

  private readonly checkUserRole = (
    actingRole: RoleType,
    allowedRoles: RoleType[]
  ): void => {
    if (!allowedRoles.includes(actingRole)) {
      throw new WorkflowServiceError(httpCodes.FORBIDDEN, 'FORBIDDEN');
    }
  };

  private readonly checkApplicantAction = (
    application: ApplicationModel,
    input: WorkflowActionInput
  ): void => {
    this.checkUserRole(input.actingRole, [Roles.APPLICANT]);

    if (application.applicant_id !== input.actingUserId) {
      throw new WorkflowServiceError(httpCodes.NOT_FOUND, 'Application not found');
    }
  };

  private readonly checkApplicationState = (
    application: ApplicationModel,
    allowedStates: ApplicationState[]
  ): void => {
    if (!allowedStates.includes(application.current_state)) {
      if (
        application.current_state === ApplicationStates.APPROVED ||
        application.current_state === ApplicationStates.REJECTED
      ) {
        throw new WorkflowServiceError(
          httpCodes.CONFLICT,
          'Final application decisions are immutable'
        );
      }

      throw new WorkflowServiceError(
        httpCodes.CONFLICT,
        'Application state changed. Refresh and retry.'
      );
    }
  };

  private readonly checkLockVersion = (
    application: ApplicationModel,
    lockVersion: number
  ): void => {
    if (application.lock_version !== lockVersion) {
      throw new WorkflowServiceError(
        httpCodes.CONFLICT,
        'Application state changed. Refresh and retry.'
      );
    }
  };

  private readonly writeAuditLog = async ({
    transaction,
    application,
    context,
    actionType,
    beforeState,
    afterState,
    metadata
  }: {
    transaction: Transaction;
    application: ApplicationModel;
    context: WorkflowContext;
    actionType: string;
    beforeState: ApplicationState;
    afterState: ApplicationState;
    metadata: AuditMetadata;
  }): Promise<void> => {
    const previousAuditEntry = await auditLogRepository.findOne({
      where: { application_id: application.id },
      order: [
        ['occurred_at', 'DESC'],
        ['created_at', 'DESC']
      ],
      transaction
    });

    const previousHash = previousAuditEntry?.entry_hash;
    const occurredAt = new Date();
    const requestId = context.requestId ?? crypto.randomUUID();
    const payload = {
      application_id: application.id,
      acting_user_id: context.actingUserId,
      action_type: actionType,
      occurred_at: occurredAt.toISOString(),
      before_state: beforeState,
      after_state: afterState,
      request_id: requestId,
      ip_address: context.ipAddress ?? null,
      user_agent: context.userAgent ?? null,
      metadata,
      previous_hash: previousHash ?? null
    };

    const entryHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');

    await auditLogRepository.create(
      {
        application_id: application.id,
        acting_user_id: context.actingUserId,
        action_type: actionType,
        occurred_at: occurredAt,
        before_state: beforeState,
        after_state: afterState,
        request_id: requestId,
        ip_address: context.ipAddress,
        user_agent: context.userAgent,
        metadata,
        previous_hash: previousHash,
        entry_hash: entryHash
      },
      { transaction }
    );
  };
}

export default WorkflowService;
