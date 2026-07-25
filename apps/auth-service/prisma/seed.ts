/**
 * Tạo 1 user demo để test login: demo@omial.dev / password123
 * Chạy:  pnpm --filter . exec ts-node ...  → xem lệnh trong README/docs.
 * Đơn giản nhất: `npx ts-node -O '{"module":"commonjs"}' apps/auth-service/prisma/seed.ts`
 */
import { config } from 'dotenv';
import { join } from 'node:path';
config({ path: join(__dirname, '..', '.env') }); // DATABASE_URL của auth-service

import { Client } from 'pg';
import * as bcrypt from 'bcryptjs';

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const email = 'demo@omial.dev';
  const password = await bcrypt.hash('password123', 10);

  await client.query(
    `INSERT INTO "User" (id, email, password, "updatedAt")
     VALUES (gen_random_uuid(), $1, $2, now())
     ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, "updatedAt" = now()`,
    [email, password],
  );

  console.log(
    '✅ Seeded demo user →  email: demo@omial.dev   password: password123',
  );
  await client.end();
}

main().catch((e) => {
  console.error('❌ Seed lỗi:', e);
  process.exit(1);
});
