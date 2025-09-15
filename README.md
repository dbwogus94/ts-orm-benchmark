# ORM Performance Benchmark

TypeScript + Node.js 환경에서 **Sequelize**, **Prisma**, **TypeORM**, **Drizzle** 네 개의 주요 ORM을 실제 **피부과 CRM 시스템**으로 모킹하여 성능을 비교 분석하는 벤치마크 프로젝트입니다.

## 🎯 프로젝트 목표

- **실전 환경**: 실제 CRM 시스템의 복잡한 도메인 모델과 관계를 반영
- **대용량 데이터**: 10만건 수준의 데이터로 실제 운영 환경 시뮬레이션
- **종합적 평가**: CRUD 성능, 트랜잭션 처리, 복잡 쿼리, 메모리 사용량 등 다각도 분석
- **객관적 비교**: 동일한 환경과 조건에서 공정한 성능 비교

## 🏗️ 시스템 아키텍처

### 도메인 모델 (피부과 CRM)

```
Patient (환자)
├── 1:N Reservation (예약)
├── 1:N MedicalRecord (진료기록)
│   └── 1:N Treatment (시술)
└── 1:N Payment (결제)
```

### 주요 엔티티

- **Patient**: 환자 정보 (이름, 성별, 연락처, 첫방문일 등)
- **Reservation**: 예약 정보 (예약일시, 진료과, 담당의 등)
- **MedicalRecord**: 진료기록 (증상, 진단, 처방 등)
- **Treatment**: 시술 정보 (시술명, 가격, 소요시간 등)
- **Payment**: 결제 정보 (금액, 결제방법, 결제상태 등)

## 🛠️ 기술 스택

- **Runtime**: Node.js 20.x
- **Language**: TypeScript
- **Database**: PostgreSQL 15 (Docker)
- **ORMs**: Sequelize 6.37.3, Prisma 6.15.0, TypeORM 0.3.20, Drizzle 0.44.5
- **Testing**: Faker.js (데이터 생성), CLI Table (결과 출력)

## 📦 설치 및 설정

### 1. 프로젝트 클론 및 의존성 설치

```bash
git clone <repository-url>
cd orm-benchmark
npm install
```

### 2. 환경 설정

```bash
# 환경변수 설정 (env/local.env 수정)
cp env/local.env.example env/local.env
```

### 3. Docker로 PostgreSQL 실행

```bash
# PostgreSQL 컨테이너 시작
npm run docker:up

# 로그 확인 (필요시)
npm run docker:logs
```

### 4. 데이터베이스 마이그레이션

```bash
# 모든 ORM 마이그레이션 실행
npm run setup:all

# 또는 개별 실행
npm run db:migrate:sequelize
npm run db:migrate:prisma
npm run db:migrate:typeorm
npm run db:migrate:drizzle
```

## 🚀 사용법

### 전체 벤치마크 실행

```bash
# 모든 ORM 벤치마크 실행
npm start

# 또는 특정 ORM만 실행
npm run benchmark:sequelize
npm run benchmark:prisma
npm run benchmark:typeorm
npm run benchmark:drizzle
```

### 시드 데이터 생성

```bash
# 모든 ORM에 시드 데이터 생성 (기본 10만건)
npm run db:seed:sequelize
npm run db:seed:prisma
npm run db:seed:typeorm
npm run db:seed:drizzle
```

### 환경변수 설정

```bash
# env/local.env 파일에서 설정 가능
BENCHMARK_TOTAL_RECORDS=100000  # 생성할 총 환자 수
BENCHMARK_BATCH_SIZE=1000       # 배치 처리 단위
BENCHMARK_CONCURRENCY=10        # 동시 처리 수
```

## 📊 벤치마크 테스트 항목

### 1. 단순 읽기 (Simple Read)

- **목적**: 기본적인 SELECT 성능 측정
- **테스트**: 환자 데이터 1,000건 / 10,000건 조회 (페이징)
- **측정**: 응답시간, 메모리 사용량

### 2. 단순 쓰기 (Simple Write)

- **목적**: 대량 INSERT 성능 측정
- **테스트**: 환자 데이터 1,000건 / 5,000건 일괄 삽입
- **측정**: 처리시간, 초당 처리건수 (TPS)

### 3. 복잡 트랜잭션 (Complex Transaction)

