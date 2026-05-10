/* eslint-disable @typescript-eslint/no-var-requires */
require('dotenv').config();
require('ts-node/register');
const { setupUUIDExtension, migrator } = require('./umuzug');

(async () => {
  const command = process.argv[2];
  if (command === 'up' || command === 'down') {
    await setupUUIDExtension();
  }
  await migrator.runAsCLI();
})().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
