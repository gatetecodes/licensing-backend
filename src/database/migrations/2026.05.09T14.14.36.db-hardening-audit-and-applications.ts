import type { Migration } from '../umzug';
import { log, logger } from '../../helpers/logger-helper';
import { LoggerEvents } from '../../constants/logger-events';

type SequelizeLike = {
  getDialect: () => string;
  query: (_sql: string) => Promise<unknown>;
};

const isPostgres = (sequelize: SequelizeLike): boolean =>
  sequelize.getDialect() === 'postgres';

const addConstraintIfMissing = async (
  sequelize: SequelizeLike,
  tableName: string,
  constraintName: string,
  expression: string
): Promise<void> => {
  await sequelize.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = '${constraintName}'
          AND conrelid = '${tableName}'::regclass
      ) THEN
        ALTER TABLE "${tableName}"
        ADD CONSTRAINT "${constraintName}" CHECK (${expression});
      END IF;
    END
    $$;
  `);
};

export const up: Migration = async ({ context: sequelize }) => {
  const queryInterface = sequelize.getQueryInterface();

  if (!isPostgres(sequelize)) {
    return;
  }

  try {
    await addConstraintIfMissing(
      sequelize,
      'applications',
      'applications_final_state_requires_decision_fields_chk',
      `
        current_state NOT IN ('APPROVED', 'REJECTED')
        OR (
          decisioned_by_id IS NOT NULL
          AND decision_at IS NOT NULL
          AND decision_reason IS NOT NULL
        )
      `
    );

    await addConstraintIfMissing(
      sequelize,
      'applications',
      'applications_non_final_state_blocks_decision_fields_chk',
      `
        current_state IN ('APPROVED', 'REJECTED')
        OR (
          decisioned_by_id IS NULL
          AND decision_at IS NULL
          AND decision_reason IS NULL
        )
      `
    );

    await addConstraintIfMissing(
      sequelize,
      'applications',
      'applications_reviewer_not_approver_chk',
      `
        reviewed_by_id IS NULL
        OR decisioned_by_id IS NULL
        OR reviewed_by_id <> decisioned_by_id
      `
    );

    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RAISE EXCEPTION 'audit_logs is append-only. UPDATE and DELETE are not allowed.';
      END;
      $$;
    `);

    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS audit_logs_append_only_trigger ON audit_logs;
      CREATE TRIGGER audit_logs_append_only_trigger
      BEFORE UPDATE OR DELETE ON audit_logs
      FOR EACH ROW
      EXECUTE FUNCTION prevent_audit_log_mutation();
    `);
  } catch (error) {
    logger.error(
      log({
        event: LoggerEvents.DB_MIGRATION_FAILURE,
        migration: '2026.05.09T14.14.36.db-hardening-audit-and-applications',
        error
      })
    );
  }
};

export const down: Migration = async ({ context: sequelize }) => {
  const queryInterface = sequelize.getQueryInterface();

  if (!isPostgres(sequelize)) {
    return;
  }

  try {
    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS "applications"
        DROP CONSTRAINT IF EXISTS "applications_reviewer_not_approver_chk",
        DROP CONSTRAINT IF EXISTS "applications_non_final_state_blocks_decision_fields_chk",
        DROP CONSTRAINT IF EXISTS "applications_final_state_requires_decision_fields_chk";
    `);

    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS audit_logs_append_only_trigger ON audit_logs;
      DROP FUNCTION IF EXISTS prevent_audit_log_mutation();
    `);
  } catch (error) {
    logger.error(
      log({
        event: LoggerEvents.DB_MIGRATION_FAILURE,
        migration: '2026.05.09T14.14.36.db-hardening-audit-and-applications',
        error
      })
    );
  }
};
