export default function getData({ oldData }) {
  return {
    ...oldData,
    imports: [
      ...oldData?.imports ?? [],
      "import { fileURLToPath, URL } from 'node:url'",
      "import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'",
      "import viteConfig from './vite.config'"
    ]
  }
}
