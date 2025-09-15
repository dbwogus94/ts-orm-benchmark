#!/bin/bash

# ORM Benchmark 프로젝트 설정 스크립트
# Usage: ./setup.sh

set -e

echo "🚀 ORM Benchmark 프로젝트 설정을 시작합니다..."

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 진행상황 출력 함수
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 필수 도구 확인
check_requirements() {
    print_status "필수 도구들을 확인하고 있습니다..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js가 설치되지 않았습니다."
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm이 설치되지 않았습니다."
        exit 1
    fi
    
    if ! command -v docker &> /dev/null && ! command -v podman &> /dev/null; then
        print_error "Docker 또는 Podman이 설치되지 않았습니다."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! command -v podman-compose &> /dev/null; then
        print_error "Docker Compose 또는 Podman Compose가 설치되지 않았습니다."
        exit 1
    fi
    
    print_success "모든 필수 도구가 설치되어 있습니다."
}

# 환경변수 파일 설정
setup_env() {
    print_status "환경변수 파일을 설정하고 있습니다..."
    
    if [ ! -f "env/local.env" ]; then
        mkdir -p env
        cat > env/local.env << EOF
# Database Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=orm_benchmark
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password

# Database URL for ORMs
DATABASE_URL=postgresql://postgres:password@localhost:5432/orm_benchmark

# Benchmark Configuration
BENCHMARK_BATCH_SIZE=1000
BENCHMARK_TOTAL_RECORDS=100000
BENCHMARK_CONCURRENCY=10

# Environment
NODE_ENV=development
EOF
        print_success "환경변수 파일이 생성되었습니다: env/local.env"
    else
        print_warning "환경변수 파일이 이미 존재합니다: env/local.env"
    fi
}

# 의존성 설치
install_dependencies() {
    print_status "NPM 의존성을 설치하고 있습니다..."
    npm ci
    print_success "의존성 설치가 완료되었습니다."
}

# PostgreSQL 시작
start_database() {
    print_status "PostgreSQL 데이터베이스를 시작하고 있습니다..."
    
    # 기존 컨테이너 정리
    docker-compose down --remove-orphans 2>/dev/null || true
    
    # 새 컨테이너 시작
    docker-compose up -d
    
    print_status "데이터베이스 준비를 기다리고 있습니다..."
    sleep 15
    
    # 연결 테스트
    if docker-compose exec -T postgres pg_isready -U postgres -d orm_benchmark; then
        print_success "PostgreSQL이 성공적으로 시작되었습니다."
    else
        print_error "PostgreSQL 시작에 실패했습니다."
        exit 1
    fi
}

# 마이그레이션 실행
run_setup() {
    print_status "데이터베이스 마이그레이션을 실행하고 있습니다..."
    
    # 각 ORM별 마이그레이션 실행
    orms=("sequelize" "prisma" "typeorm" "drizzle")
    
    for orm in "${orms[@]}"; do
        print_status "${orm} 설정 실행 중..."
        if npm run "db:setup:$orm"; then
            print_success "${orm} 설정 완료"
        else
            print_warning "${orm} 설정 실패 (건너뜀)"
        fi
    done
}

# 시드 데이터 생성
run_seed() {
    print_status "데이터베이스 시드 데이터 생성을 실행하고 있습니다..."
    # 각 ORM별 시드 데이터 생성
    # orms=("sequelize" "prisma" "typeorm" "drizzle")
    npm run "db:seed:all"
}

# 결과 디렉토리 생성
create_results_dir() {
    print_status "결과 저장 디렉토리를 생성하고 있습니다..."
    mkdir -p results
    print_success "결과 디렉토리가 생성되었습니다: ./results"
}

# 설정 완료 메시지
print_completion() {
    echo ""
    echo "🎉 ORM Benchmark 프로젝트 설정이 완료되었습니다!"
    echo ""
    echo -e "${BLUE}다음 명령어로 벤치마크를 실행할 수 있습니다:${NC}"
    echo ""
    echo "  # 모든 ORM 벤치마크 실행"
    echo "  npm start"
    echo ""
    echo "  # 특정 ORM만 실행"
    echo "  npm run benchmark:sequelize"
    echo "  npm run benchmark:prisma"
    echo "  npm run benchmark:typeorm"
    echo "  npm run benchmark:drizzle"
    echo ""
    echo "  # 테스트 초기화 방법 "
    echo "  sh reset.sh"
    echo ""
    echo -e "${YELLOW}참고사항:${NC}"
    echo "  - env/local.env 파일에서 설정을 변경할 수 있습니다"
    echo "  - 결과는 ./results 폴더에 저장됩니다"
    echo ""
}

# 메인 실행 흐름
main() {
    echo "════════════════════════════════════════════════════════════════"
    echo "              ORM Performance Benchmark Setup"
    echo "════════════════════════════════════════════════════════════════"
    echo ""
    
    check_requirements
    setup_env
    install_dependencies
    create_results_dir
    start_database
    run_setup
    run_seed
    
    print_completion
}

# 스크립트 실행
main "$@"
