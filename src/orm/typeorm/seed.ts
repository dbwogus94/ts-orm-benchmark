#!/usr/bin/env ts-node

import * as chalk from "chalk";
import "reflect-metadata";
import {
  initializeTypeORM,
  getTypeORMDataSource,
  closeTypeORM,
  getRepository,
} from "./config";
import { Patient } from "./entities/Patient";
import { Reservation } from "./entities/Reservation";
import { MedicalRecord } from "./entities/MedicalRecord";
import { Treatment } from "./entities/Treatment";
import { Payment } from "./entities/Payment";
import { CRMDataGenerator } from "../../utils/faker";
import { measurePerformance } from "../../utils/database";

const BATCH_SIZE = parseInt(process.env.BENCHMARK_BATCH_SIZE || "1000");
const TOTAL_RECORDS = parseInt(process.env.BENCHMARK_TOTAL_RECORDS || "100000");

/**
 * TypeORM 시드 데이터 생성
 */
async function seed() {
  console.log(chalk.blue("🚀 Starting TypeORM seeding..."));
  console.log(
    chalk.gray(
      `Target: ${TOTAL_RECORDS.toLocaleString()} patients with related data`
    )
  );

  try {
    await initializeTypeORM();
    const dataSource = getTypeORMDataSource();
    const crmDataGenerator = new CRMDataGenerator();

    // Repository 가져오기
    const patientRepo = getRepository(Patient);
    const reservationRepo = getRepository(Reservation);
    const recordRepo = getRepository(MedicalRecord);
    const treatmentRepo = getRepository(Treatment);
    const paymentRepo = getRepository(Payment);

    // 기존 데이터 정리
    console.log(chalk.yellow("🧹 Cleaning existing data..."));
    await paymentRepo.deleteAll();
    await treatmentRepo.deleteAll();
    await recordRepo.deleteAll();
    await reservationRepo.deleteAll();
    await patientRepo.deleteAll();

    const startTime = Date.now();
    let totalInserted = 0;

    // 배치 단위로 데이터 생성
    for (let i = 0; i < TOTAL_RECORDS; i += BATCH_SIZE) {
      const batchSize = Math.min(BATCH_SIZE, TOTAL_RECORDS - i);

      await measurePerformance(async () => {
        await dataSource.transaction(async (manager) => {
          // 환자 데이터 생성
          const patientData = Array.from({ length: batchSize }, () =>
            crmDataGenerator.generatePatient()
          );
          const patients = await manager.save(Patient, patientData);

          // 각 환자별 관련 데이터 생성
          const reservationData: any[] = [];
          const recordData: any[] = [];
          const treatmentData: any[] = [];
          const paymentData: any[] = [];

          for (const patient of patients) {
            // 예약 데이터 (1-15개, 50%는 1회만)
            let reservationCount;
            if (Math.random() < 0.5) {
              reservationCount = 1; // 50% 확률로 1회만
            } else {
              reservationCount = Math.floor(Math.random() * 14) + 2; // 2-15회
            }

            for (let j = 0; j < reservationCount; j++) {
              reservationData.push({
                ...crmDataGenerator.generateReservation(patient.id),
                patientId: patient.id,
              });
            }

            // 진료기록 데이터 (3-8개)
            const recordCount = Math.floor(Math.random() * 6) + 3; // 3-8개
            for (let j = 0; j < recordCount; j++) {
              recordData.push({
                ...crmDataGenerator.generateMedicalRecord(patient.id),
                patientId: patient.id,
              });
            }

            // 결제 데이터 (예약 기반으로 생성)
            for (let j = 0; j < reservationCount; j++) {
              const rand = Math.random();

              if (rand < 0.9) {
                // 90% - 성공한 결제 1개
                paymentData.push({
                  ...crmDataGenerator.generatePayment(patient.id),
                  patientId: patient.id,
                });
              } else {
                // 10% - 복잡한 결제 시나리오
                const scenario = Math.random();

                if (scenario < 0.4) {
                  // 결제 실패 후 재결제 성공
                  paymentData.push({
                    ...crmDataGenerator.generatePayment(patient.id),
                    patientId: patient.id,
                    status: "failed",
                  });
                  paymentData.push({
                    ...crmDataGenerator.generatePayment(patient.id),
                    patientId: patient.id,
                    status: "completed",
                  });
                } else if (scenario < 0.7) {
                  // 결제 후 환불
                  paymentData.push({
                    ...crmDataGenerator.generatePayment(patient.id),
                    patientId: patient.id,
                    status: "completed",
                  });
                  paymentData.push({
                    ...crmDataGenerator.generatePayment(patient.id),
                    patientId: patient.id,
                    status: "refunded",
                  });
                } else {
                  // 결제 대기 상태
                  paymentData.push({
                    ...crmDataGenerator.generatePayment(patient.id),
                    patientId: patient.id,
                    status: "pending",
                  });
                }
              }
            }
          }

          // 관련 데이터 일괄 삽입
          if (reservationData.length > 0) {
            await manager.save(Reservation, reservationData);
          }

          if (recordData.length > 0) {
            const createdRecords = await manager.save(
              MedicalRecord,
              recordData
            );

            // 시술 데이터 생성 (진료기록과 1:1 매핑으로 정합성 유지)
            for (const record of createdRecords) {
              treatmentData.push({
                ...crmDataGenerator.generateTreatment(record.id),
                recordId: record.id,
              });
            }

            if (treatmentData.length > 0) {
              await manager.save(Treatment, treatmentData);
            }
          }

          if (paymentData.length > 0) {
            await manager.save(Payment, paymentData);
          }
        });

        totalInserted += batchSize;
        const progress = ((totalInserted / TOTAL_RECORDS) * 100).toFixed(1);
        console.log(
          chalk.green(
            `✅ Batch ${Math.ceil(totalInserted / BATCH_SIZE)}: ${totalInserted.toLocaleString()} patients (${progress}%)`
          )
        );
      }, `TypeORM Batch Insert (${batchSize} records)`);
    }

    const duration = Date.now() - startTime;

    // 통계 출력
    const stats = await getStatistics();

    console.log(chalk.green("✅ TypeORM seeding completed successfully!"));
    console.log(chalk.blue("📊 Final Statistics:"));
    console.log(chalk.gray(`  • Total time: ${(duration / 1000).toFixed(2)}s`));
    console.log(
      chalk.gray(
        `  • Rate: ${(TOTAL_RECORDS / (duration / 1000)).toFixed(0)} patients/sec`
      )
    );
    Object.entries(stats).forEach(([table, count]) => {
      console.log(
        chalk.gray(`  • ${table}: ${count.toLocaleString()} records`)
      );
    });
  } catch (error) {
    console.error(chalk.red("❌ TypeORM seeding failed:"), error);
    process.exit(1);
  } finally {
    await closeTypeORM();
  }
}

/**
 * 데이터베이스 통계 조회
 */
async function getStatistics() {
  const patientRepo = getRepository(Patient);
  const reservationRepo = getRepository(Reservation);
  const recordRepo = getRepository(MedicalRecord);
  const treatmentRepo = getRepository(Treatment);
  const paymentRepo = getRepository(Payment);

  return {
    patients: await patientRepo.count(),
    reservations: await reservationRepo.count(),
    medical_records: await recordRepo.count(),
    treatments: await treatmentRepo.count(),
    payments: await paymentRepo.count(),
  };
}

// 직접 실행된 경우에만 시드 실행
if (require.main === module) {
  seed();
}

export default seed;
