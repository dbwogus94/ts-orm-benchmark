#!/usr/bin/env ts-node

import * as chalk from "chalk";
import { subDays } from "../../utils/date";
import { BaseBenchmark } from "../../benchmark/base";
import { BenchmarkResult } from "../../types";
import { PrismaClient } from "./generated/client";

/**
 * Prisma 벤치마크 구현
 */
class PrismaBenchmark extends BaseBenchmark {
  readonly #prisma: PrismaClient;

  constructor() {
    super("Prisma");
    this.#prisma = new PrismaClient();
  }

  async initialize(): Promise<void> {
    await this.#prisma.$connect();
  }

  async cleanup(): Promise<void> {
    await this.#prisma.$disconnect();
  }

  async simpleRead(limit = 1000, offset = 0): Promise<BenchmarkResult> {
    return this.runBenchmark(
      async () => {
        const result = await this.#prisma.patient.findMany({
          orderBy: { id: "asc" },
          take: limit,
          skip: offset,
        });
        return result;
      },
      `Simple Read (limit: ${limit})`,
      limit
    );
  }

  async simpleWrite(count: number): Promise<BenchmarkResult> {
    return this.runBenchmark(
      async () => {
        const patientData = Array.from({ length: count }, () =>
          this.crMDataGenerator.generatePatient()
        );
        const result = await this.#prisma.patient.createMany({
          data: patientData,
        });
        return result;
      },
      `Simple Write (${count} records)`,
      count
    );
  }

  async complexTransaction(count: number): Promise<BenchmarkResult> {
    return this.runBenchmark(
      async () => {
        const results = [];

        for (let i = 0; i < count; i++) {
          const result = await this.#prisma.$transaction(async (tx) => {
            // 환자 생성
            const patient = await tx.patient.create({
              data: this.crMDataGenerator.generatePatient(),
            });

            // 예약 생성
            const reservation = await tx.reservation.create({
              data: {
                ...this.crMDataGenerator.generateReservation(patient.id),
                patientId: patient.id,
              },
            });

            // 진료기록 생성
            const medicalRecord = await tx.medicalRecord.create({
              data: {
                ...this.crMDataGenerator.generateMedicalRecord(patient.id),
                patientId: patient.id,
              },
            });

            // 시술 생성
            const treatment = await tx.treatment.create({
              data: {
                ...this.crMDataGenerator.generateTreatment(medicalRecord.id),
                recordId: medicalRecord.id,
              },
            });

            // 결제 생성
            const payment = await tx.payment.create({
              data: {
                ...this.crMDataGenerator.generatePayment(
                  patient.id,
                  treatment.id,
                  Number(treatment.price)
                ),
                patientId: patient.id,
                treatmentId: treatment.id,
              },
            });

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
        const startDate = subDays(new Date(), days);

        const stats = await this.#prisma.$queryRaw`
          SELECT 
            DATE(first_visit_at) as date,
            COUNT(*) as new_patients,
            COUNT(DISTINCT id) as total_visits
          FROM prisma.patients 
          WHERE first_visit_at >= ${startDate}
          GROUP BY DATE(first_visit_at)
          ORDER BY date DESC
        `;

        return stats;
      },
      `Simple Stats (${days} days)`,
      days
    );
  }

  async complexStats(limit = 10): Promise<BenchmarkResult> {
    return this.runBenchmark(
      async () => {
        const stats = await this.#prisma.$queryRaw`
          SELECT 
            mr.doctor,
            COUNT(t.id) as treatment_count,
            SUM(t.price) as total_revenue,
            AVG(t.price) as average_revenue
          FROM prisma.medical_records mr
          JOIN prisma.treatments t ON mr.id = t.record_id
          GROUP BY mr.doctor
          ORDER BY total_revenue DESC
          LIMIT ${limit}
        `;

        return stats;
      },
      `Complex Stats - Doctor Performance (limit: ${limit})`,
      limit
    );
  }

  async bulkUpdate(count: number): Promise<BenchmarkResult> {
    return this.runBenchmark(
      async () => {
        // 랜덤한 환자들의 마지막 방문일 업데이트
        const patientsToUpdate = await this.#prisma.patient.findMany({
          select: { id: true },
          orderBy: { id: "asc" },
          take: count,
        });

        const result = await this.#prisma.patient.updateMany({
          where: {
            id: {
              in: patientsToUpdate.map((p) => p.id),
            },
          },
          data: {
            lastVisitAt: new Date(),
          },
        });

        return result;
      },
      `Bulk Update (${count} records)`,
      count
    );
  }

  async bulkDelete(olderThanDays: number): Promise<BenchmarkResult> {
    return this.runBenchmark(
      async () => {
        const cutoffDate = subDays(new Date(), olderThanDays);

        // 관련된 데이터들을 CASCADE로 삭제하기 위해 환자만 삭제
        const result = await this.#prisma.patient.deleteMany({
          where: {
            firstVisitAt: {
              lt: cutoffDate,
            },
          },
        });

        return result;
      },
      `Bulk Delete (older than ${olderThanDays} days)`,
      olderThanDays
    );
  }

  // 모두 한번에 생성하는 극단적인 케이스 - 중첩 삽입
  async nestedInsert(count: number): Promise<BenchmarkResult> {
    return this.runBenchmark(
      async () => {
        const results = [];
        for (let i = 0; i < count; i++) {
          const data = this.crMDataGenerator.generateNestedPatient();
          const result = await this.#prisma.patient.create({
            data: {
              ...data,
              reservations: {
                create: data.reservations,
              },
              medicalRecords: {
                create: data.medicalRecords.map((record) => ({
                  ...record,
                  treatments: {
                    create: record.treatments,
                  },
                })),
              },
              payments: {
                create: data.payments,
              },
            },
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
  console.log(chalk.blue("🏁 Starting Prisma Benchmarks"));

  const benchmark = new PrismaBenchmark();

  try {
    const results = await benchmark.runAll();

    // 결과 출력
    console.log(chalk.green("✅ Prisma Benchmarks Completed!"));
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
    console.error(chalk.red("❌ Prisma benchmark failed:"), error);
    process.exit(1);
  }
}

// 직접 실행된 경우에만 벤치마크 실행
if (require.main === module) {
  runBenchmark();
}

export default PrismaBenchmark;
