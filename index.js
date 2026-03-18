/**
 * FocusGuard - ADHD Daily Life Assistant for SillyTavern
 * Main entry point: loads modules via jQuery.getScript, then initializes.
 * ST loads this file as a regular script (not ES module).
 */
(function () {
    const extensionFolderPath = 'scripts/extensions/third-party/ST-FocusGuard';

    // Module load order matters: datastore first, then tasks, then everything else
    const MODULES = [
        'datastore',
        'tasks',
        'themes',
        'streak',
        'guardian',
        'toolbar',
        'overlay',
        'focus',
        'notifications',
        'ai-ball',
    ];

    // ─── Extension Panel HTML ───
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
    </div>`;

    /**
     * Load modules sequentially, then call init.
     */
    async function loadModules() {
        for (const mod of MODULES) {
            await new Promise((resolve, reject) => {
                jQuery.getScript(`/${extensionFolderPath}/modules/${mod}.js`)
                    .done(resolve)
                    .fail((jqxhr, settings, exception) => {
                        console.error(`[FocusGuard] Failed to load module: ${mod}`, exception);
                        resolve(); // continue loading other modules
                    });
            });
        }
    }

    function updatePanelDisplay() {
        const FG = window.FocusGuard || {};
        const streakEl = document.getElementById('fg-streak-display');
        const rpEl = document.getElementById('fg-rp-display');
        if (streakEl && FG.Streak) streakEl.textContent = `${FG.Streak.getStreak().current} 天`;
        if (rpEl && FG.DataStore) {
            const rp = FG.DataStore.get('rpBudget') || { earned: 0, used: 0 };
            rpEl.textContent = `${rp.earned - rp.used} min`;
        }
    }

    function registerPanel() {
        const FG = window.FocusGuard || {};
        const settingsContainer = document.getElementById('extensions_settings2');
        if (!settingsContainer) {
            console.warn('[FocusGuard] Settings container not found');
            return;
        }

        const panelWrapper = document.createElement('div');
        panelWrapper.innerHTML = PANEL_HTML;
        settingsContainer.appendChild(panelWrapper);

        const enabledCb = document.getElementById('fg-enabled');
        const toolbarCb = document.getElementById('fg-toolbar-visible');
        const focusCb = document.getElementById('fg-focus-enabled');

        if (FG.DataStore) {
            enabledCb.checked = FG.DataStore.get('settings.enabled') !== false;
            toolbarCb.checked = FG.DataStore.get('settings.toolbarVisible') !== false;
            focusCb.checked = FG.DataStore.get('settings.focusEnabled') !== false;
        }

        enabledCb?.addEventListener('change', () => {
            FG.DataStore.set('settings.enabled', enabledCb.checked);
            if (!enabledCb.checked) {
                FG.Toolbar?.destroy();
                FG.Streak?.resetStreak();
                FG.Streak?.showLetterPopup();
            } else {
                FG.Toolbar?.init();
                FG.Streak?.checkStreak();
            }
        });

        toolbarCb?.addEventListener('change', () => {
            FG.DataStore.set('settings.toolbarVisible', toolbarCb.checked);
            FG.Toolbar?.refresh();
        });

        focusCb?.addEventListener('change', () => {
            FG.DataStore.set('settings.focusEnabled', focusCb.checked);
            if (focusCb.checked) FG.Focus?.startSession();
            else FG.Focus?.endSession();
        });

        document.getElementById('fg-open-companion')?.addEventListener('click', () => {
            window.open(`/${extensionFolderPath}/companion.html`, '_blank');
        });
    }

    async function init() {
        const FG = window.FocusGuard || {};

        // Initialize data layer
        FG.DataStore.init();

        // Apply theme
        FG.Themes.init();

        // Check streak
        FG.Streak.init();

        // Initialize modules
        FG.Guardian.init();
        FG.Tasks.populateRecurringForToday();
        FG.Notifications.init();

        // Register extension panel in ST
        registerPanel();

        // Initialize toolbar
        FG.Toolbar.init();

        // Show overlay if applicable
        FG.Overlay.init();

        // Initialize focus mode
        if (FG.DataStore.get('settings.focusEnabled') !== false) {
            FG.Focus.init();
        }

        // Initialize AI Ball
        FG.AIBall.init();

        // Listen for data changes
        FG.DataStore.onChange((key) => {
            if (key === 'rpBudget' || key === 'full') updatePanelDisplay();
            if (key === '_lastAIAction') FG.Toolbar?.refresh();
        });

        updatePanelDisplay();

        // Check if streak was broken → show letter
        if (FG.Streak.checkStreakBroken()) {
            const letter = FG.Streak.getLetter();
            if (letter) setTimeout(() => FG.Streak.showLetterPopup(), 2000);
        }

        console.log('[FocusGuard] Extension initialized');
    }

    // ─── Bootstrap ───
    jQuery(async () => {
        await loadModules();
        await init();
    });
})();
