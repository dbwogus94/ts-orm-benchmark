import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { PaymentMethod, PaymentStatus } from "../../../types";
import { Patient } from "./Patient";
import { Treatment } from "./Treatment";

@Entity("payments", { schema: "typeorm" })
@Index("idx_payments_patient_id", ["patientId"])
@Index("idx_payments_treatment_id", ["treatmentId"])
@Index("idx_payments_paid_at", ["paidAt"])
@Index("idx_payments_status", ["status"])
@Index("idx_payments_method", ["method"])
export class Payment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int", nullable: false, name: "patient_id" })
  patientId!: number;

  @Column({ type: "int", nullable: true, name: "treatment_id" })
  treatmentId?: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: false })
  amount!: number;

  @Column({
    type: "enum",
    enum: PaymentMethod,
    nullable: false,
  })
  method!: PaymentMethod;

  @Column({
    type: "enum",
    enum: PaymentStatus,
    nullable: false,
    default: PaymentStatus.PENDING,
  })
  status!: PaymentStatus;

  @Column({ type: "timestamp", nullable: true, name: "paid_at" })
  paidAt?: Date;

  @Column({
    type: "varchar",
    length: 50,
    nullable: true,
    name: "receipt_number",
  })
  receiptNumber?: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  // 관계 설정
  @ManyToOne(() => Patient, (patient) => patient.payments, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "patient_id" })
  patient!: Patient;

  @ManyToOne(() => Treatment, (treatment) => treatment.payments, {
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "treatment_id" })
  treatment?: Treatment;
}
