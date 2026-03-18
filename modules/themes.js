/**
 * Themes Module - Theme switching + CSS variable system + user CSS upload
 */
(function () {
    const FG = window.FocusGuard = window.FocusGuard || {};

    const BUILT_IN_THEMES = {
        'flower-shop': {
            name: '花店橱窗',
            vars: {
                '--fg-bg': '#f4f0f0', '--fg-color-1': '200,175,170', '--fg-color-2': '170,190,175',
                '--fg-color-3': '185,178,200', '--fg-color-4': '200,190,170',
                '--fg-glass-1': 'rgba(200,175,170,0.3)', '--fg-glass-2': 'rgba(170,190,175,0.35)',
                '--fg-glass-3': 'rgba(185,178,200,0.32)', '--fg-glass-4': 'rgba(200,190,170,0.32)',
                '--fg-text': '#5c5254', '--fg-text-secondary': '#8a7e7a',
                '--fg-border': 'rgba(255,255,255,0.55)', '--fg-accent': '#c8afaa',
                '--fg-success': '#aabeaf', '--fg-warning': '#d4b896', '--fg-danger': '#c89a9a',
            },
        },
        'coastal-dusk': {
            name: '海边黄昏',
            vars: {
                '--fg-bg': '#f0f1f3', '--fg-color-1': '165,185,200', '--fg-color-2': '210,185,175',
                '--fg-color-3': '178,170,195', '--fg-color-4': '195,200,190',
                '--fg-glass-1': 'rgba(165,185,200,0.3)', '--fg-glass-2': 'rgba(210,185,175,0.35)',
                '--fg-glass-3': 'rgba(178,170,195,0.32)', '--fg-glass-4': 'rgba(195,200,190,0.32)',
                '--fg-text': '#48505a', '--fg-text-secondary': '#7a8088',
                '--fg-border': 'rgba(255,255,255,0.55)', '--fg-accent': '#a5b9c8',
                '--fg-success': '#c3c8be', '--fg-warning': '#d2b9af', '--fg-danger': '#b2aac3',
            },
        },
        'patisserie': {
            name: '甜品柜台',
            vars: {
                '--fg-bg': '#f5f2f0', '--fg-color-1': '210,180,170', '--fg-color-2': '175,195,210',
                '--fg-color-3': '180,200,178', '--fg-color-4': '190,178,200',
                '--fg-glass-1': 'rgba(210,180,170,0.3)', '--fg-glass-2': 'rgba(175,195,210,0.35)',
                '--fg-glass-3': 'rgba(180,200,178,0.32)', '--fg-glass-4': 'rgba(190,178,200,0.32)',
                '--fg-text': '#524a4e', '--fg-text-secondary': '#887e82',
                '--fg-border': 'rgba(255,255,255,0.55)', '--fg-accent': '#d2b4aa',
                '--fg-success': '#b4c8b2', '--fg-warning': '#d2c4a0', '--fg-danger': '#c8a4a4',
            },
        },
        'aurora-ice': {
            name: '极光冰面',
            vars: {
                '--fg-bg': '#f0f3f5', '--fg-color-1': '170,195,210', '--fg-color-2': '170,205,195',
                '--fg-color-3': '180,210,200', '--fg-color-4': '185,180,205',
                '--fg-glass-1': 'rgba(170,195,210,0.3)', '--fg-glass-2': 'rgba(170,205,195,0.35)',
                '--fg-glass-3': 'rgba(180,210,200,0.32)', '--fg-glass-4': 'rgba(185,180,205,0.32)',
                '--fg-text': '#404854', '--fg-text-secondary': '#6a7280',
                '--fg-border': 'rgba(255,255,255,0.55)', '--fg-accent': '#aac3d2',
                '--fg-success': '#aacdc3', '--fg-warning': '#b4d2c8', '--fg-danger': '#b9b4cd',
            },
        },
    };

    let _userStyleEl = null;

    const Themes = {
        init() {
            this.apply(FG.DataStore.get('settings.currentTheme') || 'flower-shop');
            FG.DataStore.onChange((key) => {
                if (key === 'settings.currentTheme' || key === 'full') {
                    this.apply(FG.DataStore.get('settings.currentTheme') || 'flower-shop');
                }
            });
        },

        getThemeList() {
            return Object.entries(BUILT_IN_THEMES).map(([id, theme]) => ({ id, name: theme.name }));
        },

        apply(themeId) {
            const theme = BUILT_IN_THEMES[themeId];
            if (!theme) return;
            const root = document.documentElement;
            for (const [key, value] of Object.entries(theme.vars)) root.style.setProperty(key, value);
            root.style.setProperty('--fg-blur', '20px');
            root.style.setProperty('--fg-radius', '16px');
            root.style.setProperty('--fg-radius-lg', '20px');
        },

        applyUserCSS(cssText) {
            this.removeUserCSS();
            _userStyleEl = document.createElement('style');
            _userStyleEl.id = 'fg-user-theme';
            _userStyleEl.textContent = cssText;
            document.head.appendChild(_userStyleEl);
        },

        removeUserCSS() {
            if (_userStyleEl) { _userStyleEl.remove(); _userStyleEl = null; }
            const existing = document.getElementById('fg-user-theme');
            if (existing) existing.remove();
        },

        handleCSSUpload(file) {
            return new Promise((resolve, reject) => {
                if (!file.name.endsWith('.css')) { reject(new Error('只接受 .css 文件')); return; }
                const reader = new FileReader();
                reader.onload = (e) => { const css = e.target.result; this.applyUserCSS(css); resolve(css); };
                reader.onerror = reject;
                reader.readAsText(file);
            });
        },
    };

    FG.Themes = Themes;
    FG.BUILT_IN_THEMES = BUILT_IN_THEMES;
})();
