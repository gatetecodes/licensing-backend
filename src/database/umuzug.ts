import { Umzug, SequelizeStorage } from 'umzug';
import { sequelize } from './sequelize';
import { logger } from '../helpers/logger-helper';

export const setupUUIDExtension = async () => {
  await sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  logger.info('creating "uuid-ossp" extension done');
  return undefined;
};

export const migrator = new Umzug({
  migrations: { glob: ['migrations/*.{ts,js}', { cwd: __dirname }] },
  context: sequelize,
  storage: new SequelizeStorage({ sequelize }),
  logger: console
});

export type Migration = typeof migrator._types.migration;
