import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
  PrimaryKey,
  AutoIncrement,
} from "sequelize-typescript";
import { Patient } from "./Patient";
import { Treatment } from "./Treatment";

@Table({
  tableName: "medical_records",
  schema: "sequelize",
  timestamps: true,
  indexes: [
    { fields: ["patient_id"] },
    { fields: ["visit_date"] },
    { fields: ["doctor"] },
  ],
})
export class MedicalRecord extends Model {
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

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
  })
  doctor!: string;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: "visit_date",
  })
  visitDate!: Date;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  symptoms!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  diagnosis!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  prescription?: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  notes?: string;

  // 관계 설정
  @BelongsTo(() => Patient)
  patient!: Patient;

  @HasMany(() => Treatment)
  treatments!: Treatment[];
}
