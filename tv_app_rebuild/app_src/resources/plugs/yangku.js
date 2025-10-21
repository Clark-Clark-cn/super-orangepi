// 央视频片库相关的脚本

// 本地存储
localStorage.setItem('myKey', '这是测试的值');

// --- 1. 通用工具函数 ---

// 点击事件模拟器
function simulateClick(element) {
  const clickEvent = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window
  });
  element.dispatchEvent(clickEvent);
}

// 键盘事件模拟器
function simulateKeyPress(key) {
    const eventOptions = {
        key: key,
        code: `Key${key.toUpperCase()}`,
        keyCode: key.toUpperCase().charCodeAt(0),
        which: key.toUpperCase().charCodeAt(0),
        bubbles: true,
        cancelable: true,
        view: window
    };
    document.body.dispatchEvent(new KeyboardEvent('keydown', eventOptions));
    document.body.dispatchEvent(new KeyboardEvent('keyup', eventOptions));
}

// 键盘监听器
function listenForKey(key, callback) {
    document.addEventListener('keydown', (event) => {
        if (event.key.toLowerCase() === key.toLowerCase()) {
            const activeElement = document.activeElement;
            const isTyping = activeElement && (
                activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.isContentEditable
            );
            if (!isTyping) {
                event.preventDefault();
                callback(event); // 将事件对象传递给回调
            }
        }
    });
}

// --- 视频缩放与自定义播放器 (新版逻辑) ---
let videoScale = 1.0;
let isCustomFullscreen = false;
let styleElement = null;

// 注入强制样式
function injectStyles() {
    if (styleElement) return;
    styleElement = document.createElement('style');
    styleElement.textContent = `
        body.custom-fullscreen-mode {
            overflow: hidden !important;
        }
        body.custom-fullscreen-mode video {
            position: fixed !important;
            left: 50% !important;
            top: 50% !important;
            width: 100vw !important;
            height: 100vh !important;
            max-width: none !important;
            max-height: none !important;
            z-index: 2147483646 !important;
            background: black !important;
            object-fit: contain !important;
            transform-origin: center center !important;
        }
        body.custom-fullscreen-mode .fullscreen-black-bg {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: black !important;
            z-index: 2147483645 !important;
        }
    `;
    document.head.appendChild(styleElement);
}

// 恢复视频到原始状态
function exitCustomFullscreen() {
    if (!isCustomFullscreen) return;

    // 1. 先将 isCustomFullscreen 设为 false，并重置缩放比例
    isCustomFullscreen = false;
    videoScale = 1.0;

    // 2. 调用 applyVideoScale()，它会因为 isCustomFullscreen 为 false 而清除 transform
    applyVideoScale();

    // 3. 最后再移除 body 的 class，让视频恢复原始布局
    document.body.classList.remove('custom-fullscreen-mode');
    
    console.log('[Plugin] 退出自定义全屏');
}

// 进入自定义全屏模式
function enterCustomFullscreen() {
    if (isCustomFullscreen) return;
    const video = document.querySelector('video');
    if (!video) return;
    // video.setAttribute('controls', 'true'); // 显示原生播放器控制栏


    document.body.classList.add('custom-fullscreen-mode');
    isCustomFullscreen = true;
    applyVideoScale();
    console.log('[Plugin] 进入自定义全屏');
}

// 切换全屏状态 (N键使用)
function toggleCustomFullscreen() {
    if (isCustomFullscreen) {
        exitCustomFullscreen();
    } else {
        enterCustomFullscreen();
    }
}

function applyVideoScale() {
    const video = document.querySelector('video');
    if (!video) return;

    if (isCustomFullscreen) {
        video.style.transform = `translate(-50%, -50%) scale(${videoScale})`;
    } else {
        video.style.transform = 'none'; // 退出时清除 transform
    }
}

