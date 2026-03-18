/**
 * Overlay Module - Opening screen overlay in ST
 */
(function () {
    const FG = window.FocusGuard = window.FocusGuard || {};

    let _overlayEl = null;

    function _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    const Overlay = {
        init() {
            if (FG.DataStore.isCompanion()) return;
            this.checkAndShow();
        },

        checkAndShow() {
            const freq = FG.DataStore.get('settings.overlayFrequency') || 'daily';
            if (freq === 'off') return;
            const today = FG.DataStore.today();
            const lastDate = FG.DataStore.get('settings.lastOverlayDate');
            if (freq === 'daily' && lastDate === today) return;
            this.show();
            FG.DataStore.set('settings.lastOverlayDate', today);
        },

        async show() {
            if (_overlayEl) _overlayEl.remove();
            FG.Tasks.populateRecurringForToday();
            const todayTasks = FG.Tasks.getToday();
            const progress = FG.Tasks.getTodayProgress();
            let greeting = '早安！新的一天开始了~';
            try { greeting = await FG.Guardian.generateGreeting('morning'); } catch (e) {}

            _overlayEl = document.createElement('div');
            _overlayEl.id = 'fg-overlay';
            _overlayEl.className = 'fg-overlay';
            _overlayEl.innerHTML = `
                <div class="fg-overlay-backdrop"></div>
                <div class="fg-overlay-content">
                    <div class="fg-overlay-greeting">${_escapeHtml(greeting)}</div>
                    <div class="fg-overlay-tasks">
                        <div class="fg-overlay-tasks-title">今日任务 (${progress.done}/${progress.total})</div>
                        <div class="fg-overlay-tasks-list">
                            ${todayTasks.length > 0
                                ? todayTasks.map(t => `
                                    <div class="fg-overlay-task-item ${t.done ? 'fg-overlay-task-done' : ''}">
                                        <span class="fg-overlay-task-time">${t.timeStart || '--:--'}</span>
                                        <span class="fg-overlay-task-text">${_escapeHtml(t.text)}</span>
                                        <span class="fg-overlay-task-reward">+${t.reward}min</span>
                                    </div>`).join('')
                                : '<div class="fg-overlay-empty">今天还没有安排任务哦~<br>去陪伴页面添加吧！</div>'}
                        </div>
                    </div>
                    <div class="fg-overlay-actions">
                        <button class="fg-btn fg-btn-primary" data-action="start-rp">开始 RP</button>
                        <button class="fg-btn fg-btn-secondary" data-action="companion">去陪伴页面</button>
                    </div>
                </div>`;
            document.body.appendChild(_overlayEl);
            _overlayEl.querySelector('[data-action="start-rp"]')?.addEventListener('click', () => this.hide());
            _overlayEl.querySelector('[data-action="companion"]')?.addEventListener('click', () => {
                window.open('/scripts/extensions/third-party/ST-FocusGuard/companion.html', '_blank');
                this.hide();
            });
            _overlayEl.querySelector('.fg-overlay-backdrop')?.addEventListener('click', () => this.hide());
        },

        hide() {
            if (_overlayEl) {
                _overlayEl.classList.add('fg-overlay--hiding');
                setTimeout(() => { _overlayEl?.remove(); _overlayEl = null; }, 300);
            }
        },
    };

    FG.Overlay = Overlay;
})();
