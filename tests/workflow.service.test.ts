import WorkflowService, {
  WorkflowServiceError
} from '../src/services/workflow.service';
import crypto from 'crypto';
import {
  ApplicationStates,
  WorkflowRequestItemTypes
} from '../src/types/application.types';
import { Roles } from '../src/types/role.types';
import { DocumentTypes } from '../src/types/document.types';

const mockTransaction = {
  LOCK: {
    UPDATE: 'UPDATE'
  }
};

jest.mock('../src/services/workflow-notification.service', () => ({
  workflowNotificationService: {
    notifyReviewersOnApplicationSubmitted: jest.fn(),
    notifyApplicantOnInformationRequested: jest.fn(),
    notifyApproversOnReadyForDecision: jest.fn(),
    notifyApplicantOnDecision: jest.fn()
  }
}));

jest.mock('../src/database/sequelize', () => ({
  applicationRepository: {
    findByPk: jest.fn()
  },
  applicationReviewRepository: {
    create: jest.fn(),
    max: jest.fn(),
    findOne: jest.fn()
  },
  documentRepository: {
    findAll: jest.fn()
  },
  documentVersionRepository: {
    findAll: jest.fn()
  },
  auditLogRepository: {
    findOne: jest.fn(),
    create: jest.fn()
  },
  sequelize: {
    transaction: jest.fn(
      async (callback: (_arg: typeof mockTransaction) => unknown) =>
        callback(mockTransaction)
    )
  }
}));

const sequelizeModule = jest.requireMock('../src/database/sequelize') as {
  applicationRepository: { findByPk: jest.Mock };
  applicationReviewRepository: {
    create: jest.Mock;
    max: jest.Mock;
    findOne: jest.Mock;
  };
  documentRepository: {
    findAll: jest.Mock;
  };
  documentVersionRepository: {
    findAll: jest.Mock;
  };
  auditLogRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
  };
};

const workflowNotifications = jest.requireMock(
  '../src/services/workflow-notification.service'
) as {
  workflowNotificationService: {
    notifyReviewersOnApplicationSubmitted: jest.Mock;
    notifyApplicantOnInformationRequested: jest.Mock;
    notifyApproversOnReadyForDecision: jest.Mock;
    notifyApplicantOnDecision: jest.Mock;
  };
};

const createApplication = (overrides: Record<string, unknown> = {}) => {
  const application: Record<string, any> = {
    id: 'application-1',
    applicant_id: 'applicant-1',
    institution_name: 'Test Bank',
    institution_type: 'BANK',
    business_address: 'KN 1',
    contact_name: 'Jane Doe',
    contact_email: 'jane@example.com',
    contact_phone: '+250700000000',
    license_category: 'COMMERCIAL_BANK',
    capital_amount_rwf: 5000000,
    incorporation_date: '2024-01-01',
    business_summary: 'summary',
    current_state: ApplicationStates.DRAFT,
    lock_version: 0,
    submitted_at: undefined,
    reviewed_by_id: undefined,
    decisioned_by_id: undefined,
    decision_at: undefined,
    decision_reason: undefined,
    update: jest.fn(async function update(values: Record<string, unknown>) {
      Object.assign(application, values);
      return application;
    }),
    ...overrides
  };

  return application;
};

