
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // Mock react-firebase-hooks because they don't work well in a JSDOM environment
    'react-firebase-hooks/auth': '<rootDir>/src/__mocks__/react-firebase-hooks/auth.ts',
    'react-firebase-hooks/firestore': '<rootDir>/src/__mocks__/react-firebase-hooks/firestore.ts',
    // Mock next/navigation
    'next/navigation': '<rootDir>/src/__mocks__/next-navigation.mock.js',
  },
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['ts-jest', {
      tsconfig: {
        ...require('./tsconfig.json').compilerOptions,
        jsx: 'react-jsx',
      },
    }],
  },
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/cypress/'],
  testMatch: [
    "**/__tests__/**/*.+(ts|tsx|js)",
    "**/?(*.)+(spec|test).+(ts|tsx|js)"
  ],
};
