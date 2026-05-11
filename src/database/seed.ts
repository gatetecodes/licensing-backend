import * as dotenv from 'dotenv';
dotenv.config();

import { sequelize } from './sequelize';
import {
  applicationRepository,
  applicationReviewRepository,
  roleRepository,
  userRepository,
  userRoleRepository
} from './sequelize';
import { Roles, RoleType } from '../types/role.types';
import { UserStatus, UserStatusType } from '../types/user.types';
import { UserHelper } from '../helpers/user-helper';
import {
  ApplicationStates,
  InstitutionTypes
} from '../types/application.types';
import { log, logger } from '../helpers/logger-helper';
import config from 'config';

const seedPassword = config.get('app.seed.password') as string;
const institutionName = config.get('app.seed.institutionName') as string;
const adminName = config.get('app.seed.adminName') as string;
const adminEmail = config.get('app.seed.adminEmail') as string;
const applicantOneName = config.get('app.seed.applicantOneName') as string;
const applicantOneEmail = config.get('app.seed.applicantOneEmail') as string;
const applicantOneInstitutionName = config.get(
  'app.seed.applicantOneInstitutionName'
) as string;
const applicantTwoName = config.get('app.seed.applicantTwoName') as string;
const applicantTwoEmail = config.get('app.seed.applicantTwoEmail') as string;
const applicantTwoInstitutionName = config.get(
  'app.seed.applicantTwoInstitutionName'
) as string;
const applicantThreeName = config.get('app.seed.applicantThreeName') as string;
const applicantThreeEmail = config.get(
  'app.seed.applicantThreeEmail'
) as string;
const applicantThreeInstitutionName = config.get(
  'app.seed.applicantThreeInstitutionName'
) as string;
const reviewerOneName = config.get('app.seed.reviewerOneName') as string;
const reviewerOneEmail = config.get('app.seed.reviewerOneEmail') as string;
const reviewerTwoName = config.get('app.seed.reviewerTwoName') as string;
const reviewerTwoEmail = config.get('app.seed.reviewerTwoEmail') as string;
const approverOneName = config.get('app.seed.approverOneName') as string;
const approverOneEmail = config.get('app.seed.approverOneEmail') as string;
const approverTwoName = config.get('app.seed.approverTwoName') as string;
const approverTwoEmail = config.get('app.seed.approverTwoEmail') as string;

type SeedUser = {
  name: string;
  email: string;
  institution_name: string;
  role: RoleType;
  status: UserStatusType;
  email_verified_at: Date;
};

const seedUsers: SeedUser[] = [
  {
    name: applicantOneName,
    email: applicantOneEmail,
    institution_name: applicantOneInstitutionName,
    role: Roles.APPLICANT,
    status: UserStatus.ACTIVE,
    email_verified_at: new Date()
  },
  {
    name: applicantTwoName,
    email: applicantTwoEmail,
    institution_name: applicantTwoInstitutionName,
    role: Roles.APPLICANT,
    status: UserStatus.ACTIVE,
    email_verified_at: new Date()
  },
  {
    name: applicantThreeName,
    email: applicantThreeEmail,
    institution_name: applicantThreeInstitutionName,
    role: Roles.APPLICANT,
    status: UserStatus.ACTIVE,
    email_verified_at: new Date()
  },
  {
    name: reviewerOneName,
    email: reviewerOneEmail,
    institution_name: institutionName,
    role: Roles.REVIEWER,
    status: UserStatus.ACTIVE,
    email_verified_at: new Date()
  },
  {
    name: reviewerTwoName,
    email: reviewerTwoEmail,
    institution_name: institutionName,
    role: Roles.REVIEWER,
    status: UserStatus.ACTIVE,
    email_verified_at: new Date()
  },
  {
    name: approverOneName,
    email: approverOneEmail,
    institution_name: institutionName,
    role: Roles.APPROVER,
    status: UserStatus.ACTIVE,
    email_verified_at: new Date()
  },
  {
    name: approverTwoName,
    email: approverTwoEmail,
    institution_name: institutionName,
    role: Roles.APPROVER,
    status: UserStatus.ACTIVE,
    email_verified_at: new Date()
  },
  {
    name: adminName,
    email: adminEmail,
    institution_name: institutionName,
    role: Roles.ADMIN,
    status: UserStatus.ACTIVE,
    email_verified_at: new Date()
  }
];

const getSeedPassword = (): string => seedPassword;

const checkRole = async (name: RoleType): Promise<{ id: string }> => {
  const existingRole = await roleRepository.findOne({ where: { name } });
  if (existingRole) {
    return { id: existingRole.id };
  }

  const createdRole = await roleRepository.create({
    name,
    description: `${name} role`
  } as any);

  return { id: createdRole.id };
};

