import { faker } from "@faker-js/faker/locale/ko";
import {
  PatientData,
  ReservationData,
  MedicalRecordData,
  TreatmentData,
  PaymentData,
  Gender,
  ReservationStatus,
  PaymentMethod,
  PaymentStatus,
} from "../types";

// 한국어 데이터 생성을 위한 Faker 설정
faker.setDefaultRefDate(new Date());

// 피부과 관련 데이터 상수
const DERMATOLOGY_DEPARTMENTS = [
  "일반피부과",
  "미용피부과",
  "모발이식",
  "레이저센터",
  "성형외과",
];

const DOCTORS = [
  "김진수",
  "박미영",
  "이수정",
  "최민호",
  "정영희",
  "강태현",
  "윤소영",
  "임준혁",
  "송지현",
  "한민우",
];

const SYMPTOMS = [
  "여드름",
  "아토피",
  "건선",
  "습진",
  "두드러기",
  "기미",
  "주근깨",
  "점",
  "사마귀",
  "탈모",
  "흉터",
  "주름",
  "색소침착",
  "모공확대",
  "건조증",
];

const TREATMENTS = [
  { name: "IPL 광치료", price: 150000 },
  { name: "프락셀 레이저", price: 200000 },
  { name: "보톡스 주사", price: 100000 },
  { name: "필러 시술", price: 300000 },
  { name: "스킨스케일링", price: 80000 },
  { name: "여드름 압출", price: 50000 },
  { name: "점 제거", price: 30000 },
  { name: "사마귀 제거", price: 40000 },
  { name: "PRP 치료", price: 250000 },
  { name: "모발이식", price: 2000000 },
];

export class CRMDataGenerator {
  #phoneNumberMidSeq = 0;
  #phoneNumberLastSeq = 0;

  setPhoneNumberMidSeq(seq: number) {
    this.#phoneNumberMidSeq = seq;
  }
  setPhoneNumberLastSeq(seq: number) {
    this.#phoneNumberLastSeq = seq;
  }

