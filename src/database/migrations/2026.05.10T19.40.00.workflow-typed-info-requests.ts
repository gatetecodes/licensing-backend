import { DataTypes } from 'sequelize';
import type { Migration } from '../umzug';
import { Tables } from '../tables';
import { log, logger } from '../../helpers/logger-helper';
import { LoggerEvents } from '../../constants/logger-events';

const documentTypes = [
  'BUSINESS_PLAN',
  'CERTIFICATE_OF_INCORPORATION',
  'SHAREHOLDING_STRUCTURE',
  'CAPITAL_ADEQUACY_EVIDENCE',
  'GOVERNANCE_DOCUMENT',
  'SUPPORTING_DOCUMENT'
];

const oldDocumentTypes = [
  'BUSINESS_PLAN',
  'CERTIFICATE_OF_INCORPORATION',
  'SHAREHOLDING_STRUCTURE',
  'CAPITAL_ADEQUACY_EVIDENCE',
  'GOVERNANCE_DOCUMENT'
];

export const up: Migration = async ({ context: sequelize }) => {
  const queryInterface = sequelize.getQueryInterface();
  const dialect = sequelize.getDialect();

  try {
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM pg_type
            WHERE typname = 'enum_documents_document_type'
          ) THEN
            CREATE TYPE enum_documents_document_type_new AS ENUM ('${documentTypes.join("','")}');
            ALTER TABLE "${Tables.Document}"
              ALTER COLUMN document_type TYPE enum_documents_document_type_new
              USING (document_type::text)::enum_documents_document_type_new;
            DROP TYPE enum_documents_document_type;
            ALTER TYPE enum_documents_document_type_new RENAME TO enum_documents_document_type;
          END IF;
        END$$;
      `);
    }

    await queryInterface.addColumn(Tables.ApplicationReview, 'request_items', {
      type: dialect === 'postgres' ? DataTypes.JSONB : DataTypes.JSON,
      allowNull: true
    });
    await queryInterface.addColumn(Tables.ApplicationReview, 'applicant_responses', {
      type: dialect === 'postgres' ? DataTypes.JSONB : DataTypes.JSON,
      allowNull: true
    });
    await queryInterface.addColumn(Tables.ApplicationReview, 'responded_at', {
      type: DataTypes.DATE,
      allowNull: true
    });
  } catch (error) {
    logger.error(
      log({
        event: LoggerEvents.DB_MIGRATION_FAILURE,
        migration: '2026.05.10T19.40.00.workflow-typed-info-requests',
        error
      })
    );
    throw error;
  }
};

export const down: Migration = async ({ context: sequelize }) => {
  const queryInterface = sequelize.getQueryInterface();
  const dialect = sequelize.getDialect();

  try {
    await queryInterface.removeColumn(Tables.ApplicationReview, 'responded_at');
    await queryInterface.removeColumn(Tables.ApplicationReview, 'applicant_responses');
    await queryInterface.removeColumn(Tables.ApplicationReview, 'request_items');

    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM pg_type
            WHERE typname = 'enum_documents_document_type'
          ) THEN
            CREATE TYPE enum_documents_document_type_old AS ENUM ('${oldDocumentTypes.join("','")}');
            ALTER TABLE "${Tables.Document}"
              ALTER COLUMN document_type TYPE enum_documents_document_type_old
              USING (document_type::text)::enum_documents_document_type_old;
            DROP TYPE enum_documents_document_type;
            ALTER TYPE enum_documents_document_type_old RENAME TO enum_documents_document_type;
          END IF;
        END$$;
      `);
    }
  } catch (error) {
    logger.error(
      log({
        event: LoggerEvents.DB_MIGRATION_FAILURE,
        migration: '2026.05.10T19.40.00.workflow-typed-info-requests',
        error
      })
    );
    throw error;
  }
};
