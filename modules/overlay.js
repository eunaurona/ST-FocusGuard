/**
 * Overlay Module - Opening screen overlay in ST
 * Guardian greeting + task overview + frequency settings.
 */
import { DataStore } from './datastore.js';
import { Tasks } from './tasks.js';
import { Guardian } from './guardian.js';

let _overlayEl = null;

const Overlay = {
    init() {
        if (DataStore.isCompanion()) return;
        this.checkAndShow();
    },

    /**
     * Check if overlay should show based on frequency setting.
     */
    checkAndShow() {
        const freq = DataStore.get('settings.overlayFrequency') || 'daily';
        if (freq === 'off') return;

        const today = DataStore.today();
        const lastDate = DataStore.get('settings.lastOverlayDate');

        if (freq === 'daily' && lastDate === today) return;

        // Show overlay
        this.show();
        DataStore.set('settings.lastOverlayDate', today);
    },

    async show() {
        if (_overlayEl) _overlayEl.remove();

        // Populate recurring tasks for today
        Tasks.populateRecurringForToday();

        const todayTasks = Tasks.getToday();
        const progress = Tasks.getTodayProgress();

        // Get guardian greeting
        let greeting = '早安！新的一天开始了~';
        try {
            greeting = await Guardian.generateGreeting('morning');
        } catch (e) {
            console.warn('[FocusGuard] Guardian greeting failed, using default:', e);
        }

        _overlayEl = document.createElement('div');
        _overlayEl.id = 'fg-overlay';
        _overlayEl.className = 'fg-overlay';
        _overlayEl.innerHTML = `
            <div class="fg-overlay-backdrop"></div>
            <div class="fg-overlay-content">
                <div class="fg-overlay-greeting">${this._escapeHtml(greeting)}</div>
                <div class="fg-overlay-tasks">
                    <div class="fg-overlay-tasks-title">今日任务 (${progress.done}/${progress.total})</div>
                    <div class="fg-overlay-tasks-list">
                        ${todayTasks.length > 0
                            ? todayTasks.map(t => `
                                <div class="fg-overlay-task-item ${t.done ? 'fg-overlay-task-done' : ''}">
                                    <span class="fg-overlay-task-time">${t.timeStart || '--:--'}</span>
                                    <span class="fg-overlay-task-text">${this._escapeHtml(t.text)}</span>
                                    <span class="fg-overlay-task-reward">+${t.reward}min</span>
                                </div>
                            `).join('')
                            : '<div class="fg-overlay-empty">今天还没有安排任务哦~<br>去陪伴页面添加吧！</div>'
                        }
                    </div>
                </div>
                <div class="fg-overlay-actions">
                    <button class="fg-btn fg-btn-primary" data-action="start-rp">开始 RP</button>
                    <button class="fg-btn fg-btn-secondary" data-action="companion">去陪伴页面</button>
                </div>
            </div>
        `;

        document.body.appendChild(_overlayEl);

        // Event listeners
        _overlayEl.querySelector('[data-action="start-rp"]')?.addEventListener('click', () => {
            this.hide();
        });
        _overlayEl.querySelector('[data-action="companion"]')?.addEventListener('click', () => {
            window.open('/scripts/extensions/third-party/ST-FocusGuard/companion.html', '_blank');
            this.hide();
        });

        // Click backdrop to dismiss
        _overlayEl.querySelector('.fg-overlay-backdrop')?.addEventListener('click', () => {
            this.hide();
        });
    },

    hide() {
        if (_overlayEl) {
            _overlayEl.classList.add('fg-overlay--hiding');
            setTimeout(() => {
                _overlayEl?.remove();
                _overlayEl = null;
            }, 300);
        }
    },

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
};

export { Overlay };
