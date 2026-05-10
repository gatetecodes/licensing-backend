import config from 'config';
import { Op } from 'sequelize';
import ApplicationModel from '../database/models/application.model';
import { roleRepository, userRepository, userRoleRepository } from '../database/sequelize';
import { logger } from '../helpers/logger-helper';
import { Roles, RoleType } from '../types/role.types';
import { UserStatus } from '../types/user.types';
import { sendEmail } from './email.service';
import { IWorkflowRequestItem } from '../types/application.types';

type RoleEmailOptions = {
  role: RoleType;
  subject: string;
  template: string;
  context: Record<string, unknown>;
};

type ApplicationNotificationOptions = {
  application: ApplicationModel;
  notes?: string;
  reviewerSummaryNote?: string;
  requestItems?: Array<Pick<IWorkflowRequestItem, 'type' | 'instruction'>>;
};

const getPortalApplicationsUrl = (): string | undefined => {
  if (!config.has('app.url')) {
    return undefined;
  }

  const baseUrl = `${config.get('app.url')}`.trim();
  if (!baseUrl) {
    return undefined;
  }

  return `${baseUrl.replace(/\/$/, '')}/applications`;
};

class WorkflowNotificationService {
  private readonly notifyRole = async ({
    role,
    subject,
    template,
    context
  }: RoleEmailOptions): Promise<void> => {
    try {
      const roleRecord = await roleRepository.findOne({
        where: { name: role }
      });

      if (!roleRecord) {
        return;
      }

      const roleMemberships = await userRoleRepository.findAll({
        where: {
          role_id: roleRecord.id
        }
      });

      const userIds = Array.from(
        new Set(roleMemberships.map((membership) => membership.user_id))
      );

      if (userIds.length === 0) {
        return;
      }

      const users = await userRepository.findAll({
        where: {
          id: {
            [Op.in]: userIds
          },
          status: UserStatus.ACTIVE
        }
      });

      const recipients = Array.from(
        new Set(
          users
            .map((user) => user.email?.trim().toLowerCase())
            .filter((email): email is string => Boolean(email))
        )
      );

      if (recipients.length === 0) {
        return;
      }

      await sendEmail({
        to: recipients,
        subject,
        template,
        context
      });
    } catch (error) {
      logger.error('Workflow notification email failed', {
        error,
        data: {
          role,
          subject,
          template
        }
      });
    }
  };

  public readonly notifyReviewersOnApplicationSubmitted = async ({
    application
  }: ApplicationNotificationOptions): Promise<void> => {
    await this.notifyRole({
      role: Roles.REVIEWER,
      subject: `New application submitted: ${application.reference_number}`,
      template: 'application-submitted-reviewer',
      context: {
        applicationReference: application.reference_number,
        institutionName: application.institution_name,
        submittedAt: application.submitted_at?.toISOString(),
        portalUrl: getPortalApplicationsUrl()
      }
    });
  };

  public readonly notifyApplicantOnInformationRequested = async ({
    application,
    reviewerSummaryNote,
    requestItems
  }: ApplicationNotificationOptions): Promise<void> => {
    try {
      const applicant = await userRepository.findByPk(application.applicant_id);

      if (!applicant?.email) {
        return;
      }

      const requestSummary = (requestItems ?? [])
        .slice(0, 5)
        .map(
          (item, index) =>
            `${index + 1}. ${item.type.split('_').join(' ')}: ${item.instruction}`
        )
        .join('\n');

      await sendEmail({
        to: applicant.email,
        subject: `More information requested: ${application.reference_number}`,
        template: 'information-requested-applicant',
        context: {
          applicantName: applicant.name,
          applicationReference: application.reference_number,
          institutionName: application.institution_name,
          reviewerSummaryNote: reviewerSummaryNote?.trim() || null,
          requestItemCount: requestItems?.length ?? 0,
          requestSummary: requestSummary || null,
          portalUrl: getPortalApplicationsUrl()
        }
      });
    } catch (error) {
      logger.error('Applicant information-requested email failed', {
        error,
        data: {
          applicationId: application.id
        }
      });
    }
  };

  public readonly notifyApproversOnReadyForDecision = async ({
    application,
    notes
  }: ApplicationNotificationOptions): Promise<void> => {
    await this.notifyRole({
      role: Roles.APPROVER,
      subject: `Application ready for decision: ${application.reference_number}`,
      template: 'ready-for-decision-approver',
      context: {
        applicationReference: application.reference_number,
        institutionName: application.institution_name,
        notes: notes?.trim() || null,
        portalUrl: getPortalApplicationsUrl()
      }
    });
  };

  public readonly notifyApplicantOnDecision = async ({
    application,
    decisionReason,
    outcome
  }: {
    application: ApplicationModel;
    decisionReason: string;
    outcome: 'APPROVED' | 'REJECTED';
  }): Promise<void> => {
    try {
      const applicant = await userRepository.findByPk(application.applicant_id);

      if (!applicant?.email) {
        return;
      }

      const isApproved = outcome === 'APPROVED';
      const subject = isApproved
        ? `Application Approved: ${application.reference_number}`
        : `Application Rejected: ${application.reference_number}`;
      const template = isApproved
        ? 'application-approved-applicant'
        : 'application-rejected-applicant';

      await sendEmail({
        to: applicant.email,
        subject,
        template,
        context: {
          applicantName: applicant.name,
          applicationReference: application.reference_number,
          institutionName: application.institution_name,
          licenseCategory: application.license_category?.split('_').join(' ') || 'N/A',
          decisionReason: decisionReason.trim(),
          portalUrl: getPortalApplicationsUrl()
        }
      });
    } catch (error) {
      logger.error('Applicant decision notification email failed', {
        error,
        data: {
          applicationId: application.id,
          outcome
        }
      });
    }
  };
}

export const workflowNotificationService = new WorkflowNotificationService();
