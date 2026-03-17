/**
 * DataStore - Unified data layer for FocusGuard
 * All data read/write goes through this module.
 * Handles: local extensionSettings, BroadcastChannel sync, GitHub sync (stub).
 */

const MODULE_NAME = 'focusguard';

const DEFAULT_DATA = {
    tasks: [],
    settings: {
        // Focus mode
        tastingTime: 30,           // minutes
        tastingMessages: 20,       // message count
        countingMode: 'dual',      // 'time' | 'messages' | 'dual'
        extensionTicketsDaily: 3,
        extensionTicketMinutes: 5,
        extensionTicketMessages: 3,
        // Overlay
        overlayFrequency: 'daily', // 'daily' | 'always' | 'off'
        lastOverlayDate: null,
        // Guardian
        guardianCharacterIds: [],
        guardianEnabled: true,
        // Toolbar
        toolbarVisible: true,
        toolbarOpacity: 0.85,
        toolbarSize: 1,
        toolbarPosition: 'top',
        toolbarShowTime: true,
        toolbarShowTask: true,
        toolbarShowCountdown: true,
        toolbarShowProgress: true,
        toolbarShowNextTask: true,
        // Notifications
        notificationsEnabled: true,
        // Theme
        currentTheme: 'flower-shop',
        // AI endpoint (companion page)
        aiEndpoint: '',
        aiApiKey: '',
        aiModel: 'gpt-4o-mini',
        aiPresets: [],
        // Letter to self
        letterToSelf: '',
    },
    streak: {
        current: 0,
        lastActiveDate: null,
        longestStreak: 0,
    },
    extensionTickets: {
        daily: 3,
        remaining: 3,
        bonus: 0,
        lastResetDate: null,
    },
    rpBudget: {
        earned: 0,
        used: 0,
    },
    focusSession: {
        active: false,
        startTime: null,
        messageCount: 0,
        characterId: null,
    },
    letterToSelf: '',
};

let _channel = null;
let _listeners = [];
let _isCompanion = false;

/**
 * Detect if we're running inside ST or in the companion page.
 */
function detectEnvironment() {
    try {
        _isCompanion = !window.SillyTavern;
    } catch {
        _isCompanion = true;
    }
}

/**
 * Initialize BroadcastChannel for cross-tab sync.
 */
function initChannel() {
    try {
        _channel = new BroadcastChannel('focusguard-sync');
        _channel.onmessage = (event) => {
            const { type, key, value, fullData } = event.data;
            if (type === 'update') {
                if (_isCompanion) {
                    // Companion page receives updates from ST
                    const stored = _getLocalStorage();
                    if (key) {
                        _setNestedValue(stored, key, value);
                    } else if (fullData) {
                        Object.assign(stored, fullData);
                    }
                    _setLocalStorage(stored);
                } else {
                    // ST receives updates from companion
                    const ctx = _getSTContext();
                    if (ctx) {
                        if (key) {
                            _setNestedValue(ctx.extension_settings[MODULE_NAME], key, value);
                        } else if (fullData) {
                            Object.assign(ctx.extension_settings[MODULE_NAME], fullData);
                        }
                        _saveSTSettings();
                    }
                }
                _notifyListeners(key || 'full', value || fullData);
            } else if (type === 'request-sync') {
                // Other tab requests full data
                _channel.postMessage({ type: 'update', fullData: DataStore.getAll() });
            }
        };
    } catch (e) {
        console.warn('[FocusGuard] BroadcastChannel not available:', e);
    }
}

function _getSTContext() {
    try {
        return SillyTavern.getContext();
    } catch {
        return null;
    }
}

function _saveSTSettings() {
    try {
        const ctx = _getSTContext();
        if (ctx && ctx.saveSettingsDebounced) {
            ctx.saveSettingsDebounced();
        }
    } catch (e) {
        console.warn('[FocusGuard] Failed to save ST settings:', e);
    }
}

// Companion page fallback: localStorage
const LS_KEY = 'focusguard-data';

function _getLocalStorage() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? JSON.parse(raw) : structuredClone(DEFAULT_DATA);
    } catch {
        return structuredClone(DEFAULT_DATA);
    }
}

function _setLocalStorage(data) {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('[FocusGuard] localStorage write failed:', e);
    }
}

function _setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        if (current[keys[i]] === undefined) {
            current[keys[i]] = {};
        }
        current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
}

function _getNestedValue(obj, path) {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
        if (current === undefined || current === null) return undefined;
        current = current[key];
    }
    return current;
}

function _notifyListeners(key, value) {
    for (const listener of _listeners) {
        try {
            listener(key, value);
        } catch (e) {
            console.warn('[FocusGuard] Listener error:', e);
        }
    }
}

