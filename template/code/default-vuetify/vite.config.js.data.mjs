export default function getData({ oldData }) {
    return {
      ...oldData,
      imports: [
        ...oldData?.imports ?? [],
        "import { defineConfig } from 'vite'",
        "import { fileURLToPath, URL } from 'node:url'"
      ],
      plugins: [
        ...oldData?.plugins ?? [],
        {
          id: "ViteFonts",
          importer: "import ViteFonts from 'unplugin-fonts/vite'",
          initializer: `ViteFonts({
            google: {
              families: [{
                name: 'Roboto',
                styles: 'wght@100;300;400;500;700;900',
              }],
            },
          })`,  
        },
        {
          id: "Vue",
          importer: "import Vue from '@vitejs/plugin-vue'",
          initializer: "Vue({template:{transformAssetUrls}})",
        },
        {
          id: "Vuetify",
          importer: "import Vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'",
          initializer: "Vuetify({autoImport: true, styles: {configFile: 'src/styles/settings.scss'}})",
        },
        {
          id: "Components",
          importer: "import Components from 'unplugin-vue-components/vite'",
          initializer: "Components()",
        },
      ]
    };
  }
    