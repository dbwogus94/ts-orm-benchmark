#!/usr/bin/env ts-node

import { execSync } from "child_process";
import {
  initializeDrizzle,
  initializeDrizzleSchema,
  closeDrizzle,
} from "./config";

/**
 * Drizzle 마이그레이션 실행
 */
async function migrate() {
  console.log("🚀 Starting Drizzle migration...");

  try {
    // 연결 초기화
    await initializeDrizzle();

    // 스키마 초기화
    await initializeDrizzleSchema();

    // Drizzle Kit으로 스키마 변경사항을 직접 데이터베이스에 적용
    console.log("🔄 Pushing schema changes to database...");
    execSync(
      "npx drizzle-kit push --config=src/orm/drizzle/drizzle.config.ts",
      {
        stdio: "inherit",
        cwd: process.cwd(),
      }
    );

    console.log("✅ Drizzle migration completed successfully!");
  } catch (error) {
    console.error("❌ Drizzle migration failed:", error);
    process.exit(1);
  } finally {
    await closeDrizzle();
  }
}

// 직접 실행된 경우에만 마이그레이션 실행
if (require.main === module) {
  migrate();
}

export default migrate;
