/**
 * Streak Module - Consecutive usage tracking + letter to self
 */
import { DataStore } from './datastore.js';

const Streak = {
    init() {
        this.checkStreak();
    },

    /**
     * Check and update streak on app load.
     */
    checkStreak() {
        const streak = DataStore.get('streak') || { current: 0, lastActiveDate: null, longestStreak: 0 };
        const today = DataStore.today();

        if (streak.lastActiveDate === today) return; // Already counted today

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (streak.lastActiveDate === yesterdayStr) {
            // Consecutive day
            streak.current += 1;
        } else if (streak.lastActiveDate) {
            // Streak broken
            streak.current = 1;
        } else {
            // First use
            streak.current = 1;
        }

        if (streak.current > streak.longestStreak) {
            streak.longestStreak = streak.current;
        }

        streak.lastActiveDate = today;
        DataStore.set('streak', streak);
    },

    /**
     * Get current streak info.
     */
    getStreak() {
        return DataStore.get('streak') || { current: 0, lastActiveDate: null, longestStreak: 0 };
    },

    /**
     * Reset streak (when extension is disabled).
     */
    resetStreak() {
        const streak = DataStore.get('streak') || {};
        streak.current = 0;
        DataStore.set('streak', streak);
    },

    /**
     * Check if streak was just broken and show letter.
     */
    checkStreakBroken() {
        const streak = this.getStreak();
        const today = DataStore.today();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        // If last active was more than 1 day ago, streak was broken
        if (streak.lastActiveDate && streak.lastActiveDate !== today && streak.lastActiveDate !== yesterdayStr) {
            return true;
        }
        return false;
    },

    /**
     * Get letter to self.
     */
    getLetter() {
        return DataStore.get('letterToSelf') || DataStore.get('settings.letterToSelf') || '';
    },

    /**
     * Set letter to self.
     */
    setLetter(text) {
        DataStore.set('letterToSelf', text);
        DataStore.set('settings.letterToSelf', text);
    },

    /**
     * Show letter popup (in ST).
     */
    showLetterPopup() {
        const letter = this.getLetter();
        if (!letter) return;

        const popup = document.createElement('div');
        popup.className = 'fg-letter-popup';
        popup.innerHTML = `
            <div class="fg-letter-backdrop"></div>
            <div class="fg-letter-content">
                <div class="fg-letter-title">给自己的一封信</div>
                <div class="fg-letter-body">${this._escapeHtml(letter)}</div>
                <button class="fg-btn fg-btn-primary fg-letter-close">我记住了</button>
            </div>
        `;

        document.body.appendChild(popup);

        popup.querySelector('.fg-letter-close')?.addEventListener('click', () => {
            popup.classList.add('fg-letter-popup--hiding');
            setTimeout(() => popup.remove(), 300);
        });
        popup.querySelector('.fg-letter-backdrop')?.addEventListener('click', () => {
            popup.classList.add('fg-letter-popup--hiding');
            setTimeout(() => popup.remove(), 300);
        });
    },

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
};

export { Streak };
