-- PostgreSQL 초기화 스크립트
-- 피부과 CRM ORM 벤치마크를 위한 데이터베이스 초기 설정

-- 확장 모듈 활성화 (UUID 생성용)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 성능 최적화를 위한 설정
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET pg_stat_statements.track = 'all';

-- 필요한 스키마 생성 (각 ORM별로 분리 가능하도록)
CREATE SCHEMA IF NOT EXISTS sequelize;
CREATE SCHEMA IF NOT EXISTS prisma;
CREATE SCHEMA IF NOT EXISTS typeorm;
CREATE SCHEMA IF NOT EXISTS drizzle;

-- 공통 enum 타입들 생성
CREATE TYPE gender_type AS ENUM ('male', 'female', 'other');
CREATE TYPE reservation_status AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show');
CREATE TYPE payment_method AS ENUM ('cash', 'card', 'insurance', 'bank_transfer');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- 인덱스 생성을 위한 도우미 함수
CREATE OR REPLACE FUNCTION create_indexes_for_table(schema_name text, table_name text)
RETURNS void AS $$
BEGIN
    -- 일반적인 성능 최적화 인덱스들
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_created_at ON %I.%I (created_at DESC)', table_name, schema_name, table_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_updated_at ON %I.%I (updated_at DESC)', table_name, schema_name, table_name);
END;
$$ LANGUAGE plpgsql;
