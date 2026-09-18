// URL de tu backend desplegado en Google Cloud Run
// Una vez desplegado Cloud Run, reemplaza esta URL con la URL HTTPS pública proporcionada por GCP
// Ejemplo: 'https://meetflow-backend-xxxxxx-uc.a.run.app'
export const CLOUD_RUN_URL = 'https://meetflow-backend-550978716382.us-central1.run.app';

export const environment = {
  production: true,
  apiUrl: `${CLOUD_RUN_URL}/api`,
  wsUrl: CLOUD_RUN_URL.replace('https:', 'wss:').replace('http:', 'ws:') + '/ws-signaling'
};
