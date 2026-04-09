import mongoose from 'mongoose';
import { loadDotenv } from '../config/load-dotenv.js';
import { loadEnv } from '../config/env.js';

loadDotenv();
import { buildApp } from './app.js';

let app: Awaited<ReturnType<typeof buildApp>> | null = null;

async function main() {
  const env = loadEnv();
  await mongoose.connect(env.MONGODB_URI);
  app = await buildApp(env);
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  app.log.info(`Listening on ${env.PORT}`);
}

const shutdown = async () => {
  if (app) {
    await app.close();
    app = null;
  }
  await mongoose.disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
