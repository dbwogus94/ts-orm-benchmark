#!/usr/bin/env ts-node
import * as chalk from "chalk";
import { initializePrisma, getPrismaClient, closePrisma } from "./config";
import { CRMDataGenerator } from "../../utils/faker";
import { measurePerformance } from "../../utils/database";

const BATCH_SIZE = parseInt(process.env.BENCHMARK_BATCH_SIZE || "1000");
const TOTAL_RECORDS = parseInt(process.env.BENCHMARK_TOTAL_RECORDS || "100000");

/**
 * ❌ Prisma 시드 데이터 생성 - nested create 방식 사용 (매우 느림)
 * - 이슈로 사용 금지
 *
 * 이슈
 * - prisma는 nested create를 사용해도 내부적으로 개별 insert 쿼리로 실행되어 매우 느리다.
 * - 안정성과 매핑 능력은 뛰어나지만 batch size가 크면 클수록 느려지는 것은 잘 알려진 문제이다.
 * - 이유:
 *    - 각 엔티티/연관 관계를 개별 insert 쿼리로 실행
 *    - 내부적으로 implicit transaction, FKs, trigger 등 DB 작업이 수십~수백 배로 늘어남
 *    - Prisma의 create({ data: { ... 포함 ... } })는 각 관계마다 쿼리를 따로 실행 → batch 단위로도 수백 ms~수초까지 소요
 */
