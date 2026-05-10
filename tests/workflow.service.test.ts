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
    transaction: jest.fn(async (callback: (_arg: typeof mockTransaction) => unknown) =>
      callback(mockTransaction))
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

    sequelizeModule.applicationRepository.findByPk.mockResolvedValue(application);
    sequelizeModule.applicationReviewRepository.findOne.mockResolvedValue(openReview);

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
    sequelizeModule.applicationReviewRepository.findOne.mockResolvedValue(openReview);

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

    sequelizeModule.applicationRepository.findByPk.mockResolvedValue(application);
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

    sequelizeModule.applicationRepository.findByPk.mockResolvedValue(application);
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

    sequelizeModule.applicationRepository.findByPk.mockResolvedValue(application);

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
      .mockReturnValue('generated-request-id' as ReturnType<typeof crypto.randomUUID>);

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
});
