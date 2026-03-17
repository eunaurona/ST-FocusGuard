/**
 * FocusGuard - ADHD Daily Life Assistant for SillyTavern
 * Main entry point: module registration + ST extension panel.
 */
import { DataStore, MODULE_NAME } from './modules/datastore.js';
import { Toolbar } from './modules/toolbar.js';
import { Overlay } from './modules/overlay.js';
import { Focus } from './modules/focus.js';
import { Guardian } from './modules/guardian.js';
import { Tasks } from './modules/tasks.js';
import { Notifications } from './modules/notifications.js';
import { Streak } from './modules/streak.js';
import { AIBall } from './modules/ai-ball.js';
import { Themes } from './modules/themes.js';

// ─── Extension Panel HTML (minimal, guides users to companion page) ───
const PANEL_HTML = `
<div id="fg-panel" class="fg-panel">
    <div class="fg-panel-header">
        <span class="fg-panel-title">FocusGuard</span>
        <span class="fg-panel-version">v1.0.0</span>
    </div>
    <div class="fg-panel-controls">
        <div class="fg-panel-row">
            <label class="fg-panel-label">启用扩展</label>
            <input type="checkbox" id="fg-enabled" checked />
        </div>
        <div class="fg-panel-row">
            <label class="fg-panel-label">显示悬浮条</label>
            <input type="checkbox" id="fg-toolbar-visible" checked />
        </div>
        <div class="fg-panel-row">
            <label class="fg-panel-label">专注模式</label>
            <input type="checkbox" id="fg-focus-enabled" checked />
        </div>
        <div class="fg-panel-row fg-panel-row-streak">
            <span class="fg-panel-label">连续打卡</span>
            <span id="fg-streak-display" class="fg-streak-badge">0 天</span>
        </div>
        <div class="fg-panel-row fg-panel-row-rp">
            <span class="fg-panel-label">RP额度</span>
            <span id="fg-rp-display" class="fg-rp-badge">0 min</span>
        </div>
        <button id="fg-open-companion" class="fg-btn fg-btn-primary fg-panel-btn">
            打开陪伴页面
        </button>
    </div>
</div>
`;

let _enabled = true;
let _focusEnabled = true;

/**
 * Main initialization.
 */
async function init() {
    // Initialize data layer
    DataStore.init();

    // Apply theme
    Themes.init();

    // Check streak
    Streak.init();

    // Initialize modules
    Guardian.init();
    Tasks.populateRecurringForToday();
    Notifications.init();

    // Register extension panel in ST
    registerPanel();

    // Initialize toolbar
    Toolbar.init();

    // Show overlay if applicable
    Overlay.init();

    // Initialize focus mode
    if (_focusEnabled) {
        Focus.init();
    }

    // Initialize AI Ball (in ST context too for quick access)
    AIBall.init();

    // Listen for task completions to trigger guardian
    DataStore.onChange((key, value) => {
        if (key === 'rpBudget') {
            updatePanelDisplay();
        }
        if (key === '_lastAIAction') {
            Toolbar.refresh();
        }
    });

    // Update panel display
    updatePanelDisplay();

    // Check if streak was broken → show letter
    if (Streak.checkStreakBroken()) {
        const letter = Streak.getLetter();
        if (letter) {
            setTimeout(() => Streak.showLetterPopup(), 2000);
        }
    }

    console.log('[FocusGuard] Extension initialized');
}

/**
 * Register the extension panel in ST's sidebar.
 */
function registerPanel() {
    const settingsContainer = document.getElementById('extensions_settings2');
    if (!settingsContainer) {
        console.warn('[FocusGuard] Settings container not found');
        return;
    }

    const panelWrapper = document.createElement('div');
    panelWrapper.innerHTML = PANEL_HTML;
    settingsContainer.appendChild(panelWrapper);

    // Bind controls
    const enabledCb = document.getElementById('fg-enabled');
    const toolbarCb = document.getElementById('fg-toolbar-visible');
    const focusCb = document.getElementById('fg-focus-enabled');
    const companionBtn = document.getElementById('fg-open-companion');

    // Load saved states
    enabledCb.checked = DataStore.get('settings.enabled') !== false;
    toolbarCb.checked = DataStore.get('settings.toolbarVisible') !== false;
    focusCb.checked = DataStore.get('settings.focusEnabled') !== false;

    enabledCb?.addEventListener('change', () => {
        _enabled = enabledCb.checked;
        DataStore.set('settings.enabled', _enabled);
        if (!_enabled) {
            Toolbar.destroy();
            Streak.resetStreak();
            Streak.showLetterPopup();
        } else {
            Toolbar.init();
            Streak.checkStreak();
        }
    });

    toolbarCb?.addEventListener('change', () => {
        DataStore.set('settings.toolbarVisible', toolbarCb.checked);
        Toolbar.refresh();
    });

    focusCb?.addEventListener('change', () => {
        _focusEnabled = focusCb.checked;
        DataStore.set('settings.focusEnabled', _focusEnabled);
        if (_focusEnabled) {
            Focus.startSession();
        } else {
            Focus.endSession();
        }
    });

    companionBtn?.addEventListener('click', () => {
        window.open('/scripts/extensions/third-party/ST-FocusGuard/companion.html', '_blank');
    });
}

/**
 * Update panel display values.
 */
function updatePanelDisplay() {
    const streakEl = document.getElementById('fg-streak-display');
    const rpEl = document.getElementById('fg-rp-display');

    if (streakEl) {
        const streak = Streak.getStreak();
        streakEl.textContent = `${streak.current} 天`;
    }

    if (rpEl) {
        const rp = DataStore.get('rpBudget') || { earned: 0, used: 0 };
        rpEl.textContent = `${rp.earned - rp.used} min`;
    }
}

// ─── Bootstrap ───
jQuery(async () => {
    await init();
});
