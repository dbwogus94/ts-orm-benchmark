import { Pool } from "pg";

export const getDatabaseConfig = () => ({
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432"),
  database: process.env.POSTGRES_DB || "orm_benchmark",
  username: process.env.POSTGRES_USER || "postgres",
  password: process.env.POSTGRES_PASSWORD || "password",
  url:
    process.env.DATABASE_URL ||
    "postgresql://postgres:password@localhost:5432/orm_benchmark",
});

export const createDatabaseConnectionPool = (
  dbConfig?: ReturnType<typeof getDatabaseConfig>
) => {
  const config = dbConfig || getDatabaseConfig();
  return new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
};

// 스키마별 테이블 정리 유틸리티
export const cleanupSchema = async (pool: Pool, schema: string) => {
  const client = await pool.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.query(`CREATE SCHEMA ${schema}`);
  } finally {
    client.release();
  }
};

// 성능 측정 유틸리티
export const measurePerformance = async <T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<{
  result: T;
  duration: number;
  memoryUsage: { used: number; total: number };
}> => {
  const memBefore = process.memoryUsage();
  const startTime = process.hrtime.bigint();

  const result = await operation();

  const endTime = process.hrtime.bigint();
  const memAfter = process.memoryUsage();

  const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
  const memoryUsage = {
    used: memAfter.heapUsed - memBefore.heapUsed,
    total: memAfter.heapTotal,
  };

  console.log(
    `🔍 ${operationName}: ${duration.toFixed(2)}ms, Memory: ${(memoryUsage.used / 1024 / 1024).toFixed(2)}MB`
  );

  return { result, duration, memoryUsage };
};
