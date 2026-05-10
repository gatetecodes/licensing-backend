module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.jest.json',
        diagnostics: {
          ignoreCodes: [151002]
        }
      }
    ]
  },
  moduleNameMapper: {
    '^@src/(.*)$': '<rootDir>/src/$1'
  }
};
