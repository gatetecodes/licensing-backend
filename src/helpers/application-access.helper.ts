import {
  applicationRepository
} from '../database/sequelize';
import ApplicationModel from '../database/models/application.model';
import { AuthenticatedRequest } from '../types/common.types';
import httpCodes from '../constants/http-codes';
import { getPrimaryRole } from './auth-helper';
import { INTERNAL_VIEWER_ROLES, Roles } from '../types/role.types';
import { ApplicationStates } from '../types/application.types';

export const getReadableApplication = async (
  req: AuthenticatedRequest<Record<string, string | undefined>>,
  applicationId: string
): Promise<ApplicationModel> => {
  const application = await applicationRepository.findByPk(applicationId);

  if (!application) {
    throw Object.assign(new Error('Application not found'), {
      status: httpCodes.NOT_FOUND
    });
  }

  const primaryRole = getPrimaryRole(req);

  if (primaryRole === Roles.APPLICANT) {
    if (application.applicant_id !== req.user?.id) {
      throw Object.assign(new Error('Application not found'), {
        status: httpCodes.NOT_FOUND
      });
    }

    return application;
  }

  if (
    !primaryRole ||
    !INTERNAL_VIEWER_ROLES.includes(primaryRole) ||
    application.current_state === ApplicationStates.DRAFT
  ) {
    throw Object.assign(new Error('Application not found'), {
      status: httpCodes.NOT_FOUND
    });
  }

  return application;
};

