const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  { ignores: ['docs/**', 'dist/**', 'dist-web-test/**', 'node_modules/**', 'output/**'] },
  ...expoConfig,
  {
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
]);
