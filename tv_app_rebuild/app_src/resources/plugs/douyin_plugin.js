// 抖音相关的脚本


// 本地存储
localStorage.setItem('myKey', '这是测试的值');
localStorage.setItem('isOpenMenu', false);

if (localStorage.getItem('isClearScreen') === null) {
    localStorage.setItem('isClearScreen', false);
}

const myValue = localStorage.getItem('myKey');
console.log(myValue); // myValue



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

// --- 2. 核心功能实现 ---

// 网页全屏功能
function fullScreen() {
    const maxAttempts = 90;
    let attempts = 0;
    // fullScreen 内部仍然需要定时器，因为它是在等待一个不确定何时出现的元素
    const intervalId = setInterval(() => {
        const loginOverlay = document.querySelector('#douyin-login-new-id');
        if (loginOverlay) {
            console.log("检测到登录覆盖层，等待用户完成登录...");
            attempts = 0; 
            return;
        }
        attempts++;
        const fullScreenBtn = document.querySelector('.xgplayer-page-full-screen');
        if (fullScreenBtn) {
            console.log("登录完成，找到网页全屏按钮，执行点击。");
            simulateKeyPress('y'); // 'y' 键是抖音网页版的全屏快捷键
            clearInterval(intervalId);
        } else if (attempts >= maxAttempts) {
            console.log("超时：已登录但未找到全屏按钮，停止尝试。");
            clearInterval(intervalId);
        }
    }, 1000);
}

// 直播间评论区关闭功能
function closeZoomComment() {
    // 先尝试查找关闭按钮
    const queContain = '.VmMWWan_.chatroom_close';
    let closeButton = document.querySelector(queContain);
    if (closeButton) {
        console.log('找到直播间评论区关闭按钮，执行点击。');
        simulateClick(closeButton);
        return true;
    }
    return false;
}

//监控并更改video控制栏的透明度
function changeControlBarOpacity() {
    const selector = '.xgplayer-controls';
    
    // 使用定时器持续检查控制栏是否存在
    setInterval(() => {
        const controlBar = document.querySelector(selector);
        // 如果找到了控制栏，并且它的透明度还不是0.6，就设置它
        if (controlBar && controlBar.style.opacity !== '0.6') {
            console.log('[Opacity Control] 找到控制栏，设置透明度为 0.6');
            controlBar.style.opacity = '0.6';
        }
    }, 500); // 每 500 毫秒检查一次

    console.log('[Opacity Control] 控制栏透明度监控已启动。');
}


