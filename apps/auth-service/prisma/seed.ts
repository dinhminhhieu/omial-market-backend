/**
 * Seed 2 tài khoản để test phân quyền (Phase 1):
 *   demo@omial.dev  / password123  → role USER  (khách mua hàng)
 *   admin@omial.dev / password123  → role ADMIN (quản trị: sửa sản phẩm, kho, đơn)
 *
 * Cả hai đều đặt `isEmailVerified = true` — bỏ qua bước OTP, vì login CHẶN
 * tài khoản chưa xác thực email (ForbiddenException).
 *
 * Chạy: `pnpm db:seed`
 */
import { config } from 'dotenv';
import { join } from 'node:path';
config({ path: join(__dirname, '..', '.env') }); // DATABASE_URL của auth-service

import { Client } from 'pg';
import * as bcrypt from 'bcryptjs';

const USERS = [
  { email: 'demo@omial.dev', role: 'USER', fullName: 'Khách Demo' },
  { email: 'admin@omial.dev', role: 'ADMIN', fullName: 'Quản Trị Viên' },
];

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const password = await bcrypt.hash('password123', 10);

  for (const user of USERS) {
    await client.query(
      `INSERT INTO "User" (id, email, password, "fullName", role,
                           "isEmailVerified", "isVerified", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4::"ERole", true, true, now())
       ON CONFLICT (email) DO UPDATE SET
         password = EXCLUDED.password,
         "fullName" = EXCLUDED."fullName",
         role = EXCLUDED.role,
         "isEmailVerified" = true,
         "isVerified" = true,
         "updatedAt" = now()`,
      [user.email, password, user.fullName, user.role],
    );
    console.log(`✅ ${user.email.padEnd(18)} (${user.role}) / password123`);
  }

  await client.end();
}

main().catch((e) => {
  console.error('❌ Seed lỗi:', e);
  process.exit(1);
});
