#!/usr/bin/env ts-node

import * as chalk from "chalk";
import { subDays } from "../../utils/date";

import { BaseBenchmark } from "../../benchmark/base";
import { BenchmarkResult } from "../../types";

import { In, LessThan } from "typeorm";
import { getTypeORMDataSource } from "./config";
import { MedicalRecord } from "./entities/MedicalRecord";
import { Patient } from "./entities/Patient";
import { Payment } from "./entities/Payment";
import { Reservation } from "./entities/Reservation";
import { Treatment } from "./entities/Treatment";

/**
 * TypeORM 벤치마크 구현
 */
class TypeORMBenchmark extends BaseBenchmark {
  constructor() {
    super("TypeORM");
  }

  async initialize(): Promise<void> {
    const dataSource = getTypeORMDataSource();
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }
  }

  async cleanup(): Promise<void> {
    const dataSource = getTypeORMDataSource();
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }

  async simpleRead(limit = 1000, offset = 0): Promise<BenchmarkResult> {
    return this.runBenchmark(
      async () => {
        const dataSource = getTypeORMDataSource();
        const result = await dataSource.getRepository(Patient).find({
          order: { id: "ASC" },
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
        const dataSource = getTypeORMDataSource();
        const result = await dataSource
          .getRepository(Patient)
          .save(patientData);
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
          const dataSource = getTypeORMDataSource();
          const result = await dataSource.transaction(async (manager) => {
            // 환자 생성
            const patient = manager.create(
              Patient,
              this.crMDataGenerator.generatePatient()
            );
            await manager.save(patient);

            // 예약 생성
            const reservation = manager.create(Reservation, {
              ...this.crMDataGenerator.generateReservation(patient.id),
              patientId: patient.id,
            });
            await manager.save(reservation);

            // 진료기록 생성
            const medicalRecord = manager.create(MedicalRecord, {
              ...this.crMDataGenerator.generateMedicalRecord(patient.id),
              patientId: patient.id,
            });
            await manager.save(medicalRecord);

            // 시술 생성
            const treatment = manager.create(Treatment, {
              ...this.crMDataGenerator.generateTreatment(medicalRecord.id),
              recordId: medicalRecord.id,
            });
            await manager.save(treatment);

            // 결제 생성
            const payment = manager.create(Payment, {
              ...this.crMDataGenerator.generatePayment(
                patient.id,
                treatment.id,
                treatment.price
              ),
              patientId: patient.id,
              treatmentId: treatment.id,
            });
            await manager.save(payment);

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

        const dataSource = getTypeORMDataSource();
        const stats = await dataSource.query(
          `
          SELECT 
            DATE(first_visit_at) as date,
            COUNT(*) as new_patients,
            COUNT(DISTINCT id) as total_visits
          FROM typeorm.patients 
          WHERE first_visit_at >= $1
          GROUP BY DATE(first_visit_at)
          ORDER BY date DESC
        `,
          [startDate]
        );

        return stats;
      },
      `Simple Stats (${days} days)`,
      days
    );
  }

  async complexStats(limit = 10): Promise<BenchmarkResult> {
    return this.runBenchmark(
      async () => {
        const dataSource = getTypeORMDataSource();
        const stats = await dataSource.query(
          `
          SELECT 
            mr.doctor,
            COUNT(t.id) as treatment_count,
            SUM(t.price) as total_revenue,
            AVG(t.price) as average_revenue
          FROM typeorm.medical_records mr
          JOIN typeorm.treatments t ON mr.id = t.record_id
          JOIN typeorm.payments p ON t.id = p.treatment_id
          GROUP BY mr.doctor
          ORDER BY total_revenue DESC
          LIMIT $1
        `,
          [limit]
        );

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
        const dataSource = getTypeORMDataSource();
        const patientsToUpdate = await dataSource.getRepository(Patient).find({
          select: { id: true },
          order: { id: "ASC" },
          take: count,
        });

        const result = await dataSource
          .getRepository(Patient)
          .update(
            { id: In(patientsToUpdate.map((p) => p.id)) },
            { lastVisitAt: new Date() }
          );

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
        const dataSource = getTypeORMDataSource();
        const result = await dataSource.getRepository(Patient).delete({
          firstVisitAt: LessThan(cutoffDate),
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
        const dataSource = getTypeORMDataSource();
        const results = [];
        for (let i = 0; i < count; i++) {
          const data = this.crMDataGenerator.generateNestedPatient();
          const patient = dataSource.getRepository(Patient).create(data);
          const result = await dataSource.getRepository(Patient).save(patient);
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
  console.log(chalk.blue("🏁 Starting TypeORM Benchmarks"));

  const benchmark = new TypeORMBenchmark();

  try {
    const results = await benchmark.runAll();

    // 결과 출력
    console.log(chalk.green("✅ TypeORM Benchmarks Completed!"));
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
    console.error(chalk.red("❌ TypeORM benchmark failed:"), error);
    process.exit(1);
  }
}

// 직접 실행된 경우에만 벤치마크 실행
if (require.main === module) {
  runBenchmark();
}

export default TypeORMBenchmark;
