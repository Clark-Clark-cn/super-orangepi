import serial
import time
import sys
import os
import argparse

# 根据你的 Orange Pi 串口设备文件修改
# 如果启用了 uart1，通常是 /dev/ttyS1
SERIAL_PORT = '/dev/ttyS1'
BAUD_RATE = 115200

def calculate_checksum(address, afn, data):
    """计算校验和"""
    payload = [address, afn] + list(data)
    return sum(payload) % 256

def build_frame(afn, data=b''):
    """构建完整的指令帧"""
    frame_header = b'\x68'
    frame_tail = b'\x16'
    module_address = 0xFF  # 使用广播地址

    # 长度 = 帧头(1) + 长度(2) + 地址(1) + 功能码(1) + 数据(N) + 校验(1) + 帧尾(1)
    length = 7 + len(data)
    
    checksum = calculate_checksum(module_address, afn, data)

    # 长度是2字节，低位在前
    len_low = length & 0xFF
    len_high = (length >> 8) & 0xFF

    # 组装指令
    command = bytearray()
    command.extend(frame_header)
    command.append(len_low)
    command.append(len_high)
    command.append(module_address)
    command.append(afn)
    command.extend(data)
    command.append(checksum)
    command.extend(frame_tail)
    
    return bytes(command)

def parse_args():
    parser = argparse.ArgumentParser(description='红外学习模块控制器')
    parser.add_argument('--port', default=SERIAL_PORT, help=f'串口设备 (默认: {SERIAL_PORT})')
    parser.add_argument('--baud', type=int, default=BAUD_RATE, help=f'波特率 (默认: {BAUD_RATE})')
    
    # 学习和发送操作
    parser.add_argument('--learn-internal', type=int, metavar='INDEX', 
                       help='进入内部学习模式 (索引 0-6)')
    parser.add_argument('--send-internal', type=int, metavar='INDEX',
                       help='发送内部存储编码 (索引 0-6)')
    parser.add_argument('--learn-external', action='store_true',
                       help='进入外部学习模式并保存到文件')
    parser.add_argument('--send-external-hex', metavar='HEX_DATA',
                       help='发送外部编码 (十六进制字符串)')
    parser.add_argument('--send-external-file', metavar='FILENAME',
                       help='从文件发送外部编码')
    
    # 系统设置
    parser.add_argument('--set-baud', type=int, choices=[0,1,2,3,4],
                       help='设置波特率 (0=9600, 1=19200, 2=38400, 3=57600, 4=115200)')
    parser.add_argument('--get-baud', action='store_true', help='获取当前波特率')
    parser.add_argument('--set-address', metavar='ADDR', help='设置模块地址 (00-FE)')
    parser.add_argument('--get-address', action='store_true', help='获取模块地址')
    parser.add_argument('--reset', action='store_true', help='复位模块')
    parser.add_argument('--format', action='store_true', help='格式化模块')
    
    # 上电设置
    parser.add_argument('--set-power-send', nargs=2, metavar=('INDEX', 'FLAG'),
                       help='设置上电发送状态 (索引 0-6, 标志 0/1)')
    parser.add_argument('--get-power-send', type=int, metavar='INDEX',
                       help='获取上电发送状态 (索引 0-6)')
    parser.add_argument('--set-power-delay', type=int, metavar='SECONDS',
                       help='设置上电发送延时时间 (秒)')
    parser.add_argument('--get-power-delay', action='store_true',
                       help='获取上电发送延时时间')
    
    # 编码读写
    parser.add_argument('--write-internal', nargs=2, metavar=('INDEX', 'HEX_DATA'),
                       help='写入内部存储编码 (索引 0-6, 十六进制数据)')
    parser.add_argument('--read-internal', type=int, metavar='INDEX',
                       help='读取内部存储编码 (索引 0-6)')
    
    return parser.parse_args()

