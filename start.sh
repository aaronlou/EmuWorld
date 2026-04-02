#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$PROJECT_DIR/logs"
mkdir -p "$LOG_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Default: use SQLite
DB_MODE="${DB_MODE:-sqlite}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  EmuWorld - 一键启动${NC}"
echo -e "${GREEN}  数据库模式: ${DB_MODE}${NC}"
echo -e "${GREEN}========================================${NC}"

# 检查并停止已运行的服务
echo -e "\n${YELLOW}[1/4] 检查已有进程...${NC}"
pkill -f "emu-world-backend" 2>/dev/null && echo "  已停止 Rust 后端" || true
pkill -f "uvicorn.*ai-service" 2>/dev/null && echo "  已停止 Python AI" || true
pkill -f "vite" 2>/dev/null && echo "  已停止前端" || true
sleep 1

# 启动 Python AI Service
echo -e "\n${YELLOW}[2/4] 启动 Python AI Service (端口 9000)...${NC}"
cd "$PROJECT_DIR/ai-service"
source .venv/bin/activate
nohup uvicorn main:app --host 0.0.0.0 --port 9000 > "$LOG_DIR/ai-service.log" 2>&1 &
echo "  PID: $!"
sleep 2

# 启动 Rust Backend
echo -e "\n${YELLOW}[3/4] 启动 Rust Backend (端口 8080)...${NC}"
mkdir -p "$PROJECT_DIR/backend/data"
cd "$PROJECT_DIR/backend"

if [ "$DB_MODE" = "postgres" ]; then
    # Check if PostgreSQL is running
    if ! pg_isready -h localhost -p 5432 &>/dev/null; then
        echo -e "${YELLOW}  启动本地 PostgreSQL...${NC}"
        docker compose up -d postgres 2>/dev/null || docker-compose up -d postgres 2>/dev/null || {
            echo -e "${RED}  PostgreSQL 未找到。请先安装或运行 docker compose up -d postgres${NC}"
            exit 1
        }
        sleep 3
    fi
    export DATABASE_URL="postgresql://emuworld:emuworld_pass@localhost:5432/emuworld"
    echo -e "  使用 PostgreSQL: $DATABASE_URL"
else
    export DATABASE_URL="$PROJECT_DIR/backend/data/emuworld.db"
    echo -e "  使用 SQLite: $DATABASE_URL"
fi

nohup cargo run --release > "$LOG_DIR/backend.log" 2>&1 &
echo "  PID: $!"
sleep 2

# 启动 React Frontend
echo -e "\n${YELLOW}[4/4] 启动 React Frontend (端口 5173)...${NC}"
cd "$PROJECT_DIR/frontend"
nohup npm run dev -- --host 0.0.0.0 --port 5173 > "$LOG_DIR/frontend.log" 2>&1 &
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
