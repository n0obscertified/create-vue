export default function getData({ oldData }) {
    return {
      ...oldData,
      imports: [
        ...oldData?.imports ?? [],
        "import { createVuetify } from 'vuetify'"
      ]
    };
  }
  