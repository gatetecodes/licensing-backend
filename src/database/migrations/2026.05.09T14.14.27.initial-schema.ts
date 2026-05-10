import { DataTypes, Sequelize } from 'sequelize';
import type { Migration } from '../umzug';
import { Tables } from '../tables';
import { log, logger } from '../../helpers/logger-helper';
import { Roles } from '../../types/role.types';
import { UserStatus } from '../../types/user.types';
import { AuthTokenTypes } from '../../types/auth-token.types';
import {
  ApplicationReviewOutcomes,
  ApplicationStates,
  InstitutionTypes
} from '../../types/application.types';
import { DocumentTypes } from '../../types/document.types';
import { AuditLogActionTypes } from '../../types/audit-log.types';
import { LoggerEvents } from '../../constants/logger-events';

const timestampColumns = {
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
  }
};

export const up: Migration = async ({ context: sequelize }) => {
  const queryInterface = sequelize.getQueryInterface();
  const isSqlite = sequelize.getDialect() === 'sqlite';
  const enumType = (...values: string[]) =>
    isSqlite ? DataTypes.STRING : DataTypes.ENUM(...values);

  try {
    await queryInterface.createTable(Tables.User, {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false
      },
      institution_name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      email_verified_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      status: {
        type: enumType(...Object.values(UserStatus)),
        allowNull: false
      },
      ...timestampColumns
    });
    await queryInterface.addIndex(Tables.User, ['email'], {
      unique: true,
      name: 'users_email_key'
    });

    await queryInterface.createTable(Tables.Role, {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
      },
      name: {
        type: enumType(...Object.values(Roles)),
        allowNull: false
      },
      description: {
        type: DataTypes.STRING,
        allowNull: true
      },
      ...timestampColumns
    });
    await queryInterface.addIndex(Tables.Role, ['name'], {
      unique: true,
      name: 'roles_name_key'
    });

    await queryInterface.createTable(Tables.UserRole, {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: Tables.User, key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      role_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: Tables.Role, key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      ...timestampColumns
    });

    await queryInterface.createTable(Tables.Application, {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
      },
      reference_number: {
        type: DataTypes.STRING,
        allowNull: false
      },
      applicant_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: Tables.User, key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      institution_name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      institution_type: {
        type: enumType(...Object.values(InstitutionTypes)),
        allowNull: false
      },
      current_state: {
        type: enumType(...Object.values(ApplicationStates)),
        allowNull: false
      },
      submitted_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      reviewed_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: Tables.User, key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      decisioned_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: Tables.User, key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      decision_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      decision_reason: {
        type: DataTypes.STRING,
        allowNull: true
      },
      lock_version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      ...timestampColumns
    });
    await queryInterface.addIndex(Tables.Application, ['reference_number'], {
      unique: true,
      name: 'applications_reference_number_key'
    });

    await queryInterface.createTable(Tables.ApplicationReview, {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
      },
      application_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: Tables.Application, key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      reviewer_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: Tables.User, key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      cycle_number: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      started_at: {
        type: DataTypes.DATE,
        allowNull: false
      },
      completed_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      outcome: {
        type: enumType(...Object.values(ApplicationReviewOutcomes)),
        allowNull: true
      },
      notes: {
        type: DataTypes.STRING,
        allowNull: true
      },
      ...timestampColumns
    });
    await queryInterface.addIndex(
      Tables.ApplicationReview,
      ['application_id', 'cycle_number'],
      {
        unique: true,
        name: 'application_reviews_application_id_cycle_number_key'
      }
    );

    await queryInterface.createTable(Tables.Document, {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
      },
      application_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: Tables.Application, key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      document_type: {
        type: enumType(...Object.values(DocumentTypes)),
        allowNull: false
      },
      created_at: timestampColumns.created_at
    });

    await queryInterface.createTable(Tables.DocumentVersion, {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
      },
      document_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: Tables.Document, key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      version_number: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      stored_filename: {
        type: DataTypes.STRING,
        allowNull: false
      },
      original_filename: {
        type: DataTypes.STRING,
        allowNull: false
      },
      mime_type: {
        type: DataTypes.STRING,
        allowNull: false
      },
      file_size_bytes: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      checksum: {
        type: DataTypes.STRING,
        allowNull: false
      },
      uploaded_by_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: Tables.User, key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      uploaded_at: {
        type: DataTypes.DATE,
        allowNull: false
      },
      supersedes_version_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: Tables.DocumentVersion, key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }
    });
    await queryInterface.addIndex(
      Tables.DocumentVersion,
      ['document_id', 'version_number'],
      {
        unique: true,
        name: 'document_versions_document_id_version_number_key'
      }
    );

    await queryInterface.createTable(Tables.AuditLog, {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
      },
      application_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: Tables.Application, key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      acting_user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: Tables.User, key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      action_type: {
        type: enumType(...Object.values(AuditLogActionTypes)),
        allowNull: false
      },
      occurred_at: {
        type: DataTypes.DATE,
        allowNull: false
      },
      before_state: {
        type: DataTypes.STRING,
        allowNull: true
      },
      after_state: {
        type: DataTypes.STRING,
        allowNull: true
      },
      request_id: {
        type: DataTypes.STRING,
        allowNull: false
      },
      ip_address: {
        type: DataTypes.STRING,
        allowNull: true
      },
      user_agent: {
        type: DataTypes.STRING,
        allowNull: true
      },
      metadata: {
        type: isSqlite ? DataTypes.JSON : DataTypes.JSONB,
        allowNull: false
      },
      previous_hash: {
        type: DataTypes.STRING,
        allowNull: true
      },
      entry_hash: {
        type: DataTypes.STRING,
        allowNull: false
      },
      ...timestampColumns
    });

    await queryInterface.createTable(Tables.Session, {
      id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: Tables.User, key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      data: {
        type: isSqlite ? DataTypes.JSON : DataTypes.JSONB,
        allowNull: false
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });
    await queryInterface.addIndex(Tables.Session, ['user_id'], {
      name: 'sessions_user_id_idx'
    });
    await queryInterface.addIndex(Tables.Session, ['expires_at'], {
      name: 'sessions_expires_at_idx'
    });

    await queryInterface.createTable(Tables.AuthToken, {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: Tables.User, key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      token_hash: {
        type: DataTypes.STRING,
        allowNull: false
      },
      token_type: {
        type: enumType(...Object.values(AuthTokenTypes)),
        allowNull: false
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: false
      },
      consumed_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
    await queryInterface.addIndex(Tables.AuthToken, ['token_hash'], {
      unique: true,
      name: 'auth_tokens_token_hash_key'
    });
    await queryInterface.addIndex(
      Tables.AuthToken,
      ['user_id', 'token_type', 'created_at'],
      {
        name: 'auth_tokens_user_type_created_at_idx'
      }
    );
    await queryInterface.addIndex(
      Tables.AuthToken,
      ['token_type', 'expires_at', 'consumed_at'],
      {
        name: 'auth_tokens_type_expires_consumed_idx'
      }
    );
  } catch (error) {
    logger.error(
      log({
        event: LoggerEvents.DB_MIGRATION_FAILURE,
        migration: '2026.05.09T14.14.27.initial-schema',
        error
      })
    );
  }
};

export const down: Migration = async ({ context: sequelize }) => {
  const queryInterface = sequelize.getQueryInterface();
  try {
    await queryInterface.dropTable(Tables.AuthToken);
    await queryInterface.dropTable(Tables.Session);
    await queryInterface.dropTable(Tables.AuditLog);
    await queryInterface.dropTable(Tables.DocumentVersion);
    await queryInterface.dropTable(Tables.Document);
    await queryInterface.dropTable(Tables.ApplicationReview);
    await queryInterface.dropTable(Tables.Application);
    await queryInterface.dropTable(Tables.UserRole);
    await queryInterface.dropTable(Tables.Role);
    await queryInterface.dropTable(Tables.User);
  } catch (error) {
    logger.error(
      log({
        event: LoggerEvents.DB_MIGRATION_FAILURE,
        migration: '2026.05.09T14.14.27.initial-schema',
        error
      })
    );
  }
};
