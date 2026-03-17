/**
 * Focus Module - Tasting time + counting modes + input lock + extension tickets
 * Counting modes: time | messages | dual (first to trigger)
 * Empty reply skip, swipe dedup.
 */
import { DataStore } from './datastore.js';

let _timerInterval = null;
let _lastCountedMessageId = null;

const Focus = {
    init() {
        if (DataStore.isCompanion()) return;

        // Listen to ST events
        const ctx = this._getContext();
        if (!ctx) return;

        const { eventSource, event_types } = ctx;

        // Count messages on CHARACTER_MESSAGE_RENDERED
        eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (messageId) => {
            this._onMessageRendered(messageId);
        });

        // Reset on chat change
        eventSource.on(event_types.CHAT_CHANGED, () => {
            this._onChatChanged();
        });

        // Start timer if session is active
        const session = DataStore.get('focusSession');
        if (session?.active) {
            this._startTimer();
        }
    },

    _getContext() {
        try { return SillyTavern.getContext(); } catch { return null; }
    },

    /**
     * Start a new focus session (tasting time begins).
     */
    startSession() {
        const ctx = this._getContext();
        if (!ctx) return;

        DataStore.set('focusSession', {
            active: true,
            startTime: Date.now(),
            messageCount: 0,
            characterId: ctx.characterId,
        });

        this._startTimer();
        this._unlockInput();
    },

    /**
     * End the current focus session.
     */
    endSession() {
        DataStore.set('focusSession.active', false);
        this._stopTimer();
    },

    /**
     * Check if tasting time is exhausted.
     */
    isExhausted() {
        const session = DataStore.get('focusSession');
        if (!session?.active) return false;

        const settings = DataStore.get('settings') || {};
        const mode = settings.countingMode || 'dual';
        const timeLimit = (settings.tastingTime || 30) * 60 * 1000; // ms
        const msgLimit = settings.tastingMessages || 20;

        const elapsed = Date.now() - session.startTime;
        const timeUp = elapsed >= timeLimit;
        const msgsUp = session.messageCount >= msgLimit;

        if (mode === 'time') return timeUp;
        if (mode === 'messages') return msgsUp;
        return timeUp || msgsUp; // dual
    },

    /**
     * Get remaining time and messages.
     */
    getRemaining() {
        const session = DataStore.get('focusSession');
        if (!session?.active) return { time: 0, messages: 0, exhausted: false };

        const settings = DataStore.get('settings') || {};
        const timeLimit = (settings.tastingTime || 30) * 60 * 1000;
        const msgLimit = settings.tastingMessages || 20;

        const elapsed = Date.now() - session.startTime;
        const timeRemaining = Math.max(0, Math.ceil((timeLimit - elapsed) / 60000));
        const msgsRemaining = Math.max(0, msgLimit - (session.messageCount || 0));

        return {
            time: timeRemaining,
            messages: msgsRemaining,
            exhausted: this.isExhausted(),
            mode: settings.countingMode || 'dual',
        };
    },

    /**
     * Use an extension ticket to extend tasting time.
     */
    useTicket() {
        const tickets = DataStore.get('extensionTickets') || {};

        // Reset daily tickets if new day
        this._checkDailyReset();

        const available = (tickets.remaining || 0) + (tickets.bonus || 0);
        if (available <= 0) return false;

        const settings = DataStore.get('settings') || {};
        const session = DataStore.get('focusSession');
        if (!session?.active) return false;

        // Deduct ticket
        if (tickets.bonus > 0) {
            DataStore.set('extensionTickets.bonus', tickets.bonus - 1);
        } else {
            DataStore.set('extensionTickets.remaining', tickets.remaining - 1);
        }

        const mode = settings.countingMode || 'dual';

        // Extend time
        if (mode === 'time' || mode === 'dual') {
            const extraMs = (settings.extensionTicketMinutes || 5) * 60 * 1000;
            DataStore.set('focusSession.startTime', session.startTime + extraMs);
        }

        // Extend messages
        if (mode === 'messages' || mode === 'dual') {
            const extraMsgs = settings.extensionTicketMessages || 3;
            DataStore.set('focusSession.messageCount', Math.max(0, (session.messageCount || 0) - extraMsgs));
        }

        this._unlockInput();
        return true;
    },

    /**
     * Get available tickets count.
     */
    getTicketCount() {
        this._checkDailyReset();
        const tickets = DataStore.get('extensionTickets') || {};
        return (tickets.remaining || 0) + (tickets.bonus || 0);
    },

    /**
     * Award bonus ticket (from completing a task).
     */
    awardBonusTicket(count = 1) {
        const bonus = DataStore.get('extensionTickets.bonus') || 0;
        DataStore.set('extensionTickets.bonus', bonus + count);
    },

    /**
     * Handle message rendered - count if valid.
     */
    _onMessageRendered(messageId) {
        const session = DataStore.get('focusSession');
        if (!session?.active) return;

        // Avoid double counting swipes
        if (messageId === _lastCountedMessageId) return;

        // Check if message is from AI (character)
        const ctx = this._getContext();
        if (!ctx) return;

        const chat = ctx.chat;
        if (!chat || !chat[messageId]) return;

        const msg = chat[messageId];

        // Only count character messages
        if (msg.is_user) return;

        // Empty reply check: skip if < 10 chars
        const text = (msg.mes || '').trim();
        if (text.length < 10) return;

        _lastCountedMessageId = messageId;

        // Increment message count
        const count = (session.messageCount || 0) + 1;
        DataStore.set('focusSession.messageCount', count);

        // Check if exhausted after counting
        if (this.isExhausted()) {
            this._lockInput();
        }
    },

    _onChatChanged() {
        // Start new session when switching to a chat
        const session = DataStore.get('focusSession');
        if (!session?.active) {
            this.startSession();
        }
    },

    _startTimer() {
        this._stopTimer();
        _timerInterval = setInterval(() => {
            if (this.isExhausted()) {
                this._lockInput();
            }
        }, 5000); // Check every 5 seconds
    },

    _stopTimer() {
        if (_timerInterval) {
            clearInterval(_timerInterval);
            _timerInterval = null;
        }
    },

    _lockInput() {
        const sendArea = document.getElementById('send_textarea');
        const sendBtn = document.getElementById('send_but');
        if (sendArea) {
            sendArea.disabled = true;
            sendArea.placeholder = '品尝时间已结束~ 完成任务或使用延长券继续 RP';
            sendArea.classList.add('fg-input-locked');
        }
        if (sendBtn) {
            sendBtn.classList.add('fg-send-locked');
        }

        // Show lock overlay
        this._showLockOverlay();
    },

    _unlockInput() {
        const sendArea = document.getElementById('send_textarea');
        const sendBtn = document.getElementById('send_but');
        if (sendArea) {
            sendArea.disabled = false;
            sendArea.placeholder = '';
            sendArea.classList.remove('fg-input-locked');
        }
        if (sendBtn) {
            sendBtn.classList.remove('fg-send-locked');
        }

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
                ${tickets > 0 ? `
                    <button class="fg-btn fg-btn-primary fg-lock-ticket-btn">
                        使用延长券 (剩余 ${tickets} 张)
                    </button>
                ` : `
                    <div class="fg-lock-no-tickets">延长券用完了，完成任务可以获得更多哦~</div>
                `}
                <button class="fg-btn fg-btn-secondary fg-lock-companion-btn">打开陪伴页面</button>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.querySelector('.fg-lock-ticket-btn')?.addEventListener('click', () => {
            if (this.useTicket()) {
                this._hideLockOverlay();
            }
        });

        overlay.querySelector('.fg-lock-companion-btn')?.addEventListener('click', () => {
            window.open('/scripts/extensions/third-party/ST-FocusGuard/companion.html', '_blank');
        });
    },

    _hideLockOverlay() {
        const overlay = document.getElementById('fg-lock-overlay');
        if (overlay) overlay.remove();
    },

    _checkDailyReset() {
        const tickets = DataStore.get('extensionTickets') || {};
        const today = DataStore.today();
        if (tickets.lastResetDate !== today) {
            const daily = DataStore.get('settings.extensionTicketsDaily') || 3;
            DataStore.setMultiple({
                'extensionTickets.remaining': daily,
                'extensionTickets.lastResetDate': today,
            });
        }
    },
};

export { Focus };
