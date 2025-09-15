import { Sequelize } from "sequelize-typescript";
import { getDatabaseConfig } from "../../utils/database";
import { Patient } from "./models/Patient";
import { Reservation } from "./models/Reservation";
import { MedicalRecord } from "./models/MedicalRecord";
import { Treatment } from "./models/Treatment";
import { Payment } from "./models/Payment";

let sequelize: Sequelize;

export const getSequelizeInstance = (): Sequelize => {
  if (!sequelize) {
    const config = getDatabaseConfig();

    sequelize = new Sequelize({
      dialect: "postgres",
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      database: config.database,
      schema: "sequelize",
      models: [Patient, Reservation, MedicalRecord, Treatment, Payment],
      logging: false, // 벤치마크 시 로깅 비활성화
      pool: {
        max: 20,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
      dialectOptions: {
        connectTimeout: 60000,
      },
    });
  }

  return sequelize;
};

export const initializeSequelize = async (): Promise<void> => {
  const instance = getSequelizeInstance();

  try {
    await instance.authenticate();
    console.log("✅ Sequelize: Database connection established successfully.");
  } catch (error) {
    console.error("❌ Sequelize: Unable to connect to the database:", error);
    throw error;
  }
};

export const syncSequelize = async (force: boolean = false): Promise<void> => {
  const instance = getSequelizeInstance();

  try {
    // 스키마 생성
    await instance.query("CREATE SCHEMA IF NOT EXISTS sequelize");

    // 테이블 동기화
    await instance.sync({ force, schema: "sequelize" });
    console.log("✅ Sequelize: Database synchronized successfully.");
  } catch (error) {
    console.error("❌ Sequelize: Database synchronization failed:", error);
    throw error;
  }
};

export const closeSequelize = async (): Promise<void> => {
  if (sequelize) {
    await sequelize.close();
    console.log("✅ Sequelize: Database connection closed.");
  }
};
