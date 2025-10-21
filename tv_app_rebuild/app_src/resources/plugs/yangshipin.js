// CCTV 插件内容脚本

// 存储频道列表和当前频道索引
let channelList = [];
let overlay = null; // 存储遮挡层引用
let volumeIndicator = null; // 存储音量指示器引用
let volumeTimer = null; // 存储音量指示器隐藏计时器

// 本地存储
if (localStorage.getItem('lastVolume') === null) {
  localStorage.setItem('lastVolume', '0.6'); // 设置默认音量
}

// --- 创建并管理带加载动画的遮罩层 ---

// 注入CSS样式用于加载动画
function injectSpinnerStyles() {
  const styleId = 'cctv-spinner-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .cctv-spinner {
      position: absolute;
      top: 60%; /* 移动到频道名称下方 */
      left: 50%;
      width: 60px;
      height: 60px;
      margin: 0 0 0 -30px; /* 调整边距以水平居中 */
      border: 5px solid rgba(255, 255, 255, 0.2);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: cctv-spin 1s linear infinite;
    }

    .cctv-channel-name {
      position: absolute;
      top: 50%; /* 垂直居中 */
      left: 50%;
      transform: translate(-50%, -50%); /* 精确居中 */
      color: white;
      font-size: 98px; /* 放大字体 */
      font-weight: bold;
      text-align: center;
      width: 100%; /* 确保文本居中 */
    }

    .cctv-volume-indicator {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 15px 30px;
      border-radius: 10px;
      font-size: 36px;
      font-weight: bold;
      z-index: 1000000; /* 确保在最上层 */
      opacity: 0;
      transition: opacity 0.3s ease-in-out;
      pointer-events: none; /* 避免捕获鼠标事件 */
      white-space: nowrap;
    }

    .cctv-volume-indicator.visible {
      opacity: 1;
    }

    @keyframes cctv-spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

// 显示遮罩层和加载动画
function showOverlay(channelName = '') {
  if (!overlay) {
    injectSpinnerStyles(); // 确保样式已注入
    overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'black';
    overlay.style.zIndex = '999999';
    overlay.id = 'cctv-overlay';

    const spinner = document.createElement('div');
    spinner.className = 'cctv-spinner';
    overlay.appendChild(spinner);

    const nameDisplay = document.createElement('div');
    nameDisplay.className = 'cctv-channel-name';
    nameDisplay.id = 'cctv-channel-name-display';
    overlay.appendChild(nameDisplay);
  }

  // 更新频道名称
  const nameDisplay = document.getElementById('cctv-channel-name-display');
  if (nameDisplay) {
    nameDisplay.textContent = channelName;
  }

  if (!overlay.parentNode) {
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'block';
  console.log(`显示加载遮罩层，目标频道: ${channelName || '无'}`);
}


// 隐藏遮罩层
function hideOverlay() {
  if (overlay) {
    overlay.style.display = 'none';
    console.log('隐藏加载遮罩层');
  }
}

/**
 * 优化后的核心函数：将视频全屏化
 * 它会找到视频元素，然后一路向上修改其所有父元素的样式，确保它们不会隐藏或限制视频。
 */
function fullscreenVideo() {
  const video = document.querySelector('video');
  if (!video) {
    console.log('未找到 video 元素');
    return false;
  }



  // 1. 优化隐藏逻辑：只隐藏 body 的直接子元素中非视频祖先的元素
  for (const child of document.body.children) {
    // 如果子元素不是 video 的祖先，也不是 video 本身，也不是我们的遮罩层，则隐藏
    if (!child.contains(video) && child.id !== 'cctv-overlay') {
      child.style.setProperty('display', 'none', 'important');
    }
  }

  // 2. 将视频及其所有父元素的样式重置，确保它们可见且占满全屏
  let current = video;
  while (current && current !== document.body) {
    current.style.setProperty('position', 'static', 'important');
    current.style.setProperty('width', '100%', 'important');
    current.style.setProperty('height', '100%', 'important');
    current.style.setProperty('max-width', 'none', 'important');
    current.style.setProperty('max-height', 'none', 'important');
    current.style.setProperty('margin', '0', 'important');
    current.style.setProperty('padding', '0', 'important');
    current.style.setProperty('visibility', 'visible', 'important');
    current.style.setProperty('opacity', '1', 'important');
    current.style.setProperty('display', 'block', 'important'); // 确保父元素可见
    current = current.parentElement;
  }
  
  // 额外步骤：确保 html 和 body 元素也占满视口
  document.documentElement.style.setProperty('height', '100%', 'important');
  document.documentElement.style.setProperty('width', '100%', 'important');
  document.documentElement.style.setProperty('overflow', 'hidden', 'important');
  document.body.style.setProperty('height', '100%', 'important');
  document.body.style.setProperty('width', '100%', 'important');
  document.body.style.setProperty('margin', '0', 'important');
  document.body.style.setProperty('padding', '0', 'important');
  document.body.style.setProperty('overflow', 'hidden', 'important');

  // 3. 最后将 video 元素设置为 fixed 定位以覆盖所有内容
  video.style.setProperty('position', 'fixed', 'important');
  video.style.setProperty('top', '0', 'important');
  video.style.setProperty('left', '0', 'important');
  video.style.setProperty('z-index', '9999', 'important'); // 确保在遮罩层之下

  console.log('已通过修改父元素样式将视频全屏化');
  return true;
}


// 模拟鼠标点击事件
function simulateClick(element) {
  const clickEvent = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window
  });
  element.dispatchEvent(clickEvent);
}

