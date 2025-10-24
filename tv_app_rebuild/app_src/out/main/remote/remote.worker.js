"use strict";
const net = require("net");
const dgram = require("dgram");
let Input;
let activeTcpSocket = null;
const commandQueue = [];
let processingQueue = false;
function enqueueCommand(command) {
  commandQueue.push(command);
  if (!processingQueue) void processQueue();
}
async function processQueue() {
  processingQueue = true;
  try {
    while (commandQueue.length) {
      const cmd = commandQueue.shift();
      await handleCommand(cmd);
    }
  } finally {
    processingQueue = false;
  }
}
async function handleCommand(command) {
  if (command.type === "ping") {
    if (activeTcpSocket && !activeTcpSocket.destroyed) {
      activeTcpSocket.write(`{"type":"pong","timestamp":${command.timestamp ?? Date.now()}}
`);
    }
    return;
  }
  if (command.type === "viewAction") {
    if (command.action && process.send) {
      process.send({ type: "viewAction", command });
    }
    return;
  }
  switch (command.type) {
    case "keyTap":
      if (command.payload != null) await Input.executeKeyTap(command.payload);
      break;
    case "keyDown":
      if (command.payload != null) await Input.executeKeyDown(command.payload);
      break;
    case "keyUp":
      if (command.payload != null) await Input.executeKeyUp(command.payload);
      break;
    case "mouseClick":
      console.log("[Worker] 收到 mouseClick 指令:", command);
      if (command.payload) await Input.executeMouseClick(command.payload);
      break;
    case "mouseDown":
      if (command.payload) await Input.executeMouseDown(command.payload);
      break;
    case "mouseUp":
      if (command.payload) await Input.executeMouseUp(command.payload);
      break;
    // 新增音量控制处理逻辑
    case "volumeControl":
      console.log("[Worker] 收到音量控制指令:", command);
      if (command.payload?.direction === "up") {
        await Input.volumeUp();
      } else if (command.payload?.direction === "down") {
        await Input.volumeDown();
      }
      break;
    case "reloadInputModule":
      console.log("[Worker] 收到重载输入模块指令，重新加载 nut-js 配置");
      if (process.platform === "linux" && !process.env.WAYLAND_DISPLAY) {
        try {
          const inputLinuxModule = await Promise.resolve().then(() => require("../chunks/inputLinux-Rlqf4w4u.js"));
          Input = inputLinuxModule;
          console.log("[Worker] nut-js 配置已重载");
        } catch (e) {
          console.error("[Worker] nut-js 重载失败:", e);
        }
      }
      break;
    default:
      console.warn(`[Worker] Unknown command type: ${command.type}`);
  }
}
const UDP_TYPE = {
  TOUCH_MOVE: 1,
  SCROLL: 3,
  MOUSE_BUTTON: 4,
  GAMEPAD_INPUT: 5,
  // 新增手柄输入类型
  VIBRATION: 6
  // 新增手柄震动类型
};
async function initializeRemoteServices() {
  console.log("[Worker] Starting remote control services initialization...");
  let gamepadUdpServer;
  let gamepadClientInfo = null;
  const loadInputModule = async () => {
    console.log(`[Worker] Detected platform: ${process.platform}. Loading input module...`);
    try {
      switch (process.platform) {
        case "darwin":
          Input = await Promise.resolve().then(() => require("../chunks/inputMac-CY4JAoRi.js"));
          break;
        case "linux":
          Input = process.env.WAYLAND_DISPLAY ? await Promise.resolve().then(() => require("../chunks/inputLinux_wayland-B2TMCzma.js")) : await Promise.resolve().then(() => require("../chunks/inputLinux-Rlqf4w4u.js"));
          break;
        default:
          console.error(`[Worker] Unsupported platform: ${process.platform}. Falling back to Win module.`);
          Input = await Promise.resolve().then(() => require("../chunks/inputWin-BzjUvCPg.js"));
          break;
      }
      console.log("[Worker] Input module loaded successfully.");
    } catch (error) {
      console.error("[Worker] Failed to load input module:", error);
      throw error;
    }
  };
  const setupNetworkAndIPC = () => {
    return new Promise((resolve) => {
      console.log("[Worker] Setting up network services and IPC listeners...");
      const tcpServer = net.createServer((socket) => {
        console.log("[Worker] TCP client connected.");
        socket.setNoDelay(true);
        socket.setKeepAlive(true, 1e3);
        activeTcpSocket = socket;
        let buffer = "";
        socket.on("data", (data) => {
          buffer += data.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.trim()) {
              try {
                const command = JSON.parse(line);
                if (command.type === "ping") {
                  handleCommand(command);
                } else {
                  enqueueCommand(command);
                }
              } catch (e) {
                console.error("[Worker] Failed to parse TCP command:", line, e);
              }
            }
          }
        });
        socket.on("end", () => {
          console.log("[Worker] TCP client disconnected.");
          activeTcpSocket = null;
          commandQueue.length = 0;
        });
        socket.on("error", (err) => {
          console.error("[Worker] TCP Socket Error:", err.message);
          activeTcpSocket = null;
          commandQueue.length = 0;
        });
      });
      tcpServer.maxConnections = 1;
      const udpServer = dgram.createSocket("udp4");
      udpServer.on("message", (msg) => {
        if (!Input) return;
        if (msg.length > 0) {
          const typeByte = msg[0];
          switch (typeByte) {
            case UDP_TYPE.TOUCH_MOVE:
              if (msg.length >= 5) Input.handleTouchMove(msg.readInt16LE(1), msg.readInt16LE(3));
              break;
            case UDP_TYPE.SCROLL:
              if (msg.length >= 5) Input.handleScroll(msg.readInt16LE(1), msg.readInt16LE(3));
              break;
            case UDP_TYPE.MOUSE_BUTTON:
              if (msg.length >= 3) void Input.handleBinaryMouseButton(msg[1], msg[2]);
              break;
          }
        }
      });
      gamepadUdpServer = dgram.createSocket("udp4");
      gamepadUdpServer.on("message", (msg, rinfo) => {
        if (!gamepadClientInfo || gamepadClientInfo.address !== rinfo.address || gamepadClientInfo.port !== rinfo.port) {
          console.log(`[Worker] Gamepad client registered/updated: ${rinfo.address}:${rinfo.port}`);
          gamepadClientInfo = { address: rinfo.address, port: rinfo.port };
        }
        if (!Input) return;
        if (msg.length > 0) {
          const typeByte = msg[0];
          if (typeByte === UDP_TYPE.GAMEPAD_INPUT) {
            if (Input.handleGamepadInput) {
              Input.handleGamepadInput(msg);
            }
          }
        }
      });
      process.on("message", (message) => {
        if (!Input) return;
        if (message.type === "stateUpdate") {
          if (!activeTcpSocket || activeTcpSocket.destroyed) return;
          if (message.payload && message.payload.activeView) {
            try {
              const viewData = JSON.parse(message.payload.activeView);
              const dataToSend = { type: "pcData", payload: viewData };
              activeTcpSocket.write(JSON.stringify(dataToSend) + "\n");
            } catch {
              const legacyData = { type: "stateUpdate", payload: { activeView: message.payload.activeView } };
              activeTcpSocket.write(JSON.stringify(legacyData) + "\n");
            }
          }
        } else if (message.type === "viewAction" && message.action === "douyinMouse") {
          console.log("[Worker] Received douyinMouse command from main process.");
          const { x, y, width, height } = message.payload;
          Input.douyinMouse(x, y, width, height).catch((err) => {
            console.error("[Worker] Executing douyinMouse failed:", err);
          });
        } else if (message.type === "viewAction" && message.action === "TVMouseClick") {
          console.log("[Worker] 鼠标点击了!!!!!!!!!!!");
          Input.executeMouseClick("left").catch((err) => {
            console.error("[Worker] TVMouseClick 执行失败:", err);
          });
        }
      });
      let serversReady = 0;
      const onServerReady = () => {
        serversReady++;
        if (serversReady === 3) {
          console.log("[Worker] All network services are up and running.");
          resolve();
        }
      };
      tcpServer.listen(16671, () => {
        console.log("[Worker] TCP server started on port 16671.");
        onServerReady();
      });
      udpServer.bind(16672, () => {
        console.log("[Worker] UDP server started on port 16672.");
        onServerReady();
      });
      gamepadUdpServer.bind(56673, () => {
        console.log("[Worker] Gamepad UDP server started on port 56673.");
        onServerReady();
      });
    });
  };
  await Promise.all([loadInputModule(), setupNetworkAndIPC()]);
  console.log("[Worker] Remote control worker process started.");
}
process.on("uncaughtException", (error) => {
  console.error("[Worker] Uncaught Exception:", error);
});
process.on("unhandledRejection", (reason) => {
  console.error("[Worker] Unhandled Rejection:", reason);
});
const cleanup = () => {
  console.log("[Worker] Exiting...");
  process.exit(0);
};
process.on("SIGTERM", cleanup);
process.on("SIGINT", cleanup);
initializeRemoteServices().catch((error) => {
  console.error("[Worker] Failed to initialize remote services:", error);
  process.exit(1);
});
