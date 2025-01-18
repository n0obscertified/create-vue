export default function getData({ oldData }) {
  return {
    ...oldData,
    imports: [
      ...oldData?.imports ?? [],
      "import './assets/main.css'",
      "import { createApp } from 'vue'",
      "import { vuetify } from './vuetify'",
      "import App from './App.vue'",
      "import router from './router'",
    ]
  }
}
