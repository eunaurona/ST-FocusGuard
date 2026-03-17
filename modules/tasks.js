/**
 * Tasks Module - CRUD + recurring + subtask management
 */
import { DataStore } from './datastore.js';

function generateId() {
    return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

const Tasks = {
    /**
     * Get all tasks.
     */
    getAll() {
        return DataStore.get('tasks') || [];
    },

    /**
     * Get tasks for a specific date, including recurring tasks that apply.
     */
    getForDate(dateStr) {
        const tasks = this.getAll();
        const date = new Date(dateStr);
        const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon...

        return tasks.filter(t => {
            // Direct match
            if (t.calendarDate === dateStr) return true;
            // Recurring match
            if (t.recurring) {
                if (t.recurring.type === 'daily') {
                    if (!t.recurring.days || t.recurring.days.length === 0) return true;
                    return t.recurring.days.includes(dayOfWeek);
                }
                if (t.recurring.type === 'weekly') {
                    return t.recurring.days?.includes(dayOfWeek);
                }
            }
            return false;
        });
    },

    /**
     * Get today's tasks sorted by time.
     */
    getToday() {
        const today = DataStore.today();
        const tasks = this.getForDate(today);
        return this.sortByTime(tasks);
    },

    /**
     * Sort tasks by start time.
     */
    sortByTime(tasks) {
        return [...tasks].sort((a, b) => {
            const timeA = a.timeStart || '99:99';
            const timeB = b.timeStart || '99:99';
            return timeA.localeCompare(timeB);
        });
    },

    /**
     * Add a new task.
     */
    add(taskData) {
        const task = {
            id: generateId(),
            text: taskData.text || '',
            timeStart: taskData.timeStart || null,
            timeEnd: taskData.timeEnd || null,
            reward: taskData.reward || 15,
            done: false,
            type: taskData.type || 'other',
            recurring: taskData.recurring || null,
            subtasks: taskData.subtasks || [],
            createdAt: new Date().toISOString(),
            completedAt: null,
            calendarDate: taskData.calendarDate || DataStore.today(),
        };
        const tasks = this.getAll();
        tasks.push(task);
        DataStore.set('tasks', tasks);
        return task;
    },

    /**
     * Update a task by ID.
     */
    update(taskId, updates) {
        const tasks = this.getAll();
        const idx = tasks.findIndex(t => t.id === taskId);
        if (idx === -1) return null;
        Object.assign(tasks[idx], updates);
        DataStore.set('tasks', tasks);
        return tasks[idx];
    },

    /**
     * Delete a task by ID.
     */
    delete(taskId) {
        const tasks = this.getAll();
        const filtered = tasks.filter(t => t.id !== taskId);
        DataStore.set('tasks', filtered);
        return filtered.length < tasks.length;
    },

    /**
     * Mark task as complete, award RP budget.
     */
    complete(taskId) {
        const tasks = this.getAll();
        const task = tasks.find(t => t.id === taskId);
        if (!task) return null;

        task.done = true;
        task.completedAt = new Date().toISOString();
        DataStore.set('tasks', tasks);

        // Award RP budget
        const rpBudget = DataStore.get('rpBudget') || { earned: 0, used: 0 };
        rpBudget.earned += (task.reward || 0);
        DataStore.set('rpBudget', rpBudget);

        return task;
    },

    /**
     * Complete a subtask.
     */
    completeSubtask(taskId, subtaskId) {
        const tasks = this.getAll();
        const task = tasks.find(t => t.id === taskId);
        if (!task || !task.subtasks) return null;

        const sub = task.subtasks.find(s => s.id === subtaskId);
        if (!sub) return null;

        sub.done = true;
        DataStore.set('tasks', tasks);

        // Award subtask reward
        if (sub.reward) {
            const rpBudget = DataStore.get('rpBudget') || { earned: 0, used: 0 };
            rpBudget.earned += sub.reward;
            DataStore.set('rpBudget', rpBudget);
        }

        // Check if all subtasks are done
        if (task.subtasks.every(s => s.done)) {
            task.done = true;
            task.completedAt = new Date().toISOString();
            DataStore.set('tasks', tasks);
        }

        return sub;
    },

    /**
     * Add a subtask to a task.
     */
    addSubtask(taskId, subtaskData) {
        const tasks = this.getAll();
        const task = tasks.find(t => t.id === taskId);
        if (!task) return null;

        if (!task.subtasks) task.subtasks = [];
        const subtask = {
            id: generateId(),
            text: subtaskData.text || '',
            done: false,
            reward: subtaskData.reward || 5,
        };
        task.subtasks.push(subtask);
        DataStore.set('tasks', tasks);
        return subtask;
    },

    /**
     * Split a task into subtasks (from AI).
     */
    splitIntoSubtasks(taskId, subtaskList) {
        const tasks = this.getAll();
        const task = tasks.find(t => t.id === taskId);
        if (!task) return null;

        task.subtasks = subtaskList.map(s => ({
            id: generateId(),
            text: s.text,
            done: false,
            reward: s.reward || 5,
        }));
        DataStore.set('tasks', tasks);
        return task;
    },

    /**
     * Get current active task (the one happening now based on time).
     */
    getCurrentTask() {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const todayTasks = this.getToday().filter(t => !t.done);

        for (const task of todayTasks) {
            if (task.timeStart && task.timeEnd) {
                if (currentTime >= task.timeStart && currentTime <= task.timeEnd) {
                    return task;
                }
            }
        }
        // Return next upcoming task if no current
        return todayTasks.find(t => t.timeStart && t.timeStart > currentTime) || todayTasks[0] || null;
    },

    /**
     * Get the next task after the current one.
     */
    getNextTask() {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const todayTasks = this.getToday().filter(t => !t.done && t.timeStart);
        const upcoming = todayTasks.filter(t => t.timeStart > currentTime);
        return upcoming[0] || null;
    },

    /**
     * Get today's progress stats.
     */
    getTodayProgress() {
        const todayTasks = this.getToday();
        const total = todayTasks.length;
        const done = todayTasks.filter(t => t.done).length;
        return { total, done, percentage: total > 0 ? Math.round((done / total) * 100) : 0 };
    },

    /**
     * Auto-populate recurring tasks for today if not already present.
     */
    populateRecurringForToday() {
        const today = DataStore.today();
        const allTasks = this.getAll();
        const date = new Date(today);
        const dayOfWeek = date.getDay();

        const recurringTemplates = allTasks.filter(t => t.recurring && !t.calendarDate);
        const todayExisting = allTasks.filter(t => t.calendarDate === today);

        for (const template of recurringTemplates) {
            const applies =
                template.recurring.type === 'daily' &&
                (!template.recurring.days || template.recurring.days.length === 0 || template.recurring.days.includes(dayOfWeek))
                ||
                template.recurring.type === 'weekly' && template.recurring.days?.includes(dayOfWeek);

            if (applies) {
                const alreadyExists = todayExisting.some(t => t.text === template.text && t.timeStart === template.timeStart);
                if (!alreadyExists) {
                    this.add({
                        text: template.text,
                        timeStart: template.timeStart,
                        timeEnd: template.timeEnd,
                        reward: template.reward,
                        type: template.type,
                        calendarDate: today,
                    });
                }
            }
        }
    },

    /**
     * Calculate time remaining for a task.
     */
    getTimeRemaining(task) {
        if (!task.timeEnd) return null;
        const now = new Date();
        const [h, m] = task.timeEnd.split(':').map(Number);
        const end = new Date();
        end.setHours(h, m, 0, 0);
        const diff = end - now;
        if (diff <= 0) return 0;
        return Math.ceil(diff / 60000); // minutes
    },
};

export { Tasks };
