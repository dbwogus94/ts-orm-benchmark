import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from "typeorm";
import { Gender } from "../../../types";
import { Reservation } from "./Reservation";
import { MedicalRecord } from "./MedicalRecord";
import { Payment } from "./Payment";

@Entity("patients", { schema: "typeorm" })
@Index("idx_patients_phone", ["phone"])
@Index("idx_patients_first_visit_at", ["firstVisitAt"])
@Index("idx_patients_last_visit_at", ["lastVisitAt"])
@Index("idx_patients_created_at", ["createdAt"])
export class Patient {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 100, nullable: false })
  name!: string;

  @Column({
    type: "enum",
    enum: Gender,
    nullable: false,
  })
  gender!: Gender;

  @Column({ type: "date", nullable: false, name: "birth_date" })
  birthDate!: Date;

  @Column({ type: "varchar", length: 20, nullable: false, unique: true })
  phone!: string;

  @Column({ type: "varchar", length: 200, nullable: true })
  address?: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  email?: string;

  @Column({ type: "timestamp", nullable: false, name: "first_visit_at" })
  firstVisitAt!: Date;

  @Column({ type: "timestamp", nullable: true, name: "last_visit_at" })
  lastVisitAt?: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  // 관계 설정
  @OneToMany(() => Reservation, (reservation) => reservation.patient, {
    cascade: true,
  })
  reservations!: Reservation[];

  @OneToMany(() => MedicalRecord, (record) => record.patient, {
    cascade: true,
  })
  medicalRecords!: MedicalRecord[];

  @OneToMany(() => Payment, (payment) => payment.patient, { cascade: true })
  payments!: Payment[];
}
