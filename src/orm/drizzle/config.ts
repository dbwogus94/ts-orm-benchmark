import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { createDatabaseConnectionPool } from "../../utils/database";
import { createDrizzleSchema } from "./schema";

let db: ReturnType<typeof drizzle>;
let schema: ReturnType<typeof createDrizzleSchema>;
let pool: Pool;

export const getDrizzleSchema = () => {
  if (!db) {
    throw new Error("Drizzle client not initialized");
  }
  return schema;
};

export const getDrizzleClient = (pgSchemaName?: string) => {
  if (!db) {
    pool = createDatabaseConnectionPool();
    schema = createDrizzleSchema(pgSchemaName);
    db = drizzle(pool, {
      schema,
      logger: false,
    });
  }
  return db;
};

export const initializeDrizzle = async (): Promise<void> => {
  try {
    const drizzleClient = getDrizzleClient();

    // 연결 테스트
    await drizzleClient.execute(sql`SELECT 1`);
    console.log("✅ Drizzle: Database connection established successfully.");
  } catch (error) {
    console.error("❌ Drizzle: Unable to connect to the database:", error);
    throw error;
  }
};

export const closeDrizzle = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    console.log("✅ Drizzle: Database connection closed.");
  }
  db = undefined;
  schema = undefined;
  pool = undefined;
};

// 스키마 초기화 헬퍼
export const initializeDrizzleSchema = async (): Promise<void> => {
  try {
    const drizzleClient = getDrizzleClient();

    // Drizzle 스키마 생성
    await drizzleClient.execute(sql`CREATE SCHEMA IF NOT EXISTS drizzle`);
    console.log("✅ Drizzle: Schema created successfully.");
  } catch (error) {
    console.error("❌ Drizzle: Schema creation failed:", error);
    throw error;
  }
};

// 트랜잭션 헬퍼
export const executeTransaction = async <T>(
  fn: (tx: typeof db) => Promise<T>
): Promise<T> => {
  const drizzleClient = getDrizzleClient();
  return await drizzleClient.transaction(fn as any);
};
