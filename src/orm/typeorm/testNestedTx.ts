import { getTypeORMDataSource } from "./config";
import { MedicalRecord } from "./entities/MedicalRecord";
import { Patient } from "./entities/Patient";
import { Payment } from "./entities/Payment";
import { Treatment } from "./entities/Treatment";
import { Reservation } from "./entities/Reservation";
import { EntityManager } from "typeorm";
import {
  Gender,
  ReservationStatus,
  PaymentStatus,
  PaymentMethod,
} from "../../types";
import { setTimeout } from "timers/promises";
import { CRMDataGenerator } from "src/utils/faker";

const dataSource = getTypeORMDataSource();
const crmDataGenerator = new CRMDataGenerator();
const mid = Math.floor(Math.random() * 1234) + 1234;
crmDataGenerator.setPhoneNumberMidSeq(mid);
const last = Math.floor(Math.random() * 1234) + 1234;
crmDataGenerator.setPhoneNumberLastSeq(last);

// 실행
async function runTests() {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  console.log("=".repeat(50));
  await testNestedTransactionSuccess();

  console.log("\n" + "=".repeat(50));
  await testNestedTransactionFailure();
}

// 스크립트 직접 실행시
if (require.main === module) {
  runTests()
    .catch(console.error)
    .finally(() => dataSource.destroy());
}

// 메인 테스트 함수 - 성공 시나리오
async function testNestedTransactionSuccess() {
  console.log("🚀 중첩 트랜잭션 테스트 시작 (성공 시나리오)");

  try {
    await dataSource.transaction(async (manager) => {
      // 1단계: 예약 생성
      const { patient, reservation } = await createReservationStep(manager);

      // 2단계: 진료 및 치료
      const { medicalRecord, treatment } = await medicalTreatmentStep(
        manager,
        patient.id
      );

      // 3단계: 결제 준비
      const { payment } = await preparePaymentStep(manager, patient.id);

      // 4단계: 결제 완료
      await completePaymentStep(manager, payment.id, false); // 성공 시나리오

      console.log("🎉 모든 단계 완료! 트랜잭션 커밋됩니다.");
    });

    console.log("✅ 트랜잭션 성공적으로 완료");
  } catch (error) {
    console.error("❌ 트랜잭션 실패:", error);
  }
}

// 메인 테스트 함수 - 실패 시나리오 (결제 단계에서 실패)
async function testNestedTransactionFailure() {
  console.log("🚀 중첩 트랜잭션 테스트 시작 (실패 시나리오)");

  try {
    await dataSource.transaction(async (manager) => {
      // 1단계: 예약 생성
      const { patient, reservation } = await createReservationStep(manager);

      // 2단계: 진료 및 치료
      const { medicalRecord, treatment } = await medicalTreatmentStep(
        manager,
        patient.id
      );

      // 3단계: 결제 준비
      const { payment } = await preparePaymentStep(manager, patient.id);

      try {
        // 4단계: 결제 완료 (실패 시나리오)
        await completePaymentStep(manager, payment.id, true); // 실패 시나리오
      } catch (paymentError) {
        console.log("💡 결제 실패 - 이전 단계는 유지됩니다.");
        // Note: With nested transactions using manager.transaction(),
        // rolling back to a specific savepoint is not directly supported
        // like with raw SQL savepoints. The inner transaction will just fail
        // and the outer transaction can catch it. If you need explicit
        // savepoint rollback behavior, you might need to use raw queries or
        // rethink the transaction structure.

        // 결제 실패 상태로 다시 업데이트 (이전 트랜잭션에서 이미 실패했으므로 여기서 다시 업데이트할 필요는 없음)
        // await manager.update(Payment, payment.id, {
        //   status: PaymentStatus.FAILED,
        // });

        console.log("⚠️ 결제는 실패했지만 다른 단계는 유지됩니다.");
      }

      console.log("🎯 트랜잭션 부분 완료 (결제 제외)");
    });

    console.log("✅ 트랜잭션 완료 (결제 실패 처리됨)");
  } catch (error) {
    console.error("❌ 전체 트랜잭션 실패:", error);
  }
}

// 1. 예약 단계: 환자 생성 및 예약 생성
async function createReservationStep(manager: EntityManager) {
  console.log("🏥 1단계: 예약 생성 시작");
  return await manager.transaction(async (txManager) => {
    const patientRepo = txManager.getRepository(Patient);
    const reservationRepo = txManager.getRepository(Reservation);

    // 환자 생성
    const patient = patientRepo.create({
      name: "김철수",
      gender: Gender.MALE,
      birthDate: new Date("1990-05-15"),
      phone: crmDataGenerator.getPhoneNumber(),
      address: "서울시 강남구",
      email: "kimcs@example.com",
      firstVisitAt: new Date(),
    });
    const savedPatient = await patientRepo.save(patient);
    console.log(`✅ 환자 생성 완료: ID ${savedPatient.id}`);

    // 예약 생성
    const reservation = reservationRepo.create({
      patientId: savedPatient.id,
      reservedAt: new Date(),
      department: "피부과",
      doctor: "이영희",
      status: ReservationStatus.SCHEDULED,
      notes: "여드름 치료 상담",
    });
    const savedReservation = await reservationRepo.save(reservation);
    console.log(`✅ 예약 생성 완료: ID ${savedReservation.id}`);

    return { patient: savedPatient, reservation: savedReservation };
  });
}

