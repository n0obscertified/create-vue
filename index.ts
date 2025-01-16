#!/usr/bin/env node

import * as fs from 'node:fs'
import * as path from "jsr:@std/path@1";

import { parseArgs } from 'node:util'

import prompts from 'prompts'
import { red, green, cyan, bold } from 'kleur/colors'
import ejs from 'ejs'

import * as banners from './utils/banners.ts'

import renderTemplate from './utils/renderTemplate.ts'
import type { TemplateCallback } from './utils/renderTemplate.ts'
import { postOrderDirectoryTraverse, preOrderDirectoryTraverse } from './utils/directoryTraverse.ts'
import generateReadme from './utils/generateReadme.ts'
import getCommand from './utils/getCommand.ts'
import getLanguage from './utils/getLanguage.ts'
import renderEslint from './utils/renderEslint.ts'
import { trimBoilerplate, removeCSSImport, emptyRouterConfig } from './utils/trimBoilerplate.ts'

import cliPackageJson from './deno.json' with { type: "json" }

function isValidPackageName(projectName:string) {
  return /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(projectName)
}

function toValidPackageName(projectName:string) {
  return projectName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/^[._]/, '')
    .replace(/[^a-z0-9-~]+/g, '-')
}

function canSkipEmptying(dir: string) {
  if (!fs.existsSync(dir)) {
    return true
  }

  const files = fs.readdirSync(dir)
  if (files.length === 0) {
    return true
  }
  if (files.length === 1 && files[0] === '.git') {
    return true
  }

  return false
}

function emptyDir(dir:string) {
  if (!fs.existsSync(dir)) {
    return
  }

  postOrderDirectoryTraverse(
    dir,
    (dir:string) => fs.rmdirSync(dir),
    (file:string) => fs.unlinkSync(file),
  )
}

const helpMessage = `\
Usage: create-vue [FEATURE_FLAGS...] [OPTIONS...] [DIRECTORY]

Create a new Vue.js project.
Start the CLI in interactive mode when no FEATURE_FLAGS is provided, or if the DIRECTORY argument is not a valid package name.

Options:
  --force
    Create the project even if the directory is not empty.
  --bare
    Create a barebone project without example code.
  --help
    Display this help message.
  --version
    Display the version number of this CLI.

Available feature flags:
  --default
    Create a project with the default configuration without any additional features.
  --ts, --typescript
    Add TypeScript support.
  --jsx
    Add JSX support.
  --router, --vue-router
    Add Vue Router for SPA development.
  --pinia
    Add Pinia for state management.
  --vitest
    Add Vitest for unit testing.
  --cypress
    Add Cypress for end-to-end testing.
    If used without ${cyan('--vitest')}, it will also add Cypress Component Testing.
  --playwright
    Add Playwright for end-to-end testing.
  --nightwatch
    Add Nightwatch for end-to-end testing.
    If used without ${cyan('--vitest')}, it will also add Nightwatch Component Testing.
  --eslint
    Add ESLint for code quality.
  --eslint-with-prettier
    Add Prettier for code formatting in addition to ESLint.

Unstable feature flags:
  --tests, --with-tests
    Add both unit testing and end-to-end testing support.
    Currently equivalent to ${cyan('--vitest --cypress')}, but may change in the future.
`

