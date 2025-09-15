import {
  Table,
  Column,
  Model,
  DataType,
  HasMany,
  PrimaryKey,
  AutoIncrement,
} from "sequelize-typescript";
import { Gender } from "../../../types";
import { Reservation } from "./Reservation";
import { MedicalRecord } from "./MedicalRecord";
import { Payment } from "./Payment";

@Table({
  tableName: "patients",
  schema: "sequelize",
  timestamps: true,
  indexes: [
    { fields: ["phone"] },
    { fields: ["first_visit_at"] },
    { fields: ["last_visit_at"] },
    { fields: ["created_at"] },
  ],
})
export class Patient extends Model {
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

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
  })
  name!: string;

  @Column({
    type: DataType.ENUM(...Object.values(Gender)),
    allowNull: false,
  })
  gender!: Gender;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: "birth_date",
  })
  birthDate!: Date;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    unique: true,
  })
  phone!: string;

  @Column({
    type: DataType.STRING(200),
    allowNull: true,
  })
  address?: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: true,
  })
  email?: string;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: "first_visit_at",
  })
  firstVisitAt!: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: "last_visit_at",
  })
  lastVisitAt?: Date;

  // 관계 설정
  @HasMany(() => Reservation)
  reservations!: Reservation[];

  @HasMany(() => MedicalRecord)
  medicalRecords!: MedicalRecord[];

  @HasMany(() => Payment)
  payments!: Payment[];
}
