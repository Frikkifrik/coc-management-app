import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.resolve(serverDir, '..', '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

await import('./index.mjs');
