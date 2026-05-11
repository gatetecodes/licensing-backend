import { DataTypes, Sequelize } from 'sequelize';
import type { Migration } from '../umzug';
import { Tables } from '../tables';
import { UserAuditLogActionTypes } from '../../types/user-audit-log.types';
import { log, logger } from '../../helpers/logger-helper';
import { LoggerEvents } from '../../constants/logger-events';

export const up: Migration = async ({ context: sequelize }) => {
  const queryInterface = sequelize.getQueryInterface();
  const isSqlite = sequelize.getDialect() === 'sqlite';
  const enumType = (...values: string[]) =>
    isSqlite ? DataTypes.STRING : DataTypes.ENUM(...values);

  try {
    await queryInterface.createTable(Tables.UserAuditLog, {
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
        onDelete: 'RESTRICT'
      },
      action_type: {
        type: enumType(...Object.values(UserAuditLogActionTypes)),
        allowNull: false
      },
      occurred_at: {
        type: DataTypes.DATE,
        allowNull: false
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
    });

    await queryInterface.addIndex(
      Tables.UserAuditLog,
      ['user_id', 'occurred_at'],
      {
        name: 'user_audit_logs_user_occurred_at_idx'
      }
    );
    await queryInterface.addIndex(Tables.UserAuditLog, ['request_id'], {
      unique: true,
      name: 'user_audit_logs_request_id_key'
    });

    if (sequelize.getDialect() === 'postgres') {
      await queryInterface.sequelize.query(`
        CREATE OR REPLACE FUNCTION prevent_user_audit_log_mutation()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          RAISE EXCEPTION 'user_audit_logs is append-only. UPDATE and DELETE are not allowed.';
        END;
        $$;
      `);

      await queryInterface.sequelize.query(`
        DROP TRIGGER IF EXISTS user_audit_logs_append_only_trigger ON user_audit_logs;
        CREATE TRIGGER user_audit_logs_append_only_trigger
        BEFORE UPDATE OR DELETE ON user_audit_logs
        FOR EACH ROW
        EXECUTE FUNCTION prevent_user_audit_log_mutation();
      `);
    }
  } catch (error) {
    logger.error(
      log({
        event: LoggerEvents.DB_MIGRATION_FAILURE,
        migration: '2026.05.11T13.20.00.user-audit-log',
        error
      })
    );
    throw error;
  }
};

export const down: Migration = async ({ context: sequelize }) => {
  const queryInterface = sequelize.getQueryInterface();

  try {
    if (sequelize.getDialect() === 'postgres') {
      await queryInterface.sequelize.query(`
        DROP TRIGGER IF EXISTS user_audit_logs_append_only_trigger ON user_audit_logs;
        DROP FUNCTION IF EXISTS prevent_user_audit_log_mutation();
      `);
    }

    await queryInterface.dropTable(Tables.UserAuditLog);
  } catch (error) {
    logger.error(
      log({
        event: LoggerEvents.DB_MIGRATION_FAILURE,
        migration: '2026.05.11T13.20.00.user-audit-log',
        error
      })
    );
    throw error;
  }
};
