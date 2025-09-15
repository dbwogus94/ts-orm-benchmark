import { CRMDataGenerator } from "../utils/faker";
import { BenchmarkResult } from "../types";
import { measurePerformance } from "../utils/database";

/**
 * 벤치마크 기본 클래스
 */
export abstract class BaseBenchmark {
  protected crMDataGenerator: CRMDataGenerator;
  protected ormName: string;
  protected results: BenchmarkResult[] = [];

  constructor(ormName: string) {
    this.ormName = ormName;
    this.crMDataGenerator = new CRMDataGenerator();

    const mid = Math.floor(Math.random() * 9000) + 9000;
    // const last = Math.floor(Math.random() * 9000) + 9000;
    this.crMDataGenerator.setPhoneNumberMidSeq(mid);
    this.crMDataGenerator.setPhoneNumberLastSeq(0);
  }

  /**
   * 벤치마크 초기화
   */
  abstract initialize(): Promise<void>;

  /**
   * 벤치마크 정리
   */
  abstract cleanup(): Promise<void>;

  /**
   * 단순 읽기 테스트 - 환자 전체 조회 (페이징)
   */
  abstract simpleRead(
    limit?: number,
    offset?: number
  ): Promise<BenchmarkResult>;

  /**
   * 단순 쓰기 테스트 - 환자 일괄 삽입
   */
  abstract simpleWrite(count: number): Promise<BenchmarkResult>;

  /**
   * 복잡 트랜잭션 테스트 - 환자 등록 + 예약 + 진료기록 + 시술 + 결제
   */
  abstract complexTransaction(count: number): Promise<BenchmarkResult>;

  /**
   * 단순 통계 쿼리 - 일별 신규 환자 수
   */
  abstract simpleStats(days?: number): Promise<BenchmarkResult>;

  /**
   * 복잡 통계 쿼리 - 의사별 시술 매출 순위
   */
  abstract complexStats(limit?: number): Promise<BenchmarkResult>;

  /**
   * 업데이트 테스트 - 환자 정보 대량 업데이트
   */
  abstract bulkUpdate(count: number): Promise<BenchmarkResult>;

  /**
   * 삭제 테스트 - 오래된 데이터 삭제
   */
  abstract bulkDelete(olderThanDays: number): Promise<BenchmarkResult>;

  /**
   * 중첩 삽입 테스트
   * - 모두 한번에 생성하는 극단적인 케이스 - 중첩 삽입
   */
  abstract nestedInsert(count: number): Promise<BenchmarkResult>;

  /**
   * 전체 벤치마크 실행
   */
  async runAll(): Promise<BenchmarkResult[]> {
    console.log(`🚀 Starting ${this.ormName} benchmarks...`);

    try {
      await this.initialize();

      // 1. 단순 읽기 테스트
      this.results.push(await this.simpleRead(1000, 0));
      this.results.push(await this.simpleRead(10000, 0));

      // 2. 단순 쓰기 테스트
      this.results.push(await this.simpleWrite(1000));
      this.results.push(await this.simpleWrite(5000));

      // 3. 복잡 트랜잭션 테스트
      this.results.push(await this.complexTransaction(100));
      this.results.push(await this.complexTransaction(500));

      // 4. 중첩 삽입 테스트
      this.results.push(await this.nestedInsert(100));
      this.results.push(await this.nestedInsert(500));

      // 5. 통계 쿼리 테스트
      this.results.push(await this.simpleStats(30));
      this.results.push(await this.complexStats(10));

      // 6. 업데이트 테스트
      this.results.push(await this.bulkUpdate(1000));

      // 7. 삭제 테스트
      // this.results.push(await this.bulkDelete(365));

      console.log(`✅ ${this.ormName} benchmarks completed!`);
    } catch (error) {
      console.error(`❌ ${this.ormName} benchmark failed:`, error);
      throw error;
    } finally {
      await this.cleanup();
    }

    return this.results;
  }

  /**
   * 벤치마크 실행 헬퍼
   */
  protected async runBenchmark<T>(
    operation: () => Promise<T>,
    operationName: string,
    totalRecords: number
  ): Promise<BenchmarkResult> {
    const { result, duration, memoryUsage } = await measurePerformance(
      operation,
      `${this.ormName} - ${operationName}`
    );

    return {
      operation: operationName,
      orm: this.ormName,
      totalRecords,
      duration,
      averageTime: totalRecords > 0 ? duration / totalRecords : duration,
      memoryUsage,
      timestamp: new Date(),
    };
  }

  /**
   * 결과 반환
   */
  getResults(): BenchmarkResult[] {
    return this.results;
  }
}
