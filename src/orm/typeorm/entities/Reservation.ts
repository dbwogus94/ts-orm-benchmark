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
import { ReservationStatus } from "../../../types";
import { Patient } from "./Patient";

@Entity("reservations", { schema: "typeorm" })
@Index("idx_reservations_patient_id", ["patientId"])
@Index("idx_reservations_reserved_at", ["reservedAt"])
@Index("idx_reservations_status", ["status"])
@Index("idx_reservations_doctor", ["doctor"])
export class Reservation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int", nullable: false, name: "patient_id" })
  patientId!: number;

  @Column({ type: "timestamp", nullable: false, name: "reserved_at" })
  reservedAt!: Date;

  @Column({ type: "varchar", length: 50, nullable: false })
  department!: string;

  @Column({ type: "varchar", length: 50, nullable: false })
  doctor!: string;

  @Column({
    type: "enum",
    enum: ReservationStatus,
    nullable: false,
    default: ReservationStatus.SCHEDULED,
  })
  status!: ReservationStatus;

  @Column({ type: "text", nullable: true })
  notes?: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  // 관계 설정
  @ManyToOne(() => Patient, (patient) => patient.reservations, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "patient_id" })
  patient!: Patient;
}
