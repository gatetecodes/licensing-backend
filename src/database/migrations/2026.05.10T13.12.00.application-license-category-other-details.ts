import { DataTypes } from 'sequelize';
import type { QueryInterface } from 'sequelize';
import type { Migration } from '../umzug';
import { Tables } from '../tables';

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
  if (
    !(await hasColumn(
      queryInterface,
      Tables.Application,
      'license_category_other_details'
    ))
  ) {
    await queryInterface.addColumn(
      Tables.Application,
      'license_category_other_details',
      {
        type: DataTypes.STRING,
        allowNull: true
      }
    );
  }
};

export const down: Migration = async ({ context: sequelize }) => {
  const queryInterface = sequelize.getQueryInterface();
  if (
    await hasColumn(
      queryInterface,
      Tables.Application,
      'license_category_other_details'
    )
  ) {
    await queryInterface.removeColumn(
      Tables.Application,
      'license_category_other_details'
    );
  }
};