  incrementPhoneNumberMidSeq() {
    // overflow
    if (this.#phoneNumberMidSeq >= 9999) this.#phoneNumberMidSeq = 0;
    return ++this.#phoneNumberMidSeq;
  }
  incrementPhoneNumberLastSeq() {
    // overflow
    if (this.#phoneNumberLastSeq >= 9999) this.#phoneNumberLastSeq = 0;
    return ++this.#phoneNumberLastSeq;
  }

  getPhoneNumber(): string {
    const mid = this.#phoneNumberMidSeq++;
    const last = this.#phoneNumberLastSeq++;
    return `010-${mid.toString().padStart(4, "0")}-${last.toString().padStart(4, "0")}`;
  }

  /**
   * 환자 데이터 생성
   */
  generatePatient(): Omit<PatientData, "id"> {
    const firstVisitAt = faker.date.between({
      from: "2020-01-01",
      to: new Date(),
    });

    return {
      name: faker.person.fullName(),
      gender: faker.helpers.arrayElement(Object.values(Gender)),
      birthDate: faker.date.birthdate({ min: 18, max: 80, mode: "age" }),
      phone: this.getPhoneNumber(),
      address: faker.location.streetAddress(true),
      email: faker.internet.email(),
      firstVisitAt,
      lastVisitAt: faker.date.between({ from: firstVisitAt, to: new Date() }),
      createdAt: firstVisitAt,
      updatedAt: new Date(),
    };
  }

  /**
   * 예약 데이터 생성
   */
  generateReservation(patientId: number): Omit<ReservationData, "id"> {
    const reservedAt = faker.date.future();

    return {
      patientId,
      reservedAt,
      department: faker.helpers.arrayElement(DERMATOLOGY_DEPARTMENTS),
      doctor: faker.helpers.arrayElement(DOCTORS),
      status: faker.helpers.arrayElement(Object.values(ReservationStatus)),
      notes: Math.random() > 0.7 ? faker.lorem.sentence() : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * 진료기록 데이터 생성
   */
  generateMedicalRecord(patientId: number): Omit<MedicalRecordData, "id"> {
    const visitDate = faker.date.recent({ days: 30 });
    const symptoms = faker.helpers.arrayElements(SYMPTOMS, { min: 1, max: 3 });

    return {
      patientId,
      doctor: faker.helpers.arrayElement(DOCTORS),
      visitDate,
      symptoms: symptoms.join(", "),
      diagnosis: `${symptoms[0]} 진단`,
      prescription:
        Math.random() > 0.5 ? faker.lorem.words(3) + " 처방" : undefined,
      notes: Math.random() > 0.6 ? faker.lorem.sentence() : undefined,
      createdAt: visitDate,
      updatedAt: new Date(),
    };
  }

  /**
   * 시술 데이터 생성
   */
  generateTreatment(recordId: number): Omit<TreatmentData, "id"> {
    const treatment = faker.helpers.arrayElement(TREATMENTS);
    const startedAt = faker.date.recent({ days: 7 });
    const duration = faker.number.int({ min: 30, max: 180 }); // 30분 ~ 3시간

    return {
      recordId,
      treatmentName: treatment.name,
      price: treatment.price + faker.number.int({ min: -20000, max: 50000 }), // 가격 변동
      startedAt,
      endedAt: new Date(startedAt.getTime() + duration * 60 * 1000),
      duration,
      notes: Math.random() > 0.7 ? faker.lorem.sentence() : undefined,
      createdAt: startedAt,
      updatedAt: new Date(),
    };
  }

  /**
   * 결제 데이터 생성
   */
  generatePayment(
    patientId: number,
    treatmentId?: number,
    amount?: number
  ): Omit<PaymentData, "id"> {
    const paymentAmount =
      amount || faker.number.int({ min: 50000, max: 500000 });
    const paidAt = faker.date.recent({ days: 3 });

    return {
      patientId,
      treatmentId,
      amount: paymentAmount,
      method: faker.helpers.arrayElement(Object.values(PaymentMethod)),
      status: faker.helpers.arrayElement(Object.values(PaymentStatus)),
      paidAt: Math.random() > 0.9 ? undefined : paidAt, // 10% 확률로 미결제
      receiptNumber: `RCP-${faker.string.alphanumeric(8).toUpperCase()}`,
      createdAt: paidAt,
      updatedAt: new Date(),
    };
  }

  /**
   * 중첩 삽입 테스트를 위한 환자 데이터 생성
   */
  generateNestedPatient(): Omit<
    PatientData,
    "id" | "createdAt" | "updatedAt"
  > & {
    reservations: Omit<ReservationData, "id" | "patientId">[];
    medicalRecords: (Omit<MedicalRecordData, "id" | "patientId"> & {
      treatments: Omit<TreatmentData, "id" | "recordId">[];
    })[];
    payments: Omit<PaymentData, "id" | "patientId" | "treatmentId">[];
  } {
    const patientData = this.generatePatient();

    const reservations = Array.from({ length: 2 }, () => {
      const { patientId, ...data } = this.generateReservation(0);
      return data;
    });

    const medicalRecords = Array.from({ length: 2 }, () => {
      const { patientId, ...recordData } = this.generateMedicalRecord(0);
      const treatments = Array.from({ length: 2 }, () => {
        const { recordId, ...treatmentData } = this.generateTreatment(0);
        return treatmentData;
      });
      return { ...recordData, treatments };
    });

    const payments = Array.from({ length: 2 }, () => {
      const { patientId, treatmentId, ...paymentData } = this.generatePayment(
        0,
        0
      );
      return paymentData;
    });

    return {
      ...patientData,
      reservations,
      medicalRecords,
      payments,
    };
  }

  /**
   * 완전한 환자 데이터세트 생성 (환자 + 예약 + 진료기록 + 시술 + 결제)
   */
  generateCompletePatientData() {
    const patient = this.generatePatient();
    const reservationCount = faker.number.int({ min: 1, max: 5 });
    const recordCount = faker.number.int({ min: 1, max: 3 });

    // 임시 ID (실제 저장 시 대체됨)
    const patientId = faker.number.int({ min: 1, max: 100000 });

    const reservations = Array.from({ length: reservationCount }, () =>
      this.generateReservation(patientId)
    );

    const records = Array.from({ length: recordCount }, () =>
      this.generateMedicalRecord(patientId)
    );

    const treatments: Array<Omit<TreatmentData, "id">> = [];
    const payments: Array<Omit<PaymentData, "id">> = [];

    records.forEach((_, recordIndex) => {
      const treatmentCount = faker.number.int({ min: 1, max: 3 });
      const recordId = recordIndex + 1; // 임시 ID

      for (let i = 0; i < treatmentCount; i++) {
        const treatment = this.generateTreatment(recordId);
        treatments.push(treatment);

        // 80% 확률로 결제 데이터 생성
        if (Math.random() > 0.2) {
          const payment = this.generatePayment(
            patientId,
            undefined,
            treatment.price
          );
          payments.push(payment);
        }
      }
    });

    return {
      patient,
      reservations,
      records,
      treatments,
      payments,
    };
  }
}
