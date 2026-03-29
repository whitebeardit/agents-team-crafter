import { config } from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Carrega `backend/.env` para scripts e servidor (Node não lê .env automaticamente). */
export function loadDotenv(): void {
  const backendRoot = resolve(__dirname, '../..');
  config({ path: resolve(backendRoot, '.env') });
}
