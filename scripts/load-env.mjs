import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

for (const envFile of ['.env.local', '.env']) {
  const envPath = resolve(process.cwd(), envFile);
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, quiet: true });
  }
}
