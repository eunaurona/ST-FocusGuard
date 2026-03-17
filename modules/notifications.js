/**
 * Notifications Module - Browser push notifications with guardian voice
 */
import { DataStore } from './datastore.js';
import { Tasks } from './tasks.js';
import { Guardian } from './guardian.js';

let _checkInterval = null;
let _notifiedTaskIds = new Set();

const Notifications = {
    init() {
        this.requestPermission();
        this.startChecking();
    },

    async requestPermission() {
        if (!('Notification' in window)) return;
        if (Notification.permission === 'default') {
            await Notification.requestPermission();
        }
    },

    canNotify() {
        return 'Notification' in window && Notification.permission === 'granted';
    },

    startChecking() {
        if (_checkInterval) clearInterval(_checkInterval);
        _checkInterval = setInterval(() => this._checkTasks(), 30000); // Every 30s
    },

    _checkTasks() {
        if (!DataStore.get('settings.notificationsEnabled')) return;
        if (document.hasFocus()) return; // Only notify when not focused

        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const todayTasks = Tasks.getToday().filter(t => !t.done && t.timeStart);

        for (const task of todayTasks) {
            if (_notifiedTaskIds.has(task.id)) continue;

            // Notify if task starts within 2 minutes
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
        try {
            body = await Guardian.generateGreeting('taskDue');
        } catch {
            body = `该去做「${task.text}」啦~`;
        }

        const notification = new Notification('FocusGuard', {
            body: `${body}\n📋 ${task.text} (${task.timeStart})`,
            icon: '/img/ai4.png',
            tag: `fg-task-${task.id}`,
            requireInteraction: false,
        });

        notification.onclick = () => {
            window.focus();
            notification.close();
        };
    },

    /**
     * Send a custom notification.
     */
    send(title, body) {
        if (!this.canNotify()) return;
        new Notification(title, { body, icon: '/img/ai4.png' });
    },

    destroy() {
        if (_checkInterval) clearInterval(_checkInterval);
    },
};

export { Notifications };
