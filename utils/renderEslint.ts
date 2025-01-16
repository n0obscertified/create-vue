import * as fs from 'node:fs'
import * as path from "https://deno.land/std@0.224.0/path/mod.ts";

import createESLintConfig from '@vue/create-eslint-config'

import sortDependencies from './sortDependencies.ts'
import deepMerge from './deepMerge.ts'

import eslintTemplatePackage from '../template/eslint/package.json' with { type: 'json' }
const eslintDeps = eslintTemplatePackage.devDependencies

interface EslintOptions {
  needsTypeScript: boolean
  needsVitest: boolean
  needsCypress: boolean
  needsCypressCT: boolean
  needsOxlint: boolean
  needsPrettier: boolean
  needsPlaywright: boolean
}

interface AdditionalConfigOptions {
  needsVitest: boolean
  needsCypress: boolean
  needsCypressCT: boolean
  needsPlaywright: boolean
}

export default function renderEslint(
  rootDir: string,
  options: EslintOptions
) {
  const additionalConfigs = getAdditionalConfigs({
    needsVitest: options.needsVitest,
    needsCypress: options.needsCypress,
    needsCypressCT: options.needsCypressCT,
    needsPlaywright: options.needsPlaywright,
  })

  const { pkg, files } = createESLintConfig({
    styleGuide: 'default',
    hasTypeScript: options.needsTypeScript,
    needsOxlint: options.needsOxlint,
    // Theoretically, we could add Prettier without requring ESLint.
    // But it doesn't seem to be a good practice, so we just let createESLintConfig handle it.
    needsPrettier: options.needsPrettier,
    additionalConfigs,
  })

  // update package.json
  const packageJsonPath = path.resolve(rootDir, 'package.json')
  const existingPkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  const updatedPkg = sortDependencies(deepMerge(existingPkg, pkg))
  fs.writeFileSync(packageJsonPath, JSON.stringify(updatedPkg, null, 2) + '\n', 'utf8')

  // write to eslint.config.js, .prettierrc.json, .editorconfig, etc.
  for (const [fileName, content] of Object.entries(files)) {
    const fullPath = path.resolve(rootDir, fileName)
    fs.writeFileSync(fullPath, content as string, 'utf8')
  }
}

type ConfigItemInESLintTemplate = {
  importer: string
  content: string
}
type AdditionalConfig = {
  devDependencies: Record<string, string>
  beforeVuePlugin?: Array<ConfigItemInESLintTemplate>
  afterVuePlugin?: Array<ConfigItemInESLintTemplate>
}
type AdditionalConfigArray = Array<AdditionalConfig>

// visible for testing
export function getAdditionalConfigs(options: AdditionalConfigOptions) {
  const additionalConfigs: AdditionalConfigArray = []

  if (options.needsVitest) {
    additionalConfigs.push({
      devDependencies: {
        '@vitest/eslint-plugin': eslintDeps['@vitest/eslint-plugin'],
      },
      afterVuePlugin: [
        {
          importer: `import pluginVitest from '@vitest/eslint-plugin'`,
          content: `
  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/__tests__/*'],
  },`,
        },
      ],
    })
  }

  if (options.needsCypress) {
    additionalConfigs.push({
      devDependencies: {
        'eslint-plugin-cypress': eslintDeps['eslint-plugin-cypress'],
      },
      afterVuePlugin: [
        {
          importer: "import pluginCypress from 'eslint-plugin-cypress/flat'",
          content: `
  {
    ...pluginCypress.configs.recommended,
    files: [
      ${[
        ...(options.needsCypressCT ? ["'**/__tests__/*.{cy,spec}.{js,ts,jsx,tsx}',"] : []),
        'cypress/e2e/**/*.{cy,spec}.{js,ts,jsx,tsx}',
        'cypress/support/**/*.{js,ts,jsx,tsx}',
      ]
        .map((str) => JSON.stringify(str))
        .join(',\n      ')
        .replace(/"/g, "'" /* use single quotes as in the other configs */)}
    ],
  },`,
        },
      ],
    })
  }

  if (options.needsPlaywright) {
    additionalConfigs.push({
      devDependencies: {
        'eslint-plugin-playwright': eslintDeps['eslint-plugin-playwright'],
      },
      afterVuePlugin: [
        {
          importer: "import pluginPlaywright from 'eslint-plugin-playwright'",
          content: `
  {
    ...pluginPlaywright.configs['flat/recommended'],
    files: ['e2e/**/*.{test,spec}.{js,ts,jsx,tsx}'],
  },`,
        },
      ],
    })
  }

  return additionalConfigs
}
