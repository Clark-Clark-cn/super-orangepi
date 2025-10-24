"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const nutJs = require("@nut-tree-fork/nut-js");
const keyMap = require("./keyMap-kcnz5fFt.js");
nutJs.mouse.config.mouseSpeed = 1e4;
nutJs.keyboard.config.autoDelayMs = 2;
const BUTTON_MAP = {
  "left": nutJs.Button.LEFT,
  "lmb": nutJs.Button.LEFT,
  "primary": nutJs.Button.LEFT,
  "right": nutJs.Button.RIGHT,
  "rmb": nutJs.Button.RIGHT,
  "secondary": nutJs.Button.RIGHT,
  "middle": nutJs.Button.MIDDLE,
  "mmb": nutJs.Button.MIDDLE
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
function keyFromToken(token) {
  return keyMap.KEY_MAP[token];
}
function getKeysFromPayload(payload) {
  const unknown = [];
  const keys = [];
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const tokenStr = toLowerTrimStr(item);
      if (!tokenStr) {
        unknown.push(String(item));
        continue;
      }
      const k = keyFromToken(tokenStr);
      if (k !== void 0) keys.push(k);
      else unknown.push(tokenStr);
    }
  } else {
    const str = toLowerTrimStr(payload);
    if (!str) return { keys, unknown: [String(payload)] };
    const tokens = splitComboString(str);
    for (const t of tokens) {
      const k = keyFromToken(t);
      if (k !== void 0) keys.push(k);
      else unknown.push(t);
    }
  }
  return { keys, unknown };
}
async function executeKeyTap(input) {
  try {
    const { keys, unknown } = getKeysFromPayload(input);
    if (unknown.length) console.warn(`[Input] Unknown key token(s) for tap: ${unknown.join(", ")}`);
    if (!keys.length) return;
    if (keys.length === 1) {
      await nutJs.keyboard.pressKey(keys[0]);
      await nutJs.keyboard.releaseKey(keys[0]);
    } else {
      await nutJs.keyboard.pressKey(...keys);
      const reversed = [...keys].reverse();
      await nutJs.keyboard.releaseKey(...reversed);
    }
  } catch (error) {
    console.error(`[Input] KeyTap error for ${JSON.stringify(input)}:`, error);
  }
}
async function executeKeyDown(input) {
  try {
    const { keys, unknown } = getKeysFromPayload(input);
    if (unknown.length) console.warn(`[Input] Unknown key token(s) for down: ${unknown.join(", ")}`);
    if (!keys.length) return;
    await nutJs.keyboard.pressKey(...keys);
  } catch (error) {
    console.error(`[Input] KeyDown error for ${JSON.stringify(input)}:`, error);
  }
}
async function executeKeyUp(input) {
  try {
    const { keys, unknown } = getKeysFromPayload(input);
    if (unknown.length) console.warn(`[Input] Unknown key token(s) for up: ${unknown.join(", ")}`);
    if (!keys.length) return;
    const reversed = [...keys].reverse();
    await nutJs.keyboard.releaseKey(...reversed);
  } catch (error) {
    console.error(`[Input] KeyUp error for ${JSON.stringify(input)}:`, error);
  }
}
async function executeMouseClick(buttonType) {
  try {
    const btnStr = toLowerTrimStr(buttonType);
    if (!btnStr) return console.warn(`[Input] Unsupported button for click: ${buttonType}`);
    const nutButton = BUTTON_MAP[btnStr];
    if (nutButton !== void 0) {
      await nutJs.mouse.click(nutButton);
    } else console.warn(`[Input] Unsupported button for click: ${btnStr}`);
  } catch (error) {
    console.error(`[Input] MouseClick error for ${buttonType}:`, error);
  }
}
async function executeMouseDown(buttonType) {
  try {
    const btnStr = toLowerTrimStr(buttonType);
    if (!btnStr) return console.warn(`[Input] Unsupported button for down: ${buttonType}`);
    const nutButton = BUTTON_MAP[btnStr];
    if (nutButton !== void 0) {
      await nutJs.mouse.pressButton(nutButton);
    } else console.warn(`[Input] Unsupported button for down: ${btnStr}`);
  } catch (error) {
    console.error(`[Input] MouseDown error for ${buttonType}:`, error);
  }
}
async function executeMouseUp(buttonType) {
  try {
    const btnStr = toLowerTrimStr(buttonType);
    if (!btnStr) return console.warn(`[Input] Unsupported button for up: ${buttonType}`);
    const nutButton = BUTTON_MAP[btnStr];
    if (nutButton !== void 0) {
      await nutJs.mouse.releaseButton(nutButton);
    } else console.warn(`[Input] Unsupported button for up: ${btnStr}`);
  } catch (error) {
    console.error(`[Input] MouseUp error for ${buttonType}:`, error);
  }
}
let relAccumX = 0;
let relAccumY = 0;
let relMoveTimer = null;
const REL_MOVE_INTERVAL_MS = 8;
async function flushRelativeMove() {
  relMoveTimer = null;
  const sendX = relAccumX >= 0 ? Math.floor(relAccumX) : Math.ceil(relAccumX);
  const sendY = relAccumY >= 0 ? Math.floor(relAccumY) : Math.ceil(relAccumY);
  relAccumX -= sendX;
  relAccumY -= sendY;
  if (sendX !== 0 || sendY !== 0) {
    try {
      const pos = await nutJs.mouse.getPosition();
      await nutJs.mouse.setPosition({ x: pos.x + sendX, y: pos.y + sendY });
    } catch (e) {
      console.error("[Input] RelativeMove error:", e);
    }
  }
  if (Math.abs(relAccumX) > 0.25 || Math.abs(relAccumY) > 0.25) {
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
const SCROLL_FRAME_INTERVAL_MS = 16;
const SCROLL_MAX_LINES_PER_FLUSH = 1;
const SCROLL_MIN_RESIDUE_CLEAR = 0.05;
const SCROLL_SENSITIVITY_FACTOR = 0.02;
function flushImmediateScroll() {
  scrollTimer = null;
  let sendX = scrollAccumX >= 0 ? Math.floor(scrollAccumX) : Math.ceil(scrollAccumX);
  let sendY = scrollAccumY >= 0 ? Math.floor(scrollAccumY) : Math.ceil(scrollAccumY);
  if (Math.abs(sendX) > SCROLL_MAX_LINES_PER_FLUSH)
    sendX = sendX > 0 ? SCROLL_MAX_LINES_PER_FLUSH : -SCROLL_MAX_LINES_PER_FLUSH;
  if (Math.abs(sendY) > SCROLL_MAX_LINES_PER_FLUSH)
    sendY = sendY > 0 ? SCROLL_MAX_LINES_PER_FLUSH : -SCROLL_MAX_LINES_PER_FLUSH;
  if (sendX !== 0) {
    if (sendX > 0) nutJs.mouse.scrollRight(sendX).catch((e) => console.error("scrollRight err", e));
    else nutJs.mouse.scrollLeft(-sendX).catch((e) => console.error("scrollLeft err", e));
    scrollAccumX -= sendX;
  }
  if (sendY !== 0) {
    if (sendY > 0) nutJs.mouse.scrollDown(sendY).catch((e) => console.error("scrollDown err", e));
    else nutJs.mouse.scrollUp(-sendY).catch((e) => console.error("scrollUp err", e));
    scrollAccumY -= sendY;
  }
  if (Math.abs(scrollAccumX) < SCROLL_MIN_RESIDUE_CLEAR) scrollAccumX = 0;
  if (Math.abs(scrollAccumY) < SCROLL_MIN_RESIDUE_CLEAR) scrollAccumY = 0;
  if (Math.abs(scrollAccumX) >= 1 || Math.abs(scrollAccumY) >= 1) {
    scrollTimer = setTimeout(flushImmediateScroll, SCROLL_FRAME_INTERVAL_MS);
  }
  if (Math.abs(scrollAccumY) >= 1 || Math.abs(scrollAccumY) >= 1) {
    scrollTimer = setTimeout(flushImmediateScroll, SCROLL_FRAME_INTERVAL_MS);
  }
}
function handleScroll(dx, dy) {
  scrollAccumX += dx * SCROLL_SENSITIVITY_FACTOR;
  scrollAccumY += dy * SCROLL_SENSITIVITY_FACTOR;
  if (!scrollTimer) {
    scrollTimer = setTimeout(flushImmediateScroll, SCROLL_FRAME_INTERVAL_MS);
  }
}
async function handleBinaryMouseButton(btn, action) {
  let button;
  if (btn === 0) button = nutJs.Button.LEFT;
  else if (btn === 1) button = nutJs.Button.RIGHT;
  else if (btn === 2) button = nutJs.Button.MIDDLE;
  if (button === void 0) return;
  try {
    if (action === 0) await nutJs.mouse.pressButton(button);
    else if (action === 1) await nutJs.mouse.releaseButton(button);
    else if (action === 2) await nutJs.mouse.click(button);
  } catch (e) {
    console.error("[Input] Binary mouse button error:", e);
  }
}
async function douyinMouse(winX, winY, width, height) {
  if (winX === 0 && winY === 0 && width === 0 && height === 0) return;
  try {
    const targetX = Math.round(winX + width * 0.9);
    const targetY = Math.round(winY + height * 0.5);
    await nutJs.mouse.setPosition({ x: targetX, y: targetY });
    console.log(`[InputWin] 移动鼠标到评论区: (${targetX}, ${targetY})`);
  } catch (error) {
    console.error("[InputWin] 移动鼠标到评论区失败:", error);
  }
}
async function volumeUp() {
  try {
    await nutJs.keyboard.pressKey(nutJs.Key.AudioVolUp);
    await nutJs.keyboard.releaseKey(nutJs.Key.AudioVolUp);
    console.log(`[Input] Executed volume up key press.`);
  } catch (error) {
    console.error("[Input] Failed to increase volume:", error);
  }
}
async function volumeDown() {
  try {
    await nutJs.keyboard.pressKey(nutJs.Key.AudioVolDown);
    await nutJs.keyboard.releaseKey(nutJs.Key.AudioVolDown);
    console.log(`[Input] Executed volume down key press.`);
  } catch (error) {
    console.error("[Input] Failed to decrease volume:", error);
  }
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