- **목적**: 실전 비즈니스 로직의 트랜잭션 성능
- **테스트**: 환자 등록 + 예약 + 진료기록 + 시술 + 결제 (100/500건)
- **측정**: 트랜잭션 완료시간, 실패율

### 4. 단순 통계 (Simple Stats)

- **목적**: 집계 쿼리 성능
- **테스트**: 최근 30일 일별 신규 환자 수 조회
- **측정**: 쿼리 실행시간

### 5. 복잡 통계 (Complex Stats)

- **목적**: 복잡한 JOIN과 집계 성능
- **테스트**: 의사별 시술 매출 순위 (TOP 10)
- **측정**: 복잡 쿼리 실행시간

### 6. 대량 업데이트 (Bulk Update)

- **목적**: UPDATE 성능 측정
- **테스트**: 환자 1,000건 마지막 방문일 업데이트
- **측정**: 업데이트 처리시간

### 7. 대량 삭제 (Bulk Delete)

- **목적**: DELETE 성능 측정
- **테스트**: 1년 이상 된 환자 데이터 삭제
- **측정**: 삭제 처리시간, CASCADE 성능

## 📈 결과 리포트

벤치마크 완료 후 다음 형태로 결과가 생성됩니다:

### 콘솔 출력

```
📊 ORM Performance Benchmark Results
================================================================================

🔧 Sequelize Results:
┌─────────────────────────────────────┬─────────────────┬────────────┬──────────────────┬───────────────┐
│ Operation                           │ Duration (ms)   │ Records    │ Avg/Record (ms)  │ Memory (MB)   │
├─────────────────────────────────────┼─────────────────┼────────────┼──────────────────┼───────────────┤
│ Simple Read (limit: 1000)           │ 45.32           │ 1,000      │ 0.0453           │ 12.45         │
│ Simple Write (1000 records)         │ 234.56          │ 1,000      │ 0.2346           │ 18.92         │
...
```

### 파일 출력

- **JSON**: `results/benchmark-{timestamp}.json` - 상세 결과 데이터
- **CSV**: `results/benchmark-{timestamp}.csv` - 스프레드시트 분석용
- **Markdown**: `results/benchmark-{timestamp}.md` - 보고서 형태
- **Latest**: `results/latest.json`, `results/README.md` - 최신 결과

## 🔧 프로젝트 구조

```
orm-benchmark/
├── src/
│   ├── types/           # 공통 타입 정의
│   ├── utils/           # 유틸리티 (DB연결, Faker, 성능측정)
│   ├── benchmark/       # 벤치마크 기본 클래스 및 리포터
│   └── orm/
│       ├── sequelize/   # Sequelize 구현
│       │   ├── models/     # 모델 정의
│       │   ├── config.ts   # DB 설정
│       │   ├── migrate.ts  # 마이그레이션
│       │   ├── seed.ts     # 시드 데이터
│       │   └── benchmark.ts # 벤치마크
│       ├── prisma/      # Prisma 구현
│       ├── typeorm/     # TypeORM 구현
│       └── drizzle/     # Drizzle 구현
├── env/                 # 환경변수 설정
├── scripts/            # DB 초기화 스크립트
├── results/            # 벤치마크 결과
├── docker-compose.yml  # PostgreSQL 컨테이너
└── package.json        # 스크립트 및 의존성
```

## 📋 개발 가이드

### 새로운 ORM 추가

1. `src/orm/{orm_name}/` 디렉토리 생성
2. `BaseBenchmark`를 상속하는 벤치마크 클래스 구현
3. 동일한 도메인 모델 정의
4. `package.json`에 스크립트 추가

### 새로운 테스트 추가

1. `BaseBenchmark`에 추상 메서드 추가
2. 각 ORM별 구현체에서 메서드 구현
3. `runAll()` 메서드에 테스트 추가

### 환경 설정

```bash
# env/local.env
DATABASE_URL=postgresql://postgres:password@localhost:5432/orm_benchmark
BENCHMARK_TOTAL_RECORDS=100000
BENCHMARK_BATCH_SIZE=1000
BENCHMARK_CONCURRENCY=10
```

## 🚨 주의사항

- **대용량 데이터**: 10만건 시드 생성시 시간이 오래 걸릴 수 있습니다 (5-10분)
- **DB 연결**: PostgreSQL 컨테이너가 완전히 시작된 후 마이그레이션을 실행하세요
- **스키마 분리**: 각 ORM은 별도 스키마를 사용하여 격리됩니다