// 显示音量指示器
function showVolumeIndicator(volume) {
  if (!volumeIndicator) {
    volumeIndicator = document.createElement('div');
    volumeIndicator.className = 'cctv-volume-indicator';
    document.body.appendChild(volumeIndicator);
  }

  // 清除上一个计时器
  if (volumeTimer) {
    clearTimeout(volumeTimer);
  }

  // 更新内容和样式
  if (volume === 0) {
    volumeIndicator.textContent = '静音';
  } else {
    volumeIndicator.textContent = `音量: ${Math.round(volume * 100)}`;
  }

  // 显示指示器
  volumeIndicator.classList.add('visible');

  // 1.5秒后隐藏
  volumeTimer = setTimeout(() => {
    volumeIndicator.classList.remove('visible');
  }, 1500);
}

// 音量调整函数
function adjustVolume(delta) {
  const video = document.querySelector('video');
  if (video) {
    video.volume = Math.max(0, Math.min(1, video.volume + delta));
    console.log(`音量已调整为: ${video.volume.toFixed(2)}`);
    // 保存当前音量到 localStorage
    localStorage.setItem('lastVolume', String(video.volume));
    showVolumeIndicator(video.volume); // 显示音量指示器
  }
}

// 设置频道切换功能
function setupChannelSwitching() {
  const channelParentDiv = findChannelParentDiv();
  if (!channelParentDiv) {
    console.log('未找到频道列表容器');
    return;
  }
  
  channelList = getChannelList(channelParentDiv);
  console.log(`共找到 ${channelList.length} 个可用频道`);
  console.log('频道列表:', channelList.map(c => c.name));
  
  updateKeyListener();
}

// 查找包含电视频道的父级div（按"CCTV1"和"宁夏卫视"的span定位）
function findChannelParentDiv() {
  // 优先尝试使用更稳定的类名直接定位
  const channelContainer = document.querySelector('.tv-main-con-r-list-left');
  if (channelContainer && channelContainer.children.length > 5) { // 增加一个子元素数量的判断，确保是列表
    console.log('通过类名 ".tv-main-con-r-list-left" 找到频道列表容器');
    return channelContainer;
  }

  // 如果直接定位失败，则回退到基于内容查找
  console.log('直接定位失败或容器为空，尝试通过内容查找...');
  const channelKeywords = ['江苏卫视', '河南卫视', '北京卫视', 'CCTV13'];
  const channelElements = [];

  // 查找包含关键字的元素
  const allDivs = document.querySelectorAll('div[class*="oveerflow-1"]');
  allDivs.forEach(div => {
    const text = div.textContent.trim();
    if (channelKeywords.some(keyword => text.startsWith(keyword))) {
      channelElements.push(div);
    }
  });

  if (channelElements.length < 2) {
    console.log('未能找到足够的参考频道元素来确定公共父级');
    return null;
  }

  // 寻找这些元素的共同父级
  let parent = channelElements[0].parentElement;
  while (parent) {
    const isCommonParent = channelElements.every(elem => parent.contains(elem));
    if (isCommonParent) {
      console.log('通过查找共同父级找到频道列表容器:', parent);
      return parent;
    }
    parent = parent.parentElement;
  }

  console.log('未找到共同的频道列表容器');
  return null;
}

