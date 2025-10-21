"""温度和湿度工具实现.

提供获取室内温度和湿度数据的功能
"""

import asyncio
import json
import os
from typing import Any, Dict


async def get_temperature_humidity(args: Dict[str, Any]) -> str:
    """
    获取室内温度和湿度数据.

    Args:
        args: 参数字典（保留兼容性）

    Returns:
        JSON字符串，包含温度和湿度数据
    """
    try:
        # 默认数据文件路径
        data_file = "/var/lib/temperature_humidity.json"

        # 检查文件是否存在
        if not os.path.exists(data_file):
            return json.dumps({
                "error": f"温度数据文件不存在: {data_file}。请检查温度监控服务是否正在运行。",
                "service_status": "stopped"
            }, ensure_ascii=False)

        # 检查文件是否可读
        if not os.access(data_file, os.R_OK):
            return json.dumps({
                "error": f"无法读取温度数据文件: {data_file}",
                "service_status": "permission_denied"
            }, ensure_ascii=False)

        # 读取文件内容
        try:
            with open(data_file, 'r', encoding='utf-8') as f:
                content = f.read().strip()

            if not content:
                return json.dumps({
                    "error": "温度数据文件为空",
                    "service_status": "no_data"
                }, ensure_ascii=False)

            # 解析JSON数据
            data = json.loads(content)

            # 验证数据结构
            required_fields = ['timestamp', 'humidity', 'temperature', 'unit']
            for field in required_fields:
                if field not in data:
                    return json.dumps({
                        "error": f"数据文件格式错误，缺少字段: {field}",
                        "service_status": "invalid_format"
                    }, ensure_ascii=False)

            # 添加服务状态
            data['service_status'] = 'running'

            return json.dumps(data, ensure_ascii=False, indent=2)

        except json.JSONDecodeError as e:
            return json.dumps({
                "error": f"数据文件JSON格式错误: {str(e)}",
                "service_status": "json_error"
            }, ensure_ascii=False)
        except Exception as e:
            return json.dumps({
                "error": f"读取数据文件失败: {str(e)}",
                "service_status": "read_error"
            }, ensure_ascii=False)

    except Exception as e:
        return json.dumps({
            "error": f"获取温度湿度数据失败: {str(e)}",
            "service_status": "unknown_error"
        }, ensure_ascii=False)