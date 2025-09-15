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
import { MedicalRecord } from "./MedicalRecord";
import { Payment } from "./Payment";

@Table({
  tableName: "treatments",
  schema: "sequelize",
  timestamps: true,
  indexes: [
    { fields: ["record_id"] },
    { fields: ["treatment_name"] },
    { fields: ["started_at"] },
    { fields: ["price"] },
  ],
})
export class Treatment extends Model {
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

  @ForeignKey(() => MedicalRecord)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "record_id",
  })
  recordId!: number;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
    field: "treatment_name",
  })
  treatmentName!: string;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  price!: number;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: "started_at",
  })
  startedAt!: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: "ended_at",
  })
  endedAt?: Date;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  duration?: number;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  notes?: string;

  // 관계 설정
  @BelongsTo(() => MedicalRecord)
  medicalRecord!: MedicalRecord;

  @HasMany(() => Payment)
  payments!: Payment[];
}
