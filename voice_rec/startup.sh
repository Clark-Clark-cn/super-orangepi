#!/bin/bash
source /opt/anaconda3/etc/profile.d/conda.sh
# xiaozhi-esp32-server 源码一键启动脚本
# 用于启动xiaozhi-esp32-server的3个主要服务：
# 1. xiaozhi-server (Python核心AI服务，端口8000)
# 2. manager-api (Java管理API，端口8002)
# 3. manager-web (Vue管理界面，端口8002)

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 项目根目录
PROJECT_ROOT="/home/orangepi/super-orangepi/voice_rec/xiaozhi-esp32-server"
XIAOZHI_SERVER_DIR="$PROJECT_ROOT/main/xiaozhi-server"
MANAGER_API_DIR="$PROJECT_ROOT/main/manager-api"
MANAGER_WEB_DIR="$PROJECT_ROOT/main/manager-web"

# 检查必要的工具
check_tools() {
    local missing_tools=()

    if ! command -v python3 &> /dev/null; then
        missing_tools+=("python3")
    fi

    if ! command -v java &> /dev/null; then
        missing_tools+=("java")
    fi

    if ! command -v mvn &> /dev/null; then
        missing_tools+=("maven")
    fi

    if ! command -v npm &> /dev/null; then
        missing_tools+=("npm")
    fi

    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "缺少必要的工具: ${missing_tools[*]}"
        log_info "请安装缺失的工具后重试"
        exit 1
    fi

    log_info "工具检查通过"
}

# 检查必要的文件和配置
check_files() {
    # 检查xiaozhi-server配置
    if [ ! -f "$XIAOZHI_SERVER_DIR/config.yaml" ] && [ ! -f "$XIAOZHI_SERVER_DIR/data/.config.yaml" ]; then
        log_warn "找不到 xiaozhi-server 配置文件"
        log_info "请确保已配置 config.yaml 或 data/.config.yaml"
    fi

    # 检查模型文件
    if [ ! -f "$XIAOZHI_SERVER_DIR/models/SenseVoiceSmall/model.pt" ]; then
        log_warn "找不到语音识别模型文件"
        log_info "请下载 SenseVoiceSmall 模型到: $XIAOZHI_SERVER_DIR/models/SenseVoiceSmall/model.pt"
    fi

    # 检查manager-api配置
    if [ ! -f "$MANAGER_API_DIR/src/main/resources/application.yml" ]; then
        log_warn "找不到 manager-api 配置文件"
    fi

    # 检查manager-web配置
    if [ ! -f "$MANAGER_WEB_DIR/package.json" ]; then
        log_error "找不到 manager-web package.json"
        exit 1
    fi

    log_info "文件检查完成"
}

# 启动 xiaozhi-server (Python)
start_xiaozhi_server() {
    log_info "启动 xiaozhi-server (Python服务)..."

    cd "$XIAOZHI_SERVER_DIR"

    # 确保logs目录存在
    mkdir -p "$PROJECT_ROOT/logs"

    # 激活conda环境
    log_info "激活conda环境..."
    conda activate xiaozhi-esp32-server

    # 检查并安装依赖
    if [ ! -f ".deps_installed" ]; then
        log_info "安装Python依赖..."
        pip install -r requirements.txt
        touch .deps_installed
    fi

    # 启动服务
    nohup python3 app.py > $PROJECT_ROOT/logs/xiaozhi-server.log 2>&1 &
    echo $! > xiaozhi-server.pid

    log_info "xiaozhi-server 启动中..."
    sleep 3
}

# 启动 manager-api (Java)
start_manager_api() {
    log_info "启动 manager-api (Java服务)..."

    cd "$MANAGER_API_DIR"

    # 确保logs目录存在
    mkdir -p "$PROJECT_ROOT/logs"

    # 检查是否需要编译（只有在第一次运行或源代码有变化时）
    if [ ! -f "target/xiaozhi-esp32-api.jar" ] || [ ! -f ".compiled" ]; then
        log_info "编译 manager-api..."
        mvn clean package -DskipTests
        # 创建编译标记文件
        touch .compiled
        log_info "编译完成，下次运行将跳过编译步骤"
    else
        log_info "使用已编译的JAR文件，跳过编译步骤"
    fi

    # 启动服务
    nohup java -jar target/xiaozhi-esp32-api.jar > $PROJECT_ROOT/logs/manager-api.log 2>&1 &
    echo $! > manager-api.pid

    log_info "manager-api 启动中..."
    sleep 5
}

# 启动 manager-web (Vue)
start_manager_web() {
    log_info "启动 manager-web (Vue前端)..."

    cd "$MANAGER_WEB_DIR"

    # 确保logs目录存在
    mkdir -p "$PROJECT_ROOT/logs"

    # 检查node_modules
    if [ ! -d "node_modules" ]; then
        log_info "安装Node.js依赖..."
        npm install
    fi

    # 启动开发服务器
    nohup npm run serve > $PROJECT_ROOT/logs/manager-web.log 2>&1 &
    echo $! > manager-web.pid

    log_info "manager-web 启动中..."
    sleep 3
}

# 强制重新编译
force_compile() {
    log_info "强制重新编译 manager-api..."

    cd "$MANAGER_API_DIR"

    # 删除编译标记文件和目标文件
    rm -f .compiled
    rm -rf target/

    # 重新编译
    mvn clean package -DskipTests

    # 创建新的编译标记文件
    touch .compiled

    log_info "重新编译完成"
}

