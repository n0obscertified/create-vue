export default function getData({ oldData }) {
    return {
      ...oldData,
      imports: [
        ...oldData?.imports ?? [],
        "import { createVuetify } from 'vuetify'",
        "import '@mdi/font/css/materialdesignicons.css'",
        "import 'vuetify/styles'"
      ]
    
    };
  }
  