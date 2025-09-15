#!/usr/bin/env ts-node

import * as chalk from "chalk";
import { subDays } from "../../utils/date";
import { BaseBenchmark } from "../../benchmark/base";
import { BenchmarkResult } from "../../types";
import {
  asc,
  avg,
  count,
  desc,
  eq,
  gte,
  inArray,
  lt,
  sql,
  sum,
} from "drizzle-orm";
import { closeDrizzle, getDrizzleClient, initializeDrizzle } from "./config";
import {
  medicalRecords,
  patients,
  payments,
  reservations,
  treatments,
} from "./schema";

/**
 * Drizzle 벤치마크 구현
 */
class DrizzleBenchmark extends BaseBenchmark {
  constructor() {
    super("Drizzle");
  }

  async initialize(): Promise<void> {
    await initializeDrizzle();
  }

  async cleanup(): Promise<void> {
    await closeDrizzle();
  }

  async simpleRead(limit = 1000, offset = 0): Promise<BenchmarkResult> {
    return this.runBenchmark(
      async () => {
        const drizzle = getDrizzleClient();
        const result = await drizzle
          .select()
          .from(patients)
          .orderBy(asc(patients.id))
          .limit(limit)
          .offset(offset);
        return result;
      },
      `Simple Read (limit: ${limit})`,
      limit
    );
  }

  async simpleWrite(count: number): Promise<BenchmarkResult> {
    return this.runBenchmark(
      async () => {
        const drizzle = getDrizzleClient();
        const patientData = Array.from({ length: count }, () =>
          this.crMDataGenerator.generatePatient()
        );
        const result = await drizzle
          .insert(patients)
          .values(patientData)
          .returning();
        return result;
      },
      `Simple Write (${count} records)`,
      count
    );
  }

  async complexTransaction(count: number): Promise<BenchmarkResult> {
    return this.runBenchmark(
      async () => {
        const drizzle = getDrizzleClient();
        const results = [];

        for (let i = 0; i < count; i++) {
          const result = await drizzle.transaction(async (tx) => {
            // 환자 생성
            const [patient] = await tx
              .insert(patients)
              .values(this.crMDataGenerator.generatePatient())
              .returning();

            // 예약 생성
            const [reservation] = await tx
              .insert(reservations)
              .values({
                ...this.crMDataGenerator.generateReservation(patient.id),
                patientId: patient.id,
              })
              .returning();

            // 진료기록 생성
            const [medicalRecord] = await tx
              .insert(medicalRecords)
              .values({
                ...this.crMDataGenerator.generateMedicalRecord(patient.id),
                patientId: patient.id,
              })
              .returning();

            // 시술 생성
            const [treatment] = await tx
              .insert(treatments)
              .values({
                ...this.crMDataGenerator.generateTreatment(medicalRecord.id),
                recordId: medicalRecord.id,
                price: this.crMDataGenerator
                  .generateTreatment(medicalRecord.id)
                  .price.toString(),
              })
              .returning();

            // 결제 생성
            const [payment] = await tx
              .insert(payments)
              .values({
                ...this.crMDataGenerator.generatePayment(
                  patient.id,
                  treatment.id,
                  parseFloat(treatment.price)
                ),
                patientId: patient.id,
                treatmentId: treatment.id,
                amount: this.crMDataGenerator
                  .generatePayment(
                    patient.id,
                    treatment.id,
                    parseFloat(treatment.price)
                  )
                  .amount.toString(),
              })
              .returning();

            return { patient, reservation, medicalRecord, treatment, payment };
          });
          results.push(result);
        }

        return results;
      },
      `Complex Transaction (${count} complete workflows)`,
      count
    );
  }

  async simpleStats(days = 30): Promise<BenchmarkResult> {
    return this.runBenchmark(
      async () => {
        const drizzle = getDrizzleClient();
        const startDate = subDays(new Date(), days);

        const stats = await drizzle
          .select({
            date: sql`DATE(${patients.firstVisitAt})`.as("date"),
            newPatients: count().as("new_patients"),
            totalVisits: count(patients.id).as("total_visits"),
          })
          .from(patients)
          .where(gte(patients.firstVisitAt, startDate))
          .groupBy(sql`DATE(${patients.firstVisitAt})`)
          .orderBy(desc(sql`DATE(${patients.firstVisitAt})`));

        return stats;
      },
      `Simple Stats (${days} days)`,
      days
    );
  }

