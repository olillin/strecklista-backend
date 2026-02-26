import { includeIgnoreFile } from '@eslint/compat'
import eslint from '@eslint/js'
import globals from 'globals'
import { fileURLToPath } from 'node:url'
import tseslint from 'typescript-eslint'
import jsdoc from 'eslint-plugin-jsdoc'

const gitignorePath = fileURLToPath(new URL('.gitignore', import.meta.url))

export default tseslint.config(
    includeIgnoreFile(gitignorePath, 'Imported .gitignore patterns'),
    {
        files: ['**/*.ts'],
        languageOptions: {
            globals: globals.node,
            parserOptions: {
                project: ['./tsconfig.json', './tsconfig.test.json'],
                tsconfigRootDir: import.meta.dirname,
            },
        },
        extends: [
            eslint.configs.recommended,
            ...tseslint.configs.recommended,
            ...tseslint.configs.recommendedTypeChecked,
            jsdoc.configs['flat/contents-typescript'],
            jsdoc.configs['flat/logical-typescript'],
            jsdoc.configs['flat/requirements-typescript'],
            jsdoc.configs['flat/stylistic-typescript'],
        ],
        rules: {
            'max-depth': ['error', { max: 3 }],
            '@typescript-eslint/no-deprecated': 'warn',
            '@typescript-eslint/no-base-to-string': 'off',
            'jsdoc/require-throws': 'error',
            'jsdoc/require-description-complete-sentence': 'warn',
            'jsdoc/sort-tags': 'warn',
            'jsdoc/require-example': 'off',
            'jsdoc/match-description': 'off',
            'jsdoc/require-param': [
                'error',
                { checkGetters: true, checkSetters: true },
            ],
        },
    }
)
