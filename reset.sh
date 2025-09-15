#!/bin/bash

# ORM Benchmark 프로젝트 리셋 스크립트
# Usage: ./reset.sh

set -e

echo "🚀 ORM Benchmark 프로젝트 리셋을 시작합니다..."

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

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Docker Compose 종료 및 볼륨 제거
cleanup_docker() {
    print_status "Docker Compose 컨테이너 및 네트워크를 종료하고 있습니다..."
    docker-compose down --remove-orphans
    print_success "Docker Compose 종료 완료."

    print_status "명명된 Docker 볼륨을 제거하고 있습니다... (orm-benchmark_postgres_data)"
    docker volume rm orm-benchmark_postgres_data || true
    print_success "명명된 Docker 볼륨 제거 완료."
}

remove_data_dir() {
    print_status "데이터 디렉토리 (<project>/data/postgres)를 제거하고 있습니다..."
    if [ -d "./data/postgres" ]; then
        rm -r ./data/postgres
        print_success "데이터 디렉토리 제거 완료: ./data/postgres"
    else
        print_warning "./data/postgres 디렉토리가 존재하지 않습니다. 건너뜁니다."
    fi
}

# 메인 실행 흐름
main() {
    echo "════════════════════════════════════════════════════════════════"
    echo "                   ORM Performance Benchmark Reset"
    echo "════════════════════════════════════════════════════════════════"
    echo ""
    
    cleanup_docker
    remove_data_dir
    
    echo "\n🎉 ORM Benchmark 프로젝트 리셋이 완료되었습니다!"
    echo "이제 다시 './setup.sh'를 실행하여 프로젝트를 설정할 수 있습니다."
}

# 스크립트 실행
main "$@"
