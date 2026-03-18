/**
 * Guardian Module - Character-based encouragement popups
 */
(function () {
    const FG = window.FocusGuard = window.FocusGuard || {};

    let _popupEl = null;

    function _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function _getContext() {
        try { return SillyTavern.getContext(); } catch { return null; }
    }

    const Guardian = {
        init() {},

        getAvailableCharacters() {
            const ctx = _getContext();
            if (!ctx) return [];
            const { characters, characterId } = ctx;
            if (!characters) return [];
            const selectedIds = FG.DataStore.get('settings.guardianCharacterIds') || [];
            return characters
                .map((char, idx) => ({ id: idx, name: char.name, avatar: char.avatar, selected: selectedIds.includes(idx) }))
                .filter(c => c.id !== characterId);
        },

        pickRandomGuardian() {
            const ctx = _getContext();
            if (!ctx) return { name: '小精灵', avatar: null, isDefault: true };
            const { characters, characterId } = ctx;
            const selectedIds = (FG.DataStore.get('settings.guardianCharacterIds') || []).filter(id => id !== characterId);
            if (selectedIds.length === 0) return { name: '小精灵', avatar: null, isDefault: true };
            const randomId = selectedIds[Math.floor(Math.random() * selectedIds.length)];
            const char = characters[randomId];
            if (!char) return { name: '小精灵', avatar: null, isDefault: true };
            return { name: char.name, avatar: char.avatar, id: randomId, isDefault: false };
        },

        async generateGreeting(occasion) {
            const ctx = _getContext();
            if (!ctx?.generateQuietPrompt) return this._getDefaultGreeting(occasion);
            const guardian = this.pickRandomGuardian();
            const prompts = {
                morning: `你是"${guardian.name}"，一个温暖的守护者角色。用你的性格特点说一句早安问候，鼓励用户开始新的一天。保持1-2句话，温暖但不啰嗦。`,
                timeout: `你是"${guardian.name}"，一个温暖的守护者角色。RP品尝时间到了，温柔地提醒用户去完成任务。不要让用户觉得被管束，而是像朋友一样提醒。1-2句话。`,
                taskDue: `你是"${guardian.name}"，一个温暖的守护者角色。用户有一个任务快到时间了，温柔地提醒他们。1-2句话。`,
                complete: `你是"${guardian.name}"，一个温暖的守护者角色。用户刚完成了一个任务！热情地表扬他们，让他们感到被认可。1-2句话。`,
                welcome: `你是"${guardian.name}"，一个温暖的守护者角色。用户完成任务回来继续RP了，欢迎他们回来。1-2句话。`,
                general: `你是"${guardian.name}"，一个温暖的守护者角色。说一句温暖的话鼓励用户。1-2句话。`,
            };
            try {
                const result = await ctx.generateQuietPrompt({ quietPrompt: prompts[occasion] || prompts.general });
                return result || this._getDefaultGreeting(occasion);
            } catch (e) {
                console.warn('[FocusGuard] AI greeting failed:', e);
                return this._getDefaultGreeting(occasion);
            }
        },

        _getDefaultGreeting(occasion) {
            const defaults = {
                morning: '早安！新的一天，一起加油吧~',
                timeout: '玩得开心吗？休息一下去做点任务吧~',
                taskDue: '叮~ 有任务快到时间了哦！',
                complete: '太棒了！任务完成！',
                welcome: '欢迎回来！现在可以继续RP啦~',
                general: '你今天已经很棒了~',
            };
            return defaults[occasion] || defaults.general;
        },

        async showPopup(occasion, customMessage) {
            if (_popupEl) _popupEl.remove();
            const guardian = this.pickRandomGuardian();
            const message = customMessage || await this.generateGreeting(occasion);
            _popupEl = document.createElement('div');
            _popupEl.className = 'fg-guardian-popup';
            _popupEl.innerHTML = `
                <div class="fg-guardian-popup-inner">
                    <div class="fg-guardian-avatar">
                        ${guardian.avatar
                            ? `<img src="/characters/${encodeURIComponent(guardian.avatar)}" alt="${_escapeHtml(guardian.name)}" />`
                            : `<div class="fg-guardian-avatar-default">✨</div>`}
                    </div>
                    <div class="fg-guardian-bubble">
                        <div class="fg-guardian-name">${_escapeHtml(guardian.name)}</div>
                        <div class="fg-guardian-message">${_escapeHtml(message)}</div>
                    </div>
                    <button class="fg-guardian-close">&times;</button>
                </div>`;
            document.body.appendChild(_popupEl);
            const autoDismiss = setTimeout(() => this.hidePopup(), 8000);
            _popupEl.querySelector('.fg-guardian-close')?.addEventListener('click', () => {
                clearTimeout(autoDismiss);
                this.hidePopup();
            });
            requestAnimationFrame(() => _popupEl.classList.add('fg-guardian-popup--show'));
        },

        hidePopup() {
            if (_popupEl) {
                _popupEl.classList.remove('fg-guardian-popup--show');
                _popupEl.classList.add('fg-guardian-popup--hide');
                setTimeout(() => { _popupEl?.remove(); _popupEl = null; }, 300);
            }
        },
    };

    FG.Guardian = Guardian;
})();
