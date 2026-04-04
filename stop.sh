#!/bin/bash
set -e

echo "停止 EmuWorld 所有服务..."

kill_port() {
    local port="$1"
    local name="$2"
    local pids

    pids="$(lsof -tiTCP:${port} -sTCP:LISTEN 2>/dev/null || true)"
    if [ -n "$pids" ]; then
        echo "$pids" | xargs kill 2>/dev/null || true
        echo "  已停止 ${name} (端口 ${port})"
    fi
}

pkill -f "emu-world-backend" 2>/dev/null && echo "  已停止 Rust 后端" || echo "  Rust 后端未运行"
pkill -f "uvicorn.*main:app" 2>/dev/null && echo "  已停止 Python AI" || true
pkill -f "python.*uvicorn.*main:app" 2>/dev/null && echo "  已停止 Python AI" || true
pkill -f "vite" 2>/dev/null && echo "  已停止前端" || echo "  前端未运行"
kill_port 9000 "Python AI"
kill_port 8080 "Rust 后端"
kill_port 5173 "前端"

echo "完成"