  async complexStats(limit = 10): Promise<BenchmarkResult> {
    return this.runBenchmark(
      async () => {
        const drizzle = getDrizzleClient();

        const stats = await drizzle
          .select({
            doctor: medicalRecords.doctor,
            treatmentCount: count(treatments.id).as("treatment_count"),
            totalRevenue: sum(treatments.price).as("total_revenue"),
            averageRevenue: avg(treatments.price).as("average_revenue"),
          })
          .from(medicalRecords)
          .innerJoin(treatments, eq(medicalRecords.id, treatments.recordId))
          .groupBy(medicalRecords.doctor)
          .orderBy(desc(sum(treatments.price)))
          .limit(limit);

        return stats;
      },
      `Complex Stats - Doctor Performance (limit: ${limit})`,
      limit
    );
  }

  async bulkUpdate(count: number): Promise<BenchmarkResult> {
    return this.runBenchmark(
      async () => {
        const drizzle = getDrizzleClient();

        // 랜덤한 환자들의 마지막 방문일 업데이트
        const patientIds = await drizzle
          .select({ id: patients.id })
          .from(patients)
          .orderBy(asc(patients.id))
          .limit(count);

        const result = await drizzle
          .update(patients)
          .set({ lastVisitAt: new Date() })
          .where(
            inArray(
              patients.id,
              patientIds.map((p) => p.id)
            )
          )
          .returning();

        return result;
      },
      `Bulk Update (${count} records)`,
      count
    );
  }

  /**
   * 벌크 삭제
   */
  async bulkDelete(olderThanDays: number): Promise<BenchmarkResult> {
    return this.runBenchmark(
      async () => {
        const drizzle = getDrizzleClient();
        const cutoffDate = subDays(new Date(), olderThanDays);

        // 관련된 데이터들을 CASCADE로 삭제하기 위해 환자만 삭제
        const result = await drizzle
          .delete(patients)
          .where(lt(patients.firstVisitAt, cutoffDate))
          .returning();

        return result;
      },
      `Bulk Delete (older than ${olderThanDays} days)`,
      olderThanDays
    );
  }

  /**
   * 중첩 삽입
   */
  async nestedInsert(count: number): Promise<BenchmarkResult> {
    return this.runBenchmark(
      async () => {
        const drizzle = getDrizzleClient();
        const results = [];

        for (let i = 0; i < count; i++) {
          const data = this.crMDataGenerator.generateNestedPatient();
          const result = await drizzle.transaction(async (tx) => {
            const [patient] = await tx
              .insert(patients)
              .values(data)
              .returning();

            if (data.reservations.length > 0) {
              await tx.insert(reservations).values(
                data.reservations.map((r) => ({
                  ...r,
                  patientId: patient.id,
                }))
              );
            }

            if (data.payments.length > 0) {
              await tx.insert(payments).values(
                data.payments.map((p) => ({
                  ...p,
                  patientId: patient.id,
                  amount: p.amount.toString(),
                }))
              );
            }

            for (const record of data.medicalRecords) {
              const [medicalRecord] = await tx
                .insert(medicalRecords)
                .values({ ...record, patientId: patient.id })
                .returning();

              if (record.treatments.length > 0) {
                await tx.insert(treatments).values(
                  record.treatments.map((t) => ({
                    ...t,
                    price: t.price.toString(),
                    recordId: medicalRecord.id,
                  }))
                );
              }
            }
            return patient;
          });
          results.push(result);
        }
        return results;
      },
      `Nested Insert (${count} records)`,
      count
    );
  }
}

/**
 * 메인 벤치마크 실행 함수
 */
async function runBenchmark() {
  console.log(chalk.blue("🏁 Starting Drizzle Benchmarks"));

  const benchmark = new DrizzleBenchmark();

  try {
    const results = await benchmark.runAll();

    // 결과 출력
    console.log(chalk.green("✅ Drizzle Benchmarks Completed!"));
    console.log(chalk.blue("📊 Results Summary:"));

    results.forEach((result) => {
      console.log(chalk.gray(`  ${result.operation}:`));
      console.log(chalk.gray(`    Duration: ${result.duration.toFixed(2)}ms`));
      console.log(
        chalk.gray(`    Avg/Record: ${result.averageTime.toFixed(4)}ms`)
      );
      console.log(
        chalk.gray(
          `    Memory: ${(result.memoryUsage!.used / 1024 / 1024).toFixed(2)}MB`
        )
      );
    });

    return results;
  } catch (error) {
    console.error(chalk.red("❌ Drizzle benchmark failed:"), error);
    process.exit(1);
  }
}

// 직접 실행된 경우에만 벤치마크 실행
if (require.main === module) {
  runBenchmark();
}

export default DrizzleBenchmark;
