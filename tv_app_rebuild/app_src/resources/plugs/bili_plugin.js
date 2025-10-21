// B站插件


// 网站自带的快捷键
// 空格 暂停/播放
// 右键 单次快进5s，长按三倍速放
// 左键 快退5s
// 上键 音量增加10%
// 下键 音量降低10%
// Q 单次点赞/取消点赞，长按一键三连
// W 投币
// E 收藏
// R 长按一键三连
// D 关闭/开启弹幕。
// M 开启/关闭静音
// F 进入/退出全屏
// Esc 退出全屏
// 【 上一P
// 】 下一P
// Enter 发弹幕
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
console.log('[Plugin] 弹幕显示/隐藏');  
}

// 按H键，跳转到历史记录 
function goToHistory() {
    const historyUrl = 'https://www.bilibili.com/history'; // 跳转到视频历史记录页
    window.location.href = historyUrl;
    console.log('[Plugin] 跳转到历史记录');
}

// 发送弹幕
function sendDanmu(text) {
    try {
        // 检查参数有效性
        if (typeof text !== 'string' || !text.trim()) {
            console.warn('[Plugin] 弹幕内容不能为空');
            return false;
        }

        // 查找弹幕输入框
        const input = document.querySelector('.bpx-player-dm-input');
        if (!input) {
            console.error('[Plugin] 未找到弹幕输入框');
            return false;
        }

        // 查找发送按钮
        const sendBtn = document.querySelector('.bpx-player-dm-btn-send');
        if (!sendBtn) {
            console.error('[Plugin] 未找到弹幕发送按钮');
            return false;
        }

        // 检查弹幕是否可用（如禁用、隐藏等）
        if (input.disabled || sendBtn.disabled || sendBtn.style.display === 'none') {
            console.warn('[Plugin] 弹幕功能不可用');
            return false;
        }

        // 填充弹幕内容
        input.value = text;
        // 触发输入事件，确保B站能检测到内容变化
        input.dispatchEvent(new Event('input', { bubbles: true }));

        // 点击发送按钮
        sendBtn.click();

        // 可选：清空输入框
        setTimeout(() => {
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }, 500);

        console.log('[Plugin] 已尝试发送弹幕:', text);
        return true;
    } catch (err) {
        console.error('[Plugin] 发送弹幕异常:', err);
        return false;
    }
}

// 搜索视频 https://search.bilibili.com/all?keyword=%E5%A5%BD%E6%97%A0%E8%81%8A
function searchVideo(text) {
    const q = encodeURIComponent(String(text || '').trim());
    const searchUrl = `https://search.bilibili.com/all?keyword=${q}`;
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
    // 开弹幕 D键
    // 下一集 ] 键
    // 全屏 F键
    


    // setTimeout(() => {
    //   sendDanmu('11111111');
    // }, 15000);

    console.log("[Plugin] @@@插件已加载。");
}






// 确保在页面完全加载后运行
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', run);
} else {
    run();
}