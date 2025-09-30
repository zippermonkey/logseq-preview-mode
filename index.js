/**
 * Logseq Preview Mode Plugin
 * 允许用户在编辑模式和预览模式之间快速切换
 *
 * 功能需求：
 * - 编辑模式：正常显示 Logseq 块的 markdown 源码（默认 Logseq 行为）
 * - 预览模式：即使光标聚焦在块上，也无法编辑，始终保持 markdown 渲染状态
 *
 * 技术实现：
 * - 通过 CSS 和事件监听实现预览模式的编辑禁用
 * - 工具栏按钮提供快速切换
 * - 状态持久化记住用户选择
 */
import "@logseq/libs"
// 全局状态管理
let previewModeActive = false;
let eventListenersAttached = false;

/**
 * 创建插件交互模型
 */
function createPluginModel() {
  return {
    /**
     * 切换预览模式
     */
    async togglePreviewMode() {
      const currentMode = logseq.settings?.previewMode || false;
      const newMode = !currentMode;

      console.log('🔄 Toggling preview mode:', { currentMode, newMode, previewModeActive });

      // 强制同步所有状态
      previewModeActive = newMode;

      // 保存到设置
      logseq.updateSettings({ previewMode: newMode });

      // 强制重新应用模式
      await forceApplyPreviewMode(newMode);

      // 更新工具栏按钮
      updateToolbarButton(newMode);

      // 显示用户反馈
      logseq.App.showMsg(
        newMode ? '🔒 已进入预览模式' : '✏️ 已退出预览模式'
      );

      console.log('✅ Preview mode toggle completed:', { previewModeActive, settings: logseq.settings?.previewMode });
      return newMode;
    },

    /**
     * 获取当前预览模式状态
     */
    isPreviewMode() {
      return previewModeActive;
    }
  };
}

/**
 * 应用预览模式
 */
async function applyPreviewMode(isPreviewMode) {
  if (isPreviewMode) {
    await enablePreviewMode();
  } else {
    await disablePreviewMode();
  }
}

/**
 * 强制应用预览模式（修复状态同步问题）
 */
async function forceApplyPreviewMode(isPreviewMode) {
  console.log('🔧 Force applying preview mode:', isPreviewMode);

  // 先完全移除当前状态
  await disablePreviewMode();

  // 等待一个渲染周期确保清理完成
  await new Promise(resolve => setTimeout(resolve, 50));

  // 应用新状态
  if (isPreviewMode) {
    await enablePreviewMode();
  }

  console.log('✅ Force apply completed:', isPreviewMode);
}

/**
 * 启用预览模式
 */
async function enablePreviewMode() {
  console.log('🔒 Enabling preview mode...');

  // 退出当前编辑状态
  try {
    await logseq.Editor.exitEditingMode();
  } catch (e) {
    // 忽略错误，可能本来就不在编辑状态
  }

  // 注入预览模式样式
  injectPreviewModeStyles();

  // 添加事件监听器
  attachEditModePreventionListeners();

  console.log('✅ Preview mode enabled');
}

/**
 * 禁用预览模式
 */
async function disablePreviewMode() {
  console.log('✏️ Disabling preview mode...');

  // 移除预览模式样式
  removePreviewModeStyles();

  // 移除事件监听器
  detachEditModePreventionListeners();

  console.log('✅ Preview mode disabled');
}

/**
 * 注入预览模式样式
 */
function injectPreviewModeStyles() {
  const pluginId = logseq.baseInfo.id;

  logseq.provideStyle({
    key: `${pluginId}-preview-mode-styles`,
    style: `
      /* 禁用块内容编辑 */
      .block-content {
        pointer-events: none !important;
        user-select: text !important;
        cursor: default !important;
      }

      /* 隐藏编辑光标和占位符 */
      .block-content::before,
      .editor-placeholder,
      .cursor-indicator {
        display: none !important;
      }

      /* 隐藏块控制按钮 */
      .block-control,
      .block-handle {
        visibility: hidden !important;
        pointer-events: none !important;
      }

      /* 禁用块容器的编辑相关事件 */
      .block-container {
        cursor: default !important;
      }

      /* 禁用双击编辑 */
      .block-container[ondblclick],
      .block-content[ondblclick] {
        pointer-events: none !important;
      }

      /* 预览模式水印提示 */
      .blocks-container {
        position: relative;
      }

      .blocks-container::after {
        content: "🔒 预览模式";
        position: fixed;
        top: 60px;
        right: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        z-index: 9999;
        pointer-events: none;
        opacity: 0.8;
        backdrop-filter: blur(4px);
      }

      /* 保持文本可选择 */
      .block-content * {
        user-select: text !important;
      }

      /* 禁用拖拽 */
      .block-container {
        -webkit-user-drag: none !important;
        user-drag: none !important;
      }
    `
  });
}

