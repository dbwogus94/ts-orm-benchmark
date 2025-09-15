#!/usr/bin/env ts-node

import "reflect-metadata";
import { initializeTypeORM, syncTypeORM, closeTypeORM } from "./config";

/**
 * TypeORM 마이그레이션 실행
 */
async function migrate() {
  console.log("🚀 Starting TypeORM migration...");

  try {
    // 연결 초기화
    await initializeTypeORM();

    // 테이블 생성/동기화 (dropBeforeSync: true로 기존 테이블 삭제 후 재생성)
    await syncTypeORM(true);

    console.log("✅ TypeORM migration completed successfully!");
  } catch (error) {
    console.error("❌ TypeORM migration failed:", error);
    process.exit(1);
  } finally {
    await closeTypeORM();
  }
}

// 직접 실행된 경우에만 마이그레이션 실행
if (require.main === module) {
  migrate();
}

export default migrate;
