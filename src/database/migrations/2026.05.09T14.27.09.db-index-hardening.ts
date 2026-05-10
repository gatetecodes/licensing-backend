import type { Migration } from '../umzug';
import type { QueryInterface } from 'sequelize';
import { Tables } from '../tables';
import { log, logger } from '../../helpers/logger-helper';

type DialectLike = {
  getDialect: () => string;
  query: (_sql: string) => Promise<unknown>;
};

const addIndexIfMissing = async (
  queryInterface: QueryInterface,
  tableName: string,
  fields: string[],
  options: { name: string; unique?: boolean }
) => {
  const existing = (await queryInterface.showIndex(tableName)) as Array<{
    name?: string;
  }>;
  const alreadyExists = existing.some(
    (index: { name?: string }) => index.name === options.name
  );
  if (alreadyExists) {
    return;
  }
  await queryInterface.addIndex(tableName, fields, options);
};

export const up: Migration = async ({ context: sequelize }) => {
  const queryInterface = sequelize.getQueryInterface();
  const dialect = sequelize as unknown as DialectLike;

  try {
    await addIndexIfMissing(
      queryInterface,
      Tables.Application,
      ['applicant_id', 'current_state', 'updated_at'],
      { name: 'applications_applicant_state_updated_at_idx' }
    );
    await addIndexIfMissing(
      queryInterface,
      Tables.Application,
      ['current_state', 'updated_at'],
      { name: 'applications_state_updated_at_idx' }
    );
    await addIndexIfMissing(
      queryInterface,
      Tables.Application,
      ['reviewed_by_id', 'current_state'],
      { name: 'applications_reviewer_state_idx' }
    );
    await addIndexIfMissing(
      queryInterface,
      Tables.Application,
      ['decisioned_by_id', 'decision_at'],
      { name: 'applications_decisioner_decision_at_idx' }
    );
    await addIndexIfMissing(queryInterface, Tables.Application, ['submitted_at'], {
      name: 'applications_submitted_at_idx'
    });

    await addIndexIfMissing(
      queryInterface,
      Tables.Document,
      ['application_id', 'document_type'],
      { name: 'documents_application_document_type_idx' }
    );
    await addIndexIfMissing(queryInterface, Tables.DocumentVersion, ['uploaded_by_id'], {
      name: 'document_versions_uploaded_by_id_idx'
    });

    await addIndexIfMissing(
      queryInterface,
      Tables.AuditLog,
      ['application_id', 'occurred_at'],
      { name: 'audit_logs_application_occurred_at_idx' }
    );
    await addIndexIfMissing(queryInterface, Tables.AuditLog, ['acting_user_id', 'occurred_at'], {
      name: 'audit_logs_actor_occurred_at_idx'
    });
    await addIndexIfMissing(queryInterface, Tables.AuditLog, ['request_id'], {
      unique: true,
      name: 'audit_logs_request_id_key'
    });

    await addIndexIfMissing(queryInterface, Tables.User, ['status'], {
      name: 'users_status_idx'
    });
    await addIndexIfMissing(queryInterface, Tables.UserRole, ['user_id', 'role_id'], {
      unique: true,
      name: 'user_roles_user_id_role_id_key'
    });
    await addIndexIfMissing(queryInterface, Tables.UserRole, ['role_id'], {
      name: 'user_roles_role_id_idx'
    });

    if (dialect.getDialect() === 'postgres') {
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS audit_logs_occurred_at_brin_idx
        ON "${Tables.AuditLog}" USING BRIN (occurred_at);
      `);
    }
  } catch (error) {
    logger.error(
      log({
        event: 'DB_MIGRATION_FAILURE',
        migration: '2026.05.09T14.27.09.db-index-hardening',
        error
      })
    );
    throw error;
  }
};

export const down: Migration = async ({ context: sequelize }) => {
  const queryInterface = sequelize.getQueryInterface();
  const dialect = sequelize as unknown as DialectLike;

  try {
    if (dialect.getDialect() === 'postgres') {
      await queryInterface.sequelize.query(`
        DROP INDEX IF EXISTS audit_logs_occurred_at_brin_idx;
      `);
    }

    await queryInterface.removeIndex(
      Tables.UserRole,
      'user_roles_role_id_idx'
    );
    await queryInterface.removeIndex(
      Tables.UserRole,
      'user_roles_user_id_role_id_key'
    );
    await queryInterface.removeIndex(Tables.User, 'users_status_idx');

    await queryInterface.removeIndex(Tables.AuditLog, 'audit_logs_request_id_key');
    await queryInterface.removeIndex(
      Tables.AuditLog,
      'audit_logs_actor_occurred_at_idx'
    );
    await queryInterface.removeIndex(
      Tables.AuditLog,
      'audit_logs_application_occurred_at_idx'
    );

    await queryInterface.removeIndex(
      Tables.DocumentVersion,
      'document_versions_uploaded_by_id_idx'
    );
    await queryInterface.removeIndex(
      Tables.Document,
      'documents_application_document_type_idx'
    );

    await queryInterface.removeIndex(
      Tables.Application,
      'applications_submitted_at_idx'
    );
    await queryInterface.removeIndex(
      Tables.Application,
      'applications_decisioner_decision_at_idx'
    );
    await queryInterface.removeIndex(
      Tables.Application,
      'applications_reviewer_state_idx'
    );
    await queryInterface.removeIndex(
      Tables.Application,
      'applications_state_updated_at_idx'
    );
    await queryInterface.removeIndex(
      Tables.Application,
      'applications_applicant_state_updated_at_idx'
    );
  } catch (error) {
    logger.error(
      log({
        event: 'DB_MIGRATION_FAILURE',
        migration: '2026.05.09T14.27.09.db-index-hardening',
        error
      })
    );
    throw error;
  }
};
