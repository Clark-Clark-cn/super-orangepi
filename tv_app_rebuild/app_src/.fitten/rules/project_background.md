# 项目背景信息

## 技术栈
- Electron 桌面应用程序框架
- Vue 3 前端框架
- TypeScript 编程语言
- IPC 进程间通信

## 项目结构
```
src/
├── main/        # Electron主进程代码
│   ├── ipcHandlers.ts    # IPC通信处理
│   ├── remote.worker.ts  # 远程控制功能
│   ├── storeManager.ts   # 数据存储管理
│   └── viewManager.ts    # 视图管理系统
├── preload/     # 预加载脚本
└── renderer/    # Vue渲染进程
    ├── components/  # Vue组件
    ├── router/      # 路由配置
    ├── tools/       # 工具函数
    └── views/       # 页面视图
```

## 核心功能
1. 多窗口视图管理系统
2. 基于IPC的进程间通信
3. 远程控制功能
4. 自定义视图配置

## 开发注意事项
1. 主进程和渲染进程代码分离
2. 通过预加载脚本暴露安全的Electron API
3. 使用TypeScript确保类型安全
4. 注意新旧版本代码的兼容性
