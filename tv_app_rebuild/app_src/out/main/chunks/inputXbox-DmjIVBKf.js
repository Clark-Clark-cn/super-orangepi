"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const ViGEmClient = require("vigemclient");
class XboxController {
  client;
  controller;
  isConnected = false;
  currentState;
  vibrationCallback = null;
  //  public currentState: GamepadState; // ← 改为public
  constructor() {
    this.currentState = {
      leftStickX: 0,
      leftStickY: 0,
      rightStickX: 0,
      rightStickY: 0,
      leftTrigger: 0,
      rightTrigger: 0,
      buttons: {
        A: false,
        B: false,
        X: false,
        Y: false,
        leftBumper: false,
        rightBumper: false,
        back: false,
        start: false,
        leftStick: false,
        rightStick: false,
        dpadUp: false,
        dpadDown: false,
        dpadLeft: false,
        dpadRight: false,
        guide: false
      }
    };
  }
  // 初始化并连接虚拟手柄
  async connect(vibrationCallback) {
    if (vibrationCallback) {
      this.vibrationCallback = vibrationCallback;
    }
    try {
      this.client = new ViGEmClient();
      await this.client.connect();
      this.controller = this.client.createX360Controller();
      await this.controller.connect();
      this.isConnected = true;
      console.log("[Xbox Controller] Virtual Xbox controller connected successfully");
      this.controller.on("vibration", (data) => {
        console.log("[Xbox Controller] Vibration:", data);
        if (this.vibrationCallback) {
          this.vibrationCallback(data);
        }
      });
    } catch (error) {
      console.error("[Xbox Controller] Failed to connect:", error);
      throw error;
    }
  }
  // 断开虚拟手柄
  async disconnect() {
    if (this.controller) {
      await this.controller.disconnect();
    }
    if (this.client) ;
    this.isConnected = false;
    console.log("[Xbox Controller] Virtual Xbox controller disconnected");
  }
  // 处理来自手机的手柄输入数据
  async handleGamepadInput(data) {
    if (!this.isConnected) {
      console.warn("[Xbox Controller] Controller not connected, ignoring input");
      return;
    }
    try {
      const packet = this.parseGamepadPacket(data);
      this.updateGamepadState(packet);
      this.sendToDriver();
    } catch (error) {
      console.error("[Xbox Controller] Error handling gamepad input:", error);
    }
  }
  // 解析来自手机的二进制数据包
  parseGamepadPacket(data) {
    if (data.length < 15) {
      throw new Error("Invalid gamepad packet size");
    }
    return {
      type: data[0],
      // byte 0: 类型 (0x05)
      leftStickX: data.readInt16LE(1),
      // bytes 1-2: 左摇杆X
      leftStickY: data.readInt16LE(3),
      // bytes 3-4: 左摇杆Y
      rightStickX: data.readInt16LE(5),
      // bytes 5-6: 右摇杆X
      rightStickY: data.readInt16LE(7),
      // bytes 7-8: 右摇杆Y
      leftTrigger: data[9],
      // byte 9: 左扳机
      rightTrigger: data[10],
      // byte 10: 右扳机
      buttons: data.readUInt16LE(11)
      // bytes 11-12: 按钮位掩码
    };
  }
  // 更新内部手柄状态
  updateGamepadState(packet) {
    this.currentState.leftStickX = packet.leftStickX / 32767;
    this.currentState.leftStickY = packet.leftStickY / 32767;
    this.currentState.rightStickX = packet.rightStickX / 32767;
    this.currentState.rightStickY = packet.rightStickY / 32767;
    this.currentState.leftTrigger = packet.leftTrigger / 255;
    this.currentState.rightTrigger = packet.rightTrigger / 255;
    const buttons = packet.buttons;
    this.currentState.buttons.A = !!(buttons & 1);
    this.currentState.buttons.B = !!(buttons & 2);
    this.currentState.buttons.X = !!(buttons & 4);
    this.currentState.buttons.Y = !!(buttons & 8);
    this.currentState.buttons.leftBumper = !!(buttons & 16);
    this.currentState.buttons.rightBumper = !!(buttons & 32);
    this.currentState.buttons.back = !!(buttons & 64);
    this.currentState.buttons.start = !!(buttons & 128);
    this.currentState.buttons.leftStick = !!(buttons & 256);
    this.currentState.buttons.rightStick = !!(buttons & 512);
    this.currentState.buttons.guide = !!(buttons & 1024);
    this.currentState.buttons.dpadUp = !!(buttons & 2048);
    this.currentState.buttons.dpadDown = !!(buttons & 4096);
    this.currentState.buttons.dpadLeft = !!(buttons & 8192);
    this.currentState.buttons.dpadRight = !!(buttons & 16384);
  }
  // 将状态发送到ViGEm驱动
  sendToDriver() {
    if (!this.controller) return;
    this.controller.axis.leftX.setValue(this.currentState.leftStickX);
    this.controller.axis.leftY.setValue(-this.currentState.leftStickY);
    this.controller.axis.rightX.setValue(this.currentState.rightStickX);
    this.controller.axis.rightY.setValue(-this.currentState.rightStickY);
    this.controller.axis.leftTrigger.setValue(this.currentState.leftTrigger);
    this.controller.axis.rightTrigger.setValue(this.currentState.rightTrigger);
    this.controller.button.A.setValue(this.currentState.buttons.A);
    this.controller.button.B.setValue(this.currentState.buttons.B);
    this.controller.button.X.setValue(this.currentState.buttons.X);
    this.controller.button.Y.setValue(this.currentState.buttons.Y);
    this.controller.button.LEFT_SHOULDER.setValue(this.currentState.buttons.leftBumper);
    this.controller.button.RIGHT_SHOULDER.setValue(this.currentState.buttons.rightBumper);
    this.controller.button.BACK.setValue(this.currentState.buttons.back);
    this.controller.button.START.setValue(this.currentState.buttons.start);
    this.controller.button.LEFT_THUMB.setValue(this.currentState.buttons.leftStick);
    this.controller.button.RIGHT_THUMB.setValue(this.currentState.buttons.rightStick);
    this.controller.button.GUIDE.setValue(this.currentState.buttons.guide);
    if (this.currentState.buttons.dpadUp) {
      this.controller.axis.dpadVert.setValue(-1);
    } else if (this.currentState.buttons.dpadDown) {
      this.controller.axis.dpadVert.setValue(1);
    } else {
      this.controller.axis.dpadVert.setValue(0);
    }
    if (this.currentState.buttons.dpadLeft) {
      this.controller.axis.dpadHorz.setValue(-1);
    } else if (this.currentState.buttons.dpadRight) {
      this.controller.axis.dpadHorz.setValue(1);
    } else {
      this.controller.axis.dpadHorz.setValue(0);
    }
    this.controller.update();
  }
}
let xboxController = null;
async function initializeXboxController(vibrationCallback) {
  if (!xboxController) {
    xboxController = new XboxController();
    await xboxController.connect(vibrationCallback);
  }
}
async function handleGamepadInput(data) {
  try {
    if (!xboxController) {
      await initializeXboxController();
    }
    await xboxController.handleGamepadInput(data);
  } catch (error) {
    console.error("[inputXbox] Error handling gamepad input:", error);
  }
}
console.log("[inputXbox] Xbox controller module loaded");
exports.XboxController = XboxController;
exports.handleGamepadInput = handleGamepadInput;
exports.initializeXboxController = initializeXboxController;
