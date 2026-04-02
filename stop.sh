#!/bin/bash
set -e

echo "停止 EmuWorld 所有服务..."

pkill -f "emu-world-backend" 2>/dev/null && echo "  已停止 Rust 后端" || echo "  Rust 后端未运行"
pkill -f "uvicorn.*ai-service" 2>/dev/null && echo "  已停止 Python AI" || echo "  Python AI 未运行"
pkill -f "vite" 2>/dev/null && echo "  已停止前端" || echo "  前端未运行"

echo "完成"
