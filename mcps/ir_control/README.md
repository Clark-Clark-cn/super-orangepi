# 红外学习模块控制器

这是一个用于控制红外学习模块的Python脚本，支持Orange Pi等设备。

## 功能特性

- 内部学习和发送（模块存储）
- 外部学习和发送（文件存储）
- 模块配置（波特率、地址等）
- 上电发送设置
- 命令行接口（支持MCP集成）

## 硬件连接

1. 红外学习模块连接到Orange Pi的UART1：
   - VCC → 5V
   - GND → GND
   - TX → RX (UART1)
   - RX → TX (UART1)

2. 确保UART1已启用（在armbian-config中启用）

## 安装依赖

```bash
pip3 install pyserial
```

## 权限设置

脚本需要访问串口设备 `/dev/ttyS1`。如果遇到权限问题：

### 自动设置（推荐）
```bash
./setup_serial_permissions.sh
```

### 手动设置
```bash
# 添加用户到dialout组
sudo usermod -a -G dialout $USER

# 重新登录或运行以下命令使组更改生效
newgrp dialout

# 检查权限
ls -l /dev/ttyS1  # 应该显示 crw-rw---- root dialout
```

**注意**：如果仍然遇到权限问题，请重新登录系统或重启终端。

## 使用方法

### 交互模式

```bash
python3 ir_control.py
```

### 命令行模式

#### 学习和发送

```bash
# 内部学习（存储到模块）
python3 ir_control.py --learn-internal 0

# 发送内部存储编码
python3 ir_control.py --send-internal 0

# 外部学习（保存到文件）
python3 ir_control.py --learn-external

# 发送外部编码（十六进制）
python3 ir_control.py --send-external-hex "a9 04 c5 04 39 4d 3f 50..."

# 从文件发送外部编码
python3 ir_control.py --send-external-file ir_code_1234567890.hex
```

#### 系统设置

```bash
# 设置波特率 (0=9600, 1=19200, 2=38400, 3=57600, 4=115200)
python3 ir_control.py --set-baud 4

# 获取波特率
python3 ir_control.py --get-baud

# 设置模块地址 (00-FE)
python3 ir_control.py --set-address 01

# 获取模块地址
python3 ir_control.py --get-address

# 复位模块
python3 ir_control.py --reset

# 格式化模块
python3 ir_control.py --format
```

#### 上电设置

```bash
# 设置上电发送状态 (索引 0-6, 标志 0/1)
python3 ir_control.py --set-power-send 0 1

# 获取上电发送状态
python3 ir_control.py --get-power-send 0

# 设置上电发送延时时间 (秒)
python3 ir_control.py --set-power-delay 5

# 获取上电发送延时时间
python3 ir_control.py --get-power-delay
```

#### 编码读写

```bash
# 写入内部存储编码
python3 ir_control.py --write-internal 0 "a9 04 c5 04 39 4d 3f 50..."

# 读取内部存储编码
python3 ir_control.py --read-internal 0
```

## 文件格式

IR编码文件使用十六进制格式，每字节用空格分隔：

```
a9 04 c5 04 39 4d 3f 50 39 5a 36 e0 01 39 dd 01 3c 50 38 5a 36 4d 3f 4d 3f 4d 3f 4d 3f da 01 3c e1 01 3c 50 3c 53 39 50 3c 50 39 dd 01 3c e4 01 3c 4d 3c 4c 40 da 01 3f e1 01 38 4d 3c e0 01 3c 50 3c 50 3c dd 01 3c da 01 3f 4d 40 4d 3f e0 01 3c cc 30 ac 04 c2 04 3c e0 01 39
```

## MCP集成

命令行模式支持MCP（Model Context Protocol）集成，可以通过单个命令执行所有操作：

```bash
# 示例：学习新的IR编码并保存到文件
python3 ir_control.py --learn-external

# 示例：发送已保存的IR编码
python3 ir_control.py --send-external-file ir_code_1761542575.hex
```

## 注意事项

- 学习模式下需要在10秒内按下遥控器按键
- 外部学习会自动保存到时间戳命名的.hex文件中
- 串口设备默认为 `/dev/ttyS1`，可通过 `--port` 参数修改
- 波特率默认为115200，可通过 `--baud` 参数修改