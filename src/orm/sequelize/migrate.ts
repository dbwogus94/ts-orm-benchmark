#!/usr/bin/env ts-node

import { initializeSequelize, syncSequelize, closeSequelize } from "./config";

/**
 * Sequelize 마이그레이션 실행
 */
async function migrate() {
  console.log("🚀 Starting Sequelize migration...");

  try {
    // 연결 초기화
    await initializeSequelize();

    // 테이블 생성/동기화 (force: true로 기존 테이블 삭제 후 재생성)
    await syncSequelize(true);

    console.log("✅ Sequelize migration completed successfully!");
  } catch (error) {
    console.error("❌ Sequelize migration failed:", error);
    process.exit(1);
  } finally {
    await closeSequelize();
  }
}

// 직접 실행된 경우에만 마이그레이션 실행
if (require.main === module) {
  migrate();
}

export default migrate;
