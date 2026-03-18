/**
 * Notifications Module - Browser push notifications with guardian voice
 */
(function () {
    const FG = window.FocusGuard = window.FocusGuard || {};

    let _checkInterval = null;
    const _notifiedTaskIds = new Set();

    const Notifications = {
        init() {
            this.requestPermission();
            this.startChecking();
        },

        async requestPermission() {
            if (!('Notification' in window)) return;
            if (Notification.permission === 'default') await Notification.requestPermission();
        },

        canNotify() { return 'Notification' in window && Notification.permission === 'granted'; },

        startChecking() {
            if (_checkInterval) clearInterval(_checkInterval);
            _checkInterval = setInterval(() => this._checkTasks(), 30000);
        },

        _checkTasks() {
            if (!FG.DataStore.get('settings.notificationsEnabled')) return;
            if (document.hasFocus()) return;
            const now = new Date();
            const todayTasks = FG.Tasks.getToday().filter(t => !t.done && t.timeStart);
            for (const task of todayTasks) {
                if (_notifiedTaskIds.has(task.id)) continue;
                const [th, tm] = task.timeStart.split(':').map(Number);
                const taskMinutes = th * 60 + tm;
                const nowMinutes = now.getHours() * 60 + now.getMinutes();
                const diff = taskMinutes - nowMinutes;
                if (diff >= 0 && diff <= 2) {
                    this._sendNotification(task);
                    _notifiedTaskIds.add(task.id);
                }
            }
        },

        async _sendNotification(task) {
            if (!this.canNotify()) return;
            let body;
            try { body = await FG.Guardian.generateGreeting('taskDue'); }
            catch { body = `该去做「${task.text}」啦~`; }
            const notification = new Notification('FocusGuard', {
                body: `${body}\n${task.text} (${task.timeStart})`,
                tag: `fg-task-${task.id}`,
                requireInteraction: false,
            });
            notification.onclick = () => { window.focus(); notification.close(); };
        },

        send(title, body) {
            if (!this.canNotify()) return;
            new Notification(title, { body });
        },

        destroy() { if (_checkInterval) clearInterval(_checkInterval); },
    };

    FG.Notifications = Notifications;
})();