async function seedNestedCreate() {
  console.log(chalk.blue("🚀 Starting Prisma seeding..."));
  console.log(
    chalk.gray(
      `Target: ${TOTAL_RECORDS.toLocaleString()} patients with related data`
    )
  );

  try {
    await initializePrisma();
    const prisma = getPrismaClient();
    const crmDataGenerator = new CRMDataGenerator();

    // 기존 데이터 정리
    console.log(chalk.yellow("🧹 Cleaning existing data..."));
    await prisma.payment.deleteMany();
    await prisma.treatment.deleteMany();
    await prisma.medicalRecord.deleteMany();
    await prisma.reservation.deleteMany();
    await prisma.patient.deleteMany();

    const startTime = Date.now();
    let totalInserted = 0;

    // 배치 단위로 데이터 생성
    for (let i = 0; i < TOTAL_RECORDS; i += BATCH_SIZE) {
      const batchSize = Math.min(BATCH_SIZE, TOTAL_RECORDS - i);

      await measurePerformance(async () => {
        await prisma.$transaction(
          async (tx) => {
            // 환자 데이터 생성
            const patientData = Array.from({ length: batchSize }, () =>
              crmDataGenerator.generatePatient()
            );

            for (const patient of patientData) {
              // 환자별 개별 생성 (Prisma는 nested create를 지원)
              await tx.patient.create({
                data: {
                  ...patient,
                  reservations: {
                    create: (() => {
                      // 예약 데이터 (1-15개, 50%는 1회만)
                      let reservationCount;
                      if (Math.random() < 0.5) {
                        reservationCount = 1; // 50% 확률로 1회만
                      } else {
                        reservationCount = Math.floor(Math.random() * 14) + 2; // 2-15회
                      }

                      return Array.from({ length: reservationCount }, () => {
                        const reservation =
                          crmDataGenerator.generateReservation(0);
                        const { patientId, ...reservationData } = reservation;
                        return reservationData;
                      });
                    })(),
                  },
                  medicalRecords: {
                    create: Array.from(
                      { length: Math.floor(Math.random() * 6) + 3 }, // 3-8개
                      () => {
                        const record =
                          crmDataGenerator.generateMedicalRecord(0);
                        const { patientId, ...recordData } = record;
                        return {
                          ...recordData,
                          treatments: {
                            create: [
                              (() => {
                                // 진료기록당 1개의 시술 (정합성 유지)
                                const treatment =
                                  crmDataGenerator.generateTreatment(0);
                                const { recordId, ...treatmentData } =
                                  treatment;
                                return treatmentData;
                              })(),
                            ],
                          },
                        };
                      }
                    ),
                  },
                  payments: {
                    create: (() => {
                      // 결제 데이터 (예약 기반으로 생성)
                      let reservationCount;
                      if (Math.random() < 0.5) {
                        reservationCount = 1;
                      } else {
                        reservationCount = Math.floor(Math.random() * 14) + 2;
                      }

                      const payments = [];
                      for (let j = 0; j < reservationCount; j++) {
                        const rand = Math.random();

                        if (rand < 0.9) {
                          // 90% - 성공한 결제 1개
                          const payment = crmDataGenerator.generatePayment(0);
                          const { patientId, ...paymentData } = payment;
                          payments.push(paymentData);
                        } else {
                          // 10% - 복잡한 결제 시나리오
                          const scenario = Math.random();

                          if (scenario < 0.4) {
                            // 결제 실패 후 재결제 성공
                            const failedPayment =
                              crmDataGenerator.generatePayment(0);
                            const { patientId: pid1, ...failedData } =
                              failedPayment;
                            payments.push({ ...failedData, status: "failed" });

                            const successPayment =
                              crmDataGenerator.generatePayment(0);
                            const { patientId: pid2, ...successData } =
                              successPayment;
                            payments.push({
                              ...successData,
                              status: "completed",
                            });
                          } else if (scenario < 0.7) {
                            // 결제 후 환불
                            const completedPayment =
                              crmDataGenerator.generatePayment(0);
                            const { patientId: pid1, ...completedData } =
                              completedPayment;
                            payments.push({
                              ...completedData,
                              status: "completed",
                            });

                            const refundPayment =
                              crmDataGenerator.generatePayment(0);
                            const { patientId: pid2, ...refundData } =
                              refundPayment;
                            payments.push({
                              ...refundData,
                              status: "refunded",
                            });
                          } else {
                            // 결제 대기 상태
                            const pendingPayment =
                              crmDataGenerator.generatePayment(0);
                            const { patientId, ...pendingData } =
                              pendingPayment;
                            payments.push({
                              ...pendingData,
                              status: "pending",
                            });
                          }
                        }
                      }
                      return payments;
                    })(),
                  },
                },
              });
            }
          },
          {
            timeout: 60000, // 60초 타임아웃
          }
        );

        totalInserted += batchSize;
        const progress = ((totalInserted / TOTAL_RECORDS) * 100).toFixed(1);
        console.log(
          chalk.green(
            `✅ Batch ${Math.ceil(totalInserted / BATCH_SIZE)}: ${totalInserted.toLocaleString()} patients (${progress}%)`
          )
        );
      }, `Prisma Batch Insert (${batchSize} records)`);
    }

    const duration = Date.now() - startTime;

    // 통계 출력
    const stats = await getStatistics(prisma);

    console.log(chalk.green("✅ Prisma seeding completed successfully!"));
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
    console.error(chalk.red("❌ Prisma seeding failed:"), error);
    process.exit(1);
  } finally {
    await closePrisma();
  }
}

/**
 * Prisma 시드 데이터 생성 (Flat Insert 방식)
 *
 * 성능 최적화 전략:
 * - nested create 대신 createMany를 사용한 flat insert
 * - 테이블별로 순차적으로 대량 insert (Patient → Reservation → MedicalRecord → Treatment → Payment)
 * - FK 매핑을 통한 관계 연결 (nested create 금지)
 * - 배치 단위로 메모리 효율적인 처리
 */
