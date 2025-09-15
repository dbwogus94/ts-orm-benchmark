import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from "typeorm";
import { Patient } from "./Patient";
import { Treatment } from "./Treatment";

@Entity("medical_records", { schema: "typeorm" })
@Index("idx_medical_records_patient_id", ["patientId"])
@Index("idx_medical_records_visit_date", ["visitDate"])
@Index("idx_medical_records_doctor", ["doctor"])
export class MedicalRecord {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int", nullable: false, name: "patient_id" })
  patientId!: number;

  @Column({ type: "varchar", length: 50, nullable: false })
  doctor!: string;

  @Column({ type: "timestamp", nullable: false, name: "visit_date" })
  visitDate!: Date;

  @Column({ type: "text", nullable: false })
  symptoms!: string;

  @Column({ type: "text", nullable: false })
  diagnosis!: string;

  @Column({ type: "text", nullable: true })
  prescription?: string;

  @Column({ type: "text", nullable: true })
  notes?: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  // 관계 설정
  @ManyToOne(() => Patient, (patient) => patient.medicalRecords, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "patient_id" })
  patient!: Patient;

  @OneToMany(() => Treatment, (treatment) => treatment.medicalRecord, {
    cascade: true,
  })
  treatments!: Treatment[];
}
