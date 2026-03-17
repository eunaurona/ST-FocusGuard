/**
 * AI Ball Module - Floating AI companion with chat and task operations
 * Uses user-configured OpenAI-compatible API on companion page,
 * or ST's generateRaw inside ST.
 */
import { DataStore } from './datastore.js';
import { Tasks } from './tasks.js';

let _ballEl = null;
let _chatOpen = false;
let _chatHistory = [];
let _systemPrompt = '';
let _isDragging = false;
let _dragOffset = { x: 0, y: 0 };

const AIBall = {
    async init(container = document.body) {
        // Load system prompt
        await this._loadSystemPrompt();
        this.create(container);
    },

    async _loadSystemPrompt() {
        try {
            const resp = await fetch('/scripts/extensions/third-party/ST-FocusGuard/prompts/ai-ball-system.txt');
            if (resp.ok) {
                _systemPrompt = await resp.text();
            }
        } catch {
            _systemPrompt = 'You are a helpful AI assistant for task management. Respond in JSON with action, params, and message fields.';
        }
    },

    create(container) {
        if (_ballEl) _ballEl.remove();

        _ballEl = document.createElement('div');
        _ballEl.id = 'fg-ai-ball';
        _ballEl.className = 'fg-ai-ball';
        _ballEl.innerHTML = `
            <div class="fg-ai-ball-icon" title="AI 小球">
                <span>✦</span>
            </div>
            <div class="fg-ai-chat fg-ai-chat--hidden">
                <div class="fg-ai-chat-header">
                    <span>AI 助手</span>
                    <button class="fg-ai-chat-close">&times;</button>
                </div>
                <div class="fg-ai-chat-messages"></div>
                <div class="fg-ai-chat-input-area">
                    <input type="text" class="fg-ai-chat-input" placeholder="说点什么..." />
                    <button class="fg-ai-chat-send">→</button>
                </div>
            </div>
        `;

        container.appendChild(_ballEl);

        // Toggle chat
        _ballEl.querySelector('.fg-ai-ball-icon').addEventListener('click', (e) => {
            if (_isDragging) return;
            this.toggleChat();
        });

        // Close chat
        _ballEl.querySelector('.fg-ai-chat-close').addEventListener('click', () => {
            this.toggleChat(false);
        });

        // Send message
        const input = _ballEl.querySelector('.fg-ai-chat-input');
        const sendBtn = _ballEl.querySelector('.fg-ai-chat-send');

        sendBtn.addEventListener('click', () => this._sendMessage(input));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this._sendMessage(input);
            }
        });

        // Draggable
        this._setupDrag();
    },

    toggleChat(open = null) {
        const chat = _ballEl?.querySelector('.fg-ai-chat');
        if (!chat) return;

        _chatOpen = open !== null ? open : !_chatOpen;
        chat.classList.toggle('fg-ai-chat--hidden', !_chatOpen);

        if (_chatOpen) {
            _ballEl.querySelector('.fg-ai-chat-input')?.focus();
        }
    },

    async _sendMessage(input) {
        const text = input.value.trim();
        if (!text) return;
        input.value = '';

        // Show user message
        this._appendMessage('user', text);

        // Show typing indicator
        this._appendMessage('assistant', '思考中...');

        try {
            const response = await this._callAI(text);
            // Remove typing indicator
            this._removeLastMessage();
            // Process response
            this._processResponse(response);
        } catch (e) {
            this._removeLastMessage();
            this._appendMessage('assistant', `抱歉，出了点问题: ${e.message}`);
        }
    },

    async _callAI(userMessage) {
        // Build context with current tasks
        const today = DataStore.today();
        const todayTasks = Tasks.getToday();
        const progress = Tasks.getTodayProgress();

        const contextMessage = `当前日期: ${today}
当前任务列表:
${todayTasks.map(t => `- [${t.done ? 'x' : ' '}] ${t.text} (${t.timeStart || '?'}-${t.timeEnd || '?'}) 奖励:${t.reward}min ID:${t.id}`).join('\n') || '(无任务)'}
今日进度: ${progress.done}/${progress.total}
用户消息: ${userMessage}`;

        _chatHistory.push({ role: 'user', content: contextMessage });

        // Keep history manageable
        if (_chatHistory.length > 20) {
            _chatHistory = _chatHistory.slice(-16);
        }

        const messages = [
            { role: 'system', content: _systemPrompt },
            ..._chatHistory,
        ];

        const isCompanion = DataStore.isCompanion();

        if (isCompanion) {
            // Use user-configured API
            return await this._callExternalAPI(messages);
        } else {
            // Try ST's generateRaw first, fall back to external API
            try {
                return await this._callSTAPI(messages);
            } catch {
                return await this._callExternalAPI(messages);
            }
        }
    },

    async _callExternalAPI(messages) {
        const endpoint = DataStore.get('settings.aiEndpoint');
        const apiKey = DataStore.get('settings.aiApiKey');
        const model = DataStore.get('settings.aiModel') || 'gpt-4o-mini';

        if (!endpoint || !apiKey) {
            throw new Error('请先在设置中配置 AI 端口（API 端点和密钥）');
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages,
                response_format: { type: 'json_object' },
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            throw new Error(`API 请求失败: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error('AI 返回为空');

        _chatHistory.push({ role: 'assistant', content });
        return JSON.parse(content);
    },

    async _callSTAPI(messages) {
        const ctx = SillyTavern.getContext();
        if (!ctx?.generateRaw) throw new Error('ST API not available');

        const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n\n');
        const result = await ctx.generateRaw({
            prompt,
            jsonSchema: {
                name: 'AIBallResponse',
                strict: true,
                value: {
                    type: 'object',
                    properties: {
                        action: { type: 'string' },
                        params: { type: 'object' },
                        message: { type: 'string' },
                    },
                    required: ['action', 'message'],
                },
            },
        });

        const parsed = typeof result === 'string' ? JSON.parse(result) : result;
        _chatHistory.push({ role: 'assistant', content: JSON.stringify(parsed) });
        return parsed;
    },

    _processResponse(response) {
        const { action, params, message } = response;

        // Show assistant message
        this._appendMessage('assistant', message || '好的~');

        // Execute action
        if (action && action !== 'chat') {
            this._executeAction(action, params || {});
        }
    },

    _executeAction(action, params) {
        switch (action) {
            case 'add_task':
                Tasks.add(params);
                break;
            case 'edit_task':
                if (params.taskId) {
                    const { taskId, ...updates } = params;
                    Tasks.update(taskId, updates);
                }
                break;
            case 'delete_task':
                if (params.taskId) Tasks.delete(params.taskId);
                break;
            case 'complete_task':
                if (params.taskId) Tasks.complete(params.taskId);
                break;
            case 'add_subtask':
                if (params.taskId) Tasks.addSubtask(params.taskId, params);
                break;
            case 'split_task':
                if (params.taskId && params.subtasks) {
                    Tasks.splitIntoSubtasks(params.taskId, params.subtasks);
                }
                break;
            case 'reschedule':
                if (params.taskId) {
                    const { taskId, ...updates } = params;
                    Tasks.update(taskId, updates);
                }
                break;
            case 'update_setting':
                if (params.key) {
                    DataStore.set(`settings.${params.key}`, params.value);
                }
                break;
            case 'plan_day':
                if (params.tasks) {
                    for (const t of params.tasks) {
                        Tasks.add({ ...t, calendarDate: DataStore.today() });
                    }
                }
                break;
            default:
                console.log('[FocusGuard] Unknown AI action:', action);
        }

        // Notify listeners to refresh UI
        DataStore.set('_lastAIAction', Date.now());
    },

    _appendMessage(role, text) {
        const container = _ballEl?.querySelector('.fg-ai-chat-messages');
        if (!container) return;

        const msg = document.createElement('div');
        msg.className = `fg-ai-msg fg-ai-msg-${role}`;
        msg.textContent = text;
        container.appendChild(msg);
        container.scrollTop = container.scrollHeight;
    },

    _removeLastMessage() {
        const container = _ballEl?.querySelector('.fg-ai-chat-messages');
        if (!container) return;
        const last = container.lastElementChild;
        if (last) last.remove();
    },

    _setupDrag() {
        const icon = _ballEl?.querySelector('.fg-ai-ball-icon');
        if (!icon) return;

        let startX, startY;

        icon.addEventListener('mousedown', (e) => {
            startX = e.clientX;
            startY = e.clientY;
            _dragOffset.x = _ballEl.offsetLeft;
            _dragOffset.y = _ballEl.offsetTop;
            _isDragging = false;

            const onMove = (e2) => {
                const dx = e2.clientX - startX;
                const dy = e2.clientY - startY;
                if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                    _isDragging = true;
                    _ballEl.style.right = 'auto';
                    _ballEl.style.bottom = 'auto';
                    _ballEl.style.left = `${_dragOffset.x + dx}px`;
                    _ballEl.style.top = `${_dragOffset.y + dy}px`;
                }
            };

            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                setTimeout(() => { _isDragging = false; }, 100);
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        // Touch support
        icon.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            _dragOffset.x = _ballEl.offsetLeft;
            _dragOffset.y = _ballEl.offsetTop;
            _isDragging = false;

            const onMove = (e2) => {
                const t = e2.touches[0];
                const dx = t.clientX - startX;
                const dy = t.clientY - startY;
                if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                    _isDragging = true;
                    _ballEl.style.right = 'auto';
                    _ballEl.style.bottom = 'auto';
                    _ballEl.style.left = `${_dragOffset.x + dx}px`;
                    _ballEl.style.top = `${_dragOffset.y + dy}px`;
                }
            };

            const onEnd = () => {
                document.removeEventListener('touchmove', onMove);
                document.removeEventListener('touchend', onEnd);
                setTimeout(() => { _isDragging = false; }, 100);
            };

            document.addEventListener('touchmove', onMove, { passive: true });
            document.addEventListener('touchend', onEnd);
        }, { passive: true });
    },

    destroy() {
        if (_ballEl) _ballEl.remove();
        _ballEl = null;
        _chatHistory = [];
    },
};

export { AIBall };
