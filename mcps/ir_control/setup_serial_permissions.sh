#!/bin/bash

# 红外学习模块串口权限设置脚本
# 用于解决普通用户访问串口设备需要sudo的问题

echo "=== 红外学习模块串口权限设置 ==="

# 检查当前用户是否在dialout组
if groups | grep -q dialout; then
    echo "✓ 用户已在dialout组中"
else
    echo "✗ 用户不在dialout组中，正在添加..."
    sudo usermod -a -G dialout $USER
    echo "请重新登录或运行 'newgrp dialout' 以使组更改生效"
fi

# 检查串口设备权限
if [ -e /dev/ttyS1 ]; then
    PERMS=$(stat -c "%a" /dev/ttyS1)
    if [ "$PERMS" = "660" ]; then
        echo "✓ 串口设备权限正确 (660)"
    else
        echo "✗ 串口设备权限不正确，正在修复..."
        sudo chmod 660 /dev/ttyS1
        sudo chown root:dialout /dev/ttyS1
        echo "✓ 串口设备权限已修复"
    fi
else
    echo "✗ 串口设备 /dev/ttyS1 不存在"
    echo "请确保UART1已启用 (使用 armbian-config)"
fi

# 测试访问权限
echo -e "\n测试串口访问权限..."
python3 -c "
import serial
try:
    ser = serial.Serial('/dev/ttyS1', 115200, timeout=1)
    print('✓ 串口访问成功，无需sudo')
    ser.close()
except PermissionError:
    print('✗ 串口访问失败，可能需要重新登录或检查权限')
except Exception as e:
    print(f'✗ 串口访问出错: {e}')
"

echo -e "\n=== 设置完成 ==="
echo "现在应该可以直接运行: python3 ir_control.py"