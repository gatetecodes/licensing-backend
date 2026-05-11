import { Sequelize } from 'sequelize-typescript';
import config from 'config';
import path from 'node:path';
import UserModel from './models/user.model';
import ApplicationModel from './models/application.model';
import ApplicationReviewModel from './models/application-review.model';
import DocumentModel from './models/document.model';
import DocumentVersionModel from './models/document-version.model';
import AuditLogModel from './models/audit-log.model';
import SessionModel from './models/session.model';
import AuthTokenModel from './models/auth-token.model';
import UserRoleModel from './models/user-role.model';
import RoleModel from './models/role.model';
import UserAuditLogModel from './models/user-audit-log.model';

const dbUri: string =
  config.get('node_env') === 'test'
    ? config.get('app.database.testUri')
    : config.get('app.database.uri');

let logging = false;
if (config.has('app.database.logging')) {
  logging = config.get('app.database.logging') === 'true';
}

export const connect = (url: string) => {
  const isSQLite = url.startsWith('sqlite://');

  const baseConfig = {
    models: [path.join(__dirname, './models')],
    repositoryMode: true,
    logging,
    define: {
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    },
    pool: {
      max: 10,
      acquire: 60000,
      idle: 10000,
      min: 5
    }
  };

  if (!isSQLite) {
    Object.assign(baseConfig, {
      timezone: 'Africa/Kigali'
    });
  }

  const sequelize = new Sequelize(url, baseConfig);

  return sequelize;
};

export const sequelize = connect(dbUri);

export const userRepository = sequelize.getRepository(UserModel);
export const applicationRepository = sequelize.getRepository(ApplicationModel);
export const applicationReviewRepository = sequelize.getRepository(
  ApplicationReviewModel
);
export const documentRepository = sequelize.getRepository(DocumentModel);
export const documentVersionRepository =
  sequelize.getRepository(DocumentVersionModel);
export const auditLogRepository = sequelize.getRepository(AuditLogModel);
export const sessionRepository = sequelize.getRepository(SessionModel);
export const authTokenRepository = sequelize.getRepository(AuthTokenModel);
export const userRoleRepository = sequelize.getRepository(UserRoleModel);
export const roleRepository = sequelize.getRepository(RoleModel);
export const userAuditLogRepository =
  sequelize.getRepository(UserAuditLogModel);
