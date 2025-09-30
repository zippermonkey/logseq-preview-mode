import "@logseq/libs"

let previewModeActive = false;
let eventListenersAttached = false;

function createPluginModel() {
  return {
    async togglePreviewMode() {
      const currentMode = logseq.settings?.previewMode || false;
      const newMode = !currentMode;

      previewModeActive = newMode;
      logseq.updateSettings({ previewMode: newMode });
      await forceApplyPreviewMode(newMode);
      updateToolbarButton(newMode);

      return newMode;
    },

    isPreviewMode() {
      return previewModeActive;
    }
  };
}

async function applyPreviewMode(isPreviewMode) {
  if (isPreviewMode) {
    await enablePreviewMode();
  } else {
    await disablePreviewMode();
  }
}

async function forceApplyPreviewMode(isPreviewMode) {
  await disablePreviewMode();
  await new Promise(resolve => setTimeout(resolve, 50));
  if (isPreviewMode) {
    await enablePreviewMode();
  }
}

async function enablePreviewMode() {
  try {
    await logseq.Editor.exitEditingMode();
  } catch (e) {
    // Ignore if not in editing mode
  }

  injectPreviewModeStyles();
  attachEditModePreventionListeners();
}

async function disablePreviewMode() {
  removePreviewModeStyles();
  detachEditModePreventionListeners();
}

function injectPreviewModeStyles() {
  const pluginId = logseq.baseInfo.id;

  logseq.provideStyle({
    key: `${pluginId}-preview-mode-styles`,
    style: `
      .block-content {
        pointer-events: none !important;
        user-select: text !important;
        cursor: default !important;
      }

      .block-content a,
      .block-content .page-ref,
      .block-content .tag,
      .block-content [data-ref],
      .block-content .ui__link,
      .block-content .bracket-link {
        pointer-events: auto !important;
        cursor: pointer !important;
      }

      .block-content::before,
      .editor-placeholder,
      .cursor-indicator {
        display: none !important;
      }

      .block-control,
      .block-handle {
        visibility: hidden !important;
        pointer-events: none !important;
      }

      .block-container {
        cursor: default !important;
      }

      .block-container[ondblclick],
      .block-content[ondblclick] {
        pointer-events: none !important;
      }

      .block-content * {
        user-select: text !important;
      }

      .block-container {
        -webkit-user-drag: none !important;
        user-drag: none !important;
      }
    `
  });
}

function removePreviewModeStyles() {
  const pluginId = logseq.baseInfo.id;

  const existingStyle = document.querySelector(`style[data-key="${pluginId}-preview-mode-styles"]`);
  if (existingStyle) {
    existingStyle.remove();
  }

  logseq.provideStyle({
    key: `${pluginId}-preview-mode-styles`,
    style: '/* preview mode styles removed */'
  });
}

function attachEditModePreventionListeners() {
  if (eventListenersAttached) return;

  document.addEventListener('click', preventEditModeHandler, true);
  document.addEventListener('dblclick', preventEditModeHandler, true);
  document.addEventListener('keydown', preventEditModeKeys, true);
  document.addEventListener('click', handleLinkNavigation, true);

  eventListenersAttached = true;
}

function detachEditModePreventionListeners() {
  if (!eventListenersAttached) return;

  document.removeEventListener('click', preventEditModeHandler, true);
  document.removeEventListener('dblclick', preventEditModeHandler, true);
  document.removeEventListener('keydown', preventEditModeKeys, true);
  document.removeEventListener('click', handleLinkNavigation, true);

  document.removeEventListener('click', preventEditModeHandler, false);
  document.removeEventListener('dblclick', preventEditModeHandler, false);
  document.removeEventListener('keydown', preventEditModeKeys, false);
  document.removeEventListener('click', handleLinkNavigation, false);

  eventListenersAttached = false;
}

