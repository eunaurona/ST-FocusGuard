/**
 * Timeline Module - Vertical time river rendering for companion page
 */
(function () {
    const FG = window.FocusGuard = window.FocusGuard || {};

    function _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    const Timeline = {
        render(container, dateStr) {
            const date = dateStr || FG.DataStore.today();
            const tasks = FG.Tasks.getForDate(date);
            const sorted = FG.Tasks.sortByTime(tasks);
            const now = new Date();
            const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            const isToday = date === FG.DataStore.today();

            container.innerHTML = '';
            container.className = 'fg-timeline';

            if (sorted.length === 0) {
                container.innerHTML = `
                    <div class="fg-timeline-empty">
                        <div class="fg-timeline-empty-icon">📋</div>
                        <div class="fg-timeline-empty-text">还没有任务哦~</div>
                        <div class="fg-timeline-empty-hint">点击右下角的小球添加任务吧</div>
                    </div>`;
                return;
            }

            const timelineHtml = sorted.map((task, idx) => {
                const isPast = isToday && task.timeEnd && task.timeEnd < currentTime;
                const isCurrent = isToday && task.timeStart && task.timeEnd && currentTime >= task.timeStart && currentTime <= task.timeEnd;
                const isDone = task.done;
                let stateClass = 'fg-task-upcoming';
                if (isDone) stateClass = 'fg-task-done';
                else if (isCurrent) stateClass = 'fg-task-current';
                else if (isPast) stateClass = 'fg-task-past';

                const remaining = isCurrent ? FG.Tasks.getTimeRemaining(task) : null;
                const nextTask = idx < sorted.length - 1 ? sorted[idx + 1] : null;

                let progressPercent = 0;
                if (isCurrent && task.timeStart && task.timeEnd) {
                    const [sh, sm] = task.timeStart.split(':').map(Number);
                    const [eh, em] = task.timeEnd.split(':').map(Number);
                    const startMin = sh * 60 + sm;
                    const endMin = eh * 60 + em;
                    const nowMin = now.getHours() * 60 + now.getMinutes();
                    progressPercent = Math.min(100, Math.max(0, ((nowMin - startMin) / (endMin - startMin)) * 100));
                }

                const subtasksHtml = (task.subtasks && task.subtasks.length > 0) ? `
                    <div class="fg-task-subtasks">
                        ${task.subtasks.map(sub => `
                            <div class="fg-subtask ${sub.done ? 'fg-subtask-done' : ''}" data-task-id="${task.id}" data-subtask-id="${sub.id}">
                                <span class="fg-subtask-check">${sub.done ? '✓' : '○'}</span>
                                <span class="fg-subtask-text">${_escapeHtml(sub.text)}</span>
                                <span class="fg-subtask-reward">+${sub.reward}min</span>
                            </div>`).join('')}
                    </div>` : '';

                return `
                    <div class="fg-task-card ${stateClass}" data-task-id="${task.id}">
                        <div class="fg-task-time-marker">
                            <div class="fg-task-time-dot"></div>
                            <div class="fg-task-time-label">${task.timeStart || '--:--'}</div>
                        </div>
                        <div class="fg-task-body">
                            <div class="fg-task-header">
                                <span class="fg-task-name">${_escapeHtml(task.text)}</span>
                                <span class="fg-task-reward-badge">+${task.reward}min</span>
                            </div>
                            ${isCurrent ? `
                                <div class="fg-task-countdown">剩余 ${remaining || 0} 分钟</div>
                                <div class="fg-task-progress"><div class="fg-task-progress-fill" style="width:${progressPercent}%"></div></div>
                            ` : ''}
                            ${isCurrent && nextTask ? `<div class="fg-task-next-preview">下一个: ${_escapeHtml(nextTask.text)} ${nextTask.timeStart || ''}</div>` : ''}
                            ${subtasksHtml}
                            ${!isDone
                                ? `<button class="fg-task-complete-btn" data-task-id="${task.id}">✓ 完成</button>`
                                : `<div class="fg-task-done-label">已完成 ✓</div>`}
                        </div>
                    </div>`;
            }).join('');

            const nowMarkerHtml = isToday ? `<div class="fg-timeline-now-marker"><span>现在 ${currentTime}</span></div>` : '';

            container.innerHTML = `<div class="fg-timeline-line"></div>${nowMarkerHtml}${timelineHtml}`;
            this._attachEvents(container);

            if (isToday) {
                const currentCard = container.querySelector('.fg-task-current');
                if (currentCard) setTimeout(() => currentCard.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
            }
        },

        _attachEvents(container) {
            container.querySelectorAll('.fg-task-complete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const taskId = btn.dataset.taskId;
                    FG.Tasks.complete(taskId);
                    this._showRewardAnimation(btn);
                    setTimeout(() => {
                        const dateStr = container.dataset.date || FG.DataStore.today();
                        this.render(container, dateStr);
                    }, 600);
                });
            });
            container.querySelectorAll('.fg-subtask:not(.fg-subtask-done)').forEach(sub => {
                sub.addEventListener('click', (e) => {
                    e.stopPropagation();
                    FG.Tasks.completeSubtask(sub.dataset.taskId, sub.dataset.subtaskId);
                    this._showRewardAnimation(sub);
                    setTimeout(() => {
                        const dateStr = container.dataset.date || FG.DataStore.today();
                        this.render(container, dateStr);
                    }, 600);
                });
            });
        },

        _showRewardAnimation(element) {
            const anim = document.createElement('div');
            anim.className = 'fg-reward-anim';
            anim.textContent = '+RP ✨';
            const rect = element.getBoundingClientRect();
            anim.style.left = `${rect.left + rect.width / 2}px`;
            anim.style.top = `${rect.top}px`;
            document.body.appendChild(anim);
            setTimeout(() => anim.remove(), 1000);
        },
    };

    FG.Timeline = Timeline;
})();
