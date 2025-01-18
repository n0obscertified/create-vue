export default function getData({ oldData }) {
  return {
    ...oldData,
    imports: [
      ...oldData?.imports ?? [],
      "import { createApp } from 'vue'",
      "import { vuetify } from './vuetify/index'",
      "import App from './App.vue'",
    ]
  }
}
