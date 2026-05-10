import { DataTypes } from 'sequelize';
import type { QueryInterface } from 'sequelize';
import type { Migration } from '../umzug';
import { Tables } from '../tables';

const columnNames = [
  'business_address',
  'contact_name',
  'contact_email',
  'contact_phone',
  'license_category',
  'capital_amount_rwf',
  'incorporation_date',
  'business_summary'
] as const;

const hasColumn = async (
  queryInterface: QueryInterface,
  tableName: string,
  columnName: string
): Promise<boolean> => {
  const table = await queryInterface.describeTable(tableName);
  return Object.prototype.hasOwnProperty.call(table, columnName);
};

export const up: Migration = async ({ context: sequelize }) => {
  const queryInterface = sequelize.getQueryInterface();

  if (!(await hasColumn(queryInterface, Tables.Application, 'business_address'))) {
    await queryInterface.addColumn(Tables.Application, 'business_address', {
      type: DataTypes.STRING,
      allowNull: true
    });
  }

  if (!(await hasColumn(queryInterface, Tables.Application, 'contact_name'))) {
    await queryInterface.addColumn(Tables.Application, 'contact_name', {
      type: DataTypes.STRING,
      allowNull: true
    });
  }

  if (!(await hasColumn(queryInterface, Tables.Application, 'contact_email'))) {
    await queryInterface.addColumn(Tables.Application, 'contact_email', {
      type: DataTypes.STRING,
      allowNull: true
    });
  }

  if (!(await hasColumn(queryInterface, Tables.Application, 'contact_phone'))) {
    await queryInterface.addColumn(Tables.Application, 'contact_phone', {
      type: DataTypes.STRING,
      allowNull: true
    });
  }

  if (!(await hasColumn(queryInterface, Tables.Application, 'license_category'))) {
    await queryInterface.addColumn(Tables.Application, 'license_category', {
      type: DataTypes.STRING,
      allowNull: true
    });
  }

  if (!(await hasColumn(queryInterface, Tables.Application, 'capital_amount_rwf'))) {
    await queryInterface.addColumn(Tables.Application, 'capital_amount_rwf', {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true
    });
  }

  if (!(await hasColumn(queryInterface, Tables.Application, 'incorporation_date'))) {
    await queryInterface.addColumn(Tables.Application, 'incorporation_date', {
      type: DataTypes.DATEONLY,
      allowNull: true
    });
  }

  if (!(await hasColumn(queryInterface, Tables.Application, 'business_summary'))) {
    await queryInterface.addColumn(Tables.Application, 'business_summary', {
      type: DataTypes.TEXT,
      allowNull: true
    });
  }
};

export const down: Migration = async ({ context: sequelize }) => {
  const queryInterface = sequelize.getQueryInterface();

  for (const columnName of columnNames) {
    if (await hasColumn(queryInterface, Tables.Application, columnName)) {
      await queryInterface.removeColumn(Tables.Application, columnName);
    }
  }
};