/**
 * 移除预览模式样式
 */
function removePreviewModeStyles() {
  console.log('🔧 Removing preview mode styles...');
  const pluginId = logseq.baseInfo.id;

  // 先尝试移除现有的样式元素
  const existingStyle = document.querySelector(`style[data-key="${pluginId}-preview-mode-styles"]`);
  if (existingStyle) {
    existingStyle.remove();
    console.log('✅ Existing style element removed');
  }

  // 注入空样式覆盖确保清理
  logseq.provideStyle({
    key: `${pluginId}-preview-mode-styles`,
    style: '/* preview mode styles removed */'
  });

  console.log('✅ Preview mode styles removed');
}

/**
 * 添加编辑模式预防监听器
 */
function attachEditModePreventionListeners() {
  if (eventListenersAttached) return;

  // 阻止可能触发编辑的事件
  document.addEventListener('click', preventEditModeHandler, true);
  document.addEventListener('dblclick', preventEditModeHandler, true);
  document.addEventListener('keydown', preventEditModeKeys, true);

  eventListenersAttached = true;
}

/**
 * 移除编辑模式预防监听器
 */
function detachEditModePreventionListeners() {
  if (!eventListenersAttached) return;

  console.log('🔧 Detaching event listeners...');

  // 移除捕获阶段的监听器
  document.removeEventListener('click', preventEditModeHandler, true);
  document.removeEventListener('dblclick', preventEditModeHandler, true);
  document.removeEventListener('keydown', preventEditModeKeys, true);

  // 也移除冒泡阶段的监听器（防止残留）
  document.removeEventListener('click', preventEditModeHandler, false);
  document.removeEventListener('dblclick', preventEditModeHandler, false);
  document.removeEventListener('keydown', preventEditModeKeys, false);

  eventListenersAttached = false;
  console.log('✅ Event listeners detached');
}

/**
 * 阻止编辑模式激活事件
 */
function preventEditModeHandler(event) {
  if (!previewModeActive) return;

  // 检查点击的是否是块内容相关元素
  const blockElement = event.target.closest('.block-content, .block-container');
  if (blockElement) {
    // 允许：工具栏、链接、文本选择、有点击事件的元素
    const isToolbar = event.target.closest('.toolbar');
    const isLink = event.target.closest('a');
    const hasOnClick = event.target.closest('[data-on-click]');
    const isTextSelection = window.getSelection().toString();
    const isInteractive = event.target.closest('button, input, textarea, select');

    if (isToolbar || isLink || hasOnClick || isTextSelection || isInteractive) {
      return; // 允许这些交互
    }

    event.preventDefault();
    event.stopPropagation();
    return false;
  }
}

/**
 * 阻止编辑模式快捷键
 */
