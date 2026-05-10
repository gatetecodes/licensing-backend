jest.mock('../src/database/sequelize', () => ({
  applicationRepository: {
    findByPk: jest.fn()
  }
}));

import { getReadableApplication } from '../src/helpers/application-access.helper';
import { applicationRepository } from '../src/database/sequelize';
import { ApplicationStates } from '../src/types/application.types';
import { Roles } from '../src/types/role.types';
import { AuthenticatedRequest } from '../src/types/common.types';

type MockApplication = {
  id: string;
  applicant_id: string;
  current_state: string;
};

const repository = applicationRepository as unknown as {
  findByPk: jest.Mock;
};

const createRequest = (
  roleName?: string,
  userId = 'user-1'
): AuthenticatedRequest<Record<string, string | undefined>> =>
  ({
    user: {
      id: userId,
      userRoles: roleName ? [{ role: { name: roleName } }] : []
    }
  }) as unknown as AuthenticatedRequest<Record<string, string | undefined>>;

const createApplication = (
  overrides: Partial<MockApplication> = {}
): MockApplication => ({
  id: 'application-1',
  applicant_id: 'applicant-1',
  current_state: ApplicationStates.SUBMITTED,
  ...overrides
});

describe('application-access.helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws not found when application does not exist', async () => {
    repository.findByPk.mockResolvedValue(null);
    const req = createRequest(Roles.APPLICANT, 'applicant-1');

    await expect(getReadableApplication(req, 'missing-app')).rejects.toMatchObject({
      status: 404,
      message: 'Application not found'
    });
  });

  it('returns application for owner applicant', async () => {
    const application = createApplication();
    repository.findByPk.mockResolvedValue(application);
    const req = createRequest(Roles.APPLICANT, 'applicant-1');

    const result = await getReadableApplication(req, application.id);

    expect(result).toBe(application);
  });

  it('hides application from non-owner applicant', async () => {
    const application = createApplication();
    repository.findByPk.mockResolvedValue(application);
    const req = createRequest(Roles.APPLICANT, 'other-applicant');

    await expect(getReadableApplication(req, application.id)).rejects.toMatchObject({
      status: 404
    });
  });

  it('returns non-draft application for internal reviewer', async () => {
    const application = createApplication({
      current_state: ApplicationStates.READY_FOR_DECISION
    });
    repository.findByPk.mockResolvedValue(application);
    const req = createRequest(Roles.REVIEWER, 'reviewer-1');

    const result = await getReadableApplication(req, application.id);

    expect(result).toBe(application);
  });

  it('hides draft application from internal roles', async () => {
    const application = createApplication({
      current_state: ApplicationStates.DRAFT
    });
    repository.findByPk.mockResolvedValue(application);
    const req = createRequest(Roles.ADMIN, 'admin-1');

    await expect(getReadableApplication(req, application.id)).rejects.toMatchObject({
      status: 404
    });
  });

  it('hides application when requester has no readable role', async () => {
    const application = createApplication();
    repository.findByPk.mockResolvedValue(application);
    const req = createRequest(undefined, 'user-2');

    await expect(getReadableApplication(req, application.id)).rejects.toMatchObject({
      status: 404
    });
  });

  it('hides applicant record when requester user id is missing', async () => {
    const application = createApplication();
    repository.findByPk.mockResolvedValue(application);
    const req = ({
      user: {
        userRoles: [{ role: { name: Roles.APPLICANT } }]
      }
    } as unknown) as AuthenticatedRequest<Record<string, string | undefined>>;

    await expect(getReadableApplication(req, application.id)).rejects.toMatchObject({
      status: 404
    });
  });
});
