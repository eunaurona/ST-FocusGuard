/**
 * Tasks Module - CRUD + recurring + subtask management
 */
(function () {
    const FG = window.FocusGuard = window.FocusGuard || {};
    const DataStore = FG.DataStore;

    function generateId() {
        return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    }

    const Tasks = {
        getAll() { return DataStore.get('tasks') || []; },

        getForDate(dateStr) {
            const tasks = this.getAll();
            const date = new Date(dateStr);
            const dayOfWeek = date.getDay();
            return tasks.filter(t => {
                if (t.calendarDate === dateStr) return true;
                if (t.recurring) {
                    if (t.recurring.type === 'daily') {
                        if (!t.recurring.days || t.recurring.days.length === 0) return true;
                        return t.recurring.days.includes(dayOfWeek);
                    }
                    if (t.recurring.type === 'weekly') return t.recurring.days?.includes(dayOfWeek);
                }
                return false;
            });
        },

        getToday() { return this.sortByTime(this.getForDate(DataStore.today())); },

        sortByTime(tasks) {
            return [...tasks].sort((a, b) => (a.timeStart || '99:99').localeCompare(b.timeStart || '99:99'));
        },

        add(taskData) {
            const task = {
                id: generateId(), text: taskData.text || '',
                timeStart: taskData.timeStart || null, timeEnd: taskData.timeEnd || null,
                reward: taskData.reward || 15, done: false, type: taskData.type || 'other',
                recurring: taskData.recurring || null, subtasks: taskData.subtasks || [],
                createdAt: new Date().toISOString(), completedAt: null,
                calendarDate: taskData.calendarDate || DataStore.today(),
            };
            const tasks = this.getAll();
            tasks.push(task);
            DataStore.set('tasks', tasks);
            return task;
        },

        update(taskId, updates) {
            const tasks = this.getAll();
            const idx = tasks.findIndex(t => t.id === taskId);
            if (idx === -1) return null;
            Object.assign(tasks[idx], updates);
            DataStore.set('tasks', tasks);
            return tasks[idx];
        },

        delete(taskId) {
            const tasks = this.getAll();
            const filtered = tasks.filter(t => t.id !== taskId);
            DataStore.set('tasks', filtered);
            return filtered.length < tasks.length;
        },

        complete(taskId) {
            const tasks = this.getAll();
            const task = tasks.find(t => t.id === taskId);
            if (!task) return null;
            task.done = true;
            task.completedAt = new Date().toISOString();
            DataStore.set('tasks', tasks);
            const rpBudget = DataStore.get('rpBudget') || { earned: 0, used: 0 };
            rpBudget.earned += (task.reward || 0);
            DataStore.set('rpBudget', rpBudget);
            return task;
        },

        completeSubtask(taskId, subtaskId) {
            const tasks = this.getAll();
            const task = tasks.find(t => t.id === taskId);
            if (!task || !task.subtasks) return null;
            const sub = task.subtasks.find(s => s.id === subtaskId);
            if (!sub) return null;
            sub.done = true;
            DataStore.set('tasks', tasks);
            if (sub.reward) {
                const rpBudget = DataStore.get('rpBudget') || { earned: 0, used: 0 };
                rpBudget.earned += sub.reward;
                DataStore.set('rpBudget', rpBudget);
            }
            if (task.subtasks.every(s => s.done)) {
                task.done = true;
                task.completedAt = new Date().toISOString();
                DataStore.set('tasks', tasks);
            }
            return sub;
        },

        addSubtask(taskId, subtaskData) {
            const tasks = this.getAll();
            const task = tasks.find(t => t.id === taskId);
            if (!task) return null;
            if (!task.subtasks) task.subtasks = [];
            const subtask = { id: generateId(), text: subtaskData.text || '', done: false, reward: subtaskData.reward || 5 };
            task.subtasks.push(subtask);
            DataStore.set('tasks', tasks);
            return subtask;
        },

        splitIntoSubtasks(taskId, subtaskList) {
            const tasks = this.getAll();
            const task = tasks.find(t => t.id === taskId);
            if (!task) return null;
            task.subtasks = subtaskList.map(s => ({ id: generateId(), text: s.text, done: false, reward: s.reward || 5 }));
            DataStore.set('tasks', tasks);
            return task;
        },

        getCurrentTask() {
            const now = new Date();
            const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            const todayTasks = this.getToday().filter(t => !t.done);
            for (const task of todayTasks) {
                if (task.timeStart && task.timeEnd && currentTime >= task.timeStart && currentTime <= task.timeEnd) return task;
            }
            return todayTasks.find(t => t.timeStart && t.timeStart > currentTime) || todayTasks[0] || null;
        },

        getNextTask() {
            const now = new Date();
            const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            return this.getToday().filter(t => !t.done && t.timeStart && t.timeStart > currentTime)[0] || null;
        },

        getTodayProgress() {
            const todayTasks = this.getToday();
            const total = todayTasks.length;
            const done = todayTasks.filter(t => t.done).length;
            return { total, done, percentage: total > 0 ? Math.round((done / total) * 100) : 0 };
        },

        getTimeRemaining(task) {
            if (!task.timeEnd) return null;
            const now = new Date();
            const [h, m] = task.timeEnd.split(':').map(Number);
            const end = new Date();
            end.setHours(h, m, 0, 0);
            const diff = end - now;
            return diff <= 0 ? 0 : Math.ceil(diff / 60000);
        },

        populateRecurringForToday() {
            const today = DataStore.today();
            const allTasks = this.getAll();
            const date = new Date(today);
            const dayOfWeek = date.getDay();
            const recurringTemplates = allTasks.filter(t => t.recurring && !t.calendarDate);
            const todayExisting = allTasks.filter(t => t.calendarDate === today);
            for (const template of recurringTemplates) {
                const applies =
                    (template.recurring.type === 'daily' && (!template.recurring.days || template.recurring.days.length === 0 || template.recurring.days.includes(dayOfWeek)))
                    || (template.recurring.type === 'weekly' && template.recurring.days?.includes(dayOfWeek));
                if (applies && !todayExisting.some(t => t.text === template.text && t.timeStart === template.timeStart)) {
                    this.add({ text: template.text, timeStart: template.timeStart, timeEnd: template.timeEnd, reward: template.reward, type: template.type, calendarDate: today });
                }
            }
        },
    };

    FG.Tasks = Tasks;
})();
