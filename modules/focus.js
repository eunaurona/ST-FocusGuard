/**
 * Focus Module - Tasting time + counting modes + input lock + extension tickets
 */
(function () {
    const FG = window.FocusGuard = window.FocusGuard || {};

    let _timerInterval = null;
    let _lastCountedMessageId = null;

    function _getContext() {
        try { return SillyTavern.getContext(); } catch { return null; }
    }

    const Focus = {
        init() {
            if (FG.DataStore.isCompanion()) return;
            const ctx = _getContext();
            if (!ctx) return;
            const { eventSource, event_types } = ctx;
            eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (messageId) => this._onMessageRendered(messageId));
            eventSource.on(event_types.CHAT_CHANGED, () => this._onChatChanged());
            const session = FG.DataStore.get('focusSession');
            if (session?.active) this._startTimer();
        },

        startSession() {
            const ctx = _getContext();
            if (!ctx) return;
            FG.DataStore.set('focusSession', { active: true, startTime: Date.now(), messageCount: 0, characterId: ctx.characterId });
            this._startTimer();
            this._unlockInput();
        },

        endSession() {
            FG.DataStore.set('focusSession.active', false);
            this._stopTimer();
            this._unlockInput();
        },

        isExhausted() {
            const session = FG.DataStore.get('focusSession');
            if (!session?.active) return false;
            const settings = FG.DataStore.get('settings') || {};
            const mode = settings.countingMode || 'dual';
            const timeUp = (Date.now() - session.startTime) >= (settings.tastingTime || 30) * 60000;
            const msgsUp = (session.messageCount || 0) >= (settings.tastingMessages || 20);
            if (mode === 'time') return timeUp;
            if (mode === 'messages') return msgsUp;
            return timeUp || msgsUp;
        },

        getRemaining() {
            const session = FG.DataStore.get('focusSession');
            if (!session?.active) return { time: 0, messages: 0, exhausted: false };
            const settings = FG.DataStore.get('settings') || {};
            const timeLimit = (settings.tastingTime || 30) * 60000;
            const msgLimit = settings.tastingMessages || 20;
            return {
                time: Math.max(0, Math.ceil((timeLimit - (Date.now() - session.startTime)) / 60000)),
                messages: Math.max(0, msgLimit - (session.messageCount || 0)),
                exhausted: this.isExhausted(),
                mode: settings.countingMode || 'dual',
            };
        },

        useTicket() {
            this._checkDailyReset();
            const tickets = FG.DataStore.get('extensionTickets') || {};
            const available = (tickets.remaining || 0) + (tickets.bonus || 0);
            if (available <= 0) return false;
            const settings = FG.DataStore.get('settings') || {};
            const session = FG.DataStore.get('focusSession');
            if (!session?.active) return false;
            if (tickets.bonus > 0) FG.DataStore.set('extensionTickets.bonus', tickets.bonus - 1);
            else FG.DataStore.set('extensionTickets.remaining', tickets.remaining - 1);
            const mode = settings.countingMode || 'dual';
            if (mode !== 'messages') FG.DataStore.set('focusSession.startTime', session.startTime + (settings.extensionTicketMinutes || 5) * 60000);
            if (mode !== 'time') FG.DataStore.set('focusSession.messageCount', Math.max(0, (session.messageCount || 0) - (settings.extensionTicketMessages || 3)));
            this._unlockInput();
            return true;
        },

        getTicketCount() {
            this._checkDailyReset();
            const tickets = FG.DataStore.get('extensionTickets') || {};
            return (tickets.remaining || 0) + (tickets.bonus || 0);
        },

        awardBonusTicket(count = 1) {
            const bonus = FG.DataStore.get('extensionTickets.bonus') || 0;
            FG.DataStore.set('extensionTickets.bonus', bonus + count);
        },

        _onMessageRendered(messageId) {
            const session = FG.DataStore.get('focusSession');
            if (!session?.active) return;
            if (messageId === _lastCountedMessageId) return;
            const ctx = _getContext();
            if (!ctx?.chat?.[messageId]) return;
            const msg = ctx.chat[messageId];
            if (msg.is_user) return;
            if ((msg.mes || '').trim().length < 10) return;
            _lastCountedMessageId = messageId;
            FG.DataStore.set('focusSession.messageCount', (session.messageCount || 0) + 1);
            if (this.isExhausted()) this._lockInput();
        },

        _onChatChanged() {
            const session = FG.DataStore.get('focusSession');
            if (!session?.active) this.startSession();
        },

        _startTimer() {
            this._stopTimer();
            _timerInterval = setInterval(() => { if (this.isExhausted()) this._lockInput(); }, 5000);
        },

        _stopTimer() { if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; } },

        _lockInput() {
            const sendArea = document.getElementById('send_textarea');
            const sendBtn = document.getElementById('send_but');
            if (sendArea) { sendArea.disabled = true; sendArea.placeholder = '品尝时间已结束~ 完成任务或使用延长券继续 RP'; sendArea.classList.add('fg-input-locked'); }
            if (sendBtn) sendBtn.classList.add('fg-send-locked');
            this._showLockOverlay();
        },

        _unlockInput() {
            const sendArea = document.getElementById('send_textarea');
            const sendBtn = document.getElementById('send_but');
            if (sendArea) { sendArea.disabled = false; sendArea.placeholder = ''; sendArea.classList.remove('fg-input-locked'); }
            if (sendBtn) sendBtn.classList.remove('fg-send-locked');
            this._hideLockOverlay();
        },

        _showLockOverlay() {
            let overlay = document.getElementById('fg-lock-overlay');
            if (overlay) return;
            overlay = document.createElement('div');
            overlay.id = 'fg-lock-overlay';
            overlay.className = 'fg-lock-overlay';
            const tickets = this.getTicketCount();
            overlay.innerHTML = `
                <div class="fg-lock-content">
                    <div class="fg-lock-title">品尝时间结束啦~</div>
                    <div class="fg-lock-subtitle">去做点任务再回来玩吧！</div>
                    ${tickets > 0
                        ? `<button class="fg-btn fg-btn-primary fg-lock-ticket-btn">使用延长券 (剩余 ${tickets} 张)</button>`
                        : `<div class="fg-lock-no-tickets">延长券用完了，完成任务可以获得更多哦~</div>`}
                    <button class="fg-btn fg-btn-secondary fg-lock-companion-btn">打开陪伴页面</button>
                </div>`;
            document.body.appendChild(overlay);
            overlay.querySelector('.fg-lock-ticket-btn')?.addEventListener('click', () => { if (this.useTicket()) this._hideLockOverlay(); });
            overlay.querySelector('.fg-lock-companion-btn')?.addEventListener('click', () => {
                window.open('/scripts/extensions/third-party/ST-FocusGuard/companion.html', '_blank');
            });
            if (FG.Guardian) FG.Guardian.showPopup('timeout');
        },

        _hideLockOverlay() {
            const overlay = document.getElementById('fg-lock-overlay');
            if (overlay) overlay.remove();
        },

        _checkDailyReset() {
            const tickets = FG.DataStore.get('extensionTickets') || {};
            const today = FG.DataStore.today();
            if (tickets.lastResetDate !== today) {
                FG.DataStore.setMultiple({
                    'extensionTickets.remaining': FG.DataStore.get('settings.extensionTicketsDaily') || 3,
                    'extensionTickets.lastResetDate': today,
                });
            }
        },
    };

    FG.Focus = Focus;
})();