// 获取可用频道列表
function getChannelList(parentDiv) {
  const channels = [];
  const childDivs = parentDiv.children;
  
  for (let i = 0; i < childDivs.length; i++) {
    const div = childDivs[i];
    if (div.tagName.toLowerCase() !== 'div') continue;
    
    const textContent = div.textContent || '';
    
    if (textContent.includes('VIP')) {
      continue;
    }
    
    const channelName = extractChannelName(textContent);
    if (channelName) {
      channels.push({
        name: channelName,
        element: div
      });
    }
  }
  
  return channels;
}

// 从文本中提取频道名称
function extractChannelName(text) {
  return text.replace(/\([^)]*\)/g, '').trim();
}

// 切换到上一个频道
function switchToPreviousChannel() {
  if (channelList.length === 0) return;
  const currentIndex = channelList.findIndex(channel => channel.element.classList.contains('tvSelect'));
  if (currentIndex === -1) return;

  const prevIndex = (currentIndex - 1 + channelList.length) % channelList.length;
  const channel = channelList[prevIndex];

  console.log(`切换到上一个频道: ${channel.name}`);
  showOverlay(channel.name); // 切换前显示遮罩层和频道名称
  simulateClick(channel.element);
}

// 切换到下一个频道
function switchToNextChannel() {
  if (channelList.length === 0) return;
  const currentIndex = channelList.findIndex(channel => channel.element.classList.contains('tvSelect'));
  if (currentIndex === -1) return;

  const nextIndex = (currentIndex + 1) % channelList.length;
  const channel = channelList[nextIndex];

  console.log(`切换到下一个频道: ${channel.name}`);
  showOverlay(channel.name); // 切换前显示遮罩层和频道名称
  simulateClick(channel.element);
}

// 更新键盘监听，添加上下键切换频道功能
function updateKeyListener() {
  document.removeEventListener('keydown', handleKeyDown);
  document.addEventListener('keydown', handleKeyDown);
  console.log('已设置频道切换功能，按上下键可切换频道');
}

// 键盘事件处理
function handleKeyDown(event) {
  // --- 智能M键判断逻辑 ---
  if (event.key.toLowerCase() === 'm'||event.key.toLowerCase() === 'enter') {
    // 检查当前焦点是否在输入框内
    const activeElement = document.activeElement
    const isTyping =
      activeElement &&
      (activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable)

    // 如果不是在打字，就切换菜单
    if (!isTyping) {
      event.preventDefault() // 阻止M键的默认行为
      event.stopPropagation() // 阻止事件冒泡
      console.log('M键被按下，尝试切换菜单')

      // 检查 API 是否存在
      if (window.api && typeof window.api.toggleMenu === 'function') {
        // 1. 获取最新的频道数据
        const channelData = NewChannels();
        
        // 2. 通过 prelaod 发送数据到主进程
        if (window.api.updateTvChannels && typeof window.api.updateTvChannels === 'function') {
          console.log('发送最新频道数据到菜单:', channelData);
          window.api.updateTvChannels(channelData);
        } else {
          console.error('window.api.updateTvChannels 不可用');
        }

        // 3. 请求打开菜单
        console.log('调用 toggleMenu')
        window.api.toggleMenu()
      } else {
        console.error('window.api.toggleMenu 不可用')
      }
    }
    // 如果在打字，就不做任何处理，让M键正常输入
    return
  }
  // --- M键逻辑结束 ---
  event.preventDefault();
  event.stopImmediatePropagation();
  
  switch (event.key) {
    case 'ArrowUp':
      switchToNextChannel();
      break;
    case 'ArrowDown':
      switchToPreviousChannel();
      break;
    case '-':
    case '_':
      adjustVolume(-0.05);
      break;
    case '=':
    case '+':
      adjustVolume(0.05);
      break;
    case 'h':
    case 'H':
      console.log('H键被触发');
      if (window.api && typeof window.api.returnToHome === 'function') {
        window.api.returnToHome();
        console.log('H键被按下，已调用 returnToHome');
      } else {
        console.error('window.api.returnToHome 不可用');
      }
      break;
  }
}

