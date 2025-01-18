export default function getData({ oldData }) {
  return {
    ...oldData,
    imports: [
      ...oldData?.imports ?? [],
      "import { describe, it, expect } from 'vitest'",
      "import { mount } from '@vue/test-utils'",
      "import HelloWorld from '../HelloWorld.vue'"
    ]
  }
}

