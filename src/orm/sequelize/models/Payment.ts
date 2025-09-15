import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  PrimaryKey,
  AutoIncrement,
} from "sequelize-typescript";
import { PaymentMethod, PaymentStatus } from "../../../types";
import { Patient } from "./Patient";
import { Treatment } from "./Treatment";

@Table({
  tableName: "payments",
  schema: "sequelize",
  timestamps: true,
  indexes: [
    { fields: ["patient_id"] },
    { fields: ["treatment_id"] },
    { fields: ["paid_at"] },
    { fields: ["status"] },
    { fields: ["method"] },
  ],
})
export class Payment extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id!: number;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: "created_at",
  })
  createdAt!: Date;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: "updated_at",
  })
  updatedAt!: Date;

  @ForeignKey(() => Patient)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "patient_id",
  })
  patientId!: number;

  @ForeignKey(() => Treatment)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: "treatment_id",
  })
  treatmentId?: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  amount!: number;

  @Column({
    type: DataType.ENUM(...Object.values(PaymentMethod)),
    allowNull: false,
  })
  method!: PaymentMethod;

  @Column({
    type: DataType.ENUM(...Object.values(PaymentStatus)),
    allowNull: false,
    defaultValue: PaymentStatus.PENDING,
  })
  status!: PaymentStatus;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: "paid_at",
  })
  paidAt?: Date;

  @Column({
    type: DataType.STRING(50),
    allowNull: true,
    field: "receipt_number",
  })
  receiptNumber?: string;

  // 관계 설정
  @BelongsTo(() => Patient)
  patient!: Patient;

  @BelongsTo(() => Treatment)
  treatment!: Treatment;
}
