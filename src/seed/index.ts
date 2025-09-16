import * as chalk from "chalk";
import { count } from "drizzle-orm";

import {
  closeDrizzle,
  getDrizzleClient,
  getDrizzleSchema,
} from "../orm/drizzle/config";
import { measurePerformance } from "../utils/database";
import { CRMDataGenerator } from "../utils/faker";

const BATCH_SIZE = parseInt(process.env.BENCHMARK_BATCH_SIZE || "1000");
const TOTAL_RECORDS = parseInt(process.env.BENCHMARK_TOTAL_RECORDS || "100000");
const SCHEMAS = ["sequelize", "prisma", "typeorm", "drizzle"];

/**
 * Drizzle을 사용하여 모든 스키마에 대한 통합 시드 데이터 생성
 */
async function seedAll() {
  for (const schemaName of SCHEMAS) {
    await seedSchema(schemaName);
    await closeDrizzle();
  }
}

async function seedSchema(schemaName: string) {
  console.log(
    chalk.cyan(`\n🚀 Starting seeding for schema: ${chalk.bold(schemaName)}`)
  );
  console.log(
    chalk.gray(
      `Target: ${TOTAL_RECORDS.toLocaleString()} patients with related data`
    )
  );

  const db = getDrizzleClient(schemaName);
  const schema = getDrizzleSchema();
  try {
    const { payments, treatments, medicalRecords, reservations, patients } =
      schema;

    // 기존 데이터 정리
    console.log(chalk.yellow("🧹 Cleaning existing data..."));
    try {
      await db.delete(payments);
      await db.delete(treatments);
      await db.delete(medicalRecords);
      await db.delete(reservations);
      await db.delete(patients);
    } catch (error) {
      console.error(chalk.red("❌ Drizzle table delete failed:"), error);
    }

    const startTime = Date.now();
    let totalInserted = 0;
    const crmDataGenerator = new CRMDataGenerator();

    // 배치 단위로 데이터 생성
    for (let i = 0; i < TOTAL_RECORDS; i += BATCH_SIZE) {
      const batchSize = Math.min(BATCH_SIZE, TOTAL_RECORDS - i);

      await measurePerformance(async () => {
        await db.transaction(async (tx) => {
          // 환자 데이터 생성
          const patientData = Array.from({ length: batchSize }, () =>
            crmDataGenerator.generatePatient()
          );
          const insertedPatients = await tx
            .insert(schema.patients)
            .values(patientData)
            .returning();

          // 각 환자별 관련 데이터 생성
          const reservationData: any[] = [];
          const recordData: any[] = [];
          const paymentData: any[] = [];

          for (const patient of insertedPatients) {
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
            await tx.insert(schema.reservations).values(reservationData);
          }

          if (recordData.length > 0) {
            const insertedRecords = await tx
              .insert(schema.medicalRecords)
              .values(recordData)
              .returning();

            // 시술 데이터 생성 (진료기록과 1:1 매핑으로 정합성 유지)
            const treatmentData: any[] = [];
            for (const record of insertedRecords) {
              treatmentData.push({
                ...crmDataGenerator.generateTreatment(record.id),
                recordId: record.id,
              });
            }

            if (treatmentData.length > 0) {
              await tx.insert(schema.treatments).values(treatmentData);
            }
          }

          if (paymentData.length > 0) {
            await tx.insert(schema.payments).values(paymentData);
          }
        });

        totalInserted += batchSize;
        const progress = ((totalInserted / TOTAL_RECORDS) * 100).toFixed(1);
        console.log(
          chalk.green(
            `✅ Batch ${Math.ceil(
              totalInserted / BATCH_SIZE
            )}: ${totalInserted.toLocaleString()} patients (${progress}%)`
          )
        );
      }, `Drizzle Batch Insert (${batchSize} records) for schema ${schemaName}`);
    }

    const duration = Date.now() - startTime;
    const stats = await getStatistics(db, schema);

    console.log(
      chalk.green(
        `\n✅ Drizzle seeding for ${schemaName} completed successfully!`
      )
    );
    console.log(chalk.blue("📊 Final Statistics:"));
    console.log(chalk.gray(`  • Total time: ${(duration / 1000).toFixed(2)}s`));
    console.log(
      chalk.gray(
        `  • Rate: ${(TOTAL_RECORDS / (duration / 1000)).toFixed(
          0
        )} patients/sec`
      )
    );
    Object.entries(stats).forEach(([table, count]) => {
      console.log(
        chalk.gray(`  • ${table}: ${count.toLocaleString()} records`)
      );
    });
  } catch (error) {
    console.error(
      chalk.red(`❌ Drizzle seeding for ${schemaName} failed:`),
      error
    );
    process.exit(1);
  } finally {
    await closeDrizzle();
  }
}

async function getStatistics(db: any, schema: any) {
  const { patients, reservations, medicalRecords, treatments, payments } =
    schema;

  const [
    patientResult,
    reservationResult,
    recordResult,
    treatmentResult,
    paymentResult,
  ] = await Promise.all([
    db.select({ count: count() }).from(patients),
    db.select({ count: count() }).from(reservations),
    db.select({ count: count() }).from(medicalRecords),
    db.select({ count: count() }).from(treatments),
    db.select({ count: count() }).from(payments),
  ]);

  return {
    patients: patientResult[0].count,
    reservations: reservationResult[0].count,
    medical_records: recordResult[0].count,
    treatments: treatmentResult[0].count,
    payments: paymentResult[0].count,
  };
}

// 직접 실행된 경우에만 시드 실행
if (require.main === module) {
  seedAll();
}

export default seedAll;