# 停止所有服务
stop_services() {
    log_info "停止所有服务..."
    if [ -f "$XIAOZHI_SERVER_DIR/xiaozhi-server.pid" ]; then
        kill $(cat "$XIAOZHI_SERVER_DIR/xiaozhi-server.pid") 2>/dev/null || true
        rm -f "$XIAOZHI_SERVER_DIR/xiaozhi-server.pid"
        log_info "xiaozhi-server 已停止"
    fi

    # 停止manager-api
    if [ -f "$MANAGER_API_DIR/manager-api.pid" ]; then
        kill $(cat "$MANAGER_API_DIR/manager-api.pid") 2>/dev/null || true
        rm -f "$MANAGER_API_DIR/manager-api.pid"
        log_info "manager-api 已停止"
    fi

    # 停止manager-web
    if [ -f "$MANAGER_WEB_DIR/manager-web.pid" ]; then
        kill $(cat "$MANAGER_WEB_DIR/manager-web.pid") 2>/dev/null || true
        rm -f "$MANAGER_WEB_DIR/manager-web.pid"
        log_info "manager-web 已停止"
    fi

    # 清理可能的残留进程
    pkill -f "python3 app.py" 2>/dev/null || true
    pkill -f "xiaozhi-esp32-api.jar" 2>/dev/null || true
    pkill -f "npm run serve" 2>/dev/null || true

    log_info "所有服务已停止"
}

# 检查服务状态
check_service_status() {
    log_info "检查服务状态..."

    # 检查xiaozhi-server
    if [ -f "$XIAOZHI_SERVER_DIR/xiaozhi-server.pid" ] && kill -0 $(cat "$XIAOZHI_SERVER_DIR/xiaozhi-server.pid") 2>/dev/null; then
        log_info "✓ xiaozhi-server 运行正常 (PID: $(cat "$XIAOZHI_SERVER_DIR/xiaozhi-server.pid"))"
    else
        log_warn "✗ xiaozhi-server 未运行"
    fi

    # 检查manager-api
    if [ -f "$MANAGER_API_DIR/manager-api.pid" ] && kill -0 $(cat "$MANAGER_API_DIR/manager-api.pid") 2>/dev/null; then
        log_info "✓ manager-api 运行正常 (PID: $(cat "$MANAGER_API_DIR/manager-api.pid"))"
    else
        log_warn "✗ manager-api 未运行"
    fi

    # 检查manager-web
    if [ -f "$MANAGER_WEB_DIR/manager-web.pid" ] && kill -0 $(cat "$MANAGER_WEB_DIR/manager-web.pid") 2>/dev/null; then
        log_info "✓ manager-web 运行正常 (PID: $(cat "$MANAGER_WEB_DIR/manager-web.pid"))"
    else
        log_warn "✗ manager-web 未运行"
    fi

    # 显示端口信息
    log_info "服务端口信息:"
    log_info "  - 核心AI服务 (WebSocket): http://localhost:8004"
    log_info "  - 管理API: http://localhost:8002"
    log_info "  - 管理界面: http://localhost:8001 (开发模式)"
}

# 显示日志
show_logs() {
    echo ""
    log_info "查看服务日志:"
    echo "1. xiaozhi-server: tail -f $PROJECT_ROOT/logs/xiaozhi-server.log"
    echo "2. manager-api: tail -f $PROJECT_ROOT/logs/manager-api.log"
    echo "3. manager-web: tail -f $PROJECT_ROOT/logs/manager-web.log"
    echo ""
}

# 主函数
main() {
    echo "========================================"
    echo "  xiaozhi-esp32-server 源码启动脚本"
    echo "========================================"

    # 检查参数
    if [ "$1" = "stop" ]; then
        stop_services
        exit 0
    elif [ "$1" = "restart" ]; then
        stop_services
        sleep 2
        start_services
        show_logs
        exit 0
    elif [ "$1" = "compile" ] || [ "$1" = "--compile" ]; then
        force_compile
        exit 0
    elif [ "$1" = "status" ]; then
        check_service_status
        exit 0
    elif [ "$1" = "logs" ]; then
        show_logs
        exit 0
    fi

    # 正常启动流程
    check_tools
    check_files
    stop_services
    start_services
    check_service_status
    show_logs
}

# 启动所有服务
start_services() {
    log_info "开始启动所有服务..."

    start_xiaozhi_server
    start_manager_api
    start_manager_web

    log_info "所有服务启动完成！"
}

# 参数说明
usage() {
    echo "用法: $0 [命令]"
    echo ""
    echo "命令:"
    echo "  (无参数)    启动所有服务"
    echo "  stop        停止所有服务"
    echo "  restart     重启所有服务"
    echo "  compile     强制重新编译Java服务"
    echo "  status      查看服务状态"
    echo "  logs        显示日志命令"
    echo ""
    echo "服务说明:"
    echo "  - xiaozhi-server: Python核心AI服务 (端口8000)"
    echo "  - manager-api: Java管理API (端口8002)"
    echo "  - manager-web: Vue管理界面 (端口8001)"
    echo ""
    echo "注意: 正常启动时会跳过Java编译，如需重新编译请使用 'compile' 命令"
}

# 检查参数
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    usage
    exit 0
fi

# 运行主函数
main "$@"
