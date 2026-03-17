/**
 * Toolbar Module - Floating bar in ST chat interface
 * Shows current task, countdown, progress with presence escalation.
 */
import { DataStore } from './datastore.js';
import { Tasks } from './tasks.js';

let _toolbarEl = null;
let _updateInterval = null;

const Toolbar = {
    init() {
        if (DataStore.isCompanion()) return;
        this.create();
        this.startUpdating();

        DataStore.onChange((key) => {
            if (key.startsWith('settings.toolbar') || key === 'tasks' || key === 'full') {
                this.refresh();
            }
        });
    },

    create() {
        if (_toolbarEl) _toolbarEl.remove();

        _toolbarEl = document.createElement('div');
        _toolbarEl.id = 'fg-toolbar';
        _toolbarEl.className = 'fg-toolbar';
        _toolbarEl.innerHTML = `
            <div class="fg-toolbar-inner">
                <span class="fg-toolbar-time" data-fg="time"></span>
                <span class="fg-toolbar-divider">|</span>
                <span class="fg-toolbar-task" data-fg="task"></span>
                <span class="fg-toolbar-divider">|</span>
                <span class="fg-toolbar-countdown" data-fg="countdown"></span>
                <span class="fg-toolbar-divider">|</span>
                <span class="fg-toolbar-next" data-fg="next"></span>
                <span class="fg-toolbar-divider">|</span>
                <span class="fg-toolbar-progress" data-fg="progress"></span>
            </div>
            <div class="fg-toolbar-progress-bar">
                <div class="fg-toolbar-progress-fill" data-fg="progressFill"></div>
            </div>
        `;

        document.body.appendChild(_toolbarEl);
        this.refresh();
    },

    refresh() {
        if (!_toolbarEl) return;

        const settings = DataStore.get('settings') || {};
        const visible = settings.toolbarVisible !== false;
        _toolbarEl.style.display = visible ? '' : 'none';
        if (!visible) return;

        _toolbarEl.style.opacity = settings.toolbarOpacity || 0.85;
        _toolbarEl.style.transform = `scale(${settings.toolbarSize || 1})`;

        // Update visibility of individual sections
        this._toggleSection('time', settings.toolbarShowTime !== false);
        this._toggleSection('task', settings.toolbarShowTask !== false);
        this._toggleSection('countdown', settings.toolbarShowCountdown !== false);
        this._toggleSection('next', settings.toolbarShowNextTask !== false);
        this._toggleSection('progress', settings.toolbarShowProgress !== false);

        this.updateContent();
    },

    _toggleSection(name, show) {
        const el = _toolbarEl.querySelector(`[data-fg="${name}"]`);
        if (el) el.style.display = show ? '' : 'none';
        // Hide adjacent divider
        if (el && el.previousElementSibling?.classList.contains('fg-toolbar-divider')) {
            el.previousElementSibling.style.display = show ? '' : 'none';
        }
    },

    updateContent() {
        if (!_toolbarEl || _toolbarEl.style.display === 'none') return;

        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        // Current time
        this._setText('time', timeStr);

        // Current task
        const currentTask = Tasks.getCurrentTask();
        this._setText('task', currentTask ? currentTask.text : '暂无任务');

        // Countdown
        if (currentTask) {
            const remaining = Tasks.getTimeRemaining(currentTask);
            if (remaining !== null) {
                this._setText('countdown', remaining > 0 ? `剩余 ${remaining} 分钟` : '已超时');
            } else {
                this._setText('countdown', '');
            }
        } else {
            this._setText('countdown', '');
        }

        // Next task
        const nextTask = Tasks.getNextTask();
        this._setText('next', nextTask ? `下一个: ${nextTask.text} ${nextTask.timeStart || ''}` : '');

        // Progress
        const progress = Tasks.getTodayProgress();
        this._setText('progress', `${progress.done}/${progress.total}`);
        const fill = _toolbarEl.querySelector('[data-fg="progressFill"]');
        if (fill) fill.style.width = `${progress.percentage}%`;

        // Presence escalation
        this._updatePresence(currentTask);
    },

    _setText(key, text) {
        const el = _toolbarEl?.querySelector(`[data-fg="${key}"]`);
        if (el) el.textContent = text;
    },

    /**
     * Presence escalation: green → yellow → red based on task time progress.
     */
    _updatePresence(currentTask) {
        if (!_toolbarEl) return;

        _toolbarEl.classList.remove('fg-toolbar--safe', 'fg-toolbar--warning', 'fg-toolbar--danger');

        if (!currentTask || !currentTask.timeStart || !currentTask.timeEnd) {
            _toolbarEl.classList.add('fg-toolbar--safe');
            return;
        }

        const now = new Date();
        const [sh, sm] = currentTask.timeStart.split(':').map(Number);
        const [eh, em] = currentTask.timeEnd.split(':').map(Number);
        const start = new Date();
        start.setHours(sh, sm, 0, 0);
        const end = new Date();
        end.setHours(eh, em, 0, 0);

        const total = end - start;
        const elapsed = now - start;

        if (elapsed < 0) {
            _toolbarEl.classList.add('fg-toolbar--safe');
        } else if (elapsed > total) {
            _toolbarEl.classList.add('fg-toolbar--danger');
        } else {
            const ratio = elapsed / total;
            if (ratio < 0.5) {
                _toolbarEl.classList.add('fg-toolbar--safe');
            } else if (ratio < 0.85) {
                _toolbarEl.classList.add('fg-toolbar--warning');
            } else {
                _toolbarEl.classList.add('fg-toolbar--danger');
            }
        }
    },

    startUpdating() {
        if (_updateInterval) clearInterval(_updateInterval);
        _updateInterval = setInterval(() => this.updateContent(), 15000); // Every 15 seconds
    },

    destroy() {
        if (_updateInterval) clearInterval(_updateInterval);
        if (_toolbarEl) _toolbarEl.remove();
        _toolbarEl = null;
    },
};

export { Toolbar };
