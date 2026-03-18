/**
 * Streak Module - Consecutive usage tracking + letter to self
 */
(function () {
    const FG = window.FocusGuard = window.FocusGuard || {};

    function _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    const Streak = {
        init() { this.checkStreak(); },

        checkStreak() {
            const streak = FG.DataStore.get('streak') || { current: 0, lastActiveDate: null, longestStreak: 0 };
            const today = FG.DataStore.today();
            if (streak.lastActiveDate === today) return;
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            if (streak.lastActiveDate === yesterdayStr) streak.current += 1;
            else streak.current = 1;
            if (streak.current > (streak.longestStreak || 0)) streak.longestStreak = streak.current;
            streak.lastActiveDate = today;
            FG.DataStore.set('streak', streak);
        },

        getStreak() { return FG.DataStore.get('streak') || { current: 0, lastActiveDate: null, longestStreak: 0 }; },

        resetStreak() {
            const streak = FG.DataStore.get('streak') || {};
            streak.current = 0;
            FG.DataStore.set('streak', streak);
        },

        checkStreakBroken() {
            const streak = this.getStreak();
            const today = FG.DataStore.today();
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            return streak.lastActiveDate && streak.lastActiveDate !== today && streak.lastActiveDate !== yesterdayStr;
        },

        getLetter() { return FG.DataStore.get('letterToSelf') || FG.DataStore.get('settings.letterToSelf') || ''; },

        setLetter(text) {
            FG.DataStore.set('letterToSelf', text);
            FG.DataStore.set('settings.letterToSelf', text);
        },

        showLetterPopup() {
            const letter = this.getLetter();
            if (!letter) return;
            const popup = document.createElement('div');
            popup.className = 'fg-letter-popup';
            popup.innerHTML = `
                <div class="fg-letter-backdrop"></div>
                <div class="fg-letter-content">
                    <div class="fg-letter-title">给自己的一封信</div>
                    <div class="fg-letter-body">${_escapeHtml(letter)}</div>
                    <button class="fg-btn fg-btn-primary fg-letter-close">我记住了</button>
                </div>`;
            document.body.appendChild(popup);
            const dismiss = () => { popup.classList.add('fg-letter-popup--hiding'); setTimeout(() => popup.remove(), 300); };
            popup.querySelector('.fg-letter-close')?.addEventListener('click', dismiss);
            popup.querySelector('.fg-letter-backdrop')?.addEventListener('click', dismiss);
        },
    };

    FG.Streak = Streak;
})();
