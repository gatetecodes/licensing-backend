const mockSendEmail = jest.fn();

jest.mock('../src/services/email.service', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args)
}));

jest.mock('../src/helpers/logger-helper', () => ({
  logger: {
    error: jest.fn()
  }
}));

jest.mock('../src/database/sequelize', () => ({
  roleRepository: {
    findOne: jest.fn()
  },
  userRoleRepository: {
    findAll: jest.fn()
  },
  userRepository: {
    findAll: jest.fn(),
    findByPk: jest.fn()
  }
}));

jest.mock('config', () => ({
  has: jest.fn((key: string) => key === 'app.url'),
  get: jest.fn((key: string) => {
    if (key === 'app.url') {
      return 'https://licensing-portal.bnr.rw/';
    }
    return '';
  })
}));

import { workflowNotificationService } from '../src/services/workflow-notification.service';
import {
  roleRepository,
  userRepository,
  userRoleRepository
} from '../src/database/sequelize';
import { logger } from '../src/helpers/logger-helper';
import config from 'config';

const repositories = {
  roleRepository: roleRepository as unknown as { findOne: jest.Mock },
  userRoleRepository: userRoleRepository as unknown as { findAll: jest.Mock },
  userRepository: userRepository as unknown as {
    findAll: jest.Mock;
    findByPk: jest.Mock;
  }
};

const configMock = config as unknown as {
  has: jest.Mock;
  get: jest.Mock;
};

