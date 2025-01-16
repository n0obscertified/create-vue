export default function getData({ oldData }) {
  return {
    ...oldData,
    plugins: [
      ...oldData.plugins?.map(plugin=>{
        if(plugin.id !== "vue"){
          return plugin
        }
        return {
          ...plugin,
          initializer: "vue({template:{transformAssetUrls}})",
        }
      }) ?? [],
      {
        id: "Vuetify",
        importer: "import Vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'",
        initializer: `Vuetify({
          autoImport: true,
          styles: {
            configFile: 'src/styles/settings.scss',
          },
        })`,
      },
      {
        id: "Components",
        importer: "import Components from 'unplugin-vue-components/vite'",
        initializer: "Components()",
      },

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
        id: "VueRouter",
        importer: "import VueRouter from 'unplugin-vue-router/vite'",
        initializer: "VueRouter()",
      },
      {
        id: "unplugin-vue-router",
        importer: "import unpluginVueRouter from 'unplugin-vue-router/vite'",
        initializer: "unpluginVueRouter()",
      }
  
    ],
    define: { 'process.env': {} },
  
  };
}