// 2. 진료 단계: 진료기록 및 치료 생성, 예약 상태 변경
async function medicalTreatmentStep(manager: EntityManager, patientId: number) {
  console.log("🩺 2단계: 진료 및 치료 시작");
  return await manager.transaction(async (txManager) => {
    const reservationRepo = txManager.getRepository(Reservation);
    const medicalRecordRepo = txManager.getRepository(MedicalRecord);
    const treatmentRepo = txManager.getRepository(Treatment);

    // scheduled 상태의 예약 조회
    const reservation = await reservationRepo.findOne({
      where: { patientId, status: ReservationStatus.SCHEDULED },
    });

    if (!reservation) {
      throw new Error("예약된 진료를 찾을 수 없습니다.");
    }

    // 진료기록 생성
    const medicalRecord = medicalRecordRepo.create({
      patientId,
      doctor: "이영희",
      visitDate: new Date(),
      symptoms: "얼굴 여드름, 염증성 병변",
      diagnosis: "중등도 여드름",
      prescription: "트레티노인 크림, 독시사이클린",
      notes: "4주 후 재방문 예정",
    });

    const savedRecord = await medicalRecordRepo.save(medicalRecord);
    console.log(`✅ 진료기록 생성 완료: ID ${savedRecord.id}`);

    // 치료 생성
    const treatment = treatmentRepo.create({
      recordId: savedRecord.id,
      treatmentName: "여드름 압출 치료",
      price: 150000,
      startedAt: new Date(),
      endedAt: new Date(Date.now() + 30 * 60 * 1000), // 30분 후
      duration: 30,
      notes: "압출 치료 및 LED 치료 병행",
    });

    const savedTreatment = await treatmentRepo.save(treatment);
    console.log(`✅ 치료 생성 완료: ID ${savedTreatment.id}`);

    // 예약 상태를 completed로 변경
    await reservationRepo.update(reservation.id, {
      status: ReservationStatus.COMPLETED,
    });
    console.log(`✅ 예약 상태 변경 완료: ${ReservationStatus.COMPLETED}`);

    return { medicalRecord: savedRecord, treatment: savedTreatment };
  });
}

// 3. 결제 준비 단계: 수납 대기 상태로 생성
async function preparePaymentStep(manager: EntityManager, patientId: number) {
  console.log("💳 3단계: 결제 준비 시작");
  return await manager.transaction(async (txManager) => {
    const treatmentRepo = txManager.getRepository(Treatment);
    const paymentRepo = txManager.getRepository(Payment);

    // 환자의 치료 내역 조회
    const treatments = await treatmentRepo
      .createQueryBuilder("treatment")
      .innerJoin("treatment.medicalRecord", "record")
      .where("record.patientId = :patientId", { patientId })
      .getMany();

    if (treatments.length === 0) {
      throw new Error("치료 내역을 찾을 수 없습니다.");
    }

    const totalAmount = treatments.reduce(
      (sum, treatment) => sum + Number(treatment.price),
      0
    );

    // 수납 생성 (대기 상태)
    const payment = paymentRepo.create({
      patientId,
      treatmentId: treatments[0].id, // 첫 번째 치료와 연결
      amount: totalAmount,
      method: PaymentMethod.CARD,
      status: PaymentStatus.PENDING,
    });
    const savedPayment = await paymentRepo.save(payment);
    console.log(
      `✅ 수납 생성 완료: ID ${savedPayment.id}, 금액: ${totalAmount}원`
    );

    return { payment: savedPayment, treatments };
  });
}

// 4. 결제 완료 단계: PG사 결제 및 상태 변경
async function completePaymentStep(
  manager: EntityManager,
  paymentId: number,
  shouldFail: boolean = false
) {
  const simulatePGPayment = async (shouldFail: boolean) => {
    await setTimeout(1000);
    return shouldFail
      ? { success: false, errorMessage: "카드 한도 초과" }
      : { success: true, receiptNumber: `RCP-${Date.now()}` };
  };

  console.log("💰 4단계: 결제 완료 처리 시작");
  return await manager.transaction(async (txManager) => {
    const paymentRepo = txManager.getRepository(Payment);

    // PG사 결제 시뮬레이션
    const pgResult = await simulatePGPayment(shouldFail);
    if (pgResult.success) {
      // 결제 성공
      await paymentRepo.update(paymentId, {
        status: PaymentStatus.COMPLETED,
        paidAt: new Date(),
        receiptNumber: pgResult.receiptNumber,
      });
      console.log(`✅ 결제 완료: 영수증 번호 ${pgResult.receiptNumber}`);
    } else {
      // 결제 실패
      await paymentRepo.update(paymentId, {
        status: PaymentStatus.FAILED,
      });
      console.log(`❌ 결제 실패: ${pgResult.errorMessage}`);
      throw new Error(`결제 실패: ${pgResult.errorMessage}`);
    }

    return pgResult;
  });
}