// 获取最新的频道列表并分类
function NewChannels(channels) {
  channels = channelList;
  const categorizedChannels = {
    "currentChannel":"CCTV-1", 
    "央视频道": [],
    "卫视频道": []
  };

  // 获取当前选中的频道元素
  const currentChannelElement = document.querySelector('div.tvSelect span');
  if (currentChannelElement) {
    // 精确提取当前频道名称：只获取 span 的第一个文本节点
    let currentChannelName = '';
    for (const node of currentChannelElement.childNodes) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        currentChannelName = node.textContent.trim();
        break; // 找到后立即退出循环
      }
    }
    if (currentChannelName) {
      console.log('@@@@@当前频道:', currentChannelName);
      categorizedChannels.currentChannel = currentChannelName;
    }
  }

  channels.forEach(channel => {
    const name = channel.name;
    if (name.includes('CCTV') || name.includes('CGTN')) {
      categorizedChannels.央视频道.push(name);
    } else {
      categorizedChannels.卫视频道.push(name);
    }
  });

  console.log('分类后的频道列表:', categorizedChannels);

  return categorizedChannels;

}

// 跳转到指定频道
function jumpToChannel(channelName) {
  const channel = channelList.find(c => c.name === channelName);
  if (channel) {
    console.log(`跳转到频道: ${channel.name}`);
    showOverlay(channel.name); // 切换前显示遮罩层和频道名称
    simulateClick(channel.element);
  } else {
    console.log(`未找到频道: ${channelName}`);
  }
}






// 下面是ipc通讯相关代码

// --- 1. 监听URL变化并保存 ---
function setupUrlChangeListener() {
  let lastUrl = window.location.href;
  // 央视网站是单页应用，URL变化不会触发标准事件，我们使用定时器轮询检测
  setInterval(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      console.log('检测到URL变化:', currentUrl);
      // 调用预加载脚本暴露的函数来保存URL
      if (window.api && typeof window.api.saveChannelUrl === 'function') {
        window.api.saveChannelUrl(currentUrl);
      }
    }
  }, 5000); // 每5秒检测一次
}





function cctv_plugin() {
  console.log('CCTV 插件已加载');

  // 立即显示遮罩层
  showOverlay();

  // 等待 video 元素加载后设置事件监听
  const videoObserver = new MutationObserver(() => {
    const videoElem = document.querySelector('video');
    if (videoElem) {
      // 应用上次保存的音量（若存在）
      const stored = parseFloat(localStorage.getItem('lastVolume'));
      const startVolume = isNaN(stored) ? 0.6 : stored;
      videoElem.volume = Math.max(0, Math.min(1, startVolume));

      fullscreenVideo();
      
      // 视频开始播放后隐藏遮罩层并确保音量正确
      function handleVideoPlay() {
        // 每次播放时再从 localStorage 读取并应用音量（防止播放器重置）
        const storedNow = parseFloat(localStorage.getItem('lastVolume'));
        if (!isNaN(storedNow)) {
          videoElem.volume = Math.max(0, Math.min(1, storedNow));
        }
        hideOverlay();
        
        // 首次加载时设置频道切换功能
        if (channelList.length === 0) {
            setupChannelSwitching();
        }
      }
      
      // 监听视频播放事件（每次换台都会触发）
      videoElem.addEventListener('play', handleVideoPlay);
      
      // 如果视频已经在播放状态（可能错过play事件）
      if (!videoElem.paused) {
        handleVideoPlay();
      }
      
      videoObserver.disconnect();
    }
  });
  
  videoObserver.observe(document.body, { childList: true, subtree: true });
  
  // 设置键盘监听
  updateKeyListener();
  // 监听URL变化并保存
  setupUrlChangeListener();

}

cctv_plugin();