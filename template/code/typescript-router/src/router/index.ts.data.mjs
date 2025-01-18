export default function getData({ oldData }) {
    return {
      ...oldData,
      imports: [
        ...oldData?.imports ?? [],
        "import { createRouter, createWebHistory } from 'vue-router/auto'",
        "import { routes } from 'vue-router/auto-routes'",
      ]
    
    };
  }
  