import * as chalk from "chalk";
import { subDays } from "../../utils/date";
import { Op, QueryTypes } from "sequelize";
import { BaseBenchmark } from "../../benchmark/base";
import { BenchmarkResult } from "../../types";
import { BenchmarkReporter } from "../../benchmark/reporter";

import {
  closeSequelize,
  getSequelizeInstance,
  initializeSequelize,
} from "./config";
import { MedicalRecord } from "./models/MedicalRecord";
import { Patient } from "./models/Patient";
import { Payment } from "./models/Payment";
import { Reservation } from "./models/Reservation";
import { Treatment } from "./models/Treatment";

/**
 * Sequelize 벤치마크 구현
 */
class SequelizeBenchmark extends BaseBenchmark {
  constructor() {
    super("Sequelize");
  }

  async initialize(): Promise<void> {
    await initializeSequelize();
  }

  async cleanup(): Promise<void> {
    await closeSequelize();
  }

  async simpleRead(limit = 1000, offset = 0): Promise<BenchmarkResult> {
    return this.runBenchmark(
      async () => {
        const patients = await Patient.findAll({
          limit,
          offset,
          order: [["id", "ASC"]],
        });
        return patients;
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
        const patients = await Patient.bulkCreate(patientData);
        return patients;
      },
      `Simple Write (${count} records)`,
      count
    );
  }

  async complexTransaction(count: number): Promise<BenchmarkResult> {
    return this.runBenchmark(
      async () => {
        const sequelize = getSequelizeInstance();
        const results = [];

        for (let i = 0; i < count; i++) {
          const result = await sequelize.transaction(async (t) => {
            // 환자 생성
            const patient = await Patient.create(
              this.crMDataGenerator.generatePatient(),
              { transaction: t }
            );

            // 예약 생성
            const reservation = await Reservation.create(
              {
                ...this.crMDataGenerator.generateReservation(patient.id),
                patientId: patient.id,
              },
              { transaction: t }
            );

            // 진료기록 생성
            const medicalRecord = await MedicalRecord.create(
              {
                ...this.crMDataGenerator.generateMedicalRecord(patient.id),
                patientId: patient.id,
              },
              { transaction: t }
            );

            // 시술 생성
            const treatment = await Treatment.create(
              {
                ...this.crMDataGenerator.generateTreatment(medicalRecord.id),
                recordId: medicalRecord.id,
              },
              { transaction: t }
            );

            // 결제 생성
            const payment = await Payment.create(
              {
                ...this.crMDataGenerator.generatePayment(
                  patient.id,
                  treatment.id,
                  treatment.price
                ),
                patientId: patient.id,
                treatmentId: treatment.id,
              },
              { transaction: t }
            );

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
        const sequelize = getSequelizeInstance();
        const startDate = subDays(new Date(), days);

        const stats = await sequelize.query(
          `
        SELECT 
          DATE(first_visit_at) as date,
          COUNT(*) as new_patients,
          COUNT(DISTINCT id) as total_visits
        FROM sequelize.patients 
        WHERE first_visit_at >= :startDate
        GROUP BY DATE(first_visit_at)
        ORDER BY date DESC
      `,
          {
            replacements: { startDate: startDate.toISOString() },
            type: QueryTypes.SELECT,
          }
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
        const sequelize = getSequelizeInstance();

        const stats = await sequelize.query(
          `
        SELECT 
          mr.doctor,
          COUNT(t.id) as treatment_count,
          SUM(t.price) as total_revenue,
          AVG(t.price) as average_revenue
        FROM sequelize.medical_records mr
        JOIN sequelize.treatments t ON mr.id = t.record_id
        GROUP BY mr.doctor
        ORDER BY total_revenue DESC
        LIMIT :limit
      `,
          {
            replacements: { limit },
            type: QueryTypes.SELECT,
          }
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
        const result = await Patient.update(
          { lastVisitAt: new Date() },
          {
            where: {
              id: {
                [Op.in]: await Patient.findAll({
                  attributes: ["id"],
                  limit: count,
                  order: [["id", "ASC"]],
                }).then((patients) => patients.map((p) => p.id)),
              },
            },
          }
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
        const result = await Patient.destroy({
          where: {
            firstVisitAt: {
              [Op.lt]: cutoffDate,
            },
          },
        });

        return result;
      },
      `Bulk Delete (older than ${olderThanDays} days)`,
      olderThanDays
    );
  }

  async nestedInsert(count: number): Promise<BenchmarkResult> {
    return this.runBenchmark(
      async () => {
        const sequelize = getSequelizeInstance();
        const results = [];
        for (let i = 0; i < count; i++) {
          const data = this.crMDataGenerator.generateNestedPatient();
          const result = await sequelize.transaction(async (t) => {
            return await Patient.create(data, {
              include: [
                Reservation,
                {
                  model: MedicalRecord,
                  include: [Treatment],
                },
                Payment,
              ],
              transaction: t,
            });
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
  console.log(chalk.blue("🏁 Starting Sequelize Benchmarks"));

  const benchmark = new SequelizeBenchmark();

  try {
    const results = await benchmark.runAll();

    // 결과 출력
    console.log(chalk.green("✅ Sequelize Benchmarks Completed!"));
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
    console.error(chalk.red("❌ Sequelize benchmark failed:"), error);
    process.exit(1);
  }
}

// 직접 실행된 경우에만 벤치마크 실행
if (require.main === module) {
  type BenchmarkReportMode = "file" | "console" | "all";
  const BENCHMARK_REPORT_MODE = process.env
    .BENCHMARK_REPORT_MODE as BenchmarkReportMode;
  const reporter = new BenchmarkReporter();

  const report = (result: BenchmarkResult[]) => {
    const filePrefix = "sequelize";
    reporter.addResults(result);
    switch (BENCHMARK_REPORT_MODE) {
      case "all":
        reporter.printConsoleReport();
        reporter.saveToJSON(`${filePrefix}.json`);
        reporter.saveToCSV(`${filePrefix}.csv`);
        reporter.saveToMarkdown(`${filePrefix}.md`);
        break;
      case "file":
        reporter.saveToJSON(`${filePrefix}.json`);
        reporter.saveToCSV(`${filePrefix}.csv`);
        reporter.saveToMarkdown(`${filePrefix}.md`);
        break;
      case "console":
      default:
        reporter.printConsoleReport();
        break;
    }
  };
  runBenchmark().then((result) => report(result));
}

export default SequelizeBenchmark;
