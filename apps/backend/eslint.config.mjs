/* Backend lint (maintainability baseline, v0.9.0). Rules are listed here
   instead of importing a preset so the only dependency is eslint itself. */
const node = Object.fromEntries(['process', 'Buffer', 'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'setImmediate', 'clearImmediate', 'URL', 'URLSearchParams', 'fetch', 'AbortController', 'AbortSignal', 'TextEncoder', 'TextDecoder',
  'structuredClone', 'queueMicrotask', 'globalThis', 'Headers', 'Request', 'Response', 'FormData', 'Blob', 'crypto', 'performance',
  'BigInt', 'WebSocket', 'EventTarget', 'Event', 'atob', 'btoa', 'ReadableStream', 'TextDecoderStream', 'DOMException', 'global']
  .map(name => [name, 'readonly']))

export default [
  /* production modules; the test suites are a follow-up */
  { ignores: ['node_modules/**', 'test/**', 'search-sources.json'] },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { ecmaVersion: 2025, sourceType: 'module', globals: node },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      /* correctness */
      'no-undef': 'error',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-unreachable': 'error',
      'no-const-assign': 'error',
      'no-self-assign': 'error',
      'no-self-compare': 'error',
      'no-unsafe-finally': 'error',
      'no-unsafe-negation': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
      'no-cond-assign': ['error', 'except-parens'],
      'no-constant-binary-expression': 'error',
      'no-dupe-else-if': 'error',
      'no-import-assign': 'error',
      'no-loss-of-precision': 'error',
      'no-sparse-arrays': 'error',
      'no-func-assign': 'error',
      'no-redeclare': 'error',
      'no-shadow-restricted-names': 'error',
      'no-unused-labels': 'error',
      'no-with': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-async-promise-executor': 'error',
      'require-yield': 'error',
      'getter-return': 'error',
      'no-setter-return': 'error',
      'no-dupe-class-members': 'error',
      'no-empty-character-class': 'error',
      'no-invalid-regexp': 'error',
      'no-control-regex': 'off', /* header and input validation match control characters on purpose */
      'no-misleading-character-class': 'error',
      'no-useless-backreference': 'error',
      'eqeqeq': ['error', 'smart'],
    },
  },
]
