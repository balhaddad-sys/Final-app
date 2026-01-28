module.exports = {
  env: {
    es6: true,
    node: true
  },
  parserOptions: {
    'ecmaVersion': 2020
  },
  extends: [
    'eslint:recommended',
    'google'
  ],
  rules: {
    'no-restricted-globals': ['error', 'name', 'length'],
    'prefer-arrow-callback': 'error',
    'quotes': ['error', 'single', { 'allowTemplateLiterals': true }],
    'max-len': ['error', { 'code': 120 }],
    'object-curly-spacing': ['error', 'always'],
    'indent': ['error', 2],
    'require-jsdoc': 'off',
    'valid-jsdoc': 'off',
    'comma-dangle': ['error', 'never'],
    'camelcase': 'off',
    'no-unused-vars': ['error', { 'varsIgnorePattern': '^_', 'argsIgnorePattern': '^_' }]
  },
  overrides: [
    {
      files: ['**/*.spec.*'],
      env: {
        mocha: true
      },
      rules: {}
    }
  ],
  globals: {}
};