describe('WorkflowService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sequelizeModule.auditLogRepository.findOne.mockResolvedValue(null);
    sequelizeModule.auditLogRepository.create.mockResolvedValue(undefined);
    sequelizeModule.documentRepository.findAll.mockResolvedValue([]);
    sequelizeModule.documentVersionRepository.findAll.mockResolvedValue([]);
    workflowNotifications.workflowNotificationService.notifyApplicantOnDecision.mockResolvedValue(
      undefined
    );
    workflowNotifications.workflowNotificationService.notifyApplicantOnInformationRequested.mockResolvedValue(
      undefined
    );
    workflowNotifications.workflowNotificationService.notifyApproversOnReadyForDecision.mockResolvedValue(
      undefined
    );
    workflowNotifications.workflowNotificationService.notifyReviewersOnApplicationSubmitted.mockResolvedValue(
      undefined
    );
  });

  it('submits a draft application and writes an audit event', async () => {
    const application = createApplication();
    sequelizeModule.applicationRepository.findByPk
      .mockResolvedValueOnce(application)
      .mockResolvedValueOnce(application);

    const service = new WorkflowService();

    const result = await service.submitApplication({
      applicationId: 'application-1',
      lockVersion: 0,
      actingUserId: 'applicant-1',
      actingRole: Roles.APPLICANT,
      requestId: 'request-1'
    });

    expect(result.current_state).toBe(ApplicationStates.SUBMITTED);
    expect(result.lock_version).toBe(1);
    expect(sequelizeModule.auditLogRepository.create).toHaveBeenCalledTimes(1);
  });

  it('rejects request-information when request items are empty', async () => {
    const application = createApplication({
      current_state: ApplicationStates.UNDER_REVIEW,
      lock_version: 2
    });
    const openReview = {
      id: 'review-cycle-1',
      update: jest.fn().mockResolvedValue(undefined)
    };

    sequelizeModule.applicationRepository.findByPk.mockResolvedValue(
      application
    );
    sequelizeModule.applicationReviewRepository.findOne.mockResolvedValue(
      openReview
    );

    const service = new WorkflowService();

    await expect(
      service.requestInformation({
        applicationId: 'application-1',
        lockVersion: 2,
        requestItems: [],
        actingUserId: 'reviewer-1',
        actingRole: Roles.REVIEWER,
        requestId: 'request-empty-items'
      })
    ).rejects.toMatchObject<Partial<WorkflowServiceError>>({
      statusCode: 422
    });
  });

  it('stores typed request items and captures field snapshot on info request', async () => {
    const application = createApplication({
      current_state: ApplicationStates.UNDER_REVIEW,
      lock_version: 3,
      business_address: 'Old Address'
    });
    const openReview = {
      id: 'review-cycle-1',
      update: jest.fn().mockResolvedValue(undefined)
    };

    sequelizeModule.applicationRepository.findByPk
      .mockResolvedValueOnce(application)
      .mockResolvedValueOnce(application);
    sequelizeModule.applicationReviewRepository.findOne.mockResolvedValue(
      openReview
    );

    const service = new WorkflowService();

    await service.requestInformation({
      applicationId: 'application-1',
      lockVersion: 3,
      reviewerSummaryNote: 'Please complete all requested changes',
      requestItems: [
        {
          type: WorkflowRequestItemTypes.FIELD_UPDATE,
          field_key: 'business_address',
          instruction: 'Update your registered office address'
        },
        {
          type: WorkflowRequestItemTypes.OPEN_QUESTION,
          instruction: 'Explain your branch expansion plan'
        }
      ],
      actingUserId: 'reviewer-1',
      actingRole: Roles.REVIEWER,
      requestId: 'request-typed-items'
    });

    expect(openReview.update).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: 'Please complete all requested changes',
        request_items: expect.arrayContaining([
          expect.objectContaining({
            type: WorkflowRequestItemTypes.FIELD_UPDATE,
            field_key: 'business_address',
            captured_value: 'Old Address'
          }),
          expect.objectContaining({
            type: WorkflowRequestItemTypes.OPEN_QUESTION
          })
        ])
      }),
      expect.any(Object)
    );
  });

  it('rejects resubmit when required open-question answer is missing', async () => {
    const application = createApplication({
      current_state: ApplicationStates.INFO_REQUESTED,
      lock_version: 7
    });
    const latestInfoRequestReview = {
      id: 'review-1',
      completed_at: new Date('2026-01-01T00:00:00.000Z'),
      request_items: [
        {
          id: 'rq-1',
          type: WorkflowRequestItemTypes.OPEN_QUESTION,
          instruction: 'Provide missing explanation',
          required: true
        }
      ],
      update: jest.fn().mockResolvedValue(undefined)
    };

    sequelizeModule.applicationRepository.findByPk.mockResolvedValue(
      application
    );
    sequelizeModule.applicationReviewRepository.findOne.mockResolvedValue(
      latestInfoRequestReview
    );

    const service = new WorkflowService();

    await expect(
      service.resubmitApplication({
        applicationId: 'application-1',
        lockVersion: 7,
        responses: [],
        actingUserId: 'applicant-1',
        actingRole: Roles.APPLICANT,
        requestId: 'resubmit-missing-answer'
      })
    ).rejects.toMatchObject<Partial<WorkflowServiceError>>({
      statusCode: 422
    });
  });

  it('rejects resubmit when required document upload is missing', async () => {
    const application = createApplication({
      current_state: ApplicationStates.INFO_REQUESTED,
      lock_version: 8
    });
    const latestInfoRequestReview = {
      id: 'review-2',
      completed_at: new Date('2026-01-01T00:00:00.000Z'),
      request_items: [
        {
          id: 'rq-doc',
          type: WorkflowRequestItemTypes.DOCUMENT_REPLACEMENT,
          instruction: 'Replace governance document',
          document_type: DocumentTypes.GOVERNANCE_DOCUMENT,
          required: true
        }
      ],
      update: jest.fn().mockResolvedValue(undefined)
    };

    sequelizeModule.applicationRepository.findByPk.mockResolvedValue(
      application
    );
    sequelizeModule.applicationReviewRepository.findOne.mockResolvedValue(
      latestInfoRequestReview
    );
    sequelizeModule.documentRepository.findAll.mockResolvedValue([
      { id: 'doc-1', document_type: DocumentTypes.GOVERNANCE_DOCUMENT }
    ]);
    sequelizeModule.documentVersionRepository.findAll.mockResolvedValue([]);

    const service = new WorkflowService();

    await expect(
      service.resubmitApplication({
        applicationId: 'application-1',
        lockVersion: 8,
        responses: [],
        actingUserId: 'applicant-1',
        actingRole: Roles.APPLICANT,
        requestId: 'resubmit-missing-doc'
      })
    ).rejects.toMatchObject<Partial<WorkflowServiceError>>({
      statusCode: 422
    });
  });

  it('accepts resubmit when required field change and responses are satisfied', async () => {
    const application = createApplication({
      current_state: ApplicationStates.INFO_REQUESTED,
      lock_version: 9,
      business_address: 'New Address'
    });
    const latestInfoRequestReview = {
      id: 'review-3',
      completed_at: new Date('2026-01-01T00:00:00.000Z'),
      request_items: [
        {
          id: 'rq-field',
          type: WorkflowRequestItemTypes.FIELD_UPDATE,
          instruction: 'Update business address',
          field_key: 'business_address',
          captured_value: 'Old Address',
          required: true
        },
        {
          id: 'rq-question',
          type: WorkflowRequestItemTypes.OPEN_QUESTION,
          instruction: 'Provide clarification',
          required: true
        }
      ],
      update: jest.fn().mockResolvedValue(undefined)
    };

    sequelizeModule.applicationRepository.findByPk
      .mockResolvedValueOnce(application)
      .mockResolvedValueOnce(application);
    sequelizeModule.applicationReviewRepository.findOne.mockResolvedValue(
      latestInfoRequestReview
    );

    const service = new WorkflowService();

    const result = await service.resubmitApplication({
      applicationId: 'application-1',
      lockVersion: 9,
      responses: [
        {
          request_item_id: 'rq-question',
          answer_text: 'Added clarification in section 3'
        }
      ],
      actingUserId: 'applicant-1',
      actingRole: Roles.APPLICANT,
      requestId: 'resubmit-success'
    });

    expect(result.current_state).toBe(ApplicationStates.RESUBMITTED);
    expect(latestInfoRequestReview.update).toHaveBeenCalledWith(
      expect.objectContaining({
        applicant_responses: [
          {
            request_item_id: 'rq-question',
            answer_text: 'Added clarification in section 3'
          }
        ]
      }),
      expect.any(Object)
    );
  });

  it('supports legacy note-only info requests by mapping to open question response', async () => {
    const application = createApplication({
      current_state: ApplicationStates.INFO_REQUESTED,
      lock_version: 5
    });
    const latestInfoRequestReview = {
      id: 'legacy-review',
      completed_at: new Date('2026-01-01T00:00:00.000Z'),
      notes: 'Please explain risk controls',
      request_items: null,
      update: jest.fn().mockResolvedValue(undefined)
    };

    sequelizeModule.applicationRepository.findByPk
      .mockResolvedValueOnce(application)
      .mockResolvedValueOnce(application);
    sequelizeModule.applicationReviewRepository.findOne.mockResolvedValue(
      latestInfoRequestReview
    );

    const service = new WorkflowService();

    const result = await service.resubmitApplication({
      applicationId: 'application-1',
      lockVersion: 5,
      responses: [
        {
          request_item_id: 'legacy-open-question',
          answer_text: 'Risk controls have been updated'
        }
      ],
      actingUserId: 'applicant-1',
      actingRole: Roles.APPLICANT,
      requestId: 'legacy-resubmit'
    });

    expect(result.current_state).toBe(ApplicationStates.RESUBMITTED);
  });

  it('rejects final decision when the approver is the recorded reviewer', async () => {
    const application = createApplication({
      current_state: ApplicationStates.READY_FOR_DECISION,
      lock_version: 2,
      reviewed_by_id: 'approver-1'
    });

    sequelizeModule.applicationRepository.findByPk.mockResolvedValue(
      application
    );

    const service = new WorkflowService();

    await expect(
      service.approve({
        applicationId: 'application-1',
        lockVersion: 2,
        decisionReason: 'Looks good',
        actingUserId: 'approver-1',
        actingRole: Roles.APPROVER,
        requestId: 'request-3'
      })
    ).rejects.toMatchObject<Partial<WorkflowServiceError>>({
      statusCode: 403
    });
  });

  it('writes audit with generated request id when omitted', async () => {
    jest
      .spyOn(crypto, 'randomUUID')
      .mockReturnValue(
        'generated-request-id' as ReturnType<typeof crypto.randomUUID>
      );

    const application = createApplication({
      current_state: ApplicationStates.READY_FOR_DECISION,
      lock_version: 2,
      reviewed_by_id: 'reviewer-8'
    });

    sequelizeModule.applicationRepository.findByPk
      .mockResolvedValueOnce(application)
      .mockResolvedValueOnce(application);

    const service = new WorkflowService();

    await service.reject({
      applicationId: 'application-1',
      lockVersion: 2,
      decisionReason: 'Insufficient evidence',
      actingUserId: 'approver-9',
      actingRole: Roles.APPROVER
    });

    expect(sequelizeModule.auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: 'generated-request-id'
      }),
      expect.any(Object)
    );
  });

  it('rejects submission when required draft fields are missing', async () => {
    const application = createApplication({
      institution_name: '',
      institution_type: undefined
    });
    sequelizeModule.applicationRepository.findByPk.mockResolvedValue(
      application
    );

    const service = new WorkflowService();

    await expect(
      service.submitApplication({
        applicationId: 'application-1',
        lockVersion: 0,
        actingUserId: 'applicant-1',
        actingRole: Roles.APPLICANT,
        requestId: 'missing-required-fields'
      })
    ).rejects.toMatchObject<Partial<WorkflowServiceError>>({
      statusCode: 422
    });
  });

  it('starts review from submitted state and increments review cycle', async () => {
    const application = createApplication({
      current_state: ApplicationStates.SUBMITTED,
      lock_version: 1
    });
    sequelizeModule.applicationRepository.findByPk
      .mockResolvedValueOnce(application)
      .mockResolvedValueOnce(application);
    sequelizeModule.applicationReviewRepository.max.mockResolvedValue(2);
    sequelizeModule.applicationReviewRepository.create.mockResolvedValue(
      undefined
    );

    const service = new WorkflowService();

    const result = await service.startReview({
      applicationId: 'application-1',
      lockVersion: 1,
      actingUserId: 'reviewer-1',
      actingRole: Roles.REVIEWER,
      requestId: 'start-review'
    });

    expect(result.current_state).toBe(ApplicationStates.UNDER_REVIEW);
    expect(
      sequelizeModule.applicationReviewRepository.create
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        cycle_number: 3
      }),
      expect.any(Object)
    );
  });

  it('returns forbidden when non-reviewer starts review', async () => {
    const application = createApplication({
      current_state: ApplicationStates.SUBMITTED,
      lock_version: 1
    });
    sequelizeModule.applicationRepository.findByPk.mockResolvedValue(
      application
    );

    const service = new WorkflowService();

    await expect(
      service.startReview({
        applicationId: 'application-1',
        lockVersion: 1,
        actingUserId: 'applicant-1',
        actingRole: Roles.APPLICANT,
        requestId: 'start-review-forbidden'
      })
    ).rejects.toMatchObject<Partial<WorkflowServiceError>>({
      statusCode: 403
    });
  });

  it('marks review as ready for decision and notifies approvers', async () => {
    const application = createApplication({
      current_state: ApplicationStates.UNDER_REVIEW,
      lock_version: 5
    });
    const openReview = {
      id: 'open-review-1',
      update: jest.fn().mockResolvedValue(undefined)
    };
    sequelizeModule.applicationRepository.findByPk
      .mockResolvedValueOnce(application)
      .mockResolvedValueOnce(application);
    sequelizeModule.applicationReviewRepository.findOne.mockResolvedValue(
      openReview
    );

    const service = new WorkflowService();

    const result = await service.markReadyForDecision({
      applicationId: 'application-1',
      lockVersion: 5,
      notes: 'Looks complete',
      actingUserId: 'reviewer-1',
      actingRole: Roles.REVIEWER,
      requestId: 'ready-for-decision'
    });

    expect(result.current_state).toBe(ApplicationStates.READY_FOR_DECISION);
    expect(
      workflowNotifications.workflowNotificationService
        .notifyApproversOnReadyForDecision
    ).toHaveBeenCalledTimes(1);
  });

  it('rejects final decision when reviewer is missing', async () => {
    const application = createApplication({
      current_state: ApplicationStates.READY_FOR_DECISION,
      lock_version: 2,
      reviewed_by_id: undefined
    });
    sequelizeModule.applicationRepository.findByPk.mockResolvedValue(
      application
    );

    const service = new WorkflowService();

    await expect(
      service.approve({
        applicationId: 'application-1',
        lockVersion: 2,
        decisionReason: 'Ready',
        actingUserId: 'approver-1',
        actingRole: Roles.APPROVER,
        requestId: 'approve-no-reviewer'
      })
    ).rejects.toMatchObject<Partial<WorkflowServiceError>>({
      statusCode: 422
    });
  });

  it('returns not found when applicant tries to submit another user application', async () => {
    const application = createApplication({
      applicant_id: 'other-applicant'
    });
    sequelizeModule.applicationRepository.findByPk.mockResolvedValue(
      application
    );

    const service = new WorkflowService();

    await expect(
      service.submitApplication({
        applicationId: 'application-1',
        lockVersion: 0,
        actingUserId: 'applicant-1',
        actingRole: Roles.APPLICANT,
        requestId: 'submit-other-owner'
      })
    ).rejects.toMatchObject<Partial<WorkflowServiceError>>({
      statusCode: 404
    });
  });

  it('returns conflict when lock version mismatches on submit', async () => {
    const application = createApplication({
      lock_version: 3
    });
    sequelizeModule.applicationRepository.findByPk.mockResolvedValue(
      application
    );

    const service = new WorkflowService();

    await expect(
      service.submitApplication({
        applicationId: 'application-1',
        lockVersion: 2,
        actingUserId: 'applicant-1',
        actingRole: Roles.APPLICANT,
        requestId: 'submit-lock-mismatch'
      })
    ).rejects.toMatchObject<Partial<WorkflowServiceError>>({
      statusCode: 409
    });
  });

  it('returns immutable conflict when action targets a final state application', async () => {
    const application = createApplication({
      current_state: ApplicationStates.APPROVED
    });
    sequelizeModule.applicationRepository.findByPk.mockResolvedValue(
      application
    );

    const service = new WorkflowService();

    await expect(
      service.submitApplication({
        applicationId: 'application-1',
        lockVersion: 0,
        actingUserId: 'applicant-1',
        actingRole: Roles.APPLICANT,
        requestId: 'submit-final-state'
      })
    ).rejects.toMatchObject<Partial<WorkflowServiceError>>({
      statusCode: 409,
      message: 'Final application decisions are immutable'
    });
  });

  it('returns conflict when action is attempted from a wrong non-final state', async () => {
    const application = createApplication({
      current_state: ApplicationStates.UNDER_REVIEW
    });
    sequelizeModule.applicationRepository.findByPk.mockResolvedValue(
      application
    );

    const service = new WorkflowService();

    await expect(
      service.submitApplication({
        applicationId: 'application-1',
        lockVersion: 0,
        actingUserId: 'applicant-1',
        actingRole: Roles.APPLICANT,
        requestId: 'submit-wrong-state'
      })
    ).rejects.toMatchObject<Partial<WorkflowServiceError>>({
      statusCode: 409,
      message: 'Application state changed. Refresh and retry.'
    });
  });

  it('rejects request-information when field update item misses field_key', async () => {
    const application = createApplication({
      current_state: ApplicationStates.UNDER_REVIEW,
      lock_version: 2
    });
    const openReview = {
      id: 'review-cycle-1',
      update: jest.fn().mockResolvedValue(undefined)
    };
    sequelizeModule.applicationRepository.findByPk.mockResolvedValue(
      application
    );
    sequelizeModule.applicationReviewRepository.findOne.mockResolvedValue(
      openReview
    );

    const service = new WorkflowService();

    await expect(
      service.requestInformation({
        applicationId: 'application-1',
        lockVersion: 2,
        reviewerSummaryNote: 'Need edits',
        requestItems: [
          {
            type: WorkflowRequestItemTypes.FIELD_UPDATE,
            instruction: 'Update institution name'
          } as any
        ],
        actingUserId: 'reviewer-1',
        actingRole: Roles.REVIEWER,
        requestId: 'missing-field-key'
      })
    ).rejects.toMatchObject<Partial<WorkflowServiceError>>({
      statusCode: 422
    });
  });

  it('rejects request-information when replacement document type is invalid', async () => {
    const application = createApplication({
      current_state: ApplicationStates.UNDER_REVIEW,
      lock_version: 2
    });
    const openReview = {
      id: 'review-cycle-2',
      update: jest.fn().mockResolvedValue(undefined)
    };
    sequelizeModule.applicationRepository.findByPk.mockResolvedValue(
      application
    );
    sequelizeModule.applicationReviewRepository.findOne.mockResolvedValue(
      openReview
    );

    const service = new WorkflowService();

    await expect(
      service.requestInformation({
        applicationId: 'application-1',
        lockVersion: 2,
        reviewerSummaryNote: 'Need replacement',
        requestItems: [
          {
            type: WorkflowRequestItemTypes.DOCUMENT_REPLACEMENT,
            instruction: 'Replace attachment',
            document_type: DocumentTypes.SUPPORTING_DOCUMENT
          } as any
        ],
        actingUserId: 'reviewer-1',
        actingRole: Roles.REVIEWER,
        requestId: 'invalid-replacement-type'
      })
    ).rejects.toMatchObject<Partial<WorkflowServiceError>>({
      statusCode: 422
    });
  });

  it('rejects request-information when additional document is not supporting type', async () => {
    const application = createApplication({
      current_state: ApplicationStates.UNDER_REVIEW,
      lock_version: 2
    });
    const openReview = {
      id: 'review-cycle-3',
      update: jest.fn().mockResolvedValue(undefined)
    };
    sequelizeModule.applicationRepository.findByPk.mockResolvedValue(
      application
    );
    sequelizeModule.applicationReviewRepository.findOne.mockResolvedValue(
      openReview
    );

    const service = new WorkflowService();

    await expect(
      service.requestInformation({
        applicationId: 'application-1',
        lockVersion: 2,
        reviewerSummaryNote: 'Need additional file',
        requestItems: [
          {
            type: WorkflowRequestItemTypes.ADDITIONAL_DOCUMENT,
            instruction: 'Upload document',
            document_type: DocumentTypes.GOVERNANCE_DOCUMENT
          } as any
        ],
        actingUserId: 'reviewer-1',
        actingRole: Roles.REVIEWER,
        requestId: 'invalid-additional-type'
      })
    ).rejects.toMatchObject<Partial<WorkflowServiceError>>({
      statusCode: 422
    });
  });

  it('rejects resubmit when latest info-request has no request items or notes', async () => {
    const application = createApplication({
      current_state: ApplicationStates.INFO_REQUESTED,
      lock_version: 6
    });
    const latestInfoRequestReview = {
      id: 'review-empty',
      completed_at: new Date('2026-01-01T00:00:00.000Z'),
      notes: '   ',
      request_items: null,
      update: jest.fn().mockResolvedValue(undefined)
    };

    sequelizeModule.applicationRepository.findByPk.mockResolvedValue(
      application
    );
    sequelizeModule.applicationReviewRepository.findOne.mockResolvedValue(
      latestInfoRequestReview
    );

    const service = new WorkflowService();

    await expect(
      service.resubmitApplication({
        applicationId: 'application-1',
        lockVersion: 6,
        responses: [],
        actingUserId: 'applicant-1',
        actingRole: Roles.APPLICANT,
        requestId: 'resubmit-empty-request-items'
      })
    ).rejects.toMatchObject<Partial<WorkflowServiceError>>({
      statusCode: 422
    });
  });

  it('rejects resubmit when required field-update item is malformed', async () => {
    const application = createApplication({
      current_state: ApplicationStates.INFO_REQUESTED,
      lock_version: 7
    });
    const latestInfoRequestReview = {
      id: 'review-bad-field',
      completed_at: new Date('2026-01-01T00:00:00.000Z'),
      request_items: [
        {
          id: 'rq-invalid-field',
          type: WorkflowRequestItemTypes.FIELD_UPDATE,
          instruction: 'Update required field',
          required: true
        }
      ],
      update: jest.fn().mockResolvedValue(undefined)
    };

    sequelizeModule.applicationRepository.findByPk.mockResolvedValue(
      application
    );
    sequelizeModule.applicationReviewRepository.findOne.mockResolvedValue(
      latestInfoRequestReview
    );

    const service = new WorkflowService();

    await expect(
      service.resubmitApplication({
        applicationId: 'application-1',
        lockVersion: 7,
        responses: [],
        actingUserId: 'applicant-1',
        actingRole: Roles.APPLICANT,
        requestId: 'resubmit-malformed-field-item'
      })
    ).rejects.toMatchObject<Partial<WorkflowServiceError>>({
      statusCode: 422
    });
  });

  it('rejects mark-ready-for-decision when reviewer has no open review assignment', async () => {
    const application = createApplication({
      current_state: ApplicationStates.UNDER_REVIEW,
      lock_version: 4
    });
    sequelizeModule.applicationRepository.findByPk.mockResolvedValue(
      application
    );
    sequelizeModule.applicationReviewRepository.findOne.mockResolvedValue(null);

    const service = new WorkflowService();

    await expect(
      service.markReadyForDecision({
        applicationId: 'application-1',
        lockVersion: 4,
        notes: 'Done',
        actingUserId: 'reviewer-1',
        actingRole: Roles.REVIEWER,
        requestId: 'ready-no-open-review'
      })
    ).rejects.toMatchObject<Partial<WorkflowServiceError>>({
      statusCode: 403
    });
  });

  it('returns not found when start-review target application is missing', async () => {
    sequelizeModule.applicationRepository.findByPk.mockResolvedValue(null);

    const service = new WorkflowService();

    await expect(
      service.startReview({
        applicationId: 'missing-app',
        lockVersion: 0,
        actingUserId: 'reviewer-1',
        actingRole: Roles.REVIEWER,
        requestId: 'start-review-missing'
      })
    ).rejects.toMatchObject<Partial<WorkflowServiceError>>({
      statusCode: 404
    });
  });

  it('returns not found when application disappears during reload', async () => {
    const application = createApplication({
      current_state: ApplicationStates.SUBMITTED,
      lock_version: 1
    });
    sequelizeModule.applicationRepository.findByPk
      .mockResolvedValueOnce(application)
      .mockResolvedValueOnce(null);
    sequelizeModule.applicationReviewRepository.max.mockResolvedValue(0);
    sequelizeModule.applicationReviewRepository.create.mockResolvedValue(
      undefined
    );

    const service = new WorkflowService();

    await expect(
      service.startReview({
        applicationId: 'application-1',
        lockVersion: 1,
        actingUserId: 'reviewer-1',
        actingRole: Roles.REVIEWER,
        requestId: 'start-review-reload-missing'
      })
    ).rejects.toMatchObject<Partial<WorkflowServiceError>>({
      statusCode: 404
    });
  });

  it('rejects resubmit when required field value did not change', async () => {
    const application = createApplication({
      current_state: ApplicationStates.INFO_REQUESTED,
      lock_version: 10,
      business_address: 'Same Address'
    });
    const latestInfoRequestReview = {
      id: 'review-no-change',
      completed_at: new Date('2026-01-01T00:00:00.000Z'),
      request_items: [
        {
          id: 'rq-field',
          type: WorkflowRequestItemTypes.FIELD_UPDATE,
          instruction: 'Update business address',
          field_key: 'business_address',
          captured_value: 'Same Address',
          required: true
        }
      ],
      update: jest.fn().mockResolvedValue(undefined)
    };

    sequelizeModule.applicationRepository.findByPk.mockResolvedValue(
      application
    );
    sequelizeModule.applicationReviewRepository.findOne.mockResolvedValue(
      latestInfoRequestReview
    );

    const service = new WorkflowService();

    await expect(
      service.resubmitApplication({
        applicationId: 'application-1',
        lockVersion: 10,
        responses: [],
        actingUserId: 'applicant-1',
        actingRole: Roles.APPLICANT,
        requestId: 'resubmit-no-field-change'
      })
    ).rejects.toMatchObject<Partial<WorkflowServiceError>>({
      statusCode: 422
    });
  });

  it('rejects resubmit when no info-request cycle exists', async () => {
    const application = createApplication({
      current_state: ApplicationStates.INFO_REQUESTED,
      lock_version: 11
    });
    sequelizeModule.applicationRepository.findByPk.mockResolvedValue(
      application
    );
    sequelizeModule.applicationReviewRepository.findOne.mockResolvedValue(null);

    const service = new WorkflowService();

    await expect(
      service.resubmitApplication({
        applicationId: 'application-1',
        lockVersion: 11,
        responses: [],
        actingUserId: 'applicant-1',
        actingRole: Roles.APPLICANT,
        requestId: 'resubmit-no-cycle'
      })
    ).rejects.toMatchObject<Partial<WorkflowServiceError>>({
      statusCode: 422
    });
  });

  it('rejects resubmit when document exists but has no refreshed versions', async () => {
    const application = createApplication({
      current_state: ApplicationStates.INFO_REQUESTED,
      lock_version: 12
    });
    const latestInfoRequestReview = {
      id: 'review-doc-not-refreshed',
      completed_at: new Date('2026-01-01T00:00:00.000Z'),
      request_items: [
        {
          id: 'rq-doc',
          type: WorkflowRequestItemTypes.DOCUMENT_REPLACEMENT,
          instruction: 'Replace governance document',
          document_type: DocumentTypes.GOVERNANCE_DOCUMENT,
          required: true
        }
      ],
      update: jest.fn().mockResolvedValue(undefined)
    };

    sequelizeModule.applicationRepository.findByPk.mockResolvedValue(
      application
    );
    sequelizeModule.applicationReviewRepository.findOne.mockResolvedValue(
      latestInfoRequestReview
    );
    sequelizeModule.documentRepository.findAll.mockResolvedValue([
      { id: 'doc-1', document_type: DocumentTypes.GOVERNANCE_DOCUMENT }
    ]);
    sequelizeModule.documentVersionRepository.findAll.mockResolvedValue([]);

    const service = new WorkflowService();

    await expect(
      service.resubmitApplication({
        applicationId: 'application-1',
        lockVersion: 12,
        responses: [],
        actingUserId: 'applicant-1',
        actingRole: Roles.APPLICANT,
        requestId: 'resubmit-doc-not-refreshed'
      })
    ).rejects.toMatchObject<Partial<WorkflowServiceError>>({
      statusCode: 422
    });
  });

  it('accepts resubmit for required document when a refreshed version exists', async () => {
    const application = createApplication({
      current_state: ApplicationStates.INFO_REQUESTED,
      lock_version: 13
    });
    const latestInfoRequestReview = {
      id: 'review-doc-refreshed',
      completed_at: new Date('2026-01-01T00:00:00.000Z'),
      request_items: [
        {
          id: 'rq-doc',
          type: WorkflowRequestItemTypes.DOCUMENT_REPLACEMENT,
          instruction: 'Replace governance document',
          document_type: DocumentTypes.GOVERNANCE_DOCUMENT,
          required: true
        }
      ],
      update: jest.fn().mockResolvedValue(undefined)
    };

    sequelizeModule.applicationRepository.findByPk
      .mockResolvedValueOnce(application)
      .mockResolvedValueOnce(application);
    sequelizeModule.applicationReviewRepository.findOne.mockResolvedValue(
      latestInfoRequestReview
    );
    sequelizeModule.documentRepository.findAll.mockResolvedValue([
      { id: 'doc-1', document_type: DocumentTypes.GOVERNANCE_DOCUMENT }
    ]);
    sequelizeModule.documentVersionRepository.findAll.mockResolvedValue([
      { document_id: 'doc-1' }
    ]);

    const service = new WorkflowService();

    const result = await service.resubmitApplication({
      applicationId: 'application-1',
      lockVersion: 13,
      responses: [] as any,
      actingUserId: 'applicant-1',
      actingRole: Roles.APPLICANT,
      requestId: 'resubmit-doc-refreshed'
    });

    expect(result.current_state).toBe(ApplicationStates.RESUBMITTED);
  });

  it('rejects resubmit when responses payload is not an array', async () => {
    const application = createApplication({
      current_state: ApplicationStates.INFO_REQUESTED,
      lock_version: 14
    });
    const latestInfoRequestReview = {
      id: 'review-invalid-responses',
      completed_at: new Date('2026-01-01T00:00:00.000Z'),
      request_items: [
        {
          id: 'rq-open',
          type: WorkflowRequestItemTypes.OPEN_QUESTION,
          instruction: 'Provide explanation',
          required: true
        }
      ],
      update: jest.fn().mockResolvedValue(undefined)
    };

    sequelizeModule.applicationRepository.findByPk.mockResolvedValue(
      application
    );
    sequelizeModule.applicationReviewRepository.findOne.mockResolvedValue(
      latestInfoRequestReview
    );

    const service = new WorkflowService();

    await expect(
      service.resubmitApplication({
        applicationId: 'application-1',
        lockVersion: 14,
        responses: null as any,
        actingUserId: 'applicant-1',
        actingRole: Roles.APPLICANT,
        requestId: 'resubmit-invalid-responses'
      })
    ).rejects.toMatchObject<Partial<WorkflowServiceError>>({
      statusCode: 422
    });
  });
});
