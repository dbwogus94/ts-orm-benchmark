// 공통 타입 정의

export enum Gender {
  MALE = "male",
  FEMALE = "female",
  OTHER = "other",
}

export enum ReservationStatus {
  SCHEDULED = "scheduled",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  NO_SHOW = "no_show",
}

export enum PaymentMethod {
  CASH = "cash",
  CARD = "card",
  INSURANCE = "insurance",
  BANK_TRANSFER = "bank_transfer",
}

export enum PaymentStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  FAILED = "failed",
  REFUNDED = "refunded",
}

// 피부과 CRM 도메인 인터페이스
export interface PatientData {
  id?: number;
  name: string;
  gender: Gender;
  birthDate: Date;
  phone: string;
  address?: string;
  email?: string;
  firstVisitAt: Date;
  lastVisitAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ReservationData {
  id?: number;
  patientId: number;
  reservedAt: Date;
  department: string;
  doctor: string;
  status: ReservationStatus;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MedicalRecordData {
  id?: number;
  patientId: number;
  doctor: string;
  visitDate: Date;
  symptoms: string;
  diagnosis: string;
  prescription?: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TreatmentData {
  id?: number;
  recordId: number;
  treatmentName: string;
  price: number;
  startedAt: Date;
  endedAt?: Date;
  duration?: number; // in minutes
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PaymentData {
  id?: number;
  patientId: number;
  treatmentId?: number;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt?: Date;
  receiptNumber?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// 벤치마크 결과 인터페이스
export interface BenchmarkResult {
  operation: string;
  orm: string;
  totalRecords: number;
  duration: number; // milliseconds
  averageTime: number; // milliseconds per operation
  memoryUsage?: {
    used: number;
    total: number;
  };
  timestamp: Date;
}

// 통계 쿼리 결과 인터페이스
export interface DailyPatientStats {
  date: string;
  newPatients: number;
  totalVisits: number;
  totalRevenue: number;
}

export interface DoctorPerformanceStats {
  doctor: string;
  treatmentCount: number;
  totalRevenue: number;
  averageRevenue: number;
}

export interface TreatmentStats {
  treatmentName: string;
  count: number;
  totalRevenue: number;
  averagePrice: number;
}

// ORM 공통 인터페이스
export interface ORMInterface {
  name: string;
  initialize(): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  migrate(): Promise<void>;
  seed(count: number): Promise<void>;
  benchmark(): Promise<BenchmarkResult[]>;
  cleanup(): Promise<void>;
}