def execute_command(ser, args):
    """执行单个命令并返回结果"""
    try:
        if args.learn_internal is not None:
            index = args.learn_internal
            if not 0 <= index <= 6:
                return "错误: 索引必须在 0-6 之间"
            
            print(f"进入内部学习模式，索引: {index}...")
            command = build_frame(0x10, data=bytes([index]))
            ser.write(command)
            print("指令已发送。请在10秒内按遥控器按键。")
            
            response = ser.read(20)
            if response:
                return f"收到回复: {response.hex(' ')}"
            else:
                return "未收到回复"

        elif args.send_internal is not None:
            index = args.send_internal
            if not 0 <= index <= 6:
                return "错误: 索引必须在 0-6 之间"
            
            print(f"发送内部存储编码，索引: {index}...")
            command = build_frame(0x12, data=bytes([index]))
            ser.write(command)
            
            response = ser.read(20)
            if response:
                return f"收到回复: {response.hex(' ')}"
            return "指令已发送"

        elif args.learn_external:
            print("进入外部学习模式...")
            command = build_frame(0x20)
            ser.write(command)
            print("指令已发送。请在10秒内按遥控器按键。")
            
            response = ser.read(500)
            if response and len(response) >= 7 and response[0] == 0x68 and response[4] == 0x22:
                data = response[5:-2]
                if data:
                    filename = f"ir_code_{int(time.time())}.hex"
                    with open(filename, 'w') as f:
                        f.write(data.hex(' '))
                    return f"成功保存到文件: {os.path.abspath(filename)} (数据长度: {len(data)} 字节)"
                else:
                    return "错误: 提取的数据为空"
            elif response and len(response) >= 8 and response[0] == 0x68 and response[4] == 0x01:
                status = response[5]
                if status == 0:
                    print("等待学习结果...")
                    response2 = ser.read(500)
                    if response2 and len(response2) >= 7 and response2[0] == 0x68 and response2[4] == 0x22:
                        data = response2[5:-2]
                        if data:
                            filename = f"ir_code_{int(time.time())}.hex"
                            with open(filename, 'w') as f:
                                f.write(data.hex(' '))
                            return f"成功保存到文件: {os.path.abspath(filename)} (数据长度: {len(data)} 字节)"
                        else:
                            return "错误: 第二次响应中的数据为空"
                    else:
                        return "未收到学习成功的数据帧"
                else:
                    return f"进入学习模式失败，状态码: {status}"
            else:
                return f"未收到有效响应: {response.hex(' ') if response else '无响应'}"

        elif args.send_external_hex:
            try:
                data = bytes.fromhex(args.send_external_hex.replace(' ', ''))
            except ValueError:
                return "错误: 无效的十六进制数据"
            
            print("发送外部编码...")
            command = build_frame(0x22, data=data)
            ser.write(command)
            
            response = ser.read(8)
            if response:
                return f"收到回复: {response.hex(' ')}"
            return "指令已发送"

        elif args.send_external_file:
            try:
                with open(args.send_external_file, 'r') as f:
                    data_hex = f.read().strip()
                data = bytes.fromhex(data_hex.replace(' ', ''))
            except FileNotFoundError:
                return f"错误: 文件 '{args.send_external_file}' 不存在"
            except ValueError:
                return "错误: 文件中的数据格式无效"
            
            print(f"从文件 '{args.send_external_file}' 发送外部编码...")
            command = build_frame(0x22, data=data)
            ser.write(command)
            
            response = ser.read(8)
            if response:
                return f"收到回复: {response.hex(' ')}"
            return "指令已发送"

        elif args.set_baud is not None:
            baud_index = args.set_baud
            print(f"设置波特率，索引: {baud_index}...")
            command = build_frame(0x03, data=bytes([baud_index]))
            ser.write(command)
            
            response = ser.read(8)
            if response:
                return f"收到回复: {response.hex(' ')}"
            return "指令已发送"

        elif args.get_baud:
            print("获取波特率...")
            command = build_frame(0x04)
            ser.write(command)
            
            response = ser.read(8)
            if response and len(response) == 8 and response[0] == 0x68 and response[4] == 0x04:
                baud_rates = {0: "9600", 1: "19200", 2: "38400", 3: "57600", 4: "115200"}
                baud_index = response[5]
                current_baud = baud_rates.get(baud_index, "未知")
                return f"当前波特率: {current_baud} (索引: {baud_index})"
            else:
                return "获取失败"

        elif args.set_address:
            try:
                addr = int(args.set_address, 16)
                if not 0x00 <= addr <= 0xFE:
                    return "错误: 地址必须在 00-FE 之间"
            except ValueError:
                return "错误: 无效的十六进制地址"
            
            print(f"设置模块地址为: {args.set_address}...")
            command = build_frame(0x05, data=bytes([addr]))
            ser.write(command)
            
            response = ser.read(8)
            if response:
                return f"收到回复: {response.hex(' ')}"
            return "指令已发送"

        elif args.get_address:
            print("获取模块地址...")
            command = build_frame(0x06)
            ser.write(command)
            
            response = ser.read(8)
            if response and len(response) == 8 and response[0] == 0x68 and response[4] == 0x06:
                addr = response[5]
                return f"当前地址: {addr:02X}"
            else:
                return "获取失败"

        elif args.reset:
            print("复位模块...")
            command = build_frame(0x07)
            ser.write(command)
            
            response = ser.read(8)
            if response:
                return f"收到回复: {response.hex(' ')}"
            return "指令已发送"

        elif args.format:
            print("格式化模块...")
            command = build_frame(0x08)
            ser.write(command)
            
            response = ser.read(8)
            if response:
                return f"收到回复: {response.hex(' ')}"
            return "指令已发送"

        elif args.set_power_send:
            try:
                index = int(args.set_power_send[0])
                flag = int(args.set_power_send[1])
                if not (0 <= index <= 6 and flag in [0, 1]):
                    return "错误: 索引 0-6，标志 0 或 1"
            except ValueError:
                return "错误: 无效的参数"
            
            print(f"设置上电发送状态，索引: {index}, 标志: {flag}...")
            command = build_frame(0x13, data=bytes([index, flag]))
            ser.write(command)
            
            response = ser.read(8)
            if response:
                return f"收到回复: {response.hex(' ')}"
            return "指令已发送"

        elif args.get_power_send:
            index = args.get_power_send
            if not 0 <= index <= 6:
                return "错误: 索引必须在 0-6 之间"
            
            print(f"获取上电发送状态，索引: {index}...")
            command = build_frame(0x14, data=bytes([index]))
            ser.write(command)
            
            response = ser.read(9)
            if response and len(response) == 9 and response[0] == 0x68 and response[4] == 0x14:
                flag = response[6]
                return f"上电发送标志: {flag} (0=关闭, 1=开启)"
            else:
                return "获取失败"

        elif args.set_power_delay:
            delay = args.set_power_delay
            if not 0 <= delay <= 65536:
                return "错误: 时间必须在 0-65536 秒之间"
            
            print(f"设置上电发送延时时间: {delay} 秒...")
            delay_bytes = delay.to_bytes(2, byteorder='little')
            command = build_frame(0x15, data=delay_bytes)
            ser.write(command)
            
            response = ser.read(8)
            if response:
                return f"收到回复: {response.hex(' ')}"
            return "指令已发送"

        elif args.get_power_delay:
            print("获取上电发送延时时间...")
            command = build_frame(0x16)
            ser.write(command)
            
            response = ser.read(9)
            if response and len(response) == 9 and response[0] == 0x68 and response[4] == 0x16:
                delay = int.from_bytes(response[5:7], byteorder='little')
                return f"延时时间: {delay} 秒"
            else:
                return "获取失败"

        elif args.write_internal:
            try:
                index = int(args.write_internal[0])
                data_hex = args.write_internal[1]
                data = bytes.fromhex(data_hex.replace(' ', ''))
                if not 0 <= index <= 6:
                    return "错误: 索引必须在 0-6 之间"
            except ValueError:
                return "错误: 无效的十六进制数据"
            
            print(f"写入内部存储编码，索引: {index}...")
            command = build_frame(0x17, data=bytes([index]) + data)
            ser.write(command)
            
            response = ser.read(8)
            if response:
                return f"收到回复: {response.hex(' ')}"
            return "指令已发送"

        elif args.read_internal:
            index = args.read_internal
            if not 0 <= index <= 6:
                return "错误: 索引必须在 0-6 之间"
            
            print(f"读取内部存储编码，索引: {index}...")
            command = build_frame(0x18, data=bytes([index]))
            ser.write(command)
            
            response = ser.read(200)
            if response and response[0] == 0x68 and response[4] == 0x18:
                status = response[6]
                if status == 0:
                    data = response[7:-2]
                    return f"读取成功，数据长度: {len(data)} 字节\n数据: {data.hex(' ')}"
                else:
                    return "读取失败，数据为空"
            else:
                return "读取失败"

        else:
            return "错误: 未指定有效操作"

    except Exception as e:
        return f"错误: {str(e)}"

