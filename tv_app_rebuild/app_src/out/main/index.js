"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const Store = require("electron-store");
const fs = require("fs");
const fs$1 = require("fs/promises");
const os = require("os");
const child_process = require("child_process");
const util = require("util");
const electronUpdater = require("electron-updater");
// 应用图标：Windows 使用 .ico，Linux 使用 .png
const iconPngPath = path.join(__dirname, "../../resources/icon.png");
const iconIcoPath = path.join(__dirname, "../../resources/icon.ico");
const appWindowIcon = process.platform === "win32" ? iconIcoPath : iconPngPath;
const customIconsPath = path.join(electron.app.getPath("userData"), "custom_icons");
const nutJs = require("@nut-tree-fork/nut-js");
if (!fs.existsSync(customIconsPath)) {
  fs.mkdirSync(customIconsPath, { recursive: true });
}
function getCustomIconsPath() {
  return customIconsPath;
}
const store = new Store({
  defaults: {
    viewUsage: {},
    lastUrls: {
      tv: "https://www.yangshipin.cn/tv/home"
    },
    settings: {
      // 为截图路径提供一个更合理的默认值
      screenshotPath: path.join(electron.app.getPath("pictures"), "tv_screenshots"),
      openAtLogin: false
      // 新增：默认为 false
    },
    customViews: [],
    hiddenBuiltInViews: ["douyu", "youku", "mgtv", "souhu", "netflix", "youtube"],
    // 默认隐藏的网站
    pluginVersions: {},
    // 新增：默认值为空对象
    userApps: []
    // 新增：默认值为空数组
  }
});
function recordViewUsage(viewId) {
  const key = `viewUsage.${viewId}`;
  const usage = store.get(key, { frequency: 0, lastUsed: 0 });
  usage.frequency++;
  usage.lastUsed = Date.now();
  store.set(key, usage);
  console.log(`[Store] 已记录 '${viewId}' 使用:`, usage);
}
function getLastUrl(viewId, defaultUrl) {
  const key = `lastUrls.${viewId}`;
  return store.get(key, defaultUrl);
}
function setLastUrl(viewId, url) {
  const key = `lastUrls.${viewId}`;
  store.set(key, url);
  console.log(`[Store] 已为 '${viewId}' 保存 URL: ${url}`);
}
function getAllViewUsage() {
  return store.get("viewUsage", {});
}
function getPreloadCandidates() {
  const allUsage = store.get("viewUsage", {});
  const usageArray = Object.entries(allUsage);
  if (usageArray.length === 0) {
    return ["tv"];
  }
  const sortedByFrequency = [...usageArray].sort((a, b) => b[1].frequency - a[1].frequency);
  const sortedByLastUsed = [...usageArray].sort((a, b) => b[1].lastUsed - a[1].lastUsed);
  const candidates = /* @__PURE__ */ new Set();
  if (sortedByFrequency.length > 0) {
    candidates.add(sortedByFrequency[0][0]);
  }
  if (sortedByLastUsed.length > 0) {
    candidates.add(sortedByLastUsed[0][0]);
  }
  const result = Array.from(candidates);
  const finalResult = result.filter((id) => id !== "douyin");
  console.log(`[Store] 原始预加载建议: [${result.join(", ")}]`);
  console.log(`[Store] 排除抖音后最终预加载: [${finalResult.join(", ")}]`);
  return finalResult;
}
function getCustomViews() {
  return store.get("customViews", []);
}
function addCustomView(viewData) {
  const views = getCustomViews();
  const newView = {
    ...viewData,
    id: `custom_${Date.now()}`
    // 使用时间戳生成一个简单的唯一ID
  };
  views.push(newView);
  store.set("customViews", views);
  console.log(`[Store] 已添加新的自定义视图: ${newView.name}`);
  return newView;
}
function removeCustomView(viewId) {
  let views = getCustomViews();
  const viewToRemove = views.find((v) => v.id === viewId);
  if (viewToRemove && viewToRemove.icon && viewToRemove.icon.startsWith("app-icon://")) {
    const iconFileName = viewToRemove.icon.replace("app-icon://", "");
    const iconPath = path.join(getCustomIconsPath(), iconFileName);
    if (fs.existsSync(iconPath)) {
      try {
        fs.unlinkSync(iconPath);
        console.log(`[Store] 已删除自定义视图的图标文件: ${iconPath}`);
      } catch (err) {
        console.error(`[Store] 删除自定义视图图标文件失败: ${iconPath}`, err);
      }
    }
  }
  views = views.filter((v) => v.id !== viewId);
  store.set("customViews", views);
  console.log(`[Store] 已删除自定义视图: ${viewId}`);
}
function updateCustomViewIcon(viewId, iconPath) {
  const views = getCustomViews();
  const viewIndex = views.findIndex((v) => v.id === viewId);
  if (viewIndex !== -1) {
    views[viewIndex].icon = iconPath;
    store.set("customViews", views);
    console.log(`[Store] 已更新视图 ${viewId} 的图标为: ${iconPath}`);
  }
}
function getHiddenBuiltInViews() {
  return store.get("hiddenBuiltInViews", []);
}
function hideBuiltInView(viewId) {
  const hidden = new Set(getHiddenBuiltInViews());
  hidden.add(viewId);
  store.set("hiddenBuiltInViews", Array.from(hidden));
  console.log(`[Store] 已隐藏内置视图: ${viewId}`);
}
function showBuiltInView(viewId) {
  let hidden = getHiddenBuiltInViews();
  hidden = hidden.filter((id) => id !== viewId);
  store.set("hiddenBuiltInViews", hidden);
  console.log(`[Store] 已显示内置视图: ${viewId}`);
}
function getIsOpenTV() {
  return !!store.get("settings.isopenTV", false);
}
function setIsOpenTV(val) {
  store.set("settings.isopenTV", val);
  console.log(`[Store] 设置 isopenTV = ${val}`);
}
function getScreenshotPath() {
  const defaultPath = path.join(electron.app.getPath("pictures"), "tv_screenshots");
  return store.get("settings.screenshotPath", defaultPath);
}
function setScreenshotPath(newPath) {
  store.set("settings.screenshotPath", newPath);
  console.log(`[Store] 设置截图保存路径 = ${newPath}`);
}
function getPluginVersions() {
  return store.get("pluginVersions", {});
}
function setPluginVersions(versions) {
  store.set("pluginVersions", versions);
  console.log("[Store] 已更新插件版本信息。");
}
function setUpdateDownloaded(val) {
  store.set("updateDownloaded", val);
}
function getUpdateDownloaded() {
  return !!store.get("updateDownloaded", false);
}
function clearUpdateDownloaded() {
  store.delete("updateDownloaded");
}
function getUserApps() {
  return store.get("userApps", []);
}
function addUserApp(appData) {
  const apps = getUserApps();
  apps.push(appData);
  store.set("userApps", apps);
  console.log(`[Store] 已添加新应用: ${appData.name}`);
}
function removeUserApp(appId) {
  let apps = getUserApps();
  apps = apps.filter((app2) => app2.id !== appId);
  store.set("userApps", apps);
  console.log(`[Store] 已移除应用: ${appId}`);
}
function getOpenAtLogin() {
  return store.get("settings.openAtLogin", false);
}
function setOpenAtLogin(enabled) {
  store.set("settings.openAtLogin", enabled);
  console.log(`[Store] 设置开机自启动 = ${enabled}`);
}
function setLocalIPs(ips) {
  store.set("localIPs", ips);
}
function getLocalIPs() {
  return store.get("localIPs", []);
}
const PLUGIN_CACHE_DIR = path.join(electron.app.getPath("userData"), "plugins");
const DEFAULT_PLUGINS_DIR = electron.app.isPackaged ? path.join(process.resourcesPath, "app.asar.unpacked/resources/plugs") : path.join(electron.app.getAppPath(), "resources/plugs");
const REMOTE_MANIFEST_URL = "http://show.luckylizi.cn:8056/plugins.json";
function compareVersion(v1, v2) {
  const a = v1.split(".").map(Number);
  const b = v2.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const n1 = a[i] || 0;
    const n2 = b[i] || 0;
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }
  return 0;
}
function initializePlugins() {
  if (!fs.existsSync(PLUGIN_CACHE_DIR)) {
    fs.mkdirSync(PLUGIN_CACHE_DIR, { recursive: true });
    console.log("[PluginManager] 插件缓存目录已创建:", PLUGIN_CACHE_DIR);
  }
}
async function getPluginScript(pluginId) {
  const cachedPluginPath = path.join(PLUGIN_CACHE_DIR, pluginId);
  try {
    await fs$1.access(cachedPluginPath);
    console.log(`[PluginManager] 从缓存加载插件: ${pluginId}`);
    return await fs$1.readFile(cachedPluginPath, "utf-8");
  } catch {
    const defaultPluginPath = path.join(DEFAULT_PLUGINS_DIR, pluginId);
    try {
      await fs$1.access(defaultPluginPath);
      console.log(`[PluginManager] 从默认目录加载插件: ${pluginId}`);
      return await fs$1.readFile(defaultPluginPath, "utf-8");
    } catch {
      console.error(`[PluginManager] 插件 '${pluginId}' 在任何位置都未找到。`);
      return null;
    }
  }
}
async function checkForUpdates() {
  console.log("[PluginManager] 开始检查插件更新...");
  try {
    const response = await electron.net.fetch(REMOTE_MANIFEST_URL);
    if (!response.ok) {
      throw new Error(`获取远程清单失败: ${response.statusText}`);
    }
    const remoteManifest = await response.json();
    const localVersions = getPluginVersions();
    let hasUpdates = false;
    for (const pluginId in remoteManifest) {
      const remotePlugin = remoteManifest[pluginId];
      const localPlugin = localVersions[pluginId];
      if (!localPlugin || compareVersion(remotePlugin.version, localPlugin.version) > 0) {
        console.log(`[PluginManager] 发现新插件版本: ${pluginId} v${remotePlugin.version}`);
        await downloadPlugin(remotePlugin);
        localVersions[pluginId] = remotePlugin;
        hasUpdates = true;
      }
    }
    if (hasUpdates) {
      setPluginVersions(localVersions);
    } else {
      console.log("[PluginManager] 所有插件都已是最新版本。");
    }
  } catch (error) {
    console.error("[PluginManager] 检查插件更新失败:", error);
  }
}
async function downloadPlugin(pluginInfo) {
  try {
    const response = await electron.net.fetch(pluginInfo.url);
    if (!response.ok) {
      throw new Error(`下载失败: ${response.statusText}`);
    }
    const scriptContent = await response.text();
    const filePath = path.join(PLUGIN_CACHE_DIR, pluginInfo.id);
    await fs$1.writeFile(filePath, scriptContent);
    console.log(`[PluginManager] 插件 '${pluginInfo.id}' 已成功下载到缓存。`);
  } catch (error) {
    console.error(`[PluginManager] 下载插件 '${pluginInfo.id}' 失败:`, error);
  }
}
function getLocalIPList() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        results.push({ name, address: iface.address });
      }
    }
  }
  return results;
}
async function getFaviconAsBase64(pageUrl) {
  try {
    const url = new URL(pageUrl);
    const candidates = [];
    try {
      const pageResponse = await electron.net.fetch(pageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
      });
      if (pageResponse.ok) {
        const html = await pageResponse.text();
        const linkRegex = /<link.*?rel=["'](apple-touch-icon|icon|shortcut icon)["'].*?href=(["']?)(.*?)\2.*?>/gi;
        let match;
        while ((match = linkRegex.exec(html)) !== null) {
          let iconUrl = match[3];
          if (!iconUrl) continue;
          if (iconUrl.startsWith("//")) {
            iconUrl = `${url.protocol}${iconUrl}`;
          } else if (!iconUrl.startsWith("http")) {
            iconUrl = new URL(iconUrl, url.origin).href;
          }
          const sizeMatch = match[0].match(/sizes=["']?(\d+x\d+)["']?/);
          let size = 0;
          if (sizeMatch) {
            size = parseInt(sizeMatch[1].split("x")[0], 10);
          } else if (match[0].includes(".svg")) {
            size = 1e3;
          } else if (match[1] === "apple-touch-icon") {
            size = 180;
          }
          candidates.push({ url: iconUrl, size });
        }
      }
    } catch (e) {
      console.log(`[getFavicon] 解析HTML失败 for ${pageUrl}, 将尝试 /favicon.ico。`, e);
    }
    candidates.push({ url: `${url.origin}/favicon.ico`, size: 16 });
    candidates.sort((a, b) => b.size - a.size);
    for (const candidate of candidates) {
      try {
        const iconResponse = await electron.net.fetch(candidate.url);
        if (iconResponse.ok) {
          const buffer = await iconResponse.arrayBuffer();
          if (buffer.byteLength < 10) continue;
          const base64 = Buffer.from(buffer).toString("base64");
          const mimeType = iconResponse.headers.get("content-type") || "image/x-icon";
          return `data:${mimeType};base64,${base64}`;
        }
      } catch (e) {
      }
    }
    console.log(`[getFavicon] 未能为 ${pageUrl} 获取任何图标。`);
    return null;
  } catch (error) {
    console.error(`[getFavicon] 获取图标时发生未知错误 for ${pageUrl}:`, error);
    return null;
  }
}
const ViewId = {
  NONE: "none",
  TV: "tv",
  BILI: "bili",
  DOUYIN: "douyin",
  TengXun: "tengxun",
  YANGKU: "yangku",
  AIQIYI: "aiqiyi",
  DOUYU: "douyu",
  YOUKU: "youku",
  MGTV: "mgtv",
  SOUHU: "souhu",
  NETFLIX: "netflix",
  YOUTUBE: "youtube"
};
let ALL_VIEW_CONFIGS = {};
const viewRegistry = /* @__PURE__ */ new Map();
const activeTimers = /* @__PURE__ */ new Map();
const AUTO_DESTROY_TIMEOUT = 30 * 60 * 1e3;
const MAX_VIEW_COUNT = 5;
let mainWindow$1 = null;
let activeViewType = ViewId.NONE;
let isMenuVisible = false;
let viewCheckInterval = null;
function loadAllViewConfigs() {
  const builtInConfigs = {
    [ViewId.TV]: {
      viewType: ViewId.TV,
      url: getLastUrl("tv", "https://www.yangshipin.cn/tv/home"),
      menuUrlHash: "menu/tv",
      pluginPath: path.join(electron.app.getAppPath(), "resources/plugs/yangshipin.js")
    },
    [ViewId.BILI]: {
      viewType: ViewId.BILI,
      url: "https://www.bilibili.com",
      menuUrlHash: "menu/pubmenu",
      pluginPath: path.join(electron.app.getAppPath(), "resources/plugs/bili_plugin.js"),
      setWindowOpenHandler: true
    },
    [ViewId.DOUYU]: {
      viewType: ViewId.DOUYU,
      url: "https://www.douyu.com",
      menuUrlHash: "menu/douyu",
      setWindowOpenHandler: true
    },
    [ViewId.DOUYIN]: {
      viewType: ViewId.DOUYIN,
      url: "https://www.douyin.com/?recommend=1",
      menuUrlHash: "menu/douyin",
      pluginPath: path.join(electron.app.getAppPath(), "resources/plugs/douyin_plugin.js"),
      setWindowOpenHandler: true
    },
    [ViewId.TengXun]: {
      viewType: ViewId.TengXun,
      url: "https://v.qq.com/",
      // menuUrlHash: 'menu/douyin',
      menuUrlHash: "menu/pubmenu",
      pluginPath: path.join(electron.app.getAppPath(), "resources/plugs/qq_plugin.js"),
      setWindowOpenHandler: true
    },
    [ViewId.YANGKU]: {
      viewType: ViewId.YANGKU,
      url: "https://tv.cctv.com/yxg/index.shtml",
      menuUrlHash: "menu/pubmenu",
      pluginPath: path.join(electron.app.getAppPath(), "resources/plugs/yangku.js"),
      setWindowOpenHandler: true
    },
    [ViewId.AIQIYI]: {
      viewType: ViewId.AIQIYI,
      url: "https://www.iqiyi.com",
      menuUrlHash: "menu/pubmenu",
      pluginPath: path.join(electron.app.getAppPath(), "resources/plugs/aiqiyi.js"),
      setWindowOpenHandler: true
    },
    [ViewId.YOUKU]: {
      viewType: ViewId.YOUKU,
      url: "https://www.youku.com/",
      menuUrlHash: "menu/pubmenu",
      pluginPath: path.join(electron.app.getAppPath(), "resources/plugs/youku.js"),
      setWindowOpenHandler: true
    },
    [ViewId.MGTV]: {
      viewType: ViewId.MGTV,
      url: "https://www.mgtv.com/",
      menuUrlHash: "menu/pubmenu",
      pluginPath: path.join(electron.app.getAppPath(), "resources/plugs/mgtv.js"),
      setWindowOpenHandler: true
    },
    [ViewId.SOUHU]: {
      viewType: ViewId.SOUHU,
      url: "https://tv.sohu.com/",
      menuUrlHash: "menu/pubmenu",
      pluginPath: path.join(electron.app.getAppPath(), "resources/plugs/sohu.js"),
      setWindowOpenHandler: true
    },
    [ViewId.NETFLIX]: {
      viewType: ViewId.NETFLIX,
      url: "https://www.netflix.com/",
      menuUrlHash: "menu/pubmenu",
      pluginPath: path.join(electron.app.getAppPath(), "resources/plugs/netflix.js"),
      setWindowOpenHandler: true
    },
    [ViewId.YOUTUBE]: {
      viewType: ViewId.YOUTUBE,
      url: "https://www.youtube.com/",
      menuUrlHash: "menu/pubmenu",
      pluginPath: path.join(electron.app.getAppPath(), "resources/plugs/youtube.js"),
      setWindowOpenHandler: true
    }
  };
  const customConfigs = getCustomViews().reduce(
    (acc, view) => {
      acc[view.id] = {
        viewType: view.id,
        url: view.url,
        menuUrlHash: "menu/custom",
        // 可以为自定义视图创建一个通用的菜单页
        pluginPath: view.pluginPath,
        setWindowOpenHandler: true
      };
      return acc;
    },
    {}
  );
  ALL_VIEW_CONFIGS = { ...builtInConfigs, ...customConfigs };
  console.log("[ViewManager] 所有视图配置已加载:", Object.keys(ALL_VIEW_CONFIGS));
}
function getMenuUrl(hash) {
  const baseUrl = utils.is.dev && process.env["ELECTRON_RENDERER_URL"] ? process.env["ELECTRON_RENDERER_URL"] : `file://${path.join(__dirname, "../renderer/index.html")}`;
  return `${baseUrl}#/${hash}`;
}
function createAndPreloadView(viewType) {
  if (viewRegistry.has(viewType)) return;
  if (viewRegistry.size >= MAX_VIEW_COUNT) {
    enforceViewLimit();
  }
  const config = ALL_VIEW_CONFIGS[viewType];
  if (!config) {
    console.error(`[ViewManager] 找不到视图配置: ${viewType}`);
    return;
  }
  console.log(`[ViewManager] 开始创建 ${viewType} 视图...`);
  const webPreferences = {
    preload: path.join(__dirname, "../preload/index.js"),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false,
    allowRunningInsecureContent: true
    // 允许加载 http 内容
  };
  const contentView = new electron.WebContentsView({ webPreferences });
  const menuView = new electron.WebContentsView({ webPreferences });
  menuView.setBackgroundColor("#00000000");
  menuView.webContents.loadURL(getMenuUrl(config.menuUrlHash));
  contentView.webContents.setAudioMuted(true);
  if (config.setWindowOpenHandler) {
    contentView.webContents.setWindowOpenHandler((details) => {
      console.log(`[ViewManager] ${viewType} 视图尝试打开新窗口: ${details.url}`);
      contentView.webContents.loadURL(details.url);
      return { action: "deny" };
    });
  }
  if (config.pluginPath) {
    const pluginPath = config.pluginPath;
    contentView.webContents.on("dom-ready", async () => {
      try {
        const pluginId = path.basename(pluginPath);
        const pluginScript = await getPluginScript(pluginId);
        if (pluginScript && !contentView.webContents.isDestroyed()) {
          await contentView.webContents.executeJavaScript(pluginScript);
          console.log(`[ViewManager] 已成功注入插件: ${pluginId}`);
        } else if (!pluginScript) {
          console.error(`[ViewManager] 无法获取插件脚本: ${pluginId}`);
        }
      } catch (err) {
        console.error(`[ViewManager] 注入 ${viewType} 插件失败:`, err);
      }
    });
  }
  contentView.webContents.loadURL(config.url);
  contentView.webContents.on("did-finish-load", () => {
    console.log(`[ViewManager] ${viewType} 视图创建完成。`);
  });
  viewRegistry.set(viewType, { contentView, menuView });
  const timeoutId = setTimeout(() => {
    console.log(`[ViewManager] 视图 ${viewType} 因长时间未激活被自动销毁。`);
    destroyView(viewType);
  }, AUTO_DESTROY_TIMEOUT);
  activeTimers.set(viewType, timeoutId);
}
function destroyView(viewType) {
  const views = viewRegistry.get(viewType);
  if (views) {
    if (activeViewType === viewType) {
      _hideCurrentView();
    }
    if (mainWindow$1) {
      mainWindow$1.contentView.removeChildView(views.contentView);
      mainWindow$1.contentView.removeChildView(views.menuView);
    }
    if (!views.contentView.webContents.isDestroyed()) views.contentView.webContents.close();
    if (!views.menuView.webContents.isDestroyed()) views.menuView.webContents.close();
    viewRegistry.delete(viewType);
    const timer = activeTimers.get(viewType);
    if (timer) {
      clearTimeout(timer);
      activeTimers.delete(viewType);
    }
    console.log(`[ViewManager] 视图 ${viewType} 已销毁。`);
  }
}
function _hideCurrentView() {
  if (!mainWindow$1 || activeViewType === ViewId.NONE) return;
  const viewToHideType = activeViewType;
  const views = viewRegistry.get(viewToHideType);
  if (views) {
    mainWindow$1.contentView.removeChildView(views.contentView);
    views.contentView.webContents.setAudioMuted(true);
    const oldTimer = activeTimers.get(viewToHideType);
    if (oldTimer) clearTimeout(oldTimer);
    const timeoutId = setTimeout(() => {
      console.log(`[ViewManager] 视图 ${viewToHideType} 因长时间未激活被自动销毁。`);
      destroyView(viewToHideType);
    }, AUTO_DESTROY_TIMEOUT);
    activeTimers.set(viewToHideType, timeoutId);
    console.log(`[ViewManager] 视图 ${viewToHideType} 已隐藏，销毁定时器已启动。`);
    const homeMsg = {
      type: "NewView",
      viewType: "home",
      viewUrl: "localhost"
    };
    setImmediate(() => {
      try {
        notifyRemoteWorkerOfStateChange(JSON.stringify(homeMsg));
      } catch (err) {
        console.error("[ViewManager] 发送 home 视图消息失败:", err);
      }
    });
  }
  activeViewType = ViewId.NONE;
}
function clickDisplayArea() {
  if (!mainWindow$1) return;
  setTimeout(() => {
    sendCommandToRemoteWorker({
      type: "viewAction",
      action: "TVMouseClick"
    });
    console.log("[ViewManager] clickDisplayArea 方法被调用");
  }, 3e3);
}
function _showView(viewType) {
  if (!mainWindow$1) return;
  if (!viewRegistry.has(viewType)) {
    console.log(`[ViewManager] ${viewType} 未加载，现在开始创建...`);
    createAndPreloadView(viewType);
  }
  setTimeout(() => {
    if (!mainWindow$1) return;
    if (!viewRegistry.has(viewType)) {
      console.error(`[ViewManager] 视图 ${viewType} 在延时后仍未创建成功，无法显示。`);
      return;
    }
    _hideCurrentView();
    const views = viewRegistry.get(viewType);
    mainWindow$1.contentView.addChildView(views.contentView);
    views.contentView.webContents.setAudioMuted(false);
    const bounds = mainWindow$1.getContentBounds();
    views.contentView.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height });
    views.contentView.webContents.focus();
    activeViewType = viewType;
    const timer = activeTimers.get(viewType);
    if (timer) {
      clearTimeout(timer);
      activeTimers.delete(viewType);
      console.log(`[ViewManager] 视图 ${viewType} 已激活，销毁定时器已清除。`);
    }
    const viewUrl = views.contentView.webContents.getURL();
    const msg = {
      type: "NewView",
      viewType,
      viewUrl
    };
    setImmediate(() => {
      try {
        notifyRemoteWorkerOfStateChange(JSON.stringify(msg));
      } catch (err) {
        console.error("[ViewManager] 发送NewView消息失败:", err);
      }
    });
    recordViewUsage(viewType);
    if (isMenuVisible) {
      _toggleMenu();
    }
  }, 200);
}
function _toggleMenu() {
  if (!mainWindow$1 || activeViewType === ViewId.NONE) return;
  const views = viewRegistry.get(activeViewType);
  if (!views) return;
  const menuView = views.menuView;
  const bounds = mainWindow$1.getContentBounds();
  if (isMenuVisible) {
    mainWindow$1.contentView.removeChildView(menuView);
    views.contentView.webContents.focus();
  } else {
    mainWindow$1.contentView.addChildView(menuView);
    menuView.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height });
    menuView.webContents.focus();
  }
  isMenuVisible = !isMenuVisible;
}
function enforceViewLimit() {
  console.log(`[ViewManager] 视图数量达到上限(${viewRegistry.size})，开始清理...`);
  const allUsage = getAllViewUsage();
  let oldestViewType = null;
  let oldestTime = Infinity;
  for (const viewType of viewRegistry.keys()) {
    if (viewType === activeViewType) continue;
    const usage = allUsage[viewType];
    if (usage && usage.lastUsed < oldestTime) {
      oldestTime = usage.lastUsed;
      oldestViewType = viewType;
    }
  }
  if (!oldestViewType) {
    for (const viewType of viewRegistry.keys()) {
      if (viewType !== activeViewType) {
        oldestViewType = viewType;
        break;
      }
    }
  }
  if (oldestViewType) {
    console.log(`[ViewManager] 决定销毁最不活跃的视图: ${oldestViewType}`);
    destroyView(oldestViewType);
  }
}
function initializeViewManager(win) {
  mainWindow$1 = win;
  loadAllViewConfigs();
  if (getIsOpenTV && getIsOpenTV()) {
    const latestIPs = getLocalIPList();
    const storedIPs = getLocalIPs();
    const isSame = JSON.stringify(latestIPs) === JSON.stringify(storedIPs);
    setLocalIPs(latestIPs);
    if (isSame) {
      setTimeout(() => {
        _showView(ViewId.TV);
        setTimeout(() => {
          clickDisplayArea();
        }, 800);
      }, 500);
    } else {
      console.log("[ViewManager] 本地IP变化，不自动打开TV");
    }
  }
  electron.ipcMain.handle("get-all-views", () => {
    let toAbsIcon;
    if (utils.is.dev) {
      toAbsIcon = (iconName) => `/icons/${iconName.replace(/^\//, "")}`;
    } else {
      const iconBasePath = path.join(process.resourcesPath, "app.asar.unpacked", "resources", "icons");
      toAbsIcon = (iconName) => `file://${path.join(iconBasePath, iconName.replace(/^\//, ""))}`;
    }
    const allBuiltInViews = [
      { id: ViewId.TV, name: "TV直播", icon: toAbsIcon("TT4.png") },
      { id: ViewId.YANGKU, name: "央视片库", icon: toAbsIcon("cctvpp.png") },
      { id: ViewId.DOUYIN, name: "抖音", icon: toAbsIcon("douyin.png") },
      { id: ViewId.TengXun, name: "腾讯视频", icon: toAbsIcon("腾讯视频.png") },
      { id: ViewId.AIQIYI, name: "爱奇艺", icon: toAbsIcon("爱奇艺.png") },
      { id: ViewId.BILI, name: "哔哩哔哩", icon: toAbsIcon("bili.png") },
      { id: ViewId.DOUYU, name: "斗鱼", icon: toAbsIcon("douyu.png") },
      { id: ViewId.YOUKU, name: "优酷", icon: toAbsIcon("youku.png") },
      { id: ViewId.MGTV, name: "芒果TV", icon: toAbsIcon("MGTV.png") },
      { id: ViewId.SOUHU, name: "搜狐视频", icon: toAbsIcon("souhu.png") },
      { id: ViewId.NETFLIX, name: "Netflix", icon: toAbsIcon("netflix.png") },
      { id: ViewId.YOUTUBE, name: "YouTube", icon: toAbsIcon("youtube.png") }
    ];
    const hiddenBuiltInIds = new Set(getHiddenBuiltInViews());
    return {
      builtIn: allBuiltInViews.map((view) => ({
        ...view,
        isVisible: !hiddenBuiltInIds.has(view.id),
        isCustom: false
      })),
      custom: getCustomViews().map((view) => {
        let iconUrl = view.icon || toAbsIcon("网页.png");
        if (iconUrl && iconUrl.startsWith("file:///")) {
          const fileName = path.basename(iconUrl.replace("file:///", ""));
          iconUrl = `app-icon://${fileName}`;
          updateCustomViewIcon(view.id, iconUrl);
        }
        return {
          ...view,
          icon: iconUrl,
          isVisible: true,
          isCustom: true
        };
      })
    };
  });
  electron.ipcMain.handle("add-custom-view", async (_event, viewData) => {
    const icon2 = await getFaviconAsBase64(viewData.url);
    const viewWithIcon = { ...viewData, icon: icon2 || void 0, userApps: [] };
    const newView = addCustomView(viewWithIcon);
    console.log(`[Store] 已添加新的自定义视图: ${newView.name}`);
    loadAllViewConfigs();
    return newView;
  });
  electron.ipcMain.handle("remove-custom-view", (_event, viewId) => {
    removeCustomView(viewId);
    loadAllViewConfigs();
  });
  mainWindow$1.once("ready-to-show", () => {
    setTimeout(() => {
      console.log("[ViewManager] 开始延迟预加载视图...");
      const candidates = getPreloadCandidates();
      candidates.forEach((viewId) => {
        if (!viewRegistry.has(viewId)) {
          createAndPreloadView(viewId);
        }
      });
    }, 2e3);
  });
  function makeOutput(displayedView, viewName, viewUrl) {
    return {
      type: "viewData",
      DisplayedView: displayedView,
      viewName,
      viewUrl
    };
  }
  async function reportViewState(displayedView, viewName, viewUrl) {
    const out = makeOutput(displayedView, viewName, viewUrl);
    try {
      await notifyRemoteWorkerOfStateChange(JSON.stringify(out));
    } catch (err) {
      console.error("[ViewManager] 发送消息失败:", err);
    }
  }
  async function checkAndReportViewState(webContents, viewType, isMain = false) {
    if (!webContents || webContents.isDestroyed()) return;
    const url = webContents.getURL();
    const isRendererPage = url.includes("index.html") || utils.is.dev && process.env["ELECTRON_RENDERER_URL"] && url.includes(process.env["ELECTRON_RENDERER_URL"]);
    if (isRendererPage) {
      try {
        const hash = await webContents.executeJavaScript("location.hash", true);
        const route = (hash || "").replace(/^#/, "") || "/";
        await reportViewState("vue", route, url);
      } catch (e) {
        await reportViewState("vue", isMain ? "/" : String(viewType), url);
      }
    } else {
      const builtInIds = new Set(Object.values(ViewId));
      const isCustomView = !builtInIds.has(String(viewType));
      await reportViewState(isCustomView ? "OutViews" : "InViews", isMain ? "mainWindow" : String(viewType), url);
    }
  }
  if (viewCheckInterval) clearInterval(viewCheckInterval);
  viewCheckInterval = setInterval(async () => {
    try {
      if (!mainWindow$1 || !mainWindow$1.isFocused()) return;
      if (activeViewType !== ViewId.NONE) {
        const views = viewRegistry.get(activeViewType);
        if (views) {
          await checkAndReportViewState(views.contentView.webContents, activeViewType);
          return;
        }
      }
      await checkAndReportViewState(mainWindow$1.webContents, "mainWindow", true);
    } catch (err) {
      console.error("[ViewManager] 定期检查视图状态失败:", err);
    }
  }, 1007);
  mainWindow$1.on("resize", () => {
    if (!mainWindow$1) return;
    const bounds = mainWindow$1.getContentBounds();
    const activeViews = viewRegistry.get(activeViewType);
    if (activeViews) {
      activeViews.contentView.setBounds(bounds);
      if (isMenuVisible) {
        activeViews.menuView.setBounds(bounds);
      }
    }
  });
  return {
    openView: _showView,
    toggleMenu: _toggleMenu,
    hideMenu: () => {
      if (isMenuVisible) _toggleMenu();
    },
    goBack: () => {
      const views = viewRegistry.get(activeViewType);
      if (views) {
        const wc = views.contentView.webContents;
        if (!wc || wc.isDestroyed()) return;
        // 兼容旧版与新版 Electron：
        // - 旧版：webContents.canGoBack()/goBack()
        // - 新版：webContents.navigationHistory.canGoBack(布尔或函数)/goBack()
        try {
          if (typeof wc.canGoBack === "function") {
            if (wc.canGoBack()) wc.goBack();
            return;
          }
          const hist = wc.navigationHistory;
          if (hist) {
            const canGo = typeof hist.canGoBack === "function" ? hist.canGoBack() : !!hist.canGoBack;
            if (canGo && typeof hist.goBack === "function") {
              hist.goBack();
            }
          }
        } catch (e) {
          console.error("[ViewManager] 执行返回时出错:", e);
        }
      }
    },
    returnToHome: () => {
      if (isMenuVisible) _toggleMenu();
      _hideCurrentView();
    },
    destroyAllViews: () => {
      if (isMenuVisible) _toggleMenu();
      _hideCurrentView();
      viewRegistry.forEach((_, viewType) => destroyView(viewType));
      console.log("[ViewManager] 所有视图已销毁。");
    },
    sendToMenuView: (viewType, channel, ...args) => {
      const views = viewRegistry.get(viewType);
      if (views && !views.menuView.webContents.isDestroyed()) {
        views.menuView.webContents.send(channel, ...args);
      }
    },
    reloadCurrentView: () => {
      const views = viewRegistry.get(activeViewType);
      if (views) {
        views.contentView.webContents.loadURL(ALL_VIEW_CONFIGS[activeViewType].url);
      }
    },
    // 新增一个方法，用于获取当前活动视图的 WebContents
    getNowWebContents: () => {
      if (activeViewType !== ViewId.NONE) {
        const views = viewRegistry.get(activeViewType);
        if (views && !views.contentView.webContents.isDestroyed()) {
          return views.contentView.webContents;
        }
      }
      return mainWindow$1?.webContents ?? null;
    },
    // 手机主动发送消息到渲染进程获取当前视图信息
    getCurrentViewInfo: () => {
      if (activeViewType !== ViewId.NONE) {
        const views = viewRegistry.get(activeViewType);
        if (views && !views.contentView.webContents.isDestroyed()) {
          const viewUrl = views.contentView.webContents.getURL();
          return {
            type: "nowview",
            viewType: activeViewType,
            viewUrl
          };
        }
      }
      return {
        type: "nowview",
        viewType: "home",
        viewUrl: mainWindow$1?.webContents.getURL() ?? ""
      };
    },
    // 这个方法用于聚焦抖音评论鼠标
    focusCommentArea: async () => {
      if (!mainWindow$1) return;
      try {
        const display = electron.screen.getPrimaryDisplay();
        const { width, height } = display.size;
        const scaleFactor = display.scaleFactor;
        const physicalWidth = Math.round(width * scaleFactor);
        const physicalHeight = Math.round(height * scaleFactor);
        console.log(`[ViewManager] 物理分辨率: ${physicalWidth}x${physicalHeight} (缩放因子: ${scaleFactor})`);
        sendCommandToRemoteWorker({
          type: "viewAction",
          action: "douyinMouse",
          payload: { x: 0, y: 0, width: physicalWidth, height: physicalHeight }
        });
      } catch (error) {
        console.error("[ViewManager] 发送 douyinMouse 命令失败:", error);
      }
    },
    // 用于
    executeJavaScriptOnContentView: (viewType, script) => {
      const views = viewRegistry.get(viewType);
      if (views && !views.contentView.webContents.isDestroyed()) {
        views.contentView.webContents.executeJavaScript(script).catch((err) => {
          console.error(`[ViewManager] 执行JS脚本失败 on ${viewType}:`, err);
        });
      }
    }
  };
}
function registerIpcHandlers(mainWindow2, viewManager2) {
  electron.ipcMain.on("open-view", (_event, viewId) => {
    if (viewId) {
      viewManager2.openView(viewId);
    } else {
      console.error("[IPC] Received open-view call with no viewId.");
    }
  });
  electron.ipcMain.on("return-to-home", () => {
    viewManager2.returnToHome();
    mainWindow2.webContents.focus();
  });
  electron.ipcMain.on("closeviews-and-gohome", () => {
    viewManager2.destroyAllViews();
    mainWindow2.webContents.focus();
  });
  electron.ipcMain.on("go-back", () => viewManager2.goBack());
  electron.ipcMain.on("quit-app", () => {
    electron.app.quit();
  });
  electron.ipcMain.on("minimize-app", () => {
    mainWindow2.minimize();
  });
  electron.ipcMain.on("toggle-menu", () => viewManager2.toggleMenu());
  electron.ipcMain.on("hide-menu", () => viewManager2.hideMenu());
  electron.ipcMain.on("reload-current-view", () => viewManager2.reloadCurrentView());
  electron.ipcMain.on("save-TV-lasturl", (_event, url) => {
    setLastUrl("tv", url);
  });
  electron.ipcMain.handle("hide-built-in-view", (_event, viewId) => {
    hideBuiltInView(viewId);
  });
  electron.ipcMain.handle("show-built-in-view", (_event, viewId) => {
    showBuiltInView(viewId);
  });
  electron.ipcMain.handle("get-local-ip", () => {
    return getLocalIP();
  });
  electron.ipcMain.handle("get-screenshot-path", () => {
    return getScreenshotPath();
  });
  electron.ipcMain.handle("set-screenshot-path", (_event, newPath) => {
    setScreenshotPath(newPath);
  });
  electron.ipcMain.on("open-path-in-explorer", (_event, dirPath) => {
    electron.shell.openPath(dirPath).catch((err) => {
      console.error("无法打开路径:", err);
    });
  });
  electron.ipcMain.on("jietu", async () => {
    const dir = getScreenshotPath();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const activeWebContents = viewManager2.getNowWebContents();
    if (!activeWebContents) {
      console.log("没有找到可以截图的活动视图。");
      return;
    }
    const image = await activeWebContents.capturePage();
    const filePath = path.join(dir, `screenshot_${Date.now()}.png`);
    fs.writeFileSync(filePath, image.toPNG());
    console.log("截图已保存:", filePath);
  });
  electron.ipcMain.handle("jietu", async () => {
    const dir = getScreenshotPath();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const activeWebContents = viewManager2.getNowWebContents();
    if (!activeWebContents) {
      console.log("没有找到可以截图的活动视图。");
      return null;
    }
    const image = await activeWebContents.capturePage();
    const filePath = path.join(dir, `screenshot_${Date.now()}.png`);
    fs.writeFileSync(filePath, image.toPNG());
    console.log("截图已保存:", filePath);
    return filePath;
  });
  electron.ipcMain.handle("select-app", async () => {
    const { canceled, filePaths } = await electron.dialog.showOpenDialog(mainWindow2, {
      title: "选择应用程序",
      properties: ["openFile"],
      filters: [
        { name: "Applications", extensions: ["exe", "app", "lnk", "*"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    if (canceled || filePaths.length === 0) {
      return null;
    }
    const filePath = filePaths[0];
    let targetPath = filePath;
    let name = path.basename(filePath, path.extname(filePath));
    try {
      if (process.platform === "win32" && path.extname(filePath).toLowerCase() === ".lnk") {
        const shortcutDetails = electron.shell.readShortcutLink(filePath);
        if (shortcutDetails.target) {
          targetPath = shortcutDetails.target;
        }
      }
      const icon2 = await electron.app.getFileIcon(targetPath, { size: "large" });
      const userApp = {
        id: `user-app-${Date.now()}`,
        // 使用时间戳确保唯一性
        name,
        path: targetPath,
        // 保存真实路径用于启动
        icon: icon2.toDataURL()
        // 转换为 Base64
      };
      addUserApp(userApp);
      return userApp;
    } catch (error) {
      console.error("添加应用失败:", error);
      return null;
    }
  });
  electron.ipcMain.handle("remove-user-app", (_event, appId) => {
    if (appId) {
      removeUserApp(appId);
      return true;
    }
    return false;
  });
  electron.ipcMain.on("launch-shortcut", (_event, executablePath) => {
    if (executablePath) {
      electron.shell.openPath(executablePath).then(() => {
        mainWindow2.minimize();
      }).catch((err) => {
        console.error(`无法启动应用: ${executablePath}`, err);
      });
    }
  });
  electron.ipcMain.handle("get-user-apps", () => {
    return getUserApps();
  });
  electron.ipcMain.on("set-open-at-login", (_event, enabled) => {
    setOpenAtLogin(enabled);
    electron.app.setLoginItemSettings({
      openAtLogin: enabled,
      path: electron.app.getPath("exe")
    });
  });
  electron.ipcMain.handle("get-open-at-login-status", () => {
    return getOpenAtLogin();
  });
  electron.ipcMain.handle("set-custom-view-icon", async (_event, viewId) => {
    if (!viewId) return null;
    const { canceled, filePaths } = await electron.dialog.showOpenDialog(mainWindow2, {
      title: "选择一个图标",
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "ico", "webp"] }]
    });
    if (canceled || filePaths.length === 0) {
      return null;
    }
    try {
      const originalPath = filePaths[0];
      const customIconsDir = getCustomIconsPath();
      const newFileName = `${viewId}_${Date.now()}${path.extname(originalPath)}`;
      const newPath = path.join(customIconsDir, newFileName);
      fs.copyFileSync(originalPath, newPath);
      const iconUrl = `app-icon://${newFileName}`;
      updateCustomViewIcon(viewId, iconUrl);
      console.log(`[IPC] 已为视图 ${viewId} 设置新图标: ${iconUrl}`);
      return iconUrl;
    } catch (error) {
      console.error(`[IPC] 设置自定义图标失败:`, error);
      return null;
    }
  });
  electron.ipcMain.on("focusCommentArea", () => {
    viewManager2.focusCommentArea();
  });
  electron.ipcMain.on("update-tv-channels", (_event, channelData) => {
    viewManager2.sendToMenuView(ViewId.TV, "channels-updated", channelData);
  });
  electron.ipcMain.on("jump-to-channel", (_event, channelName) => {
    console.log("jump-to-channel 函数被调用了");
    viewManager2.executeJavaScriptOnContentView(
      ViewId.TV,
      `jumpToChannel('${channelName.replace(/'/g, "\\'")}')`
    );
  });
  electron.ipcMain.handle("get-isopenTV", () => {
    return getIsOpenTV();
  });
  electron.ipcMain.handle("set-isopenTV", (_event, val) => {
    setIsOpenTV(val);
    return val;
  });
  electron.ipcMain.on("search-tencent-video", (_event, query) => {
    viewManager2.executeJavaScriptOnContentView(
      ViewId.TengXun,
      `searchVideo(${JSON.stringify(query)})`
    );
  });
  electron.ipcMain.on("send-tencent-danmu", (_event, text) => {
    viewManager2.executeJavaScriptOnContentView(
      ViewId.TengXun,
      `sendDanmu(${JSON.stringify(text)})`
    );
  });
  electron.ipcMain.on("search-iqiyi-video", (_event, query) => {
    viewManager2.executeJavaScriptOnContentView(
      ViewId.AIQIYI,
      `searchaiqiyi(${JSON.stringify(query)})`
    );
  });
  electron.ipcMain.on("search-bili-video", (_event, query) => {
    viewManager2.executeJavaScriptOnContentView(
      ViewId.BILI,
      `searchVideo(${JSON.stringify(query)})`
    );
  });
  electron.ipcMain.on("send-bili-danmu", (_event, text) => {
    viewManager2.executeJavaScriptOnContentView(
      ViewId.BILI,
      `sendDanmu(${JSON.stringify(text)})`
    );
  });
  electron.ipcMain.on("search-yangku-video", (_event, query) => {
    viewManager2.executeJavaScriptOnContentView(
      ViewId.YANGKU,
      `searchVideo(${JSON.stringify(query)})`
    );
  });
  electron.ipcMain.on("search-douyin-video", (_event, query) => {
    viewManager2.executeJavaScriptOnContentView(
      ViewId.DOUYIN,
      `searchDouyin(${JSON.stringify(query)})`
    );
  });
  electron.ipcMain.handle("get-version", () => {
    return electron.app.getVersion();
  });
  electron.ipcMain.handle("check-update", async () => {
    if (process.platform !== "linux") {
      return { has_update: false, release_notes: "仅Linux系统可用" };
    }
    try {
      const response = await electron.net.fetch("http://show.luckylizi.cn:8056/is_update");
      if (!response.ok) {
        return { has_update: false, release_notes: "网络错误" };
      }
      return await response.json();
    } catch (e) {
      return { has_update: false, release_notes: "网络错误" };
    }
  });
}
const execAsync = util.promisify(child_process.exec);
let ydooldProcess = null;
async function isYdooldRunning() {
  try {
    await execAsync("pgrep -x ydotoold");
    console.log("[DaemonManager] ydotoold is already running.");
    return true;
  } catch (error) {
    console.log("[DaemonManager] ydotoold is not running.");
    return false;
  }
}
async function findYdooldPath() {
  try {
    const { stdout } = await execAsync("which ydotoold");
    const path2 = stdout.trim();
    if (path2) {
      console.log(`[DaemonManager] Found ydotoold at: ${path2}`);
      return path2;
    }
  } catch (error) {
  }
  console.error('[DaemonManager] Could not find "ydotoold" executable in PATH.');
  return null;
}
async function startYdoold() {
  const ydooldPath = await findYdooldPath();
  if (!ydooldPath) {
    console.error("[DaemonManager] Aborting start of ydotoold because it was not found.");
    return;
  }
  console.log(`[DaemonManager] Attempting to start ydotoold from: ${ydooldPath}...`);
  ydooldProcess = child_process.spawn(ydooldPath, [], {
    detached: true,
    // 让子进程在父进程退出后继续运行
    stdio: "ignore"
    // 忽略子进程的输出，避免阻塞
  });
  ydooldProcess.unref();
  ydooldProcess.on("error", (err) => {
    console.error("[DaemonManager] Failed to start ydotoold. Please ensure ydotool is installed and you have permissions.", err);
  });
  ydooldProcess.on("spawn", () => {
    console.log("[DaemonManager] ydotoold process spawned successfully.");
  });
}
async function initializeWaylandDaemon() {
  if (process.platform !== "linux" || !process.env.WAYLAND_DISPLAY) {
    return;
  }
  if (!await isYdooldRunning()) {
    await startYdoold();
  }
}
function cleanupWaylandDaemon() {
  if (ydooldProcess && !ydooldProcess.killed) {
    console.log("[DaemonManager] Cleaning up our ydotoold process...");
    ydooldProcess.kill();
  }
}
electron.protocol.registerSchemesAsPrivileged([
  { scheme: "bytedance", privileges: { standard: true, secure: true, supportFetchAPI: true } },
  { scheme: "app-icon", privileges: { standard: true, secure: true, bypassCSP: true } }
]);
electron.protocol.registerSchemesAsPrivileged([
  { scheme: "bytedance", privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);
electron.app.commandLine.appendSwitch("webrtc-ip-handling-policy", "default_public_interface_only");
let mainWindow = null;
let viewManager = null;
let remoteWorker = null;
let remoteWorkerRestartCount = 0;
const MAX_REMOTE_WORKER_RESTARTS = 3;
let appTray = null;
// 置顶展示错误对话框，避免被其他窗口遮挡
async function showTopMostError(title, message) {
  try {
    const buttons = ["确定"];
    if (mainWindow) {
      const prevTop = mainWindow.isAlwaysOnTop();
      try {
        // 使用最高级别以尽量确保置顶（Linux/Wayland 下行为取决于 WM）
        mainWindow.setAlwaysOnTop(true, "screen-saver");
        await electron.dialog.showMessageBox(mainWindow, {
          type: "error",
          title,
          message: String(message || "未知错误"),
          buttons
        });
      } finally {
        mainWindow.setAlwaysOnTop(prevTop);
        try { mainWindow.focus(); } catch {}
      }
    } else {
      await electron.dialog.showMessageBox({
        type: "error",
        title,
        message: String(message || "未知错误"),
        buttons
      });
    }
  } catch (err) {
    console.error("[ErrorDialog] 显示错误对话框失败:", err);
  }
}
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    title: "电视时光",
    width: 900,
    height: 670,
    show: false,
    // 初始时不显示窗口
    autoHideMenuBar: true,
    // 自动隐藏菜单栏
    fullscreen: true,
    // 设置为全屏模式
    frame: false,
    // 隐藏边框
    ...(process.platform === "linux" || process.platform === "win32" ? { icon: appWindowIcon } : {}),
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (details.url.startsWith("bytedance://")) {
      console.log(`[MainWindow] 已拦截并阻止打开: ${details.url}`);
      return { action: "deny" };
    }
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  minimizeToTray();
}
electron.app.whenReady().then(async () => {
  setupSessionSecurity();
  utils.electronApp.setAppUserModelId("com.electron");
  electron.protocol.handle("app-icon", handleAppIconProtocol);
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  electron.ipcMain.on("ping", () => console.log("pong"));
  createWindow();
  if (mainWindow) {
    viewManager = initializeViewManager(mainWindow);
    registerIpcHandlers(mainWindow, viewManager);
  }
  // 捕获主进程异常并置顶显示
  process.on("uncaughtException", (err) => {
    console.error("[Main] uncaughtException:", err);
    showTopMostError("程序发生未捕获异常", err?.stack || err?.message || String(err));
  });
  process.on("unhandledRejection", (reason) => {
    console.error("[Main] unhandledRejection:", reason);
    const msg = typeof reason === "object" && reason !== null ? (reason.stack || reason.message || JSON.stringify(reason)) : String(reason);
    showTopMostError("出现未处理的 Promise 拒绝", msg);
  });
  // 捕获渲染进程崩溃/无响应/预加载错误并置顶显示
  electron.app.on("web-contents-created", (_e, contents) => {
    contents.on("render-process-gone", (_event, details) => {
      console.error("[Renderer] render-process-gone:", details);
      showTopMostError("渲染进程已退出", `${details.reason || "unknown"} (exitCode: ${details.exitCode ?? "?"})`);
    });
    contents.on("unresponsive", () => {
      console.error("[Renderer] unresponsive");
      showTopMostError("页面无响应", "当前页面长时间无响应，请尝试稍后重试或重启应用。");
    });
    contents.on("preload-error", (_event, preloadPath, error) => {
      console.error("[Renderer] preload-error:", preloadPath, error);
      showTopMostError("预加载脚本错误", `${preloadPath}\n\n${error?.stack || error}`);
    });
    contents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
      // 网络失败类问题不一定弹窗，这里仅记录严重错误（如 -3: ABORTED 等忽略）
      if (errorCode && errorCode !== -3) {
        console.error("[Renderer] did-fail-load:", errorCode, errorDescription, validatedURL);
        showTopMostError("页面加载失败", `${errorDescription} (${errorCode})\nURL: ${validatedURL}`);
      }
    });
  });
  electron.app.on("activate", function() {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  mainWindow?.on("ready-to-show", () => {
    setTimeout(() => {
      if (!remoteWorker) {
        remoteWorkerRestartCount = 0;
        startRemoteWorker();
      }
    }, 1e3);
    initializePlugins();
    checkForUpdates();
    initializeWaylandDaemon();
    if (!utils.is.dev && process.platform !== "linux") {
      electronUpdater.autoUpdater.checkForUpdatesAndNotify();
      electronUpdater.autoUpdater.on("update-downloaded", () => {
        setUpdateDownloaded(true);
      });
    }
  });
  electron.powerMonitor.on("unlock-screen", () => {
    if (process.platform === "linux") {
      console.log("[Main] 屏幕解锁，发送 reloadInputModule 指令");
      sendCommandToRemoteWorker({ type: "reloadInputModule" });
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("before-quit", () => {
  if (remoteWorker) {
    remoteWorker.kill();
    remoteWorker = null;
  }
});
electron.app.on("will-quit", () => {
  cleanupWaylandDaemon();
});
electron.app.on("ready", () => {
  if (getUpdateDownloaded()) {
    clearUpdateDownloaded();
    electronUpdater.autoUpdater.quitAndInstall();
  }
});
function startRemoteWorker() {
  const workerPath = path.join(__dirname, "./remote/remote.worker.js");
  remoteWorker = child_process.fork(workerPath, [], { stdio: "inherit" });
  remoteWorker.on("message", (message) => {
    if (message.type === "viewAction" && viewManager) {
      handleViewAction(message.command);
    }
  });
  remoteWorker.on("error", (error) => {
    console.error("[Main] Worker process error:", error);
    showTopMostError("后台服务错误", error?.stack || error?.message || String(error));
  });
  remoteWorker.on("exit", (code) => {
    console.log(`[Main] Worker process exited with code ${code}`);
    remoteWorker = null;
    if (typeof code === "number" && code !== 0) {
      showTopMostError("后台服务退出", `远程工作进程已退出 (code: ${code})`);
    }
    if (remoteWorkerRestartCount < MAX_REMOTE_WORKER_RESTARTS) {
      remoteWorkerRestartCount++;
      console.log(`[Main] Restarting worker process (${remoteWorkerRestartCount}/${MAX_REMOTE_WORKER_RESTARTS})...`);
      setTimeout(() => startRemoteWorker(), 2e3);
    } else {
      console.error("[Main] Worker process exited too many times, not restarting.");
    }
  });
}
function handleViewAction(command) {
  if (!viewManager) return;
  const { action, payload } = command;
  console.log(`[Main] 接收到的数据: ${action} with payload:`, payload);
  switch (action) {
    case "openView":
      if (payload && typeof payload === "string") {
        electron.ipcMain.emit("open-view", null, payload || void 0);
      }
      break;
    case "returnToHome":
      electron.ipcMain.emit("return-to-home", null, payload || void 0);
      break;
    case "toggleMenu":
      electron.ipcMain.emit("toggle-menu", null, payload || void 0);
      break;
    case "goBack":
      electron.ipcMain.emit("go-back", null, payload || void 0);
      break;
    case "reloadCurrentView":
      electron.ipcMain.emit("reload-current-view", null, payload || void 0);
      break;
    case "jumpToChannel":
      console.log("jumpToChannel payload类型:", typeof payload, "内容:", JSON.stringify(payload));
      electron.ipcMain.emit("jump-to-channel", null, payload);
      break;
    case "searchTencentVideo":
      electron.ipcMain.emit("search-tencent-video", null, payload);
      break;
    case "sendTencentDanmu":
      electron.ipcMain.emit("send-tencent-danmu", null, payload);
      break;
    case "searchIqiyiVideo":
      electron.ipcMain.emit("search-iqiyi-video", null, payload);
      break;
    case "searchBiliVideo":
      electron.ipcMain.emit("search-bili-video", null, payload);
      break;
    case "sendBiliDanmu":
      electron.ipcMain.emit("send-bili-danmu", null, payload);
      break;
    case "searchYangkuVideo":
      electron.ipcMain.emit("search-yangku-video", null, payload);
      break;
    case "searchDouyinVideo":
      electron.ipcMain.emit("search-douyin-video", null, payload);
      break;
    case "jieTu":
      electron.ipcMain.emit("jietu", null, payload || void 0);
      break;
    case "getCurrentViewInfo":
      if (viewManager) {
        const info = viewManager.getCurrentViewInfo();
        if (process.send) {
          process.send({ type: "currentViewInfo", payload: info });
        }
        electron.ipcMain.emit("current-now-view", null, info);
      }
      break;
  }
}
function notifyRemoteWorkerOfStateChange(activeView) {
  if (remoteWorker && remoteWorker.connected) {
    remoteWorker.send({ type: "stateUpdate", payload: { activeView } });
  }
}
function sendCommandToRemoteWorker(command) {
  if (remoteWorker && remoteWorker.connected) {
    remoteWorker.send(command);
  }
}
function setupSessionSecurity() {
  const ses = electron.session.defaultSession;
  ses.webRequest.onHeadersReceived((details, callback) => {
    if (details.url.startsWith("http://")) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": ["upgrade-insecure-requests;"]
      }
    });
  });
  ses.protocol.handle("bytedance", (request) => {
    console.log(`[Session] 已拦截并阻止 bytedance:// 协议请求: ${request.url}`);
    return Promise.reject(new Error("Blocked custom protocol"));
  });
}
function minimizeToTray() {
  if (process.platform !== "win32" || !mainWindow) return;
  const trayIconPath = path.join(__dirname, "../../resources/icon.ico");
  if (appTray) {
    try {
      appTray.destroy();
    } catch (e) {
    }
    appTray = null;
  }
  appTray = new electron.Tray(trayIconPath);
  appTray.setToolTip("电视时光");
  appTray.setContextMenu(
    electron.Menu.buildFromTemplate([
      {
        label: "显示主窗口",
        click: () => {
          mainWindow?.show();
          mainWindow?.setSkipTaskbar(false);
          mainWindow?.focus();
        }
      },
      {
        label: "退出",
        click: () => {
          electron.app.quit();
        }
      }
    ])
  );
  appTray.on("click", () => {
    mainWindow?.show();
    mainWindow?.setSkipTaskbar(false);
    mainWindow?.focus();
  });
  if (mainWindow) {
    mainWindow.setSkipTaskbar(true);
    mainWindow.on("minimize", (event) => {
      event.preventDefault();
      mainWindow?.hide();
      mainWindow?.setSkipTaskbar(true);
    });
  }
}
function handleAppIconProtocol(request) {
  let url = request.url.replace("app-icon://", "");
  url = url.replace(/^\//, "");
  url = url.replace(/\/$/, "");
  const filePath = path.join(getCustomIconsPath(), url);
  console.log("[app-icon] 请求:", request.url, "实际文件:", filePath);
  if (!fs.existsSync(filePath)) {
    return new Response("File not found", { status: 404 });
  }
  const fileStream = fs.createReadStream(filePath);
  const readableStream = new ReadableStream({
    start(controller) {
      fileStream.on("data", (chunk) => controller.enqueue(chunk));
      fileStream.on("end", () => controller.close());
      fileStream.on("error", (err) => controller.error(err));
    }
  });
  return new Response(readableStream, {
    status: 200,
    headers: { "Content-Type": "application/octet-stream" }
  });
}
exports.notifyRemoteWorkerOfStateChange = notifyRemoteWorkerOfStateChange;
exports.sendCommandToRemoteWorker = sendCommandToRemoteWorker;