function preventEditModeHandler(event) {
  if (!previewModeActive) return;

  const blockElement = event.target.closest('.block-content, .block-container');
  if (blockElement) {
    const isToolbar = event.target.closest('.toolbar');
    const isLink = event.target.closest('a');
    const hasOnClick = event.target.closest('[data-on-click]');
    const isTextSelection = window.getSelection().toString();
    const isInteractive = event.target.closest('button, input, textarea, select');

    const isPageRef = event.target.closest('.page-ref');
    const isTag = event.target.closest('.tag');
    const hasDataRef = event.target.closest('[data-ref]');
    const isUILink = event.target.closest('.ui__link');
    const isBracketLink = event.target.closest('.bracket-link');
    const hasPageLinkAttr = event.target.closest('[data-link-type="page"]');
    const hasHrefLink = event.target.closest('[href*="page"], [href*="block"]');

    if (isToolbar || isLink || hasOnClick || isTextSelection || isInteractive ||
        isPageRef || isTag || hasDataRef || isUILink || isBracketLink ||
        hasPageLinkAttr || hasHrefLink) {
      if (isPageRef || isTag || hasDataRef || isUILink || isBracketLink ||
          hasPageLinkAttr || hasHrefLink) {
        handleLinkClick(event);
      }
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    return false;
  }
}

function handleLinkNavigation(event) {
  if (!previewModeActive) return;

  const targetElement = event.target.closest('a, .page-ref, .tag, [data-ref], .ui__link, .bracket-link, [data-link-type="page"], [href*="page"], [href*="block"]');

  if (targetElement) {
    setTimeout(() => {
      if (!event.defaultPrevented) {
        handleLinkClick(event);
      }
    }, 0);
  }
}

async function handleLinkClick(event) {
  try {
    const targetElement = event.target.closest('a, .page-ref, .tag, [data-ref], .ui__link, .bracket-link, [data-link-type="page"]');
    if (!targetElement) return;

    let pageName = null;

    if (targetElement.hasAttribute('data-ref')) {
      pageName = targetElement.getAttribute('data-ref');
    } else if (targetElement.hasAttribute('href')) {
      const href = targetElement.getAttribute('href');
      pageName = href.replace(/^#/, '');
    } else if (targetElement.textContent) {
      let textContent = targetElement.textContent;
      textContent = textContent.replace(/^\[\[|\]\]$/g, '').trim();
      textContent = textContent.replace(/^\[|\]$/g, '').trim();
      pageName = textContent;
    } else if (targetElement.getAttribute('title')) {
      pageName = targetElement.getAttribute('title');
    }

    if (!pageName) return;

    pageName = pageName.replace(/^\s+|\s+$/g, '');
    if (!pageName) return;

    event.preventDefault();
    event.stopPropagation();

    await logseq.App.pushState('page', { name: pageName });

  } catch (error) {
    // Fallback to default link behavior
  }
}

function preventEditModeKeys(event) {
  if (!previewModeActive) return;

  const editKeys = ['Enter', 'e', 'E', 'Tab'];

  if (editKeys.includes(event.key)) {
    const focusedBlock = document.activeElement.closest('.block-container');
    if (focusedBlock) {
      const isInteractive = event.target.closest('a, button, input, textarea, select');
      if (!isInteractive) {
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
    }
  }
}

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
        title="切换预览模式"
      >
        <i class="ti">✏️</i>
        <span class="button-text">预览</span>
      </a>
    `
  });
}

function updateToolbarButton(isPreviewMode, retryCount = 0) {
  const pluginId = logseq.baseInfo.id;
  let buttonContainer = top.document.querySelector(`div[data-injected-ui="preview-mode-toggle-${pluginId}"]`);

  if (!buttonContainer) {
    buttonContainer = top.document.querySelector('#preview-mode-toggle');
  }

  if (!buttonContainer) {
    buttonContainer = document.querySelector('#preview-mode-toggle');
  }

  if (!buttonContainer) {
    logseq.App.queryElementById('preview-mode-toggle').then(result => {
      if (result && result !== true) {
        setTimeout(() => updateToolbarButton(isPreviewMode, retryCount + 1), 100);
      } else if (retryCount < 5) {
        setTimeout(() => updateToolbarButton(isPreviewMode, retryCount + 1), 200);
      }
    });
    return;
  }

  let button = buttonContainer;
  if (buttonContainer.tagName !== 'A') {
    button = buttonContainer.querySelector('a') || buttonContainer.querySelector('#preview-mode-toggle') || buttonContainer;
  }

  if (!button) return;

  const icon = button.querySelector('i') || button.querySelector('.ti');
  const text = button.querySelector('.button-text');

  if (isPreviewMode) {
    button.className = 'button preview-mode-active';
    button.classList.remove('edit-mode-active');
    button.classList.add('preview-mode-active');

    if (icon) icon.textContent = '🔒';
    if (text) text.textContent = '编辑';
    button.title = '切换到编辑模式';
  } else {
    button.classList.remove('preview-mode-active');
    button.classList.add('edit-mode-active');

    if (icon) icon.textContent = '✏️';
    if (text) text.textContent = '预览';
    button.title = '切换到预览模式';
  }
}

function setupSettingsListener() {
  logseq.onSettingsChanged((newSettings) => {
    const newMode = newSettings?.previewMode || false;

    if (newMode !== previewModeActive) {
      previewModeActive = newMode;
      applyPreviewMode(newMode);
      updateToolbarButton(newMode);
    }
  });
}

async function main() {
  try {
    const model = createPluginModel();
    logseq.provideModel(model);

    createToolbarButton();
    setupSettingsListener();

    previewModeActive = logseq.settings?.previewMode || false;
    await applyPreviewMode(previewModeActive);
    updateToolbarButton(previewModeActive);

  } catch (error) {
    logseq.App.showMsg('❌ 预览模式插件加载失败', 'error');
  }
}

logseq.ready(main).catch(console.error);