function scaleVideo(delta) {
    // 如果不处于自定义全屏模式，则先进入
    if (!isCustomFullscreen) {
        enterCustomFullscreen();
    }
    videoScale += delta;
    if (videoScale < 0.2) videoScale = 0.2;
    if (videoScale > 3) videoScale = 3;
    applyVideoScale();
    console.log(`[Plugin] 视频缩放: ${videoScale.toFixed(2)}x`);
}

function zoomInVideo() {
    scaleVideo(0.05);
}
function zoomOutVideo() {
    scaleVideo(-0.05);
}

// --- 2. 核心功能实现 ---
// 央视片库历史记录
function goToHistory() {
    const historyUrl = 'https://user.cctv.com/history'; 
    window.location.href = historyUrl;
    console.log('[Plugin] 跳转到历史记录');
}
// 拦截连接到片库首页
function goppHome() {
    document.addEventListener('click', function(e) {
        const target = e.target.closest('a');
        if (target && target.href && target.href.startsWith('https://www.cctv.com/')) {
            console.log('拦截成功，跳转到片库首页');
            e.preventDefault();
            window.location.href = 'https://tv.cctv.com/yxg/index.shtml';
        }
    }, true);
}
// 搜索功能
function searchVideo(query) {
    const q = encodeURIComponent(String(query || '').trim());
    if (!q) {
        console.warn('[Plugin] searchVideo: query 为空，未执行搜索');
        return;
    }
    const searchUrl = `https://search.cctv.com/search.php?qtext=${q}&type=video`;
    window.location.href = searchUrl;
    console.log('[Plugin] 搜索视频：', query);
}

// ---- 3.暴露给主进程的 API 调用 ---
// 显示菜单
function showMenu() {
    console.log("按了M键，显示菜单");
    if (window.api) window.api.toggleMenu();
}

// b键返回上一页
function goBack() {
    console.log("按了B键，返回上一页");
    if (window.api && typeof window.api.goBack === 'function') {
        window.api.goBack()
    } else {
        console.error('window.api.goBack 不可用')
    }
}

// -------- 插件入口 ---------

function run() {
    injectStyles(); // 页面加载时就注入我们的样式规则

    // 为 F 键设置特殊的监听逻辑
    window.addEventListener('keydown', (event) => {
        // if (event.key.toLowerCase() === 'f') {
        //     console.log('按了 F 键，切换全屏');
        //     //清除所有自定义的缩放样式

        // }
        if (event.key.toLowerCase() === 'y') {
            console.log('按了 Y 键，切换全屏');
        }
    });

           // 为 F 键设置一个高优先级的捕获监听器
    window.addEventListener('keydown', (event) => {
        if (event.key.toLowerCase() === 'f') {
            const activeElement = document.activeElement;
            const isTyping = activeElement && (
                activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.isContentEditable
            );

            if (!isTyping) {
                // 阻止默认行为（如原生全屏）
                exitCustomFullscreen();
                // event.preventDefault();
                // // 阻止其他任何同类事件监听器被调用
                // event.stopImmediatePropagation();
                
                console.log('按了 F 键，已成功拦截默认全屏行为');
                
                // 在这里可以调用你自己的全屏函数，例如:
                // toggleCustomFullscreen();
            }
        }
    }, true); //


    // 启动其他键盘监听
    listenForKey('m', showMenu);    // 显示菜单
    listenForKey('b', goBack);      // 返回上一页
    listenForKey('h', goToHistory); // 跳转历史记录
    listenForKey('n', toggleCustomFullscreen); // N键切换我们的全屏
    listenForKey('escape', exitCustomFullscreen); // Esc键退出我们的全屏
    listenForKey('=', zoomInVideo); // 放大视频
    listenForKey('-', zoomOutVideo);// 缩小视频
    
    goppHome();                     // 拦截连接到片库首页

    console.log("[Plugin] 央视片库插件已加载 (新版全屏逻辑)。");
}

// 确保在页面完全加载后运行
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', run);
} else {
    run();
}