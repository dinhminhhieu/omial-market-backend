import { execSync } from 'node:child_process';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';

/**
 * Hạ tầng dùng chung cho INTEGRATION TEST: bật 1 Postgres THẬT trong Docker,
 * chạy đúng bộ migration của service, trả về connection string để test kết nối.
 *
 * Khác unit test (mock Prisma) ở chỗ: ở đây câu query, migration, CHECK constraint,
 * unique index, transaction rollback đều CHẠY THẬT — nên nó bắt được lớp bug mà
 * mock không thấy (vd gõ `module` thay vì `mode`, constraint không được apply…).
 *
 * Chi phí: mỗi lần bật container ~5–10s (kéo image lần đầu lâu hơn) → chỉ chạy
 * qua `pnpm test:int`, KHÔNG nằm trong `pnpm test` thường.
 */
export interface StartedTestDb {
  container: StartedPostgreSqlContainer;
  databaseUrl: string;
  stop: () => Promise<void>;
}

/**
 * @param migrationsCwd Thư mục service chứa `prisma/` (vd `apps/inventory-service`)
 *        — `prisma migrate deploy` chạy từ đây để apply đúng lịch sử migration.
 */
export async function startTestDb(
  migrationsCwd: string,
): Promise<StartedTestDb> {
  const container = await new PostgreSqlContainer('postgres:16')
    .withDatabase('test_db')
    .withUsername('test')
    .withPassword('test')
    .start();

  const databaseUrl = container.getConnectionUri();

  // Apply migration THẬT (không phải db push) → chứng minh lịch sử migration
  // chạy sạch từ số 0, đúng cái sẽ chạy trên production.
  execSync('npx prisma migrate deploy', {
    cwd: migrationsCwd,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });

  return {
    container,
    databaseUrl,
    stop: () => container.stop(),
  };
}
