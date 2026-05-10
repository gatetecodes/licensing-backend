import type { Migration } from '../umzug';
import { Tables } from '../tables';
import { log, logger } from '../../helpers/logger-helper';
import { LoggerEvents } from '../../constants/logger-events';

const oldToNewMap: Record<string, string> = {
  APPLICATION_FORM: 'BUSINESS_PLAN',
  FINANCIAL_STATEMENTS: 'CAPITAL_ADEQUACY_EVIDENCE',
  BUSINESS_REGISTRATION: 'CERTIFICATE_OF_INCORPORATION',
  TAX_CERTIFICATES: 'GOVERNANCE_DOCUMENT',
  OTHER: 'SHAREHOLDING_STRUCTURE'
};

const newToOldMap: Record<string, string> = {
  BUSINESS_PLAN: 'APPLICATION_FORM',
  CAPITAL_ADEQUACY_EVIDENCE: 'FINANCIAL_STATEMENTS',
  CERTIFICATE_OF_INCORPORATION: 'BUSINESS_REGISTRATION',
  GOVERNANCE_DOCUMENT: 'TAX_CERTIFICATES',
  SHAREHOLDING_STRUCTURE: 'OTHER'
};

const buildCaseExpression = (valueMap: Record<string, string>): string =>
  Object.entries(valueMap)
    .map(([from, to]) => `WHEN '${from}' THEN '${to}'`)
    .join(' ');

const oldValues = [
  'APPLICATION_FORM',
  'FINANCIAL_STATEMENTS',
  'BUSINESS_REGISTRATION',
  'TAX_CERTIFICATES',
  'OTHER'
];

const newValues = [
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
    const mapCase = buildCaseExpression(oldToNewMap);

    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM pg_type
            WHERE typname = 'enum_documents_document_type'
          ) THEN
            CREATE TYPE enum_documents_document_type_new AS ENUM ('${newValues.join("','")}');
            ALTER TABLE "${Tables.Document}"
              ALTER COLUMN document_type TYPE enum_documents_document_type_new
              USING (
                CASE document_type::text
                  ${mapCase}
                  ELSE document_type::text
                END
              )::enum_documents_document_type_new;
            DROP TYPE enum_documents_document_type;
            ALTER TYPE enum_documents_document_type_new RENAME TO enum_documents_document_type;
          END IF;
        END$$;
      `);
    } else {
      await queryInterface.sequelize.query(`
        UPDATE "${Tables.Document}"
        SET document_type = CASE document_type
          ${mapCase}
          ELSE document_type
        END;
      `);
    }
  } catch (error) {
    logger.error(
      log({
        event: LoggerEvents.DB_MIGRATION_FAILURE,
        migration: '2026.05.09T17.43.23.document-type-enum-alignment',
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
    const mapCase = buildCaseExpression(newToOldMap);

    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM pg_type
            WHERE typname = 'enum_documents_document_type'
          ) THEN
            CREATE TYPE enum_documents_document_type_old AS ENUM ('${oldValues.join("','")}');
            ALTER TABLE "${Tables.Document}"
              ALTER COLUMN document_type TYPE enum_documents_document_type_old
              USING (
                CASE document_type::text
                  ${mapCase}
                  ELSE document_type::text
                END
              )::enum_documents_document_type_old;
            DROP TYPE enum_documents_document_type;
            ALTER TYPE enum_documents_document_type_old RENAME TO enum_documents_document_type;
          END IF;
        END$$;
      `);
    } else {
      await queryInterface.sequelize.query(`
        UPDATE "${Tables.Document}"
        SET document_type = CASE document_type
          ${mapCase}
          ELSE document_type
        END;
      `);
    }
  } catch (error) {
    logger.error(
      log({
        event: LoggerEvents.DB_MIGRATION_FAILURE,
        migration: '2026.05.09T17.43.23.document-type-enum-alignment',
        error
      })
    );
    throw error;
  }
};
