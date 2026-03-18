/**
 * FocusGuard - ADHD Daily Life Assistant for SillyTavern
 * Main entry point: registers panel synchronously, then loads modules async.
 */
(function () {
    const extensionFolderPath = 'scripts/extensions/third-party/ST-FocusGuard';

    const MODULES = [
        'datastore', 'tasks', 'themes', 'streak', 'guardian',
        'toolbar', 'overlay', 'focus', 'notifications', 'ai-ball',
    ];

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
            <div id="fg-load-status" style="font-size:11px;color:var(--fg-text-secondary,#888);margin-top:8px;"></div>
        </div>
    </div>`;

    // ═══ Step 1: Register panel IMMEDIATELY on script load ═══
    function registerPanelNow() {
        try {
            const container = document.getElementById('extensions_settings2');
            if (!container) {
                console.warn('[FocusGuard] extensions_settings2 not found, trying extensions_settings');
                const alt = document.getElementById('extensions_settings');
                if (alt) {
                    const wrapper = document.createElement('div');
                    wrapper.innerHTML = PANEL_HTML;
                    alt.appendChild(wrapper);
                    console.log('[FocusGuard] Panel registered in extensions_settings');
                } else {
                    console.error('[FocusGuard] No settings container found at all');
                }
                return;
            }
            const wrapper = document.createElement('div');
            wrapper.innerHTML = PANEL_HTML;
            container.appendChild(wrapper);
            console.log('[FocusGuard] Panel registered in extensions_settings2');
        } catch (e) {
            console.error('[FocusGuard] Panel registration failed:', e);
        }
    }

    // ═══ Step 2: Load modules async ═══
    async function loadModules() {
        const statusEl = document.getElementById('fg-load-status');
        let loaded = 0;
        for (const mod of MODULES) {
            try {
                await new Promise((resolve, reject) => {
                    jQuery.getScript(`/${extensionFolderPath}/modules/${mod}.js`)
                        .done(() => { loaded++; resolve(); })
                        .fail((jqxhr, settings, exception) => {
                            console.error(`[FocusGuard] Failed to load: ${mod}`, exception);
                            resolve();
                        });
                });
            } catch (e) {
                console.error(`[FocusGuard] Error loading ${mod}:`, e);
            }
        }
        if (statusEl) statusEl.textContent = `模块加载: ${loaded}/${MODULES.length}`;
        return loaded;
    }

    // ═══ Step 3: Initialize modules after loading ═══
    async function initModules() {
        const FG = window.FocusGuard;
        if (!FG || !FG.DataStore) {
            const statusEl = document.getElementById('fg-load-status');
            if (statusEl) statusEl.textContent = '核心模块加载失败，请刷新页面重试';
            console.error('[FocusGuard] DataStore not available');
            return;
        }

        try { FG.DataStore.init(); } catch (e) { console.error('[FG] DataStore init:', e); }
        try { FG.Themes?.init(); } catch (e) { console.error('[FG] Themes init:', e); }
        try { FG.Streak?.init(); } catch (e) { console.error('[FG] Streak init:', e); }
        try { FG.Guardian?.init(); } catch (e) { console.error('[FG] Guardian init:', e); }
        try { FG.Tasks?.populateRecurringForToday(); } catch (e) { console.error('[FG] Tasks init:', e); }
        try { FG.Notifications?.init(); } catch (e) { console.error('[FG] Notifications init:', e); }
        try { FG.Toolbar?.init(); } catch (e) { console.error('[FG] Toolbar init:', e); }
        try { FG.Overlay?.init(); } catch (e) { console.error('[FG] Overlay init:', e); }
        try {
            if (FG.DataStore.get('settings.focusEnabled') !== false) FG.Focus?.init();
        } catch (e) { console.error('[FG] Focus init:', e); }
        try { FG.AIBall?.init(); } catch (e) { console.error('[FG] AIBall init:', e); }

        // Bind panel controls now that DataStore is available
        bindPanelControls();

        // Update display
        updatePanelDisplay();

        // Listen for changes
        try {
            FG.DataStore.onChange((key) => {
                if (key === 'rpBudget' || key === 'full') updatePanelDisplay();
                if (key === '_lastAIAction') FG.Toolbar?.refresh();
            });
        } catch (e) {}

        // Check streak broken
        try {
            if (FG.Streak?.checkStreakBroken()) {
                const letter = FG.Streak.getLetter();
                if (letter) setTimeout(() => FG.Streak.showLetterPopup(), 2000);
            }
        } catch (e) {}

        const statusEl = document.getElementById('fg-load-status');
        if (statusEl) statusEl.textContent = '已就绪 ✓';

        console.log('[FocusGuard] Extension initialized');
    }

    function bindPanelControls() {
        const FG = window.FocusGuard || {};
        const enabledCb = document.getElementById('fg-enabled');
        const toolbarCb = document.getElementById('fg-toolbar-visible');
        const focusCb = document.getElementById('fg-focus-enabled');

        if (FG.DataStore) {
            if (enabledCb) enabledCb.checked = FG.DataStore.get('settings.enabled') !== false;
            if (toolbarCb) toolbarCb.checked = FG.DataStore.get('settings.toolbarVisible') !== false;
            if (focusCb) focusCb.checked = FG.DataStore.get('settings.focusEnabled') !== false;
        }

        enabledCb?.addEventListener('change', () => {
            FG.DataStore?.set('settings.enabled', enabledCb.checked);
            if (!enabledCb.checked) { FG.Toolbar?.destroy(); FG.Streak?.resetStreak(); FG.Streak?.showLetterPopup(); }
            else { FG.Toolbar?.init(); FG.Streak?.checkStreak(); }
        });

        toolbarCb?.addEventListener('change', () => {
            FG.DataStore?.set('settings.toolbarVisible', toolbarCb.checked);
            FG.Toolbar?.refresh();
        });

        focusCb?.addEventListener('change', () => {
            FG.DataStore?.set('settings.focusEnabled', focusCb.checked);
            if (focusCb.checked) FG.Focus?.startSession();
            else FG.Focus?.endSession();
        });

        document.getElementById('fg-open-companion')?.addEventListener('click', () => {
            window.open(`/${extensionFolderPath}/companion.html`, '_blank');
        });
    }

    function updatePanelDisplay() {
        try {
            const FG = window.FocusGuard || {};
            const streakEl = document.getElementById('fg-streak-display');
            const rpEl = document.getElementById('fg-rp-display');
            if (streakEl && FG.Streak) streakEl.textContent = `${FG.Streak.getStreak().current} 天`;
            if (rpEl && FG.DataStore) {
                const rp = FG.DataStore.get('rpBudget') || { earned: 0, used: 0 };
                rpEl.textContent = `${rp.earned - rp.used} min`;
            }
        } catch (e) {}
    }

    // ═══ Bootstrap ═══
    // Register panel as soon as DOM is ready (synchronous priority)
    jQuery(() => {
        registerPanelNow();
        // Then load modules and init async
        loadModules().then(() => initModules()).catch(e => {
            console.error('[FocusGuard] Init failed:', e);
            const statusEl = document.getElementById('fg-load-status');
            if (statusEl) statusEl.textContent = `初始化失败: ${e.message}`;
        });
    });
})();
