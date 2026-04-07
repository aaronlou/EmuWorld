#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$PROJECT_DIR/logs"
mkdir -p "$LOG_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  EmuWorld - 一键启动${NC}"
echo -e "${GREEN}  数据库: PostgreSQL${NC}"
echo -e "${GREEN}========================================${NC}"

postgres_ready() {
    pg_isready -h localhost -p 5432 -U emuworld >/dev/null 2>&1
}

docker_compose_available() {
    docker compose version >/dev/null 2>&1 || docker-compose version >/dev/null 2>&1
}

postgres_container_running() {
    docker compose ps postgres 2>/dev/null | grep -q "Up" || \
        docker-compose ps postgres 2>/dev/null | grep -q "Up"
}

start_postgres_container() {
    docker compose up -d postgres >/dev/null 2>&1 || docker-compose up -d postgres >/dev/null 2>&1
}

start_detached() {
    local logfile="$1"
    shift

    if command -v setsid >/dev/null 2>&1; then
        setsid "$@" >"$logfile" 2>&1 < /dev/null &
    else
        nohup "$@" >"$logfile" 2>&1 < /dev/null &
    fi
}

run_logged() {
    local logfile="$1"
    shift
    "$@" >>"$logfile" 2>&1
}

wait_for_postgres() {
    local attempts=15

    while [ "$attempts" -gt 0 ]; do
        if postgres_ready; then
            return 0
        fi
        sleep 1
        attempts=$((attempts - 1))
    done

    return 1
}

ensure_postgres() {
    if postgres_ready; then
        echo "  PostgreSQL 已就绪"
        return 0
    fi

    if docker_compose_available && postgres_container_running; then
        echo "  检测到 Docker PostgreSQL，等待就绪..."
        if wait_for_postgres; then
            echo "  PostgreSQL 已就绪"
            return 0
        fi
    fi

    if docker_compose_available; then
        echo "  启动本地 PostgreSQL..."
        start_postgres_container || {
            echo -e "${RED}  无法启动 PostgreSQL 容器${NC}"
            return 1
        }

        if wait_for_postgres; then
            echo "  PostgreSQL 已就绪"
            return 0
        fi

        echo -e "${RED}  PostgreSQL 容器已启动，但宿主机仍无法连接 5432${NC}"
        return 1
    fi

    echo -e "${RED}  PostgreSQL 未找到。请先安装本地 PostgreSQL 或运行 docker compose up -d postgres${NC}"
    return 1
}

kill_port() {
    local port="$1"
    local name="$2"
    local pids

    pids="$(lsof -tiTCP:${port} -sTCP:LISTEN 2>/dev/null || true)"
    if [ -n "$pids" ]; then
        echo "$pids" | xargs kill 2>/dev/null || true
        sleep 1
        echo "  已停止 ${name} (端口 ${port})"
    fi
}

# 检查并停止已运行的服务
echo -e "\n${YELLOW}[1/4] 检查已有进程...${NC}"
pkill -f "emu-world-backend" 2>/dev/null && echo "  已停止 Rust 后端" || true
pkill -f "uvicorn.*main:app" 2>/dev/null && echo "  已停止 Python AI" || true
pkill -f "python.*uvicorn.*main:app" 2>/dev/null && echo "  已停止 Python AI" || true
pkill -f "vite" 2>/dev/null && echo "  已停止前端" || true
kill_port 9000 "Python AI"
kill_port 8080 "Rust 后端"
kill_port 5173 "前端"
sleep 1

# 启动 Python AI Service
echo -e "\n${YELLOW}[2/4] 启动 Python AI Service (端口 9000)...${NC}"
cd "$PROJECT_DIR/ai-service"
source .venv/bin/activate
. .env.local
start_detached "$LOG_DIR/ai-service.log" uvicorn main:app --host 0.0.0.0 --port 9000
echo "  PID: $!"
echo "  等待 AI 服务初始化 (gRPC)..."
sleep 5

# 启动 PostgreSQL (Docker)
echo -e "\n${YELLOW}[3/4] 启动 PostgreSQL + Rust Backend...${NC}"
ensure_postgres || exit 1

export DATABASE_URL="postgresql://emuworld:emuworld_pass@localhost:5432/emuworld"
export AI_SERVICE_URL="http://localhost:9001"

cd "$PROJECT_DIR/backend"
start_detached "$LOG_DIR/backend.log" cargo run --release
echo "  PID: $!"
sleep 2

# 启动 React Frontend
echo -e "\n${YELLOW}[4/4] 启动 React Frontend (端口 5173)...${NC}"
cd "$PROJECT_DIR/frontend"
echo "> frontend build" > "$LOG_DIR/frontend.log"
run_logged "$LOG_DIR/frontend.log" npm run build
start_detached "$LOG_DIR/frontend.log" npm run preview -- --host 0.0.0.0 --port 5173
echo "  PID: $!"
sleep 2

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  所有服务已启动!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\n  前端:    http://localhost:5173"
echo -e "  后端:    http://localhost:8080"
echo -e "  AI服务:  http://localhost:9000"
echo -e "\n  日志:    $LOG_DIR/"
echo -e "  停止:    ./stop.sh"
echo -e ""