async function seedFlatInsert() {
  console.log(chalk.blue("🚀 Starting Prisma seeding (Flat Insert Mode)..."));
  console.log(
    chalk.gray(
      `Target: ${TOTAL_RECORDS.toLocaleString()} patients with related data`
    )
  );

  try {
    await initializePrisma();
    const prisma = getPrismaClient();
    const crmDataGenerator = new CRMDataGenerator();

    // 기존 데이터 정리
    console.log(chalk.yellow("🧹 Cleaning existing data..."));
    await prisma.payment.deleteMany();
    await prisma.treatment.deleteMany();
    await prisma.medicalRecord.deleteMany();
    await prisma.reservation.deleteMany();
    await prisma.patient.deleteMany();

    const startTime = Date.now();

    // 1단계: 환자 데이터 대량 생성 및 insert
    console.log(chalk.blue("👥 Step 1: Creating patients..."));
    const patients = await createPatientsInBatches(prisma, crmDataGenerator);

    // 2단계: 예약 데이터 생성 및 insert
    console.log(chalk.blue("📅 Step 2: Creating reservations..."));
    const reservations = await createReservationsInBatches(
      prisma,
      crmDataGenerator,
      patients
    );

    // 3단계: 진료기록 데이터 생성 및 insert
    console.log(chalk.blue("🏥 Step 3: Creating medical records..."));
    const medicalRecords = await createMedicalRecordsInBatches(
      prisma,
      crmDataGenerator,
      patients
    );

    // 4단계: 시술 데이터 생성 및 insert
    console.log(chalk.blue("💉 Step 4: Creating treatments..."));
    const treatments = await createTreatmentsInBatches(
      prisma,
      crmDataGenerator,
      medicalRecords
    );

    // 5단계: 결제 데이터 생성 및 insert
    console.log(chalk.blue("💳 Step 5: Creating payments..."));
    await createPaymentsInBatches(
      prisma,
      crmDataGenerator,
      patients,
      treatments
    );

    const duration = Date.now() - startTime;

    // 통계 출력
    const stats = await getStatistics(prisma);

    console.log(chalk.green("✅ Prisma seeding completed successfully!"));
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
    console.error(chalk.red("❌ Prisma seeding failed:"), error);
    process.exit(1);
  } finally {
    await closePrisma();
  }
}

/**
 * 환자 데이터를 배치 단위로 생성하고 insert
 */
async function createPatientsInBatches(
  prisma: any,
  crmDataGenerator: CRMDataGenerator
) {
  const patients: (typeof prisma.patient)[] = [];
  let totalInserted = 0;

  for (let i = 0; i < TOTAL_RECORDS; i += BATCH_SIZE) {
    const batchSize = Math.min(BATCH_SIZE, TOTAL_RECORDS - i);

    await measurePerformance(async () => {
      const patientData = Array.from({ length: batchSize }, () =>
        crmDataGenerator.generatePatient()
      );

      const result = await prisma.patient.createMany({
        data: patientData,
        skipDuplicates: true,
      });

      // 생성된 환자들의 ID를 가져와서 저장
      const createdPatients = await prisma.patient.findMany({
        where: {
          id: {
            gte: totalInserted + 1,
            lte: totalInserted + result.count,
          },
        },
        select: { id: true },
        orderBy: { id: "asc" },
      });

      patients.push(...createdPatients);
      totalInserted += result.count;

      const progress = ((totalInserted / TOTAL_RECORDS) * 100).toFixed(1);
      console.log(
        chalk.green(
          `✅ Patients: ${totalInserted.toLocaleString()}/${TOTAL_RECORDS.toLocaleString()} (${progress}%)`
        )
      );
    }, `Patient Batch Insert (${batchSize} records)`);
  }

  return patients;
}

/**
 * 예약 데이터를 배치 단위로 생성하고 insert
 */
async function createReservationsInBatches(
  prisma: any,
  crmDataGenerator: CRMDataGenerator,
  patients: any[]
) {
  const reservations: any[] = [];
  let totalInserted = 0;
  const totalReservations = patients.length * 2; // 환자당 평균 2개 예약

  for (let i = 0; i < patients.length; i += BATCH_SIZE) {
    const batchPatients = patients.slice(i, i + BATCH_SIZE);
    const batchReservations: any[] = [];

    // 각 환자별로 예약 데이터 생성
    for (const patient of batchPatients) {
      // 예약 데이터 (1-15개, 50%는 1회만)
      let reservationCount;
      if (Math.random() < 0.5) {
        reservationCount = 1; // 50% 확률로 1회만
      } else {
        reservationCount = Math.floor(Math.random() * 14) + 2; // 2-15회
      }

      for (let j = 0; j < reservationCount; j++) {
        const reservation = crmDataGenerator.generateReservation(patient.id);
        batchReservations.push(reservation);
      }
    }

    if (batchReservations.length > 0) {
      await measurePerformance(async () => {
        const result = await prisma.reservation.createMany({
          data: batchReservations,
          skipDuplicates: true,
        });

        // 생성된 예약들의 ID를 가져와서 저장
        const createdReservations = await prisma.reservation.findMany({
          where: {
            id: {
              gte: totalInserted + 1,
              lte: totalInserted + result.count,
            },
          },
          select: { id: true, patientId: true },
          orderBy: { id: "asc" },
        });

        reservations.push(...createdReservations);
        totalInserted += result.count;

        const progress = ((totalInserted / totalReservations) * 100).toFixed(1);
        console.log(
          chalk.green(
            `✅ Reservations: ${totalInserted.toLocaleString()}/${totalReservations.toLocaleString()} (${progress}%)`
          )
        );
      }, `Reservation Batch Insert (${batchReservations.length} records)`);
    }
  }

  return reservations;
}

