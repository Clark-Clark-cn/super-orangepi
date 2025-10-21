"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const child_process = require("child_process");
function execYdo(args) {
  return new Promise((resolve, reject) => {
    const ydo = child_process.spawn("ydotool", args);
    let errorOutput = "";
    ydo.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });
    ydo.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        if (errorOutput.includes("mouse is not on a surface")) {
          resolve();
        } else {
          console.error(`[ydotool] Failed with code ${code}. Args: ['${args.join("', '")}']. Stderr: ${errorOutput}`);
          reject(new Error(`ydotool exited with code ${code}: ${errorOutput}`));
        }
      }
    });
    ydo.on("error", (err) => {
      console.error("[ydotool] Spawn Error:", err);
      reject(err);
    });
  });
}
const YDO_KEY_MAP = {
  // === 字母键 ===
  "a": "30",
  "b": "48",
  "c": "46",
  "d": "32",
  "e": "18",
  "f": "33",
  "g": "34",
  "h": "35",
  "i": "23",
  "j": "36",
  "k": "37",
  "l": "38",
  "m": "50",
  "n": "49",
  "o": "24",
  "p": "25",
  "q": "16",
  "r": "19",
  "s": "31",
  "t": "20",
  "u": "22",
  "v": "47",
  "w": "17",
  "x": "45",
  "y": "21",
  "z": "44",
  // === 数字键（主键盘区）===
  "0": "11",
  "1": "2",
  "2": "3",
  "3": "4",
  "4": "5",
  "5": "6",
  "6": "7",
  "7": "8",
  "8": "9",
  "9": "10",
  // === 功能键 ===
  "f1": "59",
  "f2": "60",
  "f3": "61",
  "f4": "62",
  "f5": "63",
  "f6": "64",
  "f7": "65",
  "f8": "66",
  "f9": "67",
  "f10": "68",
  "f11": "87",
  "f12": "88",
  // === 方向键 ===
  "up": "103",
  "down": "108",
  "left": "105",
  "right": "106",
  // === 控制键 ===
  "enter": "28",
  "return": "28",
  "space": "57",
  "spacebar": "57",
  " ": "57",
  "tab": "15",
  "backspace": "14",
  "delete": "111",
  "escape": "1",
  "esc": "1",
  "home": "102",
  "end": "107",
  "pageup": "104",
  "pagedown": "109",
  "insert": "110",
  // === 修饰键 ===
  "shift": "42",
  // Left Shift
  "ctrl": "29",
  "control": "29",
  // Left Ctrl
  "alt": "56",
  "option": "56",
  // Left Alt
  "win": "125",
  "meta": "125",
  "cmd": "125",
  "windows": "125",
  // Left Meta/Win/Cmd
  "capslock": "58",
  // === 符号键 (直接输入和名称) ===
  "-": "12",
  "minus": "12",
  "=": "13",
  "equal": "13",
  "[": "26",
  "leftbracket": "26",
  "]": "27",
  "rightbracket": "27",
  "\\": "43",
  "backslash": "43",
  ";": "39",
  "semicolon": "39",
  "'": "40",
  "quote": "40",
  "`": "41",
  "grave": "41",
  ",": "51",
  "comma": "51",
  ".": "52",
  "period": "52",
  "/": "53",
  "slash": "53"
};
const YDO_BUTTON_CODE = {
  LEFT: 0,
  RIGHT: 1,
  MIDDLE: 2
};
const YDO_ACTION_CODE = {
  DOWN: 64,
  UP: 128,
  CLICK: 192
  // DOWN | UP
};
const YDO_BUTTON_MAP = {
  "left": YDO_BUTTON_CODE.LEFT,
  "lmb": YDO_BUTTON_CODE.LEFT,
  "primary": YDO_BUTTON_CODE.LEFT,
  "right": YDO_BUTTON_CODE.RIGHT,
  "rmb": YDO_BUTTON_CODE.RIGHT,
  "secondary": YDO_BUTTON_CODE.RIGHT,
  "middle": YDO_BUTTON_CODE.MIDDLE,
  "mmb": YDO_BUTTON_CODE.MIDDLE
};
function toLowerTrimStr(input) {
  if (typeof input === "string") return input.trim().toLowerCase();
  if (typeof input === "number") return String(input);
  return null;
}
function splitComboString(s) {
  const str = s.trim();
  if (!str) return [];
  const hasPlus = str.includes("+");
  return (hasPlus ? str.split("+") : str.split(/\s+/)).map((t) => t.trim()).filter(Boolean);
}
function getKeysFromPayload(payload) {
  const unknown = [];
  const keyCodes = [];
  const processToken = (token) => {
    const keyCode = YDO_KEY_MAP[token];
    if (keyCode) keyCodes.push(keyCode);
    else unknown.push(token);
  };
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const tokenStr = toLowerTrimStr(item);
      if (tokenStr) processToken(tokenStr);
      else unknown.push(String(item));
    }
  } else {
    const str = toLowerTrimStr(payload);
    if (!str) return { keyCodes, unknown: [String(payload)] };
    const tokens = splitComboString(str);
    for (const t of tokens) {
      processToken(t);
    }
  }
  return { keyCodes, unknown };
}
async function executeKeyTap(input) {
  try {
    const { keyCodes, unknown } = getKeysFromPayload(input);
    if (unknown.length) console.warn(`[InputWayland] Unknown key(s) for tap: ${unknown.join(", ")}`);
    if (!keyCodes.length) return;
    const args = ["key"];
    keyCodes.forEach((kc) => args.push(`${kc}:1`));
    [...keyCodes].reverse().forEach((kc) => args.push(`${kc}:0`));
    await execYdo(args);
  } catch (error) {
    console.error(`[InputWayland] KeyTap error for ${JSON.stringify(input)}:`, error);
  }
}
async function executeKeyDown(input) {
  try {
    const { keyCodes, unknown } = getKeysFromPayload(input);
    if (unknown.length) console.warn(`[InputWayland] Unknown key(s) for down: ${unknown.join(", ")}`);
    if (!keyCodes.length) return;
    const args = ["key"];
    keyCodes.forEach((kc) => args.push(`${kc}:1`));
    await execYdo(args);
  } catch (error) {
    console.error(`[InputWayland] KeyDown error for ${JSON.stringify(input)}:`, error);
  }
}
async function executeKeyUp(input) {
  try {
    const { keyCodes, unknown } = getKeysFromPayload(input);
    if (unknown.length) console.warn(`[InputWayland] Unknown key(s) for up: ${unknown.join(", ")}`);
    if (!keyCodes.length) return;
    const args = ["key"];
    [...keyCodes].reverse().forEach((kc) => args.push(`${kc}:0`));
    await execYdo(args);
  } catch (error) {
    console.error(`[InputWayland] KeyUp error for ${JSON.stringify(input)}:`, error);
  }
}
async function executeMouseAction(buttonType, action) {
  try {
    const btnStr = toLowerTrimStr(buttonType);
    if (!btnStr) return console.warn(`[InputWayland] Unsupported button type: ${buttonType}`);
    const btnCode = YDO_BUTTON_MAP[btnStr];
    if (btnCode === void 0) return console.warn(`[InputWayland] Unknown button for action: ${btnStr}`);
    const finalCode = action | btnCode;
    await execYdo(["click", `0x${finalCode.toString(16)}`]);
  } catch (error) {
    console.error(`[InputWayland] Mouse action error for ${buttonType}:`, error);
  }
}
async function executeMouseClick(buttonType) {
  await executeMouseAction(buttonType, YDO_ACTION_CODE.CLICK);
}
async function executeMouseDown(buttonType) {
  await executeMouseAction(buttonType, YDO_ACTION_CODE.DOWN);
}
async function executeMouseUp(buttonType) {
  await executeMouseAction(buttonType, YDO_ACTION_CODE.UP);
}
let relAccumX = 0;
let relAccumY = 0;
let relMoveTimer = null;
const REL_MOVE_INTERVAL_MS = 16;
async function flushRelativeMove() {
  relMoveTimer = null;
  const sendX = Math.round(relAccumX);
  const sendY = Math.round(relAccumY);
  relAccumX -= sendX;
  relAccumY -= sendY;
  if (sendX !== 0 || sendY !== 0) {
    try {
      await execYdo(["mousemove", "--", String(sendX), String(sendY)]);
    } catch (e) {
    }
  }
  if (Math.abs(relAccumX) > 0.5 || Math.abs(relAccumY) > 0.5) {
    relMoveTimer = setTimeout(flushRelativeMove, REL_MOVE_INTERVAL_MS);
  }
}
function handleTouchMove(dx, dy) {
  relAccumX += dx;
  relAccumY += dy;
  if (!relMoveTimer) {
    relMoveTimer = setTimeout(flushRelativeMove, REL_MOVE_INTERVAL_MS);
  }
}
let scrollAccumX = 0;
let scrollAccumY = 0;
let scrollTimer = null;
const SCROLL_INTERVAL_MS = 16;
const SCROLL_SENSITIVITY = 0.1;
async function flushScroll() {
  scrollTimer = null;
  const sendX = Math.trunc(scrollAccumX);
  const sendY = Math.trunc(scrollAccumY);
  scrollAccumX -= sendX;
  scrollAccumY -= sendY;
  if (sendX !== 0 || sendY !== 0) {
    try {
      await execYdo(["mousemove", "--wheel", "--", String(sendX), String(-sendY)]);
    } catch (e) {
    }
  }
  if (Math.abs(scrollAccumX) >= 1 || Math.abs(scrollAccumY) >= 1) {
    scrollTimer = setTimeout(flushScroll, SCROLL_INTERVAL_MS);
  }
}
function handleScroll(dx, dy) {
  scrollAccumX += dx * SCROLL_SENSITIVITY;
  scrollAccumY += dy * SCROLL_SENSITIVITY;
  if (!scrollTimer) {
    scrollTimer = setTimeout(flushScroll, SCROLL_INTERVAL_MS);
  }
}
async function handleBinaryMouseButton(btn, action) {
  let buttonStr;
  if (btn === 0) buttonStr = "left";
  else if (btn === 1) buttonStr = "right";
  else if (btn === 2) buttonStr = "middle";
  if (!buttonStr) return;
  if (action === 0) await executeMouseDown(buttonStr);
  else if (action === 1) await executeMouseUp(buttonStr);
  else if (action === 2) await executeMouseClick(buttonStr);
}
async function douyinMouse(winX, winY, width, height) {
  if (winX === 0 && winY === 0 && width === 0 && height === 0) return;
  console.log("闲不写");
}
async function volumeUp() {
  try {
    await execCmd(["pactl", "set-sink-volume", "@DEFAULT_SINK@", "+5%"]);
    console.log(`[Input] Executed volume up.`);
  } catch (error) {
    console.error("[Input] Failed to increase volume:", error);
  }
}
async function volumeDown() {
  try {
    await execCmd(["pactl", "set-sink-volume", "@DEFAULT_SINK@", "-5%"]);
    console.log(`[Input] Executed volume down.`);
  } catch (error) {
    console.error("[Input] Failed to decrease volume:", error);
  }
}
function execCmd(cmdArr) {
  return new Promise((resolve, reject) => {
    const proc = child_process.spawn(cmdArr[0], cmdArr.slice(1));
    let stderr = "";
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `exit code ${code}`));
    });
    proc.on("error", reject);
  });
}
exports.douyinMouse = douyinMouse;
exports.executeKeyDown = executeKeyDown;
exports.executeKeyTap = executeKeyTap;
exports.executeKeyUp = executeKeyUp;
exports.executeMouseClick = executeMouseClick;
exports.executeMouseDown = executeMouseDown;
exports.executeMouseUp = executeMouseUp;
exports.handleBinaryMouseButton = handleBinaryMouseButton;
exports.handleScroll = handleScroll;
exports.handleTouchMove = handleTouchMove;
exports.volumeDown = volumeDown;
exports.volumeUp = volumeUp;