async function init() {
  const cwd = Deno.cwd()
  const args = Deno.args

  // alias is not supported by parseArgs
  const options = {
    typescript: { type: 'boolean' },
    ts: { type: 'boolean' },
    'with-tests': { type: 'boolean' },
    tests: { type: 'boolean' },
    'vue-router': { type: 'boolean' },
    router: { type: 'boolean' },
  } as const

  const { values: argv, positionals } = parseArgs({
    args,
    options,
    strict: false,
  })

  if (argv.help) {
    console.log(helpMessage)
    Deno.exit(0)
  }

  if (argv.version) {
    console.log(`${cliPackageJson.name} v${cliPackageJson.version}`)
    Deno.exit(0)
  }

  // if any of the feature flags is set, we would skip the feature prompts
  const isFeatureFlagsUsed =
    typeof (
      argv.default ??
      (argv.ts || argv.typescript) ??
      argv.jsx ??
      (argv.router || argv['vue-router']) ??
      argv.pinia ??
      (argv.tests || argv['with-tests']) ??
      argv.vitest ??
      argv.vuetify ?? 
      argv.cypress ??
      argv.nightwatch ??
      argv.playwright ??
      argv.eslint ??
      argv['eslint-with-prettier']
    ) === 'boolean'
  
  
  let targetDir = positionals[0]
  const defaultProjectName = !targetDir ? 'vue-project' : targetDir

  const forceOverwrite = argv.force

  const language = await getLanguage()
  // console.log('WTH is this', language)
  let result: {
    projectName?: string
    shouldOverwrite?: boolean
    packageName?: string
    needsTypeScript?: boolean
    needsJsx?: boolean
    needsRouter?: boolean
    needsPinia?: boolean
    needsVitest?: boolean
    needsE2eTesting?: false | 'cypress' | 'nightwatch' | 'playwright'
    needsEslint?: false | 'eslintOnly' | 'speedUpWithOxlint'
    needsOxlint?: boolean
    needsPrettier?: boolean,
    needsVuetify?: boolean
  } = {}

  console.log()
  console.log(
    Deno.stdout.isTerminal()
      ? banners.gradientBanner
      : banners.defaultBanner,
  )
  console.log()
  // console.log(language)
  try {
    // Prompts:
    // - Project name:
    //   - whether to overwrite the existing directory or not?
    //   - enter a valid package name for package.json
    // - Project language: JavaScript / TypeScript
    // - Add JSX Support?
    // - Install Vue Router for SPA development?
    // - Install Pinia for state management?
    // - Add Cypress for testing?
    // - Add Nightwatch for testing?
    // - Add Playwright for end-to-end testing?
    // - Add ESLint for code quality?
    // - Add Prettier for code formatting?
    result = await prompts(
      [
        {
          name: 'projectName',
          type: targetDir ? null : 'text',
          message: language.projectName.message,
          initial: defaultProjectName,
          onState: (state: { value: string }) => (targetDir = String(state.value).trim() || defaultProjectName),
        },
        {
          name: 'shouldOverwrite',
          type: () => (canSkipEmptying(targetDir) || forceOverwrite ? null : 'toggle'),
          message: () => {
            const dirForPrompt =
              targetDir === '.'
                ? language.shouldOverwrite.dirForPrompts.current
                : `${language.shouldOverwrite.dirForPrompts.target} "${targetDir}"`

            return `${dirForPrompt} ${language.shouldOverwrite.message}`
          },
          initial: true,
          active: language.defaultToggleOptions.active,
          inactive: language.defaultToggleOptions.inactive,
        },
        {
          name: 'overwriteChecker',
          // deno-lint-ignore no-explicit-any
          type: (_prev: any, values: any) => {
            if (values.shouldOverwrite === false) {
              throw new Error(red('✖') + ` ${language.errors.operationCancelled}`)
            }
            return null
          },
        },
        {
          name: 'packageName',
          type: () => (isValidPackageName(targetDir) ? null : 'text'),
          message: language.packageName.message,
          initial: () => toValidPackageName(targetDir),
          validate: (dir: string) => isValidPackageName(dir) || language.packageName.invalidMessage,
        },
        {
          name: 'needsTypeScript',
          type: () => (isFeatureFlagsUsed ? null : 'toggle'),
          message: language.needsTypeScript.message,
          initial: false,
          active: language.defaultToggleOptions.active,
          inactive: language.defaultToggleOptions.inactive,
        },
        {
          name: 'needsJsx',
          type: () => (isFeatureFlagsUsed ? null : 'toggle'),
          message: language.needsJsx.message,
          initial: false,
          active: language.defaultToggleOptions.active,
          inactive: language.defaultToggleOptions.inactive,
        },
        {
          name: 'needsRouter',
          type: () => (isFeatureFlagsUsed ? null : 'toggle'),
          message: language.needsRouter.message,
          initial: false,
          active: language.defaultToggleOptions.active,
          inactive: language.defaultToggleOptions.inactive,
        },
        {
          name: 'needsPinia',
          type: () => (isFeatureFlagsUsed ? null : 'toggle'),
          message: language.needsPinia.message,
          initial: false,
          active: language.defaultToggleOptions.active,
          inactive: language.defaultToggleOptions.inactive,
        },
        {
          name: 'needsVuetify',
          type: () => (isFeatureFlagsUsed ? null : 'toggle'),
          message: language.needsVuetify.message,
          initial: false,
          active: language.defaultToggleOptions.active,
          inactive: language.defaultToggleOptions.inactive,
        },
        {
          name: 'needsVitest',
          type: () => (isFeatureFlagsUsed ? null : 'toggle'),
          message: language.needsVitest.message,
          initial: false,
          active: language.defaultToggleOptions.active,
          inactive: language.defaultToggleOptions.inactive,
        },
        {
          name: 'needsE2eTesting',
          type: () => (isFeatureFlagsUsed ? null : 'select'),
          hint: language.needsE2eTesting.hint,
          message: language.needsE2eTesting.message,
          initial: 0,
          // deno-lint-ignore no-explicit-any
          choices: (_prev: any, answers: any) => [
            {
              title: language.needsE2eTesting.selectOptions.negative.title,
              value: false,
            },
            {
              title: language.needsE2eTesting.selectOptions.cypress.title,
              description: answers.needsVitest
                ? undefined
                : language.needsE2eTesting.selectOptions.cypress.desc,
              value: 'cypress',
            },
            {
              title: language.needsE2eTesting.selectOptions.nightwatch.title,
              description: answers.needsVitest
                ? undefined
                : language.needsE2eTesting.selectOptions.nightwatch.desc,
              value: 'nightwatch',
            },
            {
              title: language.needsE2eTesting.selectOptions.playwright.title,
              value: 'playwright',
            },
          ],
        },
        {
          name: 'needsEslint',
          type: () => (isFeatureFlagsUsed ? null : 'select'),
          message: language.needsEslint.message,
          initial: 0,
          choices: [
            {
              title: language.needsEslint.selectOptions.negative.title,
              value: false,
            },
            {
              title: language.needsEslint.selectOptions.eslintOnly.title,
              value: 'eslintOnly',
            },
            {
              title: language.needsEslint.selectOptions.speedUpWithOxlint.title,
              value: 'speedUpWithOxlint',
            },
          ],
        },
        {
          name: 'needsPrettier',
          // deno-lint-ignore no-explicit-any
          type: (_prev: any, values: any) => {
            if (isFeatureFlagsUsed || !values.needsEslint) {
              return null
            }
            return 'toggle'
          },
          message: language.needsPrettier.message,
          initial: false,
          active: language.defaultToggleOptions.active,
          inactive: language.defaultToggleOptions.inactive,
        },
      ],
      {
        onCancel: () => {
          throw new Error(red('✖') + ` ${language.errors.operationCancelled}`)
        },
      },
    )
  } catch (cancelled: unknown) {
    const cancelledMessage = cancelled instanceof Error ? cancelled.message : String(cancelled)
    console.log(cancelledMessage)
    Deno.exit(1)
  }

  // `initial` won't take effect if the prompt type is null
  // so we still have to assign the default values here
  const {
    projectName,
    packageName = projectName ?? defaultProjectName,
    shouldOverwrite = argv.force ?? false,
    needsJsx = Boolean(argv.jsx),
    needsTypeScript = Boolean(argv.ts || argv.typescript),
    needsRouter = Boolean(argv.router || argv['vue-router']),
    needsPinia = Boolean(argv.pinia),
    needsVitest = Boolean(argv.vitest || argv.tests),
    needsPrettier = Boolean(argv['eslint-with-prettier']),
    needsVuetify = Boolean(argv.vuetify),
  } = result

  const needsEslint = Boolean(argv.eslint || argv['eslint-with-prettier'] || result.needsEslint)
  const needsOxlint = result.needsEslint === 'speedUpWithOxlint'

  const { needsE2eTesting } = result
  const needsCypress = Boolean(argv.cypress || argv.tests || needsE2eTesting === 'cypress')
  const needsCypressCT = Boolean(needsCypress && !needsVitest)
  const needsNightwatch = Boolean(argv.nightwatch || needsE2eTesting === 'nightwatch')
  const needsNightwatchCT = Boolean(needsNightwatch && !needsVitest)
  const needsPlaywright = Boolean(argv.playwright || needsE2eTesting === 'playwright')

  const root = path.join(cwd, targetDir)

  if (fs.existsSync(root) && shouldOverwrite) {
    emptyDir(root)
  } else if (!fs.existsSync(root)) {
    fs.mkdirSync(root)
  }

  console.log(`\n${language.infos.scaffolding} ${root}...`)

  const pkg = { name: packageName, version: '0.0.0' }
  fs.writeFileSync(path.resolve(root, 'deno.json'), JSON.stringify(pkg, null, 2))

  // todo:
  // work around the esbuild issue that `import.meta.url` cannot be correctly transpiled
  // when bundling for node and the format is cjs
  // const templateRoot = new URL('./template', import.meta.url).pathname
  const templateRoot = path.join(path.dirname(path.fromFileUrl(import.meta.url)), 'template');
  const callbacks: TemplateCallback[] = []
  const render = function render(templateName: string) {
    const templateDir = path.resolve(templateRoot, templateName)
    renderTemplate(templateDir, root, callbacks)
  }
  // Render base template
  render('base')

  // Add configs.
  if (needsJsx) {
    render('config/jsx')
  }
  if (needsRouter) {
    render('config/router')
  }
  if (needsPinia) {
    render('config/pinia')
  }
  if (needsVuetify) {
    render('config/vuetify')
  }
  if (needsVitest) {
    render('config/vitest')
  }
  if (needsCypress) {
    render('config/cypress')
  }
  if (needsCypressCT) {
    render('config/cypress-ct')
  }
  if (needsNightwatch) {
    render('config/nightwatch')
  }
  if (needsNightwatchCT) {
    render('config/nightwatch-ct')
  }
  if (needsPlaywright) {
    render('config/playwright')
  }
  if (needsTypeScript) {
    render('config/typescript')

    // Render tsconfigs
    render('tsconfig/base')
    // The content of the root `tsconfig.json` is a bit complicated,
    // So here we are programmatically generating it.
    const rootTsConfig = {
      // It doesn't target any specific files because they are all configured in the referenced ones.
      files: [],
      // All templates contain at least a `.node` and a `.app` tsconfig.
      references: [
        {
          path: './tsconfig.node.json',
        },
        {
          path: './tsconfig.app.json',
        },
      ],
    }
    if (needsCypress) {
      render('tsconfig/cypress')
      // Cypress uses `ts-node` internally, which doesn't support solution-style tsconfig.
      // So we have to set a dummy `compilerOptions` in the root tsconfig to make it work.
      // I use `NodeNext` here instead of `ES2015` because that's what the actual environment is.
      // (Cypress uses the ts-node/esm loader when `type: module` is specified in package.json.)
      // @ts-ignore
      rootTsConfig.compilerOptions = {
        module: 'NodeNext',
      }
    }
    if (needsCypressCT) {
      render('tsconfig/cypress-ct')
      // Cypress Component Testing needs a standalone tsconfig.
      rootTsConfig.references.push({
        path: './tsconfig.cypress-ct.json',
      })
    }
    if (needsPlaywright) {
      render('tsconfig/playwright')
    }
    if (needsVitest) {
      render('tsconfig/vitest')
      // Vitest needs a standalone tsconfig.
      rootTsConfig.references.push({
        path: './tsconfig.vitest.json',
      })
    }
    if (needsNightwatch) {
      render('tsconfig/nightwatch')
      // Nightwatch needs a standalone tsconfig, but in a different folder.
      rootTsConfig.references.push({
        path: './nightwatch/tsconfig.json',
      })
    }
    if (needsNightwatchCT) {
      render('tsconfig/nightwatch-ct')
    }
    fs.writeFileSync(
      path.resolve(root, 'tsconfig.json'),
      JSON.stringify(rootTsConfig, null, 2) + '\n',
      'utf-8',
    )
  }

  // Render ESLint config
  if (needsEslint) {
    renderEslint(root, {
      needsTypeScript,
      needsOxlint,
      needsVitest,
      needsCypress,
      needsCypressCT,
      needsPrettier,
      needsPlaywright,
    })
    render('config/eslint')
  }

  if (needsPrettier) {
    render('config/prettier')
  }

  // Render code template.
  // prettier-ignore
  const codeTemplate =
    (needsTypeScript ? 'typescript-' : '') +
    (needsRouter ? 'router' : 'default') + 
    (needsVuetify ? '-vuetify' : '')
  render(`code/${codeTemplate}`)

  // Render entry file (main.js/ts).
  if (needsVuetify && needsRouter && needsPinia) {
    render('entry/router-vuetify-and-pinia')
  } else if (needsPinia && needsRouter) {
    render('entry/router-and-pinia')
  }else if (needsVuetify && needsRouter) {
    render('entry/router-and-vuetify')  
  }else if (needsVuetify && needsPinia) {
    render('entry/pinia-and-vuetify')
  } else if (needsVuetify) {
    render('entry/vuetify')
  } else if (needsPinia) {
    render('entry/pinia')
  } else if (needsRouter) {
    render('entry/router')
  } else {
    render('entry/default')
  }

  // An external data store for callbacks to share data
  // deno-lint-ignore no-explicit-any
  const dataStore: Record<string, any> = {}
  // Process callbacks
  for (const cb of callbacks) {
    await cb(dataStore)
  }

  // EJS template rendering
  preOrderDirectoryTraverse(
    root,
    () => {},
    (filepath: string) => {
      if (filepath.endsWith('.ejs')) {
        const template = fs.readFileSync(filepath, 'utf-8')
        const dest = filepath.replace(/\.ejs$/, '')
        const content = ejs.render(template, dataStore[dest])

        fs.writeFileSync(dest, content)
        fs.unlinkSync(filepath)
      }
    },
  )

  if (argv.bare) {
    trimBoilerplate(root)
    render('bare/base')
    // TODO: refactor the `render` utility to avoid this kind of manual mapping?
    if (needsTypeScript) {
      render('bare/typescript')
    }
    if (needsVitest) {
      render('bare/vitest')
    }
    if (needsCypressCT) {
      render('bare/cypress-ct')
    }
    if (needsNightwatchCT) {
      render('bare/nightwatch-ct')
    }
  }

  // Cleanup.

  // We try to share as many files between TypeScript and JavaScript as possible.
  // If that's not possible, we put `.ts` version alongside the `.js` one in the templates.
  // So after all the templates are rendered, we need to clean up the redundant files.
  // (Currently it's only `cypress/plugin/index.ts`, but we might add more in the future.)
  // (Or, we might completely get rid of the plugins folder as Cypress 10 supports `cypress.config.ts`)

  if (needsTypeScript) {
    // Convert the JavaScript template to the TypeScript
    // Check all the remaining `.js` files:
    //   - If the corresponding TypeScript version already exists, remove the `.js` version.
    //   - Otherwise, rename the `.js` file to `.ts`
    // Remove `jsconfig.json`, because we already have tsconfig.json
    // `jsconfig.json` is not reused, because we use solution-style `tsconfig`s, which are much more complicated.
    preOrderDirectoryTraverse(
      root,
      () => {},
      (filepath: string) => {
        if (filepath.endsWith('.js') && !filepath.endsWith('eslint.config.js')) {
          const tsFilePath = filepath.replace(/\.js$/, '.ts')
          if (fs.existsSync(tsFilePath)) {
            fs.unlinkSync(filepath)
          } else {
            fs.renameSync(filepath, tsFilePath)
          }
        } else if (path.basename(filepath) === 'jsconfig.json') {
          fs.unlinkSync(filepath)
        }
      },
    )

    // Rename entry in `index.html`
    const indexHtmlPath = path.resolve(root, 'index.html')
    const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8')
    fs.writeFileSync(indexHtmlPath, indexHtmlContent.replace('src/main.js', 'src/main.ts'))
  } else {
    // Remove all the remaining `.ts` files
    preOrderDirectoryTraverse(
      root,
      () => {},
      (filepath: string) => {
        if (filepath.endsWith('.ts')) {
          fs.unlinkSync(filepath)
        }
      },
    )
  }

  if (argv.bare) {
    removeCSSImport(root, needsTypeScript)
    if (needsRouter) {
      emptyRouterConfig(root, needsTypeScript)
    }
  }

  // Instructions:
  // Supported package managers: pnpm > yarn > bun > npm
  const userAgent = Deno.env.get('npm_config_user_agent') ?? ''
  const packageManager = 'deno'

  //TODO: add pnpm, yarn, bun support
  // /pnpm/.test(userAgent)
  //   ? 'pnpm'
  //   : /yarn/.test(userAgent)
  //     ? 'yarn'
  //     : /bun/.test(userAgent)
  //       ? 'bun'
  //       : 'npm'

  // README generation
  fs.writeFileSync(
    path.resolve(root, 'README.md'),
    generateReadme({
      projectName: result.projectName ?? result.packageName ?? defaultProjectName,
      packageManager,
      needsTypeScript,
      needsVitest,
      needsCypress,
      needsNightwatch,
      needsPlaywright,
      needsNightwatchCT,
      needsCypressCT,
      needsEslint,
    }),
  )

  console.log(`\n${language.infos.done}\n`)
  if (root !== cwd) {
    const cdProjectName = path.relative(cwd, root)
    console.log(
      `  ${bold(green(`cd ${cdProjectName.includes(' ') ? `"${cdProjectName}"` : cdProjectName}`))}`,
    )
  }
  console.log(`  ${bold(green(getCommand(packageManager, 'install --allow-scripts' )))}`)
  if (needsPrettier) {
    console.log(`  ${bold(green(getCommand(packageManager, 'format')))}`)
  }
  console.log(`  ${bold(green(getCommand(packageManager, 'dev')))}`)  
  console.log()
}

init().catch((e) => {
  console.error(e)
})
