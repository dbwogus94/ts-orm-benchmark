import { PrismaClient } from "./generated/client";

let prisma: PrismaClient;

export const getPrismaClient = (): PrismaClient => {
  if (!prisma) {
    prisma = new PrismaClient({
      log: [], // 벤치마크 시 로깅 비활성화
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }

  return prisma;
};

export const initializePrisma = async (): Promise<void> => {
  const client = getPrismaClient();

  try {
    await client.$connect();
    console.log("✅ Prisma: Database connection established successfully.");
  } catch (error) {
    console.error("❌ Prisma: Unable to connect to the database:", error);
    throw error;
  }
};

export const closePrisma = async (): Promise<void> => {
  if (prisma) {
    await prisma.$disconnect();
    console.log("✅ Prisma: Database connection closed.");
  }
};

// 트랜잭션 헬퍼
export const executeTransaction = async <T>(
  fn: (tx: PrismaClient) => Promise<T>
) => {
  const client = getPrismaClient();
  return await client.$transaction(fn as any);
};

// Raw 쿼리 실행 헬퍼
export const executeRawQuery = async (
  query: string,
  params?: any[]
): Promise<any> => {
  const client = getPrismaClient();
  return await client.$queryRawUnsafe(query, ...(params || []));
};

// 스키마 초기화 헬퍼
export const initializePrismaSchema = async (): Promise<void> => {
  const client = getPrismaClient();

  try {
    // Prisma 스키마 생성
    await client.$executeRawUnsafe("CREATE SCHEMA IF NOT EXISTS prisma");
    console.log("✅ Prisma: Schema created successfully.");
  } catch (error) {
    console.error("❌ Prisma: Schema creation failed:", error);
    throw error;
  }
};
