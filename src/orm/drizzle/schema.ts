import { relations } from "drizzle-orm";
import {
  decimal,
  index,
  integer,
  pgSchema,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const createDrizzleSchema = (schemaName: string) => {
  const schema = pgSchema(schemaName);

  // Enum 정의
  const genderEnum = schema.enum("gender", ["male", "female", "other"]);
  const reservationStatusEnum = schema.enum("reservation_status", [
    "scheduled",
    "completed",
    "cancelled",
    "no_show",
  ]);
  const paymentMethodEnum = schema.enum("payment_method", [
    "cash",
    "card",
    "insurance",
    "bank_transfer",
  ]);
  const paymentStatusEnum = schema.enum("payment_status", [
    "pending",
    "completed",
    "failed",
    "refunded",
  ]);

  // 테이블 정의
  const patients = schema.table(
    "patients",
    {
      id: serial("id").primaryKey(),
      name: varchar("name", { length: 100 }).notNull(),
      gender: genderEnum("gender").notNull(),
      birthDate: timestamp("birth_date", { mode: "date" }).notNull(),
      phone: varchar("phone", { length: 20 }).notNull().unique(),
      address: varchar("address", { length: 200 }),
      email: varchar("email", { length: 100 }),
      firstVisitAt: timestamp("first_visit_at").notNull(),
      lastVisitAt: timestamp("last_visit_at"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [
      index("idx_patients_phone").on(table.phone),
      index("idx_patients_first_visit_at").on(table.firstVisitAt),
      index("idx_patients_last_visit_at").on(table.lastVisitAt),
      index("idx_patients_created_at").on(table.createdAt),
    ]
  );

  const reservations = schema.table(
    "reservations",
    {
      id: serial("id").primaryKey(),
      patientId: integer("patient_id")
        .notNull()
        .references(() => patients.id, { onDelete: "cascade" }),
      reservedAt: timestamp("reserved_at").notNull(),
      department: varchar("department", { length: 50 }).notNull(),
      doctor: varchar("doctor", { length: 50 }).notNull(),
      status: reservationStatusEnum("status").notNull().default("scheduled"),
      notes: text("notes"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [
      index("idx_reservations_patient_id").on(table.patientId),
      index("idx_reservations_reserved_at").on(table.reservedAt),
      index("idx_reservations_status").on(table.status),
      index("idx_reservations_doctor").on(table.doctor),
    ]
  );

  const medicalRecords = schema.table(
    "medical_records",
    {
      id: serial("id").primaryKey(),
      patientId: integer("patient_id")
        .notNull()
        .references(() => patients.id, { onDelete: "cascade" }),
      doctor: varchar("doctor", { length: 50 }).notNull(),
      visitDate: timestamp("visit_date").notNull(),
      symptoms: text("symptoms").notNull(),
      diagnosis: text("diagnosis").notNull(),
      prescription: text("prescription"),
      notes: text("notes"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [
      index("idx_medical_records_patient_id").on(table.patientId),
      index("idx_medical_records_visit_date").on(table.visitDate),
      index("idx_medical_records_doctor").on(table.doctor),
    ]
  );

  const treatments = schema.table(
    "treatments",
    {
      id: serial("id").primaryKey(),
      recordId: integer("record_id")
        .notNull()
        .references(() => medicalRecords.id, { onDelete: "cascade" }),
      treatmentName: varchar("treatment_name", { length: 100 }).notNull(),
      price: decimal("price", { precision: 10, scale: 2 }).notNull(),
      startedAt: timestamp("started_at").notNull(),
      endedAt: timestamp("ended_at"),
      duration: integer("duration"),
      notes: text("notes"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [
      index("idx_treatments_record_id").on(table.recordId),
      index("idx_treatments_treatment_name").on(table.treatmentName),
      index("idx_treatments_started_at").on(table.startedAt),
      index("idx_treatments_price").on(table.price),
    ]
  );

  const payments = schema.table(
    "payments",
    {
      id: serial("id").primaryKey(),
      patientId: integer("patient_id")
        .notNull()
        .references(() => patients.id, { onDelete: "cascade" }),
      treatmentId: integer("treatment_id").references(() => treatments.id, {
        onDelete: "set null",
      }),
      amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
      method: paymentMethodEnum("method").notNull(),
      status: paymentStatusEnum("status").notNull().default("pending"),
      paidAt: timestamp("paid_at"),
      receiptNumber: varchar("receipt_number", { length: 50 }),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [
      index("idx_payments_patient_id").on(table.patientId),
      index("idx_payments_treatment_id").on(table.treatmentId),
      index("idx_payments_paid_at").on(table.paidAt),
      index("idx_payments_status").on(table.status),
      index("idx_payments_method").on(table.method),
    ]
  );

  // 관계 정의
  const patientsRelations = relations(patients, ({ many }) => ({
    reservations: many(reservations),
    medicalRecords: many(medicalRecords),
    payments: many(payments),
  }));

  const reservationsRelations = relations(reservations, ({ one }) => ({
    patient: one(patients, {
      fields: [reservations.patientId],
      references: [patients.id],
    }),
  }));

  const medicalRecordsRelations = relations(
    medicalRecords,
    ({ one, many }) => ({
      patient: one(patients, {
        fields: [medicalRecords.patientId],
        references: [patients.id],
      }),
      treatments: many(treatments),
    })
  );

  const treatmentsRelations = relations(treatments, ({ one, many }) => ({
    medicalRecord: one(medicalRecords, {
      fields: [treatments.recordId],
      references: [medicalRecords.id],
    }),
    payments: many(payments),
  }));

  const paymentsRelations = relations(payments, ({ one }) => ({
    patient: one(patients, {
      fields: [payments.patientId],
      references: [patients.id],
    }),
    treatment: one(treatments, {
      fields: [payments.treatmentId],
      references: [treatments.id],
    }),
  }));

  return {
    genderEnum,
    reservationStatusEnum,
    paymentMethodEnum,
    paymentStatusEnum,
    patients,
    reservations,
    medicalRecords,
    treatments,
    payments,
    patientsRelations,
    reservationsRelations,
    medicalRecordsRelations,
    treatmentsRelations,
    paymentsRelations,
  };
};

// 기본 "drizzle" 스키마 export (기존 코드 호환성용)
const drizzleSchema = createDrizzleSchema("drizzle");

export const {
  genderEnum,
  reservationStatusEnum,
  paymentMethodEnum,
  paymentStatusEnum,
  patients,
  reservations,
  medicalRecords,
  treatments,
  payments,
  patientsRelations,
  reservationsRelations,
  medicalRecordsRelations,
  treatmentsRelations,
  paymentsRelations,
} = drizzleSchema;

// 타입 export
export type Patient = typeof patients.$inferSelect;
export type NewPatient = typeof patients.$inferInsert;
export type Reservation = typeof reservations.$inferSelect;
export type NewReservation = typeof reservations.$inferInsert;
export type MedicalRecord = typeof medicalRecords.$inferSelect;
export type NewMedicalRecord = typeof medicalRecords.$inferInsert;
export type Treatment = typeof treatments.$inferSelect;
export type NewTreatment = typeof treatments.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
