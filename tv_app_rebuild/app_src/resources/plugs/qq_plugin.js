// 腾讯视频相关的脚本


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



// 按F键视频播放全屏、退出全屏
function toggleFullScreen() {
    const fullBtn = document.querySelector('.txp_btn_fullscreen');
    const fakeBtn = document.querySelector('.txp_btn_fake');
    const container = document.getElementById('player') || document.getElementById('player-container') || document.querySelector('.player__container');

    try {
        if (fullBtn) {
            simulateClick(fullBtn);
            console.log('[Plugin] 切换播放器全屏（txp_btn_fullscreen）');
            return;
        }
        if (fakeBtn) {
            simulateClick(fakeBtn);
            console.log('[Plugin] 切换网页全屏（txp_btn_fake）');
            return;
        }

        // 回退：使用标准 Fullscreen API 切换 player 容器的全屏
        if (!document.fullscreenElement) {
            if (container && container.requestFullscreen) {
                container.requestFullscreen().catch(err => console.warn('[Plugin] requestFullscreen 失败', err));
            } else if (container && container.msRequestFullscreen) {
                container.msRequestFullscreen();
            } else {
                console.warn('[Plugin] 全屏 API 不可用');
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(()=>{});
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    } catch (e) {
        console.error('[Plugin] toggleFullScreen 错误', e);
    }
}

// 阻止站外跳转 还没写 


// 按D键显示/隐藏弹幕
function toggleDanmu() {
    // 腾讯视频新版弹幕开关按钮
    // 1. 先找新版弹幕按钮
    let danmuBtn = document.querySelector('.barrage-switch');
    if (!danmuBtn) {
        // 兼容旧版或其它皮肤
        danmuBtn = document.querySelector('.txp_btn_barrage, .txp_btn_barrage_on, .txp_btn_barrage_off');
    }
    if (danmuBtn) {
        simulateClick(danmuBtn);
        console.log('[Plugin] 切换弹幕显示/隐藏');
        return;
    }

    // 2. 若找不到按钮，尝试直接操作弹幕容器
    const danmuLayer = document.querySelector('.barrage-control-v2, .txp_barrage_layer');
    if (danmuLayer) {
        const isHidden = danmuLayer.style.display === 'none' || danmuLayer.classList.contains('txp_none');
        if (isHidden) {
            danmuLayer.style.display = '';
            danmuLayer.classList.remove('txp_none');
            console.log('[Plugin] 显示弹幕层');
        } else {
            danmuLayer.style.display = 'none';
            danmuLayer.classList.add('txp_none');
            console.log('[Plugin] 隐藏弹幕层');
        }
        return;
    }

    // 3. 兜底提示
    console.warn('[Plugin] 未找到弹幕开关按钮或弹幕层');
}

// 按键点击下一个剧集 L键
function nextEpisode() {
    try {
        const selectors = [
            '.txp_btn_next_u',                                 // 新版可点击“下一个”
            '.txp_btn.txp_btn_next:not(.txp_disabled)',       // 未禁用的下一个按钮
            '[aria-label*="下一个"]',                         // aria-label 包含“下一个”
            '.play-next-icon',                                // 图标选择器备选
            '.txp_btn_next'                                   // 兜底选择器
        ];

        let btn = null;
        for (const sel of selectors) {
            btn = document.querySelector(sel);
            if (btn) break;
        }

        if (btn) {
            simulateClick(btn);
            console.log('[Plugin] 点击下一个剧集');
            return;
        }

        // 回退：在剧集列表中查找当前集的下一个节点并点击
        const current = document.querySelector('.episode-item.active, .episode-item.current, .txp_episode_current, .current-episode, .ep-item-current');
        if (current && current.nextElementSibling) {
            const nextNode = current.nextElementSibling;
            const link = nextNode.querySelector('a') || nextNode;
            simulateClick(link);
            console.log('[Plugin] 在剧集列表中选择下一集（回退方案）');
            return;
        }

        console.warn('[Plugin] 未找到“下一个”按钮或下一集节点');
    } catch (e) {
        console.error('[Plugin] nextEpisode 错误', e);
    }
}



// 切换倍速，按C键
function toggleSpeed() {
    try {
        // 优先使用播放器的倍速菜单项（UI）
        const popup = document.querySelector('.txp_popup_playrate');
        let items = popup ? Array.from(popup.querySelectorAll('.txp_menuitem')) : [];

        // 过滤掉非倍速项（例如提示下载的节点）
        items = items.filter(it => {
            const v = it.getAttribute('data-value');
            return v !== null && v !== '' && !isNaN(Number(v));
        });

        if (items.length > 0) {
            const currentIndex = items.findIndex(it => it.classList.contains('txp_current'));
            const nextIndex = (currentIndex + 1) % items.length;
            simulateClick(items[nextIndex]);
            const label = items[nextIndex].getAttribute('data-label') || items[nextIndex].textContent.trim();
            console.log('[Plugin] 切换倍速（UI） ->', label);
            return;
        }

        // 回退：直接切换 video.playbackRate（常用顺序）
        const video = document.querySelector('video');
        if (!video) {
            console.warn('[Plugin] 未找到倍速菜单或 video 元素，无法切换倍速');
            return;
        }
        const speeds = [1, 1.25, 1.5, 2, 3, 0.75, 0.5];
        const curIdx = speeds.indexOf(Number(video.playbackRate));
        const nextSpeed = speeds[(curIdx + 1) % speeds.length];
        video.playbackRate = nextSpeed;
        console.log('[Plugin] 切换倍速（video） ->', nextSpeed);
    } catch (e) {
        console.error('[Plugin] toggleSpeed 错误', e);
    }
}

// 按H键，跳转到历史记录
function goToHistory() {
    const historyUrl = 'https://v.qq.com/biu/u/history/?selectTab=history&subTabId=all'; // 腾讯视频历史记录页
    window.location.href = historyUrl;
    console.log('[Plugin] 跳转到历史记录');
}

// 搜索功能
function searchVideo(query) {
    const q = encodeURIComponent(String(query || '').trim());
   if (!q) {
       console.warn('[Plugin] searchVideo: query 为空，未执行搜索');
       return;
   }
   const searchUrl = `https://v.qq.com/x/search/?q=${q}`;
   window.location.href = searchUrl;
   console.log('[Plugin] 搜索视频：', query);
}

// 发弹幕
function sendDanmu(text) {
  try {
    const txt = String(text || '').trim();
    if (!txt) {
      alert('[Plugin] 弹幕不能为空');
      return;
    }

    const container = document.querySelector('.barrage-input') ||
                      document.querySelector('.barrage-input.plugin-responsive-hidden') ||
                      document.querySelector('.thumbplayer .barrage-input');
    if (!container) {
      console.warn('[Plugin] 未找到弹幕输入容器');
      return;
    }

    // 1) 未登录：点击登录按钮并返回
    const loginBox = container.querySelector('.login');
    if (loginBox) {
      const loginBtn = loginBox.querySelector('a') || loginBox;
      if (loginBtn && loginBtn.offsetParent !== null) { // 可见且存在
        simulateClick(loginBtn);
        console.log('[Plugin] 未登录，已点击登录按钮');
        return;
      }
    }

    // 2) 已登录：确保弹幕开着（尝试读取开关 title / class）
    const switchBtn = document.querySelector('.barrage-switch');
    if (switchBtn) {
      const title = (switchBtn.getAttribute('title') || '').toLowerCase();
      const isOpen = title.includes('关闭') || title.includes('已开启') || switchBtn.classList.contains('active') || switchBtn.classList.contains('on');
      if (!isOpen) {
        simulateClick(switchBtn);
        console.log('[Plugin] 弹幕当前为关，已尝试打开');
      }
    }

    // 3) 填写输入并发表（延迟 100ms 点击发表）
    const input = container.querySelector('input[type="text"], input');
    if (!input) {
      console.warn('[Plugin] 未找到弹幕输入框');
      return;
    }

    input.focus && input.focus();
    input.value = txt;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    // 查找发表按钮（优先使用 submit-btn）
    let submit = container.querySelector('.submit-btn') ||
                 container.querySelector('button.submit-btn') ||
                 container.querySelector('button[type="button"], button');
    if (!submit) submit = document.querySelector('.submit-btn, button.submit-btn');

    if (!submit) {
      console.warn('[Plugin] 未找到发表按钮，无法发送弹幕');
      return;
    }

    // 延迟 100ms 再点击，避免被前端限制为空提交
    setTimeout(() => {
      try {
        simulateClick(submit);
        console.log('[Plugin] 已尝试发表弹幕 ->', input.value);
      } catch (e) {
        console.error('[Plugin] 发表弹幕时出错', e);
      }
    }, 100);
  } catch (e) {
    console.error('[Plugin] sendDanmu 错误', e);
  }
}

// ---- 3.暴露给主进程的 API 调用 ---
// 显示菜单
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
    listenForKey('f', toggleFullScreen);
    listenForKey('d', toggleDanmu);
    listenForKey('b', goBack);
    listenForKey('l', nextEpisode); // 下一个剧集  
    listenForKey('c', toggleSpeed); // 切换倍速  “]” 键是自带的倍速键，不用监听
    listenForKey('h', goToHistory); // 跳转到历史记录

    console.log("[Plugin] @@@插件已加载。");
}

// // 确保在页面完全加载后运行
// if (document.readyState === 'loading') {
//     window.addEventListener('DOMContentLoaded', run);
// } else {
//     run();
// }

// 确保在页面“主要 DOM 解析完成”后尽早运行（interactive 比 DOMContentLoaded 更早）
function runWhenDomParsed(fn) {
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        fn();
        return;
    }
    function onReadyState() {
        if (document.readyState === 'interactive' || document.readyState === 'complete') {
            document.removeEventListener('readystatechange', onReadyState);
            fn();
        }
    }
    document.addEventListener('readystatechange', onReadyState);
}


// 使用更早的就绪时机执行插件入口
runWhenDomParsed(run);