// 当出现合集的dom时，点击E，模仿鼠标点击合集按钮，就能进入合集。
function clickCollect() {
    // 1. 定义一个函数，检查元素是否在屏幕可视区域内
    function isElementInViewport(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    // 2. 查找页面上所有可能的合集按钮
    const allCollectSpans = document.querySelectorAll('.YznPEPqz');

    // 3. 遍历所有找到的按钮
    for (const span of allCollectSpans) {
        // 4. 检查文本内容和它是否在屏幕上可见
        if (span.textContent && span.textContent.trim().startsWith('合集：')) {
            const clickableParent = span.parentElement;
            if (clickableParent && isElementInViewport(clickableParent)) {
                console.log('找到屏幕中可见的合集按钮，执行点击:', span.textContent);
                simulateClick(clickableParent);
                return; // 找到并点击后立即退出
            }
        }
    }

    console.log('在当前屏幕可视范围内未找到“合集”按钮。');
}


// q退出合集
function exitCollect() {
    // 优先查找返回按钮
    const backButton = document.querySelector('.m9iwbrBe[tabindex="0"]');
    if (backButton) {
        console.log('已点击合集返回按钮');
        simulateClick(backButton);
        return;
    }

    console.log('未找到合集返回按钮');
}

// 打开/关闭合集菜单
// 1.先检查<div id="relatedVideoCard">和它的父元素是否是在页面上显示还是隐藏
// 2.如果显示，双击'x'键
function closeCollectMenu() {
    const isOpenMenu = localStorage.getItem('isOpenMenu');

    // 检查合集菜单是否存在
    const relatedVideoCard = document.querySelector('#relatedVideoCard');
    if (relatedVideoCard || relatedVideoCard.style.display === 'block') {
        console.log('已找到合集菜单，执行关闭操作');
        // 点两次x,间隔100ms，防止误操作
        simulateKeyPress('x');
        if (isOpenMenu === 'false') {
            setTimeout(() => simulateKeyPress('x'), 100);
            localStorage.setItem('isOpenMenu', 'true');
        }
        else if (isOpenMenu === 'true') {
            localStorage.setItem('isOpenMenu', 'false');
        }
        // 再点一次菜单键
        const menuButton = document.querySelector('#semiTabcompilation_card');
        if (menuButton) {
            console.log('点击合集菜单按钮');
            setTimeout(() => simulateClick(menuButton), 100);
        }
        return;
    }
    console.log('未找到合集菜单');
}




// q清屏模式
function setupClearScreenObserver() {
    // 设置一个定时器，周期性地检查并同步所有清屏按钮的状态
    setInterval(() => {
        // 1. 检查总开关是否要求开启清屏
        if (localStorage.getItem('isClearScreen') === 'false') {
            return; // 如果总开关是关闭的，则不执行任何操作
        }

        // 2. 查找页面上所有包含“清屏”文字的设置项
        const settingLabels = document.querySelectorAll('.xgplayer-setting-label');
        
        for (const label of settingLabels) {
            const titleElement = label.querySelector('.xgplayer-setting-title');
            
            // 3. 确认这就是“清屏”设置项
            if (titleElement && titleElement.textContent.trim() === '清屏') {
                const button = label.querySelector('button.xg-switch');
                
                // 4. 检查按钮是否存在，以及它是否处于“关闭”状态（没有 xg-switch-checked 类）
                if (button && !button.classList.contains('xg-switch-checked')) {
                    console.log('[Clear Screen] 检测到清屏按钮为关闭状态，执行点击开启。');
                    simulateClick(button);
                }
            }
        }
    }, 100); // 每 1.5 秒检查一次

    console.log('[Clear Screen] 自动清屏状态同步监控已启动。');
}


// --- 3. 事件驱动的 URL 变化处理 ---

//当 URL 发生变化时要执行的逻辑
function handleUrlChange() {
    const currentUrl = window.location.href;
    console.log(`[URL Change Handler] 检测到 URL 变化: ${currentUrl}`);

    // 场景1: 进入直播间
    if (currentUrl.includes('/live/')) {
        console.log('进入直播间，尝试关闭评论区...');
        let attempts = 0;
        const maxAttempts = 10;
        const tryCloseInterval = setInterval(() => {
            attempts++;
            if (closeZoomComment() || attempts >= maxAttempts) {
                clearInterval(tryCloseInterval);
            }
        }, 500);
    }
    // 场景2: 返回到推荐页
    else if (currentUrl.includes('/?recommend=1')) {
        console.log('返回推荐页，尝试重新网页全屏...');
        fullScreen();
    }
}

//设置 URL 变化监听器。这是替代 setInterval 的核心。
function setupUrlChangeObserver() {
    // 包装 history.pushState，因为直接调用它不会触发任何事件
    const originalPushState = history.pushState;
    history.pushState = function(...args) {
        // 先执行原始的 pushState
        const result = originalPushState.apply(this, args);
        // 然后手动派发一个自定义事件
        window.dispatchEvent(new Event('pushstate'));
        return result;
    };

    // 监听我们自定义的 'pushstate' 事件
    window.addEventListener('pushstate', handleUrlChange);
    // 监听浏览器前进/后退按钮触发的 'popstate' 事件
    window.addEventListener('popstate', handleUrlChange);

    console.log('[URL Observer] URL 变化监听器已启动。');
}


// 搜索 https://www.douyin.com/search/%E7%88%B1%E6%83%85%E5%85%AC%E5%AF%93
function searchDouyin(text) {
    const q = encodeURIComponent(String(text || '').trim());
    const searchUrl = `https://www.douyin.com/search/${q}`;
    window.location.href = searchUrl;
    console.log('[Plugin] 搜索视频:', text);
}

// --- 4. 暴露给主进程的 API 调用 ---

// 显示菜单
function showMenu() {
    if (window.api) window.api.toggleMenu();
}

// 返回上一页
function backLastPage() {
    if (window.api) window.api.goBack();
}

// 聚焦到评论区
function focusOnCommentArea() {
    if (window.api) window.api.focusArea();
}

// --- 5. 插件入口 ---

function run() {
    // 初始加载时执行一次
    fullScreen();

    // 启动清屏模式
    setupClearScreenObserver();

    // 启动控制栏透明度修改
    changeControlBarOpacity();

    // 启动键盘监听
    listenForKey('m', showMenu);
    listenForKey('backspace', backLastPage);
    listenForKey('x', focusOnCommentArea);
    listenForKey('e', clickCollect); 
    listenForKey('q', exitCollect);
    listenForKey('o', closeCollectMenu);
    listenForKey('j', () => {
        const cur = localStorage.getItem('isClearScreen');
        const next = (cur === 'true') ? 'false' : 'true';
        localStorage.setItem('isClearScreen', next);
    });
    // 启动 URL 变化监听器
    setupUrlChangeObserver();



    
    console.log("[Plugin] 抖音插件已加载。");
}

// 确保在页面完全加载后运行
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', run);
} else {
    run();
}