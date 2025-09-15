import { drizzle } from "drizzle-orm/postgres-js";
import * as postgres from "postgres";
import { getDatabaseConfig } from "../../utils/database";
import { createDrizzleSchema } from "./schema";
import { sql } from "drizzle-orm";

let db: ReturnType<typeof drizzle>;
let client: ReturnType<typeof postgres>;

export const getDrizzleClient = (
  dbConfig?: ReturnType<typeof getDatabaseConfig>,
  pgSchemaName?: string
) => {
  if (!db) {
    const config = dbConfig || getDatabaseConfig();

    // PostgreSQL 클라이언트 생성
    client = postgres({
      host: config.host,
      port: config.port,
      database: config.database,
      username: config.username,
      password: config.password,

      max: 20,
      idle_timeout: 10,
      connect_timeout: 30,
      prepare: false, // 벤치마크 시 prepared statements 비활성화
      transform: undefined,
      debug: false, // 벤치마크 시 디버그 비활성화
    });

    const schema = createDrizzleSchema(pgSchemaName);

    // Drizzle ORM 인스턴스 생성
    db = drizzle(client, {
      schema,
      logger: false, // 벤치마크 시 로깅 비활성화
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
  if (client) {
    await client.end();
    console.log("✅ Drizzle: Database connection closed.");
  }
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