function preventEditModeKeys(event) {
  if (!previewModeActive) return;

  // 可能触发编辑的快捷键
  const editKeys = ['Enter', 'e', 'E', 'Tab'];

  if (editKeys.includes(event.key)) {
    // 检查是否聚焦在块上
    const focusedBlock = document.activeElement.closest('.block-container');
    if (focusedBlock) {
      // 允许在链接和按钮中使用这些键
      const isInteractive = event.target.closest('a, button, input, textarea, select');
      if (!isInteractive) {
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
    }
  }
}

/**
 * 创建工具栏按钮
 */
function createToolbarButton() {
  const pluginId = logseq.baseInfo.id;

  logseq.provideStyle({
    key: `${pluginId}-toolbar-button-styles`,
    style: `
      #preview-mode-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        width: auto;
        height: 32px;
        padding: 0 8px;
        margin: 0 2px;
        border-radius: 6px;
        font-weight: 500;
        font-size: 14px;
        text-decoration: none;
        transition: all 0.2s ease;
        border: 1px solid transparent;
        cursor: pointer;
      }

      #preview-mode-toggle:hover {
        background-color: rgba(0, 0, 0, 0.1);
      }

      #preview-mode-toggle.preview-mode-active {
        color: #e74c3c !important;
        background-color: rgba(231, 76, 60, 0.1);
        border-color: rgba(231, 76, 60, 0.2);
      }

      #preview-mode-toggle.edit-mode-active {
        color: #3498db !important;
        background-color: rgba(52, 152, 219, 0.1);
        border-color: rgba(52, 152, 219, 0.2);
      }

      #preview-mode-toggle i {
        font-size: 16px;
        margin-right: 4px;
      }
    `
  });

  logseq.App.registerUIItem('toolbar', {
    key: 'preview-mode-toggle',
    template: `
      <a
        id="preview-mode-toggle"
        class="button"
        data-on-click="togglePreviewMode"
        title="切换预览模式 (Ctrl+Shift+P)"
      >
        <i class="ti">✏️</i>
        <span class="button-text">预览</span>
      </a>
    `
  });
}

/**
 * 更新工具栏按钮状态
 */
function updateToolbarButton(isPreviewMode, retryCount = 0) {
  console.log('🔧 Updating toolbar button:', { isPreviewMode, retryCount });

  // 方法1: 使用 data-injected-ui 属性查找按钮容器
  const pluginId = logseq.baseInfo.id;
  let buttonContainer = top.document.querySelector(`div[data-injected-ui="preview-mode-toggle-${pluginId}"]`);

  // 如果方法1失败，尝试方法2: 直接查找按钮ID
  if (!buttonContainer) {
    buttonContainer = top.document.querySelector('#preview-mode-toggle');
  }

  // 如果方法2失败，尝试方法3: 在当前文档中查找
  if (!buttonContainer) {
    buttonContainer = document.querySelector('#preview-mode-toggle');
  }

  // 如果还是找不到，使用Logseq API
  if (!buttonContainer) {
    logseq.App.queryElementById('preview-mode-toggle').then(result => {
      if (result && result !== true) {
        // 找到了元素，但返回的是HTML内容，我们需要重新查找
        setTimeout(() => updateToolbarButton(isPreviewMode, retryCount + 1), 100);
      } else if (retryCount < 5) {
        // 重试机制
        console.log(`⚠️ Button not found, retrying... (${retryCount + 1}/5)`);
        setTimeout(() => updateToolbarButton(isPreviewMode, retryCount + 1), 200);
      } else {
        console.error('❌ Failed to find toolbar button after 5 attempts');
      }
    });
    return;
  }

  // 获取按钮元素（可能是容器本身或容器内的a标签）
  let button = buttonContainer;
  if (buttonContainer.tagName !== 'A') {
    button = buttonContainer.querySelector('a') || buttonContainer.querySelector('#preview-mode-toggle') || buttonContainer;
  }

  if (!button) {
    console.error('❌ Button element not found in container');
    return;
  }

  console.log('✅ Found button element:', button);

  const icon = button.querySelector('i') || button.querySelector('.ti');
  const text = button.querySelector('.button-text');

  if (isPreviewMode) {
    // 移除所有状态类，添加预览模式类
    button.classList.remove('edit-mode-active');
    button.classList.add('preview-mode-active');

    if (icon) icon.textContent = '🔒';
    if (text) text.textContent = '编辑';
    button.title = '切换到编辑模式 (Ctrl+Shift+P)';
  } else {
    // 移除所有状态类，添加编辑模式类
    button.classList.remove('preview-mode-active');
    button.classList.add('edit-mode-active');

    if (icon) icon.textContent = '✏️';
    if (text) text.textContent = '预览';
    button.title = '切换到预览模式 (Ctrl+Shift+P)';
  }

  console.log('✅ Toolbar button updated successfully:', {
    isPreviewMode,
    hasIcon: !!icon,
    hasText: !!text,
    buttonClasses: button.className
  });
}

/**
 * 设置设置模式监听
 */
function setupSettingsListener() {
  logseq.onSettingsChanged((newSettings) => {
    const newMode = newSettings?.previewMode || false;

    // 只在模式实际改变时更新
    if (newMode !== previewModeActive) {
      previewModeActive = newMode;
      applyPreviewMode(newMode);
      updateToolbarButton(newMode);
    }
  });
}

/**
 * 设置键盘快捷键
 */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (event) => {
    // Ctrl/Cmd + Shift + P 切换预览模式
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'P') {
      event.preventDefault();
      event.stopPropagation();

      const model = createPluginModel();
      model.togglePreviewMode();
    }
  });
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 Loading Logseq Preview Mode Plugin...');

  try {
    // 创建插件模型
    const model = createPluginModel();
    logseq.provideModel(model);

    // 创建工具栏按钮
    createToolbarButton();

    // 设置设置监听
    setupSettingsListener();

    // 设置键盘快捷键
    setupKeyboardShortcuts();

    // 初始化状态
    previewModeActive = logseq.settings?.previewMode || false;

    // 应用初始模式
    await applyPreviewMode(previewModeActive);
    updateToolbarButton(previewModeActive);

    console.log('✅ Logseq Preview Mode Plugin loaded successfully');
    console.log(`📊 Current mode: ${previewModeActive ? 'Preview' : 'Edit'}`);

    // 显示欢迎消息
    if (!logseq.settings?.welcomeMessageShown) {
      logseq.App.showMsg('🎉 预览模式插件已加载！使用 Ctrl+Shift+P 快速切换');
      logseq.updateSettings({ welcomeMessageShown: true });
    }

  } catch (error) {
    console.error('❌ Failed to load Logseq Preview Mode Plugin:', error);
    logseq.App.showMsg('❌ 预览模式插件加载失败', 'error');
  }
}

// 启动插件
logseq.ready(main).catch(console.error);