def main():
    args = parse_args()
    
    # 如果没有指定任何操作参数，则进入交互模式
    if not any([args.learn_internal is not None, args.send_internal is not None, args.learn_external,
                args.send_external_hex, args.send_external_file, args.set_baud is not None,
                args.get_baud, args.set_address, args.get_address, args.reset, args.format,
                args.set_power_send, args.get_power_send is not None, args.set_power_delay is not None,
                args.get_power_delay, args.write_internal, args.read_internal is not None]):
        # 进入交互模式
        interactive_mode()
        return
    
    # 命令行模式
    try:
        ser = serial.Serial(args.port, args.baud, timeout=2)
        print(f"成功打开串口 {args.port}")
    except serial.SerialException as e:
        print(f"错误: 无法打开串口 {args.port}. {e}")
        return

    result = execute_command(ser, args)
    print(result)
    
    ser.close()

def interactive_mode():
    """原来的交互模式代码"""
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=2)
        print(f"成功打开串口 {SERIAL_PORT}")
    except serial.SerialException as e:
        print(f"错误: 无法打开串口 {SERIAL_PORT}. {e}")
        print("请检查：1. 硬件连接是否正确？ 2. 是否已使用 armbian-config 启用 uart1？")
        return

    # 获取并打印当前波特率
    print("\n[查询] 正在获取模块当前波特率...")
    get_baud_rate_command = build_frame(0x04)  # AFN=04H for getting baud rate
    ser.write(get_baud_rate_command)
    response = ser.read(8)  # 响应帧固定为8字节

    if response and len(response) == 8 and response[0] == 0x68 and response[4] == 0x04:
        baud_rates = {
            0: "9600 bps",
            1: "19200 bps",
            2: "38400 bps",
            3: "57600 bps",
            4: "115200 bps",
        }
        baud_index = response[5]
        current_baud = baud_rates.get(baud_index, "未知")
        print(f"[结果] 模块当前波特率: {current_baud} (索引: {baud_index})")
    else:
        print("[结果] 获取波特率失败或响应超时。")

    print("\n-------------------- 红外学习模块控制器 --------------------")
    print(" 1: 进入内部学习模式 (学习并存到模块)     2: 发送内部存储的红外码")
    print(" 3: 设置波特率                            4: 获取波特率")
    print(" 5: 设置模块地址                          6: 获取模块地址")
    print(" 7: 复位模块                              8: 格式化模块")
    print(" 9: 退出内部学习模式                      10: 设置上电发送内部编码状态")
    print("11: 获取上电发送内部编码状态              12: 设置上电发送延时时间")
    print("13: 获取上电发送延时时间                  14: 写入内部存储编码")
    print("15: 读取内部存储编码                      16: 外部学习模式 (输入文件名保存)")
    print("17: 退出外部学习模式                      18: 发送外部存储编码")
    print("19: 从文件发送外部编码                    20: 退出程序")
    print("------------------------------------------------------------")

    while True:
        choice = input("请输入选项 (1-20): ")

        if choice == '1':
            try:
                index = int(input("请输入要存储的内部索引 (0-6): "))
                if not 0 <= index <= 6:
                    print("索引必须在 0 到 6 之间。")
                    continue
            except ValueError:
                print("无效的输入。")
                continue
                
            print(f"\n[动作] 进入内部学习模式，索引: {index}...")
            # 功能码 10H: 进入内部编码存储学习模式
            command = build_frame(0x10, data=bytes([index]))
            ser.write(command)
            
            print("指令已发送。请在10秒内将遥控器对准模块并按下按键。")
            print("模块绿灯应常亮，学习成功后熄灭。")
            
            # 等待模块的回复
            response = ser.read(20) # 读取足够多的字节
            if response:
                print(f"收到模块回复: {response.hex(' ')}")
            else:
                print("未收到学习成功的回复，可能超时或失败。")

        elif choice == '2':
            try:
                index = int(input("请输入要发送的内部索引 (0-6): "))
                if not 0 <= index <= 6:
                    print("索引必须在 0 到 6 之间。")
                    continue
            except ValueError:
                print("无效的输入。")
                continue

            print(f"\n[动作] 发送内部存储的红外码，索引: {index}...")
            # 功能码 12H: 发送内部存储编码
            command = build_frame(0x12, data=bytes([index]))
            ser.write(command)
            print("指令已发送。")
            
            response = ser.read(20)
            if response:
                print(f"收到模块回复: {response.hex(' ')}")

        elif choice == '3':
            try:
                baud_index = int(input("请输入波特率索引 (0=9600, 1=19200, 2=38400, 3=57600, 4=115200): "))
                if not 0 <= baud_index <= 4:
                    print("索引必须在 0 到 4 之间。")
                    continue
            except ValueError:
                print("无效的输入。")
                continue

            print(f"\n[动作] 设置波特率，索引: {baud_index}...")
            command = build_frame(0x03, data=bytes([baud_index]))
            ser.write(command)
            print("指令已发送。")
            
            response = ser.read(8)
            if response:
                print(f"收到模块回复: {response.hex(' ')}")

        elif choice == '4':
            print("\n[动作] 获取波特率...")
            command = build_frame(0x04)
            ser.write(command)
            
            response = ser.read(8)
            if response and len(response) == 8 and response[0] == 0x68 and response[4] == 0x04:
                baud_rates = {
                    0: "9600 bps",
                    1: "19200 bps",
                    2: "38400 bps",
                    3: "57600 bps",
                    4: "115200 bps",
                }
                baud_index = response[5]
                current_baud = baud_rates.get(baud_index, "未知")
                print(f"[结果] 模块当前波特率: {current_baud} (索引: {baud_index})")
            else:
                print("[结果] 获取波特率失败。")

        elif choice == '5':
            try:
                addr_str = input("请输入新模块地址 (00-FE, 十六进制): ").strip().upper()
                addr = int(addr_str, 16)
                if not 0x00 <= addr <= 0xFE:
                    print("地址必须在 00 到 FE 之间。")
                    continue
            except ValueError:
                print("无效的十六进制地址。")
                continue

            print(f"\n[动作] 设置模块地址为: {addr_str}...")
            command = build_frame(0x05, data=bytes([addr]))
            ser.write(command)
            print("指令已发送。")
            
            response = ser.read(8)
            if response:
                print(f"收到模块回复: {response.hex(' ')}")

        elif choice == '6':
            print("\n[动作] 获取模块地址...")
            command = build_frame(0x06)
            ser.write(command)
            
            response = ser.read(8)
            if response and len(response) == 8 and response[0] == 0x68 and response[4] == 0x06:
                addr = response[5]
                print(f"[结果] 模块当前地址: {addr:02X}")
            else:
                print("[结果] 获取地址失败。")

        elif choice == '7':
            print("\n[动作] 复位模块...")
            command = build_frame(0x07)
            ser.write(command)
            print("指令已发送。")
            
            response = ser.read(8)
            if response:
                print(f"收到模块回复: {response.hex(' ')}")

        elif choice == '8':
            print("\n[动作] 格式化模块...")
            command = build_frame(0x08)
            ser.write(command)
            print("指令已发送。")
            
            response = ser.read(8)
            if response:
                print(f"收到模块回复: {response.hex(' ')}")

        elif choice == '9':
            print("\n[动作] 退出内部学习模式...")
            command = build_frame(0x11)
            ser.write(command)
            print("指令已发送。")
            
            response = ser.read(8)
            if response:
                print(f"收到模块回复: {response.hex(' ')}")

        elif choice == '10':
            try:
                index = int(input("请输入内部索引 (0-6): "))
                flag = int(input("请输入上电发送标志 (0=关闭, 1=开启): "))
                if not (0 <= index <= 6 and flag in [0, 1]):
                    print("索引 0-6，标志 0 或 1。")
                    continue
            except ValueError:
                print("无效的输入。")
                continue

            print(f"\n[动作] 设置上电发送状态，索引: {index}, 标志: {flag}...")
            command = build_frame(0x13, data=bytes([index, flag]))
            ser.write(command)
            print("指令已发送。")
            
            response = ser.read(8)
            if response:
                print(f"收到模块回复: {response.hex(' ')}")

        elif choice == '11':
            try:
                index = int(input("请输入内部索引 (0-6): "))
                if not 0 <= index <= 6:
                    print("索引必须在 0 到 6 之间。")
                    continue
            except ValueError:
                print("无效的输入。")
                continue

            print(f"\n[动作] 获取上电发送状态，索引: {index}...")
            command = build_frame(0x14, data=bytes([index]))
            ser.write(command)
            
            response = ser.read(9)
            if response and len(response) == 9 and response[0] == 0x68 and response[4] == 0x14:
                flag = response[6]
                print(f"[结果] 上电发送标志: {flag} (0=关闭, 1=开启)")
            else:
                print("[结果] 获取失败。")

        elif choice == '12':
            try:
                delay = int(input("请输入延时时间 (秒, 0-65536): "))
                if not 0 <= delay <= 65536:
                    print("时间必须在 0 到 65536 秒之间。")
                    continue
            except ValueError:
                print("无效的输入。")
                continue

            print(f"\n[动作] 设置上电发送延时时间: {delay} 秒...")
            delay_bytes = delay.to_bytes(2, byteorder='little')
            command = build_frame(0x15, data=delay_bytes)
            ser.write(command)
            print("指令已发送。")
            
            response = ser.read(8)
            if response:
                print(f"收到模块回复: {response.hex(' ')}")

        elif choice == '13':
            print("\n[动作] 获取上电发送延时时间...")
            command = build_frame(0x16)
            ser.write(command)
            
            response = ser.read(9)
            if response and len(response) == 9 and response[0] == 0x68 and response[4] == 0x16:
                delay = int.from_bytes(response[5:7], byteorder='little')
                print(f"[结果] 延时时间: {delay} 秒")
            else:
                print("[结果] 获取失败。")

        elif choice == '14':
            try:
                index = int(input("请输入内部索引 (0-6): "))
                data_hex = input("请输入红外编码数据 (十六进制字符串, 如 '85 01 1F...'): ").strip()
                data = bytes.fromhex(data_hex.replace(' ', ''))
                if not 0 <= index <= 6:
                    print("索引必须在 0 到 6 之间。")
                    continue
            except ValueError:
                print("无效的十六进制数据。")
                continue

            print(f"\n[动作] 写入内部存储编码，索引: {index}...")
            command = build_frame(0x17, data=bytes([index]) + data)
            ser.write(command)
            print("指令已发送。")
            
            response = ser.read(8)
            if response:
                print(f"收到模块回复: {response.hex(' ')}")

        elif choice == '15':
            try:
                index = int(input("请输入内部索引 (0-6): "))
                if not 0 <= index <= 6:
                    print("索引必须在 0 到 6 之间。")
                    continue
            except ValueError:
                print("无效的输入。")
                continue

            print(f"\n[动作] 读取内部存储编码，索引: {index}...")
            command = build_frame(0x18, data=bytes([index]))
            ser.write(command)
            
            response = ser.read(200)  # 读取足够多的字节
            if response and response[0] == 0x68 and response[4] == 0x18:
                status = response[6]
                if status == 0:
                    data = response[7:-2]  # 去掉帧头等
                    print(f"[结果] 读取成功，数据长度: {len(data)} 字节")
                    print(f"数据: {data.hex(' ')}")
                else:
                    print("[结果] 读取失败，数据项为空。")
            else:
                print("[结果] 读取失败。")

        elif choice == '16':
            filename = input("请输入要保存的文件名 (如: tv_power.hex): ").strip()
            if not filename:
                print("文件名不能为空。")
                continue
            if not filename.endswith('.hex'):
                filename += '.hex'
            
            print("\n[动作] 进入外部学习模式...")
            command = build_frame(0x20)
            ser.write(command)
            print("指令已发送。请在10秒内将遥控器对准模块并按下按键。")
            print(f"学习成功后，红外编码将保存到文件: {filename}")
            
            # 等待更长时间，因为学习需要时间
            response = ser.read(500)  # 增加缓冲区大小
            if response:
                print(f"[调试] 收到原始数据: {response.hex(' ')}")
                print(f"[调试] 数据长度: {len(response)} 字节")
                
                if len(response) >= 7 and response[0] == 0x68 and response[4] == 0x22:
                    # 提取红外数据：从数据域开始到校验前
                    # 帧结构：帧头(1) + 长度(2) + 地址(1) + AFN(1) + 数据(N) + 校验(1) + 帧尾(1)
                    data_start = 5  # 数据域开始位置
                    data_end = -2   # 去掉校验和帧尾
                    data = response[data_start:data_end]
                    
                    if data:
                        try:
                            with open(filename, 'w') as f:
                                f.write(data.hex(' '))
                            print(f"[成功] 红外编码已保存到文件: {filename}")
                            print(f"数据长度: {len(data)} 字节")
                            print(f"文件位置: {os.path.abspath(filename)}")
                        except Exception as e:
                            print(f"[错误] 保存文件失败: {e}")
                    else:
                        print("[错误] 提取的数据为空")
                elif len(response) >= 8 and response[0] == 0x68 and response[4] == 0x01:
                    # 可能是应答帧，表示进入学习模式成功
                    status = response[5]
                    if status == 0:
                        print("[状态] 成功进入学习模式，请按遥控器按键")
                        # 继续等待学习结果
                        print("等待学习结果...")
                        response2 = ser.read(500)
                        if response2 and len(response2) >= 7 and response2[0] == 0x68 and response2[4] == 0x22:
                            data = response2[5:-2]
                            if data:
                                try:
                                    with open(filename, 'w') as f:
                                        f.write(data.hex(' '))
                                    print(f"[成功] 红外编码已保存到文件: {filename}")
                                    print(f"数据长度: {len(data)} 字节")
                                    print(f"文件位置: {os.path.abspath(filename)}")
                                except Exception as e:
                                    print(f"[错误] 保存文件失败: {e}")
                            else:
                                print("[错误] 第二次响应中的数据为空")
                        else:
                            print("[调试] 未收到学习成功的数据帧")
                            if response2:
                                print(f"[调试] 第二次响应: {response2.hex(' ')}")
                    else:
                        print(f"[错误] 进入学习模式失败，状态码: {status}")
                else:
                    print(f"[调试] 收到未知响应格式")
            else:
                print("未收到任何响应，可能超时或硬件连接问题。")

        elif choice == '17':
            print("\n[动作] 退出外部学习模式...")
            command = build_frame(0x21)
            ser.write(command)
            print("指令已发送。")
            
            response = ser.read(8)
            if response:
                print(f"收到模块回复: {response.hex(' ')}")

        elif choice == '18':
            data_hex = input("请输入红外编码数据 (十六进制字符串, 如从外部学习获取的): ").strip()
            try:
                data = bytes.fromhex(data_hex.replace(' ', ''))
            except ValueError:
                print("无效的十六进制数据。")
                continue

            print("\n[动作] 发送外部存储编码...")
            command = build_frame(0x22, data=data)
            ser.write(command)
            print("指令已发送。")
            
            response = ser.read(8)
            if response:
                print(f"收到模块回复: {response.hex(' ')}")

        elif choice == '19':
            filename = input("请输入要读取的红外编码文件名: ").strip()
            try:
                with open(filename, 'r') as f:
                    data_hex = f.read().strip()
                data = bytes.fromhex(data_hex.replace(' ', ''))
            except FileNotFoundError:
                print(f"文件 '{filename}' 不存在。")
                continue
            except ValueError:
                print("文件中的数据格式无效。")
                continue

            print(f"\n[动作] 从文件 '{filename}' 发送外部编码...")
            command = build_frame(0x22, data=data)
            ser.write(command)
            print("指令已发送。")
            
            response = ser.read(8)
            if response:
                print(f"收到模块回复: {response.hex(' ')}")

        elif choice == '20':
            print("程序退出。")
            break
        
        else:
            print("无效选项，请重新输入。")

    ser.close()

if __name__ == '__main__':
    main()