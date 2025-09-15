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
import { MedicalRecord } from "./MedicalRecord";
import { Payment } from "./Payment";

@Entity("treatments", { schema: "typeorm" })
@Index("idx_treatments_record_id", ["recordId"])
@Index("idx_treatments_treatment_name", ["treatmentName"])
@Index("idx_treatments_started_at", ["startedAt"])
@Index("idx_treatments_price", ["price"])
export class Treatment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int", nullable: false, name: "record_id" })
  recordId!: number;

  @Column({
    type: "varchar",
    length: 100,
    nullable: false,
    name: "treatment_name",
  })
  treatmentName!: string;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: false })
  price!: number;

  @Column({ type: "timestamp", nullable: false, name: "started_at" })
  startedAt!: Date;

  @Column({ type: "timestamp", nullable: true, name: "ended_at" })
  endedAt?: Date;

  @Column({ type: "int", nullable: true })
  duration?: number;

  @Column({ type: "text", nullable: true })
  notes?: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  // 관계 설정
  @ManyToOne(() => MedicalRecord, (record) => record.treatments, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "record_id" })
  medicalRecord!: MedicalRecord;

  @OneToMany(() => Payment, (payment) => payment.treatment)
  payments!: Payment[];
}
