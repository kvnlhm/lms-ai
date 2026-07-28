/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  collectCoverageFrom: [
    'src/modules/**/domain/**/*.ts',
    'src/modules/**/application/**/*.ts',
    '!src/**/*.spec.ts',
  ],
  coverageDirectory: 'coverage',
  clearMocks: true,
};
