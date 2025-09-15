#!/usr/bin/env ts-node

import {
  initializePrisma,
  initializePrismaSchema,
  closePrisma,
} from "./config";
import { execSync } from "child_process";

/**
 * Prisma 마이그레이션 실행
 */
async function migrate() {
  console.log("🚀 Starting Prisma migration...");

  try {
    // 연결 초기화
    await initializePrisma();

    // 스키마 초기화
    await initializePrismaSchema();

    // Prisma Client 생성
    console.log("📦 Generating Prisma Client...");
    execSync("npx prisma generate --schema=src/orm/prisma/schema.prisma", {
      stdio: "inherit",
      cwd: process.cwd(),
    });

    // 마이그레이션 적용
    console.log("🔄 Applying migrations...");
    execSync(
      "npx prisma db push --schema=src/orm/prisma/schema.prisma --skip-generate",
      {
        stdio: "inherit",
        cwd: process.cwd(),
      }
    );

    console.log("✅ Prisma migration completed successfully!");
  } catch (error) {
    console.error("❌ Prisma migration failed:", error);
    process.exit(1);
  } finally {
    await closePrisma();
  }
}

// 직접 실행된 경우에만 마이그레이션 실행
if (require.main === module) {
  migrate();
}

export default migrate;
