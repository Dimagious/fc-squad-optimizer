/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleNameMapper: {
    // Strip .js extensions so ts-jest resolves TypeScript source files
    '^(.*)\\.js$': '$1',
  },
};
