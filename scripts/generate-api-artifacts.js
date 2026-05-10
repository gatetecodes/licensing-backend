/* eslint-disable @typescript-eslint/no-var-requires */
require('dotenv').config();
require('ts-node/register');

const fs = require('fs');
const path = require('path');
const { swaggerSpec } = require('../src/api-docs/v1/swagger-setup');

const docsDir = path.join(process.cwd(), 'docs');
const postmanDir = path.join(docsDir, 'postman');
const openApiPath = path.join(docsDir, 'openapi.v1.json');
const postmanPath = path.join(
  postmanDir,
  'BNR-Licensing-Portal.postman_collection.json'
);

const toPostmanCollection = (openApi) => {
  const baseUrl =
    openApi?.servers?.[0]?.url?.replace(/\/+$/, '');
  const paths = openApi?.paths || {};

  const items = Object.entries(paths).map(([apiPath, methods]) => {
    const methodItems = Object.entries(methods).map(([method, operation]) => ({
      name: operation.summary || `${method.toUpperCase()} ${apiPath}`,
      request: {
        method: method.toUpperCase(),
        hedader: [{ key: 'Content-Type', value: 'application/json' }],
        url: {
          raw: `${baseUrl}${apiPath}`,
          host: [baseUrl],
          path: apiPath.replace(/^\//, '').split('/')
        },
        description: operation.description || operation.summary || ''
      }
    }));

    return {
      name: apiPath,
      item: methodItems
    };
  });

  return {
    info: {
      name: 'BNR Licensing Portal API',
      schema:
        'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      description: 'Generated from OpenAPI annotations.'
    },
    item: items
  };
};

fs.mkdirSync(postmanDir, { recursive: true });
fs.writeFileSync(openApiPath, JSON.stringify(swaggerSpec, null, 2));
fs.writeFileSync(
  postmanPath,
  JSON.stringify(toPostmanCollection(swaggerSpec), null, 2)
);

// eslint-disable-next-line no-console
console.log(`Generated ${openApiPath}`);
// eslint-disable-next-line no-console
console.log(`Generated ${postmanPath}`);
