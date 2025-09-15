import { DataSource } from "typeorm";
import { getDatabaseConfig } from "../../utils/database";
import { Patient } from "./entities/Patient";
import { Reservation } from "./entities/Reservation";
import { MedicalRecord } from "./entities/MedicalRecord";
import { Treatment } from "./entities/Treatment";
import { Payment } from "./entities/Payment";

let dataSource: DataSource;

export const getTypeORMDataSource = (): DataSource => {
  if (!dataSource) {
    const config = getDatabaseConfig();

    dataSource = new DataSource({
      type: "postgres",
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      database: config.database,
      schema: "typeorm",
      entities: [Patient, Reservation, MedicalRecord, Treatment, Payment],
      synchronize: false, // 운영환경에서는 false
      logging: false, // 벤치마크 시 로깅 비활성화
      maxQueryExecutionTime: 10000,

      extra: {
        max: 20,
        min: 0,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 10000,
      },
    });
  }

  return dataSource;
};

export const initializeTypeORM = async (): Promise<void> => {
  const ds = getTypeORMDataSource();

  try {
    if (!ds.isInitialized) {
      await ds.initialize();
    }
    console.log("✅ TypeORM: Database connection established successfully.");
  } catch (error) {
    console.error("❌ TypeORM: Unable to connect to the database:", error);
    throw error;
  }
};

export const syncTypeORM = async (
  dropBeforeSync: boolean = false
): Promise<void> => {
  const ds = getTypeORMDataSource();

  try {
    // 스키마 생성
    await ds.query("CREATE SCHEMA IF NOT EXISTS typeorm");

    // 테이블 동기화
    await ds.synchronize(dropBeforeSync);
    console.log("✅ TypeORM: Database synchronized successfully.");
  } catch (error) {
    console.error("❌ TypeORM: Database synchronization failed:", error);
    throw error;
  }
};

export const closeTypeORM = async (): Promise<void> => {
  const ds = getTypeORMDataSource();

  if (ds && ds.isInitialized) {
    await ds.destroy();
    console.log("✅ TypeORM: Database connection closed.");
  }
};

// 트랜잭션 헬퍼
export const executeTransaction = async <T>(
  fn: (manager: any) => Promise<T>
): Promise<T> => {
  const ds = getTypeORMDataSource();
  return await ds.transaction(fn);
};

// Repository 헬퍼
export const getRepository = <T>(entity: new () => T) => {
  const ds = getTypeORMDataSource();
  return ds.getRepository(entity);
};
