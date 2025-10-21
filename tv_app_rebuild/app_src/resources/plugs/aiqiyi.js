// 爱奇艺插件
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
                callback();
            }
        }
    });
}

// --- 2. 核心功能实现 ---------

// 按D键显示/隐藏弹幕
function toggleDanmu() {
    // 查找弹幕按钮容器
    const btnSet = document.querySelector('.player-buttons_danmuBtnSet__28a4c');
    if (btnSet) {
        // 查找第一个可点击的弹幕开关按钮
        const danmuBtn = btnSet.querySelector('div[style*="cursor: pointer"]');
        if (danmuBtn) {
            simulateClick(danmuBtn);
            console.log('[Plugin] 切换弹幕显示/隐藏');
            return;
        }
    }
        // 2. 兜底：尝试新版播放栏弹幕按钮
    // 新版弹幕控制区
    const barragePanel = document.getElementById('qiyibs-barrage-control-panel');
    if (barragePanel) {
        // 三种弹幕开关按钮，只有一个是可见的（未隐藏）
        const barrageOn = document.getElementById('barrage_on');
        const barrageHalf = document.getElementById('barrage_half');
        const barrageOff = document.getElementById('barrage_off');
        // 优先关闭弹幕（如果当前是开启状态）
        if (barrageOn && barrageOn.classList.contains('qiyibs-svg-on') && !barrageOn.classList.contains('dn')) {
            simulateClick(barrageOn);
            console.log('[Plugin] 新版弹幕已关闭');
            return;
        }
        // 优先开启弹幕（如果当前是关闭状态）
        if (barrageOff && barrageOff.classList.contains('qiyibs-svg-off') && !barrageOff.classList.contains('dn')) {
            simulateClick(barrageOff);
            console.log('[Plugin] 新版弹幕已开启');
            return;
        }
        // 精简弹幕（半开状态）
        if (barrageHalf && barrageHalf.classList.contains('qiyibs-svg-half') && !barrageHalf.classList.contains('dn')) {
            simulateClick(barrageHalf);
            console.log('[Plugin] 新版弹幕已切换精简');
            return;
        }
    }
    // 若找不到按钮，兜底提示
    console.warn('[Plugin] 未找到弹幕开关按钮');
}

// 按H键，跳转到历史记录
function goToHistory() {
    const historyUrl = 'https://www.iqiyi.com/u/record'; // 爱奇艺视频历史记录页
    window.location.href = historyUrl;
    console.log('[Plugin] 跳转到历史记录');
}

// 下一集 L键
function nextEpisode() {
    // 1. 查找“下一集”按钮
    const nextBtn = document.querySelector('.player-buttons_playNext__ArR2t[style*="cursor: pointer"]');
    if (nextBtn) {
        simulateClick(nextBtn);
        console.log('[Plugin] 已点击下一集按钮');
        return;
    }
    // 2. 兜底：尝试选集面板自动跳转
    const albumBtn = document.querySelector('.player-buttons_selAlbumBtn__1ssB0[style*="cursor: pointer"]');
    if (albumBtn) {
        simulateClick(albumBtn);
        setTimeout(() => {
            // 选集列表可能是动态加载的
            const selected = document.querySelector('.albumList_albumItemSelected__3Qw5k');
            if (selected && selected.nextElementSibling) {
                simulateClick(selected.nextElementSibling);
                console.log('[Plugin] 已通过选集面板跳转下一集');
            } else {
                console.warn('[Plugin] 未找到下一集选项');
            }
        }, 800);
        return;
    }
    console.warn('[Plugin] 未找到下一集按钮');
}


// 搜索视频
function searchaiqiyi(text) {
    const q = encodeURIComponent(String(text || '').trim());
    const searchUrl = `https://www.iqiyi.com/search/${q}.html`;
    window.location.href = searchUrl;
    console.log('[Plugin] 搜索视频:', text);
}

// ---- 3.暴露给主进程的 API 调用 ---
function showMenu() {
    console.log("按了M键，显示菜单按了M键，显示菜单按了M键，显示菜单按了M键，显示菜单");
    if (window.api) window.api.toggleMenu();
}


// b键返回上一页
function goBack() {
    console.log("按了B键，返回上一页按了B键，返回上一页");
    if (window.api && typeof window.api.goBack === 'function') {
        window.api.goBack()
      } else {
        console.error('window.api.goBack 不可用')
      }
}


// ----插件入口函数----

function run() {
    // 初始加载时执行一次
        // 启动键盘监听
    listenForKey('m', showMenu);
    listenForKey('d', toggleDanmu);
    listenForKey('b', goBack);          // 返回上一页
    listenForKey('h', goToHistory); // 跳转到历史记录
    listenForKey('l', nextEpisode); // 下一个剧集



    console.log("[Plugin] @@@插件已加载。");
}






// 确保在页面完全加载后运行
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', run);
} else {
    run();
}