import type { Config } from "drizzle-kit";

export default {
  schema: "./src/orm/drizzle/schema.ts",
  out: "./src/orm/drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://postgres:password@localhost:5432/orm_benchmark",
  },
  schemaFilter: ["drizzle"],
  verbose: true,
  strict: true,
} satisfies Config;