describe('workflow-notification.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    configMock.has.mockImplementation((key: string) => key === 'app.url');
    configMock.get.mockImplementation((key: string) =>
      key === 'app.url' ? 'https://portal.bnr.rw/' : ''
    );
  });

  it('notifies reviewers with unique normalized recipient emails', async () => {
    repositories.roleRepository.findOne.mockResolvedValue({
      id: 'role-reviewer'
    });
    repositories.userRoleRepository.findAll.mockResolvedValue([
      { user_id: 'u-1' },
      { user_id: 'u-1' },
      { user_id: 'u-2' }
    ]);
    repositories.userRepository.findAll.mockResolvedValue([
      { email: 'Reviewer@Example.com ' },
      { email: ' reviewer@example.com' },
      { email: 'second@example.com' },
      { email: '' }
    ]);
    mockSendEmail.mockResolvedValue({ success: true });

    await workflowNotificationService.notifyReviewersOnApplicationSubmitted({
      application: {
        reference_number: 'BNR-123',
        institution_name: 'Acme Bank',
        submitted_at: new Date('2026-01-01T10:00:00.000Z')
      } as any
    });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['reviewer@example.com', 'second@example.com'],
        subject: 'New application submitted: BNR-123',
        template: 'application-submitted-reviewer',
        context: expect.objectContaining({
          portalUrl: 'https://portal.bnr.rw/applications'
        })
      })
    );
  });

  it('skips role notifications when role is missing', async () => {
    repositories.roleRepository.findOne.mockResolvedValue(null);

    await workflowNotificationService.notifyApproversOnReadyForDecision({
      application: {
        reference_number: 'BNR-123',
        institution_name: 'Acme'
      } as any
    });

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('sends information request to applicant with trimmed note and request summary', async () => {
    repositories.userRepository.findByPk.mockResolvedValue({
      email: 'applicant@example.com',
      name: 'Applicant One'
    });
    mockSendEmail.mockResolvedValue({ success: true });

    await workflowNotificationService.notifyApplicantOnInformationRequested({
      application: {
        id: 'app-1',
        applicant_id: 'u-app',
        reference_number: 'BNR-456',
        institution_name: 'Acme MFI'
      } as any,
      reviewerSummaryNote: '  Add missing details  ',
      requestItems: [
        { type: 'OPEN_QUESTION', instruction: 'Explain controls' },
        { type: 'FIELD_UPDATE', instruction: 'Update address' }
      ] as any
    });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'applicant@example.com',
        template: 'information-requested-applicant',
        context: expect.objectContaining({
          reviewerSummaryNote: 'Add missing details',
          requestItemCount: 2,
          requestSummary: expect.stringContaining(
            '1. OPEN QUESTION: Explain controls'
          )
        })
      })
    );
  });

  it('sends applicant decision email with outcome-specific subject/template', async () => {
    repositories.userRepository.findByPk.mockResolvedValue({
      email: 'applicant@example.com',
      name: 'Applicant One'
    });
    mockSendEmail.mockResolvedValue({ success: true });

    await workflowNotificationService.notifyApplicantOnDecision({
      application: {
        id: 'app-1',
        applicant_id: 'u-app',
        reference_number: 'BNR-999',
        institution_name: 'Acme',
        license_category: 'COMMERCIAL_BANK'
      } as any,
      decisionReason: '  Complete evidence provided ',
      outcome: 'APPROVED'
    });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Application Approved: BNR-999',
        template: 'application-approved-applicant',
        context: expect.objectContaining({
          decisionReason: 'Complete evidence provided',
          licenseCategory: 'COMMERCIAL BANK'
        })
      })
    );
  });

  it('logs and swallows applicant email errors', async () => {
    repositories.userRepository.findByPk.mockRejectedValue(
      new Error('db down')
    );

    await workflowNotificationService.notifyApplicantOnDecision({
      application: {
        id: 'app-2',
        applicant_id: 'u-1',
        reference_number: 'BNR-1'
      } as any,
      decisionReason: 'x',
      outcome: 'REJECTED'
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Applicant decision notification email failed',
      expect.objectContaining({
        data: expect.objectContaining({
          applicationId: 'app-2',
          outcome: 'REJECTED'
        })
      })
    );
  });

  it('skips role notifications when role has no memberships', async () => {
    repositories.roleRepository.findOne.mockResolvedValue({
      id: 'role-reviewer'
    });
    repositories.userRoleRepository.findAll.mockResolvedValue([]);

    await workflowNotificationService.notifyReviewersOnApplicationSubmitted({
      application: {
        reference_number: 'BNR-124',
        institution_name: 'Acme',
        submitted_at: new Date('2026-01-01T10:00:00.000Z')
      } as any
    });

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('skips role notifications when active recipients are empty', async () => {
    repositories.roleRepository.findOne.mockResolvedValue({
      id: 'role-reviewer'
    });
    repositories.userRoleRepository.findAll.mockResolvedValue([
      { user_id: 'u-1' }
    ]);
    repositories.userRepository.findAll.mockResolvedValue([
      { email: '' },
      { email: '   ' },
      { email: null }
    ]);

    await workflowNotificationService.notifyReviewersOnApplicationSubmitted({
      application: {
        reference_number: 'BNR-125',
        institution_name: 'Acme',
        submitted_at: new Date('2026-01-01T10:00:00.000Z')
      } as any
    });

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('logs and swallows role notification failures', async () => {
    repositories.roleRepository.findOne.mockRejectedValue(
      new Error('role lookup failed')
    );

    await workflowNotificationService.notifyApproversOnReadyForDecision({
      application: {
        reference_number: 'BNR-126',
        institution_name: 'Acme'
      } as any
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Workflow notification email failed',
      expect.objectContaining({
        data: expect.objectContaining({ role: 'APPROVER' })
      })
    );
  });

  it('skips information-requested email when applicant has no email', async () => {
    repositories.userRepository.findByPk.mockResolvedValue({
      email: '',
      name: 'Applicant One'
    });

    await workflowNotificationService.notifyApplicantOnInformationRequested({
      application: {
        id: 'app-3',
        applicant_id: 'u-app',
        reference_number: 'BNR-127',
        institution_name: 'Acme'
      } as any,
      requestItems: [{ type: 'OPEN_QUESTION', instruction: 'Question' }] as any
    });

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('logs and swallows information-requested email errors', async () => {
    repositories.userRepository.findByPk.mockRejectedValue(
      new Error('db unavailable')
    );

    await workflowNotificationService.notifyApplicantOnInformationRequested({
      application: {
        id: 'app-4',
        applicant_id: 'u-app',
        reference_number: 'BNR-128',
        institution_name: 'Acme'
      } as any
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Applicant information-requested email failed',
      expect.objectContaining({
        data: expect.objectContaining({ applicationId: 'app-4' })
      })
    );
  });

  it('skips decision email when applicant has no email', async () => {
    repositories.userRepository.findByPk.mockResolvedValue({
      email: undefined,
      name: 'Applicant One'
    });

    await workflowNotificationService.notifyApplicantOnDecision({
      application: {
        id: 'app-5',
        applicant_id: 'u-1',
        reference_number: 'BNR-129'
      } as any,
      decisionReason: 'x',
      outcome: 'APPROVED'
    });

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('sets portal url as undefined when app url is not configured', async () => {
    configMock.has.mockReturnValue(false);
    repositories.roleRepository.findOne.mockResolvedValue({
      id: 'role-reviewer'
    });
    repositories.userRoleRepository.findAll.mockResolvedValue([
      { user_id: 'u-1' }
    ]);
    repositories.userRepository.findAll.mockResolvedValue([
      { email: 'reviewer@example.com' }
    ]);
    mockSendEmail.mockResolvedValue({ success: true });

    await workflowNotificationService.notifyReviewersOnApplicationSubmitted({
      application: {
        reference_number: 'BNR-130',
        institution_name: 'Acme',
        submitted_at: new Date('2026-01-01T10:00:00.000Z')
      } as any
    });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ portalUrl: undefined })
      })
    );
  });

  it('sets portal url as undefined when configured url is blank', async () => {
    configMock.has.mockReturnValue(true);
    configMock.get.mockReturnValue('   ');
    repositories.roleRepository.findOne.mockResolvedValue({
      id: 'role-reviewer'
    });
    repositories.userRoleRepository.findAll.mockResolvedValue([
      { user_id: 'u-1' }
    ]);
    repositories.userRepository.findAll.mockResolvedValue([
      { email: 'reviewer@example.com' }
    ]);
    mockSendEmail.mockResolvedValue({ success: true });

    await workflowNotificationService.notifyReviewersOnApplicationSubmitted({
      application: {
        reference_number: 'BNR-131',
        institution_name: 'Acme',
        submitted_at: new Date('2026-01-01T10:00:00.000Z')
      } as any
    });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ portalUrl: undefined })
      })
    );
  });
});
