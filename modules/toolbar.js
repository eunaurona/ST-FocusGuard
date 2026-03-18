/**
 * Toolbar Module - Floating bar in ST chat interface
 */
(function () {
    const FG = window.FocusGuard = window.FocusGuard || {};

    let _toolbarEl = null;
    let _updateInterval = null;

    const Toolbar = {
        init() {
            if (FG.DataStore.isCompanion()) return;
            this.create();
            this.startUpdating();
            FG.DataStore.onChange((key) => {
                if (key.startsWith('settings.toolbar') || key === 'tasks' || key === 'full') this.refresh();
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
                </div>`;
            document.body.appendChild(_toolbarEl);
            this.refresh();
        },

        refresh() {
            if (!_toolbarEl) return;
            const settings = FG.DataStore.get('settings') || {};
            const visible = settings.toolbarVisible !== false;
            _toolbarEl.style.display = visible ? '' : 'none';
            if (!visible) return;
            _toolbarEl.style.opacity = settings.toolbarOpacity || 0.85;
            _toolbarEl.style.transform = `translateX(-50%) scale(${settings.toolbarSize || 1})`;
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
            if (el && el.previousElementSibling?.classList.contains('fg-toolbar-divider')) {
                el.previousElementSibling.style.display = show ? '' : 'none';
            }
        },

        updateContent() {
            if (!_toolbarEl || _toolbarEl.style.display === 'none') return;
            const now = new Date();
            const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            this._setText('time', timeStr);
            const currentTask = FG.Tasks.getCurrentTask();
            this._setText('task', currentTask ? currentTask.text : '暂无任务');
            if (currentTask) {
                const remaining = FG.Tasks.getTimeRemaining(currentTask);
                this._setText('countdown', remaining !== null ? (remaining > 0 ? `剩余 ${remaining} 分钟` : '已超时') : '');
            } else { this._setText('countdown', ''); }
            const nextTask = FG.Tasks.getNextTask();
            this._setText('next', nextTask ? `下一个: ${nextTask.text} ${nextTask.timeStart || ''}` : '');
            const progress = FG.Tasks.getTodayProgress();
            this._setText('progress', `${progress.done}/${progress.total}`);
            const fill = _toolbarEl.querySelector('[data-fg="progressFill"]');
            if (fill) fill.style.width = `${progress.percentage}%`;
            this._updatePresence(currentTask);
        },

        _setText(key, text) {
            const el = _toolbarEl?.querySelector(`[data-fg="${key}"]`);
            if (el) el.textContent = text;
        },

        _updatePresence(currentTask) {
            if (!_toolbarEl) return;
            _toolbarEl.classList.remove('fg-toolbar--safe', 'fg-toolbar--warning', 'fg-toolbar--danger');
            if (!currentTask || !currentTask.timeStart || !currentTask.timeEnd) {
                _toolbarEl.classList.add('fg-toolbar--safe'); return;
            }
            const now = new Date();
            const [sh, sm] = currentTask.timeStart.split(':').map(Number);
            const [eh, em] = currentTask.timeEnd.split(':').map(Number);
            const start = new Date(); start.setHours(sh, sm, 0, 0);
            const end = new Date(); end.setHours(eh, em, 0, 0);
            const total = end - start;
            const elapsed = now - start;
            if (elapsed < 0) _toolbarEl.classList.add('fg-toolbar--safe');
            else if (elapsed > total) _toolbarEl.classList.add('fg-toolbar--danger');
            else {
                const ratio = elapsed / total;
                _toolbarEl.classList.add(ratio < 0.5 ? 'fg-toolbar--safe' : ratio < 0.85 ? 'fg-toolbar--warning' : 'fg-toolbar--danger');
            }
        },

        startUpdating() {
            if (_updateInterval) clearInterval(_updateInterval);
            _updateInterval = setInterval(() => this.updateContent(), 15000);
        },

        destroy() {
            if (_updateInterval) clearInterval(_updateInterval);
            if (_toolbarEl) _toolbarEl.remove();
            _toolbarEl = null;
        },
    };

    FG.Toolbar = Toolbar;
})();
