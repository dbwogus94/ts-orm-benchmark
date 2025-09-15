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
import { ReservationStatus } from "../../../types";
import { Patient } from "./Patient";

@Table({
  tableName: "reservations",
  schema: "sequelize",
  timestamps: true,
  indexes: [
    { fields: ["patient_id"] },
    { fields: ["reserved_at"] },
    { fields: ["status"] },
    { fields: ["doctor"] },
  ],
})
export class Reservation extends Model {
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
    type: DataType.DATE,
    allowNull: false,
    field: "reserved_at",
  })
  reservedAt!: Date;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
  })
  department!: string;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
  })
  doctor!: string;

  @Column({
    type: DataType.ENUM(...Object.values(ReservationStatus)),
    allowNull: false,
    defaultValue: ReservationStatus.SCHEDULED,
  })
  status!: ReservationStatus;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  notes?: string;

  // 관계 설정
  @BelongsTo(() => Patient)
  patient!: Patient;
}