/**
 * 진료기록 데이터를 배치 단위로 생성하고 insert
 */
async function createMedicalRecordsInBatches(
  prisma: any,
  crmDataGenerator: CRMDataGenerator,
  patients: any[]
) {
  const medicalRecords: any[] = [];
  let totalInserted = 0;
  const totalRecords = patients.length * 1.5; // 환자당 평균 1.5개 진료기록

  for (let i = 0; i < patients.length; i += BATCH_SIZE) {
    const batchPatients = patients.slice(i, i + BATCH_SIZE);
    const batchRecords: any[] = [];

    // 각 환자별로 진료기록 데이터 생성
    for (const patient of batchPatients) {
      const recordCount = Math.floor(Math.random() * 6) + 3; // 3-8개
      for (let j = 0; j < recordCount; j++) {
        const record = crmDataGenerator.generateMedicalRecord(patient.id);
        batchRecords.push(record);
      }
    }

    if (batchRecords.length > 0) {
      await measurePerformance(async () => {
        const result = await prisma.medicalRecord.createMany({
          data: batchRecords,
          skipDuplicates: true,
        });

        // 생성된 진료기록들의 ID를 가져와서 저장
        const createdRecords = await prisma.medicalRecord.findMany({
          where: {
            id: {
              gte: totalInserted + 1,
              lte: totalInserted + result.count,
            },
          },
          select: { id: true, patientId: true },
          orderBy: { id: "asc" },
        });

        medicalRecords.push(...createdRecords);
        totalInserted += result.count;

        const progress = ((totalInserted / totalRecords) * 100).toFixed(1);
        console.log(
          chalk.green(
            `✅ Medical Records: ${totalInserted.toLocaleString()}/${Math.floor(totalRecords).toLocaleString()} (${progress}%)`
          )
        );
      }, `Medical Record Batch Insert (${batchRecords.length} records)`);
    }
  }

  return medicalRecords;
}

/**
 * 시술 데이터를 배치 단위로 생성하고 insert
 */
async function createTreatmentsInBatches(
  prisma: any,
  crmDataGenerator: CRMDataGenerator,
  medicalRecords: any[]
) {
  const treatments: any[] = [];
  let totalInserted = 0;
  const totalTreatments = medicalRecords.length * 1.5; // 진료기록당 평균 1.5개 시술

  for (let i = 0; i < medicalRecords.length; i += BATCH_SIZE) {
    const batchRecords = medicalRecords.slice(i, i + BATCH_SIZE);
    const batchTreatments: any[] = [];

    // 각 진료기록별로 시술 데이터 생성 (정합성을 위해 1:1 매핑)
    for (const record of batchRecords) {
      const treatment = crmDataGenerator.generateTreatment(record.id);
      batchTreatments.push(treatment);
    }

    if (batchTreatments.length > 0) {
      await measurePerformance(async () => {
        const result = await prisma.treatment.createMany({
          data: batchTreatments,
          skipDuplicates: true,
        });

        // 생성된 시술들의 ID를 가져와서 저장
        const createdTreatments = await prisma.treatment.findMany({
          where: {
            id: {
              gte: totalInserted + 1,
              lte: totalInserted + result.count,
            },
          },
          select: { id: true, recordId: true },
          orderBy: { id: "asc" },
        });

        treatments.push(...createdTreatments);
        totalInserted += result.count;

        const progress = ((totalInserted / totalTreatments) * 100).toFixed(1);
        console.log(
          chalk.green(
            `✅ Treatments: ${totalInserted.toLocaleString()}/${Math.floor(totalTreatments).toLocaleString()} (${progress}%)`
          )
        );
      }, `Treatment Batch Insert (${batchTreatments.length} records)`);
    }
  }

  return treatments;
}