const checkUser = async (
  helper: UserHelper,
  input: SeedUser
): Promise<{ id: string; email: string }> => {
  const passwordHash = helper.hashPassword(getSeedPassword());
  const existingUser = await userRepository.findOne({
    where: { email: input.email }
  });

  if (existingUser) {
    await existingUser.update({
      name: input.name,
      password: passwordHash,
      institution_name: input.institution_name,
      status: input.status,
      email_verified_at: input.email_verified_at ? new Date() : undefined
    });
    return { id: existingUser.id, email: existingUser.email };
  }

  const createdUser = await userRepository.create({
    name: input.name,
    email: input.email,
    password: passwordHash,
    institution_name: input.institution_name,
    status: input.status,
    email_verified_at: input.email_verified_at ? new Date() : undefined
  } as any);

  return { id: createdUser.id, email: createdUser.email };
};

const checkUserRole = async (userId: string, roleId: string): Promise<void> => {
  const existingUserRole = await userRoleRepository.findOne({
    where: {
      user_id: userId,
      role_id: roleId
    }
  });

  if (existingUserRole) {
    return;
  }

  await userRoleRepository.create({
    user_id: userId,
    role_id: roleId
  } as any);
};

const clearSeedApplicationReviews = async (
  applicationId: string
): Promise<void> => {
  await applicationReviewRepository.destroy({
    where: { application_id: applicationId }
  });
};

/** In-progress drafts tied to specific seeded applicants (not workflow-complete). */
const checkSeedApplications = async (args: {
  applicantOneId: string;
  applicantTwoId: string;
}): Promise<void> => {
  const seedDrafts: Array<{
    reference_number: string;
    applicant_id: string;
    institution_name: string;
    institution_type: (typeof InstitutionTypes)[keyof typeof InstitutionTypes];
  }> = [
    {
      reference_number: 'BNR-SEED-SUBMITTED-0001',
      applicant_id: args.applicantOneId,
      institution_name: applicantOneInstitutionName,
      institution_type: InstitutionTypes.BANK
    },
    {
      reference_number: 'BNR-SEED-READY-0001',
      applicant_id: args.applicantTwoId,
      institution_name: applicantTwoInstitutionName,
      institution_type: InstitutionTypes.MICROFINANCE
    }
  ];

  const draftFields = {
    current_state: ApplicationStates.DRAFT,
    submitted_at: null,
    reviewed_by_id: null,
    decisioned_by_id: null,
    decision_at: null,
    decision_reason: null,
    lock_version: 0
  } as const;

  for (const draft of seedDrafts) {
    const existing = await applicationRepository.findOne({
      where: { reference_number: draft.reference_number }
    });

    if (existing) {
      await existing.update({
        applicant_id: draft.applicant_id,
        institution_name: draft.institution_name,
        institution_type: draft.institution_type,
        ...draftFields
      } as any);
      await clearSeedApplicationReviews(existing.id);
    } else {
      await applicationRepository.create({
        reference_number: draft.reference_number,
        applicant_id: draft.applicant_id,
        institution_name: draft.institution_name,
        institution_type: draft.institution_type,
        ...draftFields
      } as any);
    }
  }
};

const run = async (): Promise<void> => {
  const helper = new UserHelper();
  const seededApplicants: { id: string; email: string }[] = [];

  for (const role of Object.values(Roles)) {
    await checkRole(role);
  }

  for (const seedUser of seedUsers) {
    const user = await checkUser(helper, seedUser);
    const role = await roleRepository.findOne({
      where: { name: seedUser.role }
    });

    if (!role) {
      throw new Error(`Role ${seedUser.role} is not configured`);
    }

    await checkUserRole(user.id, role.id);
    if (seedUser.role === Roles.APPLICANT) {
      seededApplicants.push(user);
    }
  }

  const applicantOne = seededApplicants[0];
  const applicantTwo = seededApplicants[1];

  if (!applicantOne || !applicantTwo) {
    throw new Error(
      'Expected at least two seeded applicants for draft applications'
    );
  }

  await checkSeedApplications({
    applicantOneId: applicantOne.id,
    applicantTwoId: applicantTwo.id
  });
};

run()
  .then(async () => {
    logger.info(
      log({
        event: 'DB_SEED_SUCCESS',
        data: {
          users: seedUsers.map((seedUser) => seedUser.email),
          password: getSeedPassword(),
          applications: [
            {
              reference: 'BNR-SEED-SUBMITTED-0001',
              state: ApplicationStates.DRAFT,
              applicantEmail: applicantOneEmail
            },
            {
              reference: 'BNR-SEED-READY-0001',
              state: ApplicationStates.DRAFT,
              applicantEmail: applicantTwoEmail
            }
          ]
        }
      })
    );
    await sequelize.close();
  })
  .catch(async (error) => {
    logger.error(
      log({
        event: 'DB_SEED_FAILURE',
        error
      })
    );
    await sequelize.close();
    process.exitCode = 1;
  });
