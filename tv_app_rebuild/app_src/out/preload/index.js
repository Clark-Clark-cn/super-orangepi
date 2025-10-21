"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
function injectStyle(css) {
  const style = document.createElement("style");
  style.textContent = css;
  const insertStyle = () => {
    if (document.head) {
      document.head.appendChild(style);
    } else {
      setTimeout(insertStyle, 1);
    }
  };
  insertStyle();
}
function tengXunHack() {
  if (location.hostname === "v.qq.com") {
    injectStyle(`#channel-page-scroller > div:nth-child(1) { display: none !important; }`);
    window.addEventListener("DOMContentLoaded", () => {
      const observer = new MutationObserver(() => {
        const banner = document.querySelector("#channel-page-scroller > div:nth-child(1)");
        if (banner) banner.style.display = "none";
      });
      const scroller = document.getElementById("channel-page-scroller");
      if (scroller) observer.observe(scroller, { childList: true, subtree: false });
      const hideSidebarItems = () => {
        ["中视频", "小游戏"].forEach((txt) => {
          document.querySelectorAll(".nav-wrap .nav-item-wrap .text").forEach((el) => {
            if (el.textContent && el.textContent.trim().startsWith(txt)) {
              const navItem = el.closest(".nav-item");
              if (navItem) navItem.style.display = "none";
              const navDiv = el.closest("div[style]");
              if (navDiv && navDiv.querySelector(".nav-item")) navDiv.style.display = "none";
            }
          });
        });
      };
      hideSidebarItems();
      const navWrap = document.querySelector(".nav-wrap");
      if (navWrap) {
        const navObserver = new MutationObserver(hideSidebarItems);
        navObserver.observe(navWrap, { childList: true, subtree: true });
      }
    });
  }
}
function hideBanner1() {
  injectStyle(`
    #bid > div.nav_wrapper_bg { display: none !important; }
    /* 兼容部分页面结构 */
    body > div.nav_wrapper_bg { display: none !important; }
  `);
}
function hideBanner2() {
  injectStyle(`
    #page_body > div.gwA18043_ind01 { display: none !important; }
    /* 兼容部分页面结构 */
    #page_body > div:nth-child(2).gwA18043_ind01 { display: none !important; }
    body > div.gwA18043_ind01 { display: none !important; }
  `);
}
function hideBanner3() {
  injectStyle(`
    #page_body > div.header_nav.newtopbzTV ul,
    #page_body > div.header_nav.newtopbzTV li,
    body > div.header_nav.newtopbzTV ul,
    body > div.header_nav.newtopbzTV li {
      display: none !important;
    }
    #page_body > div.header_nav.newtopbzTV,
    body > div.header_nav.newtopbzTV {
      min-height: 150px !important;
      height: 150px !important;
      background: #181818 !important;
      padding-top: 50px !important;
    }
  `);
  window.addEventListener("DOMContentLoaded", () => {
    try {
      const logoLink = document.querySelector(".header_nav.newtopbzTV .logoNav a");
      if (logoLink) {
        logoLink.href = "https://tv.cctv.com/yxg/index.shtml";
      }
    } catch (e) {
    }
  });
}
function hidelan1() {
  injectStyle(`
    #page_body > div:nth-child(5) > div.col_w166 { display: none !important; }
    /* 兼容部分页面结构 */
    #page_body > div:nth-child(5) > div:nth-child(2) { display: none !important; }
    .col_w166 { display: none !important; }
  `);
}
function hidelan2() {
  injectStyle(`
    #jckdTV { display: none !important; }
  `);
}
function hidelan10() {
  injectStyle(`
    /* 精确选择右侧收视TOP榜容器进行隐藏 */
    #page_body > div > div.col_w280 > div.ELMTXEMhod234w8H7el6vB4V211019 { display: none !important; }
    /* 兼容部分页面结构，兜底隐藏所有该类名的块 */
    .ELMTXEMhod234w8H7el6vB4V211019 { display: none !important; }
  `);
}
function hidelan11() {
  injectStyle(`
    /* 精确隐藏右侧广告栏 */
    #page_body > div:nth-child(25) > div.col_w280 { display: none !important; }
    /* 兼容部分页面结构，兜底隐藏所有右侧宽280的栏 */
    #page_body > div > div.col_w280 { display: none !important; }
    .col_w280 { display: none !important; }
  `);
}
function hidelan9() {
  injectStyle(`
    #video > div.video_btnBar { display: none !important; }
  `);
}
function buttom1() {
  injectStyle(`
    #page_body > div.XUQIU18897_pinglun { display: none !important; }
  `);
}
function buttom2() {
  injectStyle(`
    #page_body > div.XUQIU18897_tonglan > div:nth-child(1) { display: none !important; }
  `);
}
function buttom3() {
  injectStyle(`
    #SUBD1575862763294715 { display: none !important; }
  `);
}
function buttom5() {
  injectStyle(`
    #page_body > div.column_wrapper_1025 > div:nth-child(9) > div.column_wrapper_xw { display: none !important; }
    /* 兜底：更通用的类选择器 */
    .column_wrapper_xw { display: none !important; }
  `);
}
function yangKU() {
  if (location.hostname.endsWith("cctv.com")) {
    hideBanner1();
    hideBanner2();
    hideBanner3();
    hidelan1();
    hidelan2();
    hidelan9();
    hidelan10();
    hidelan11();
    buttom1();
    buttom2();
    buttom3();
    buttom5();
  }
}
function injectUniversalButtons(actions) {
  if (document.querySelector(".tvb-universal-buttons")) {
    return;
  }
  const icons = {
    home: `<svg viewBox="0 0 1024 1024" fill="currentColor" width="24" height="24"><path d="M946.5 505L534.6 93.4a31.93 31.93 0 00-45.2 0L77.5 505c-12 12-18.8 28.3-18.8 45.3 0 35.3 28.7 64 64 64h43.4V908c0 17.7 14.3 32 32 32h264c17.7 0 32-14.3 32-32V642c0-17.7 14.3-32 32-32h64c17.7 0 32 14.3 32 32v266c0 17.7 14.3 32 32 32h264c17.7 0 32-14.3 32-32V614.3h43.4c35.3 0 64-28.7 64-64 0-17-6.8-33.3-18.8-45.3z"></path></svg>`,
    refresh: `<svg t="1759326518000" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="5459" width="24" height="24"><path d="M512 85.333333c98.922667 0 192.554667 33.856 267.434667 94.186667l53.461333-53.482667 85.76 241.664-241.664-85.76 41.664-41.642666A339.818667 339.818667 0 0 0 512 170.666667C323.477333 170.666667 170.666667 323.477333 170.666667 512s152.810667 341.333333 341.333333 341.333333a340.053333 340.053333 0 0 0 241.365333-99.968 339.989333 339.989333 0 0 0 99.84-232.490666L853.333333 512h85.333334a425.386667 425.386667 0 0 1-124.970667 301.696A425.386667 425.386667 0 0 1 512 938.666667C276.352 938.666667 85.333333 747.648 85.333333 512S276.352 85.333333 512 85.333333z" fill="#515151" p-id="5460"></path></svg>`,
    back: `<svg viewBox="0 0 1024 1024" fill="currentColor" width="24" height="24"><path d="M872 474H286.9l350.2-304c5.6-4.9 9.2-11.5 9.2-18.5 0-13.5-10.9-24.5-24.5-24.5-8.5 0-16.3 4.2-21.1 11L173.1 499.9a32.06 32.06 0 000 48.2l377.6 339.9c4.8 4.3 10.9 6.6 17.3 6.6 13.5 0 24.5-10.9 24.5-24.5 0-6.9-2.8-13.2-7.4-17.8L286.9 550H872c13.3 0 24-10.7 24-24v-28c0-13.3-10.7-24-24-24z"></path></svg>`
  };
  const css = `
    .tvb-universal-buttons {
      position: fixed;
      top: 50%;
      right: 0;
      transform: translateY(-50%);
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 2147483647;
      padding: 8px 4px 8px 8px;
      background-color: rgba(0, 0, 0, 0.1);
      border-radius: 10px 0 0 10px;
      transition: background-color 0.3s, opacity 0.5s ease-in-out;
      opacity: 1;
    }
    .tvb-universal-buttons.hidden {
      opacity: 0;
      pointer-events: none;
    }
    .tvb-universal-buttons:hover {
      background-color: rgba(0, 0, 0, 0.3);
    }
    .tvb-universal-button {
      background: rgba(255, 255, 255, 0.5);
      border: none;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background-color 0.3s;
      padding: 0;
      color: #333;
    }
    .tvb-universal-button:hover {
      background: rgba(255, 255, 255, 0.8);
      color: #000;
    }
    .tvb-universal-button svg {
      vertical-align: middle;
    }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  const container = document.createElement("div");
  container.className = "tvb-universal-buttons";
  const createButton = (id, icon, title, action) => {
    const button = document.createElement("button");
    button.id = `tvb-btn-${id}`;
    button.className = "tvb-universal-button";
    button.innerHTML = icon;
    button.title = title;
    button.addEventListener("click", action);
    return button;
  };
  const btnHome = createButton("home", icons.home, "返回主页", actions.returnToHome);
  const btnRefresh = createButton("refresh", icons.refresh, "刷新页面", actions.reloadCurrentView);
  const btnBack = createButton("back", icons.back, "后退", actions.goBack);
  container.appendChild(btnHome);
  container.appendChild(btnRefresh);
  container.appendChild(btnBack);
  document.body.appendChild(container);
  let inactivityTimer;
  const showAndResetTimer = () => {
    container.classList.remove("hidden");
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      container.classList.add("hidden");
    }, 2e3);
  };
  document.addEventListener("mousemove", showAndResetTimer);
  showAndResetTimer();
}
const path = require("path");
const api = {
  // --- 通用视图控制 ---
  // 2. 使用一个通用的 openView 函数，代替所有独立的 openXxx 函数
  openView: (viewId) => electron.ipcRenderer.send("open-view", viewId),
  returnToHome: () => electron.ipcRenderer.send("return-to-home"),
  // 返回首页
  closeAndGoHome: () => electron.ipcRenderer.send("closeviews-and-gohome"),
  goBack: () => electron.ipcRenderer.send("go-back"),
  // 后退
  quitApp: () => electron.ipcRenderer.send("quit-app"),
  // 退出应用
  minimizeApp: () => electron.ipcRenderer.send("minimize-app"),
  // 最小化应用
  // --- 通用菜单控制 ---
  toggleMenu: () => electron.ipcRenderer.send("toggle-menu"),
  // 显示菜单
  hideMenu: () => electron.ipcRenderer.send("hide-menu"),
  // 隐藏菜单
  reloadCurrentView: () => electron.ipcRenderer.send("reload-current-view"),
  // 重新加载当前视图
  // --- 用户自定义视图管理 (使用 invoke 因为主进程用 handle) ---
  getAllViews: () => electron.ipcRenderer.invoke("get-all-views"),
  addCustomView: (data) => electron.ipcRenderer.invoke("add-custom-view", data),
  removeCustomView: (id) => electron.ipcRenderer.invoke("remove-custom-view", id),
  // 新增：获取用户添加的本地应用
  getUserApps: () => electron.ipcRenderer.invoke("get-user-apps"),
  // 新增：选择并添加一个本地应用
  selectAndAddApp: () => electron.ipcRenderer.invoke("select-app"),
  // 新增：移除一个本地用户应用
  removeUserApp: (id) => electron.ipcRenderer.invoke("remove-user-app", id),
  // 新增：启动本地应用
  launchShortcut: (path2) => electron.ipcRenderer.send("launch-shortcut", path2),
  // 应用开机自启动
  getOpenAtLogin: () => electron.ipcRenderer.invoke("get-open-at-login-status"),
  setOpenAtLogin: (enabled) => electron.ipcRenderer.send("set-open-at-login", enabled),
  // 添加自定义图标
  setCustomViewIcon: (viewId) => electron.ipcRenderer.invoke("set-custom-view-icon", viewId),
  // 新增暴露的API
  hideBuiltInView: (viewId) => electron.ipcRenderer.invoke("hide-built-in-view", viewId),
  // 隐藏内置视图
  showBuiltInView: (viewId) => electron.ipcRenderer.invoke("show-built-in-view", viewId),
  // 显示内置视图
  // --- 特定视图的 API ---
  // TV
  saveChannelUrl: (url) => electron.ipcRenderer.send("save-TV-lasturl", url),
  updateTvChannels: (data) => electron.ipcRenderer.send("update-tv-channels", data),
  onChannelsUpdated: (callback) => electron.ipcRenderer.on("channels-updated", callback),
  jumpToChannel: (channelName) => electron.ipcRenderer.send("jump-to-channel", channelName),
  // 新增：开机自动打开TV的设置
  getIsOpenTV: () => electron.ipcRenderer.invoke("get-isopenTV"),
  setIsOpenTV: (val) => electron.ipcRenderer.invoke("set-isopenTV", val),
  // 暴露ip地址
  getLocalIP: () => electron.ipcRenderer.invoke("get-local-ip"),
  // 获取当前版本
  getAppVersion: () => electron.ipcRenderer.invoke("get-version"),
  // 打开截图文件夹
  openScreenshotPath: async () => {
    const dir = await electron.ipcRenderer.invoke("get-screenshot-path");
    electron.ipcRenderer.send("open-path-in-explorer", dir);
  },
  getIconPath: (iconName) => {
    if (process.env.NODE_ENV === "development") {
      return `/icons/${iconName.replace(/^\//, "")}`;
    }
    const iconBasePath = path.join(process.resourcesPath, "app.asar.unpacked", "resources", "icons");
    return `file://${path.join(iconBasePath, iconName.replace(/^\//, ""))}`;
  },
  getImgPath: (imgName) => {
    if (process.env.NODE_ENV === "development") {
      return `/images/${imgName.replace(/^\//, "")}`;
    }
    const imgBasePath = path.join(process.resourcesPath, "app.asar.unpacked", "resources", "images");
    return `file://${path.join(imgBasePath, imgName.replace(/^\//, ""))}`;
  },
  getScreenshotPath: () => electron.ipcRenderer.invoke("get-screenshot-path"),
  // 抖音
  focusArea: () => electron.ipcRenderer.send("focusCommentArea"),
  // 获取外部的接口
  //1.检查更新
  checkUpdate: () => electron.ipcRenderer.invoke("check-update")
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
    electron.contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = preload.electronAPI;
  window.api = api;
}
tengXunHack();
yangKU();
yangKU();
const isYangshipin = window.location.href.includes("yangshipin");
const isExternalSite = !window.location.href.startsWith("http://localhost:5173") && !window.location.protocol.startsWith("file") && !isYangshipin;
if (isExternalSite) {
  const buttonActions = {
    returnToHome: api.returnToHome,
    reloadCurrentView: () => location.reload(),
    // 刷新当前页面
    goBack: api.goBack
  };
  let injectionDone = false;
  const tryInjectButtons = () => {
    if (injectionDone || !document.body) {
      return;
    }
    if (document.querySelector(".tvb-universal-buttons")) {
      injectionDone = true;
      return;
    }
    requestAnimationFrame(() => {
      injectUniversalButtons(buttonActions);
      injectionDone = true;
    });
  };
  tryInjectButtons();
  window.addEventListener("DOMContentLoaded", tryInjectButtons, { once: true });
  const observer = new MutationObserver(() => {
    if (document.body) {
      tryInjectButtons();
      observer.disconnect();
    }
  });
  observer.observe(document.documentElement, { childList: true });
  const handleRouteChange = () => {
    injectionDone = false;
    setTimeout(tryInjectButtons, 100);
  };
  const originalPushState = history.pushState;
  history.pushState = function(...args) {
    originalPushState.apply(this, args);
    handleRouteChange();
  };
  const originalReplaceState = history.replaceState;
  history.replaceState = function(...args) {
    originalReplaceState.apply(this, args);
    handleRouteChange();
  };
  window.addEventListener("popstate", handleRouteChange);
}