/**
 * 결제 데이터를 배치 단위로 생성하고 insert
 */
async function createPaymentsInBatches(
  prisma: any,
  crmDataGenerator: CRMDataGenerator,
  patients: any[],
  treatments: any[]
) {
  let totalInserted = 0;
  const totalPayments = patients.length * 2; // 환자당 평균 2개 결제

  for (let i = 0; i < patients.length; i += BATCH_SIZE) {
    const batchPatients = patients.slice(i, i + BATCH_SIZE);
    const batchPayments: any[] = [];

    // 각 환자별로 결제 데이터 생성 (예약 기반)
    for (const patient of batchPatients) {
      // 해당 환자의 예약 수를 다시 계산 (동일한 로직 사용)
      let reservationCount;
      if (Math.random() < 0.5) {
        reservationCount = 1;
      } else {
        reservationCount = Math.floor(Math.random() * 14) + 2;
      }

      for (let j = 0; j < reservationCount; j++) {
        const rand = Math.random();

        if (rand < 0.9) {
          // 90% - 성공한 결제 1개
          const payment = crmDataGenerator.generatePayment(patient.id);
          batchPayments.push(payment);
        } else {
          // 10% - 복잡한 결제 시나리오
          const scenario = Math.random();

          if (scenario < 0.4) {
            // 결제 실패 후 재결제 성공
            const failedPayment = crmDataGenerator.generatePayment(patient.id);
            batchPayments.push({ ...failedPayment, status: "failed" });

            const successPayment = crmDataGenerator.generatePayment(patient.id);
            batchPayments.push({ ...successPayment, status: "completed" });
          } else if (scenario < 0.7) {
            // 결제 후 환불
            const completedPayment = crmDataGenerator.generatePayment(
              patient.id
            );
            batchPayments.push({ ...completedPayment, status: "completed" });

            const refundPayment = crmDataGenerator.generatePayment(patient.id);
            batchPayments.push({ ...refundPayment, status: "refunded" });
          } else {
            // 결제 대기 상태
            const pendingPayment = crmDataGenerator.generatePayment(patient.id);
            batchPayments.push({ ...pendingPayment, status: "pending" });
          }
        }
      }
    }

    if (batchPayments.length > 0) {
      await measurePerformance(async () => {
        const result = await prisma.payment.createMany({
          data: batchPayments,
          skipDuplicates: true,
        });

        totalInserted += result.count;

        const progress = ((totalInserted / totalPayments) * 100).toFixed(1);
        console.log(
          chalk.green(
            `✅ Payments: ${totalInserted.toLocaleString()}/${Math.floor(totalPayments).toLocaleString()} (${progress}%)`
          )
        );
      }, `Payment Batch Insert (${batchPayments.length} records)`);
    }
  }
}

/**
 * 데이터베이스 통계 조회
 */
async function getStatistics(prisma: any) {
  const [patients, reservations, medicalRecords, treatments, payments] =
    await Promise.all([
      prisma.patient.count(),
      prisma.reservation.count(),
      prisma.medicalRecord.count(),
      prisma.treatment.count(),
      prisma.payment.count(),
    ]);

  return {
    patients,
    reservations,
    medical_records: medicalRecords,
    treatments,
    payments,
  };
}

async function seed() {
  type PrismaSeedMode = "nested" | "flat";
  const SEED_MODE = process.env.PRISMA_SEED_MODE as PrismaSeedMode;

  if (SEED_MODE === "nested") {
    await seedNestedCreate();
  } else {
    await seedFlatInsert();
  }
}

// 직접 실행된 경우에만 시드 실행
if (require.main === module) {
  seed();
}

export default seed;