/**
 * Public DataStore API
 */
const DataStore = {
    /**
     * Initialize the data store.
     */
    init() {
        detectEnvironment();
        initChannel();

        if (!_isCompanion) {
            // Inside ST: ensure extension_settings has our data
            const ctx = _getSTContext();
            if (ctx) {
                if (!ctx.extension_settings[MODULE_NAME]) {
                    ctx.extension_settings[MODULE_NAME] = structuredClone(DEFAULT_DATA);
                    _saveSTSettings();
                } else {
                    // Merge any missing defaults
                    const data = ctx.extension_settings[MODULE_NAME];
                    _mergeDefaults(data, DEFAULT_DATA);
                    _saveSTSettings();
                }
            }
        } else {
            // Companion page: init localStorage if empty, then request sync
            const data = _getLocalStorage();
            _mergeDefaults(data, DEFAULT_DATA);
            _setLocalStorage(data);
            // Request latest data from ST tab
            if (_channel) {
                _channel.postMessage({ type: 'request-sync' });
            }
        }
    },

    /**
     * Get all data.
     */
    getAll() {
        if (!_isCompanion) {
            const ctx = _getSTContext();
            return ctx?.extension_settings?.[MODULE_NAME] || structuredClone(DEFAULT_DATA);
        }
        return _getLocalStorage();
    },

    /**
     * Get a value by dot-notation path.
     */
    get(path) {
        const all = this.getAll();
        return _getNestedValue(all, path);
    },

    /**
     * Set a value by dot-notation path. Broadcasts to other tabs.
     */
    set(path, value) {
        if (!_isCompanion) {
            const ctx = _getSTContext();
            if (ctx) {
                _setNestedValue(ctx.extension_settings[MODULE_NAME], path, value);
                _saveSTSettings();
            }
        } else {
            const data = _getLocalStorage();
            _setNestedValue(data, path, value);
            _setLocalStorage(data);
        }

        // Broadcast to other tabs
        if (_channel) {
            _channel.postMessage({ type: 'update', key: path, value });
        }

        _notifyListeners(path, value);
    },

    /**
     * Update multiple paths at once.
     */
    setMultiple(updates) {
        const all = this.getAll();
        for (const [path, value] of Object.entries(updates)) {
            _setNestedValue(all, path, value);
        }

        if (!_isCompanion) {
            const ctx = _getSTContext();
            if (ctx) {
                ctx.extension_settings[MODULE_NAME] = all;
                _saveSTSettings();
            }
        } else {
            _setLocalStorage(all);
        }

        if (_channel) {
            _channel.postMessage({ type: 'update', fullData: all });
        }

        _notifyListeners('full', all);
    },

    /**
     * Subscribe to data changes.
     */
    onChange(callback) {
        _listeners.push(callback);
        return () => {
            _listeners = _listeners.filter(l => l !== callback);
        };
    },

    /**
     * Get tasks for a specific date.
     */
    getTasksForDate(dateStr) {
        const tasks = this.get('tasks') || [];
        return tasks.filter(t => t.calendarDate === dateStr);
    },

    /**
     * Get today's date string.
     */
    today() {
        return new Date().toISOString().split('T')[0];
    },

    /**
     * Check if running in companion page.
     */
    isCompanion() {
        return _isCompanion;
    },

    /**
     * Export all data as JSON string.
     */
    exportData() {
        return JSON.stringify(this.getAll(), null, 2);
    },

    /**
     * Import data from JSON string.
     */
    importData(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            _mergeDefaults(data, DEFAULT_DATA);
            if (!_isCompanion) {
                const ctx = _getSTContext();
                if (ctx) {
                    ctx.extension_settings[MODULE_NAME] = data;
                    _saveSTSettings();
                }
            } else {
                _setLocalStorage(data);
            }
            if (_channel) {
                _channel.postMessage({ type: 'update', fullData: data });
            }
            _notifyListeners('full', data);
            return true;
        } catch (e) {
            console.error('[FocusGuard] Import failed:', e);
            return false;
        }
    },

    // ---- GitHub Sync Stub (Box 2) ----
    async githubPush() {
        console.log('[FocusGuard] GitHub push - not yet implemented');
    },
    async githubPull() {
        console.log('[FocusGuard] GitHub pull - not yet implemented');
    },
};

function _mergeDefaults(target, defaults) {
    for (const key of Object.keys(defaults)) {
        if (target[key] === undefined) {
            target[key] = structuredClone(defaults[key]);
        } else if (
            typeof defaults[key] === 'object' &&
            defaults[key] !== null &&
            !Array.isArray(defaults[key])
        ) {
            _mergeDefaults(target[key], defaults[key]);
        }
    }
}

export { DataStore, MODULE_NAME, DEFAULT_DATA };
