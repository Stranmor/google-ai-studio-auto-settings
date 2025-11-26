// ==UserScript==
// @name         Google AI Studio - Auto Settings (UX Pro)
// @namespace    https://github.com/Stranmor/google-ai-studio-auto-settings
// @version      18.0
// @description  Beautiful UX, reliable settings application, and smart focus restoration.
// @author       Stranmor
// @match        https://aistudio.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=aistudio.google.com
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
    "use strict";

    // ==================== 1. CONSTANTS & SELECTORS ====================
    const CONSTANTS = {
        maxAttempts: 40,
        retryDelay: 250,
        waitTimeout: 8000,
        animDelay: 150
    };

    const SELECTORS = {
        settingsPanel: 'ms-run-settings',
        settingsToggleBtn: 'button.runsettings-toggle-button',
        closeSettingsBtn: 'ms-run-settings button[iconname="close"]',

        // Inputs
        temperature: 'div[data-test-id="temperatureSliderContainer"] input',
        topP: 'ms-slider input[max="1"]',
        maxTokens: 'input[name="maxOutputTokens"]',

        // Dropdowns
        mediaRes: 'mediaResolution',
        thinking: 'Thinking Level',

        // Toggles
        structuredOutput: '.structured-output-toggle',
        codeExecution: '.code-execution-toggle',
        functionCalling: '.function-calling-toggle',
        googleSearch: '.search-as-a-tool-toggle',
        urlContext: ['ms-browse-as-a-tool mat-slide-toggle', '.url-context-toggle'],

        // Chat Input
        chatInput: [
            'ms-chunk-input textarea',
            'ms-autosize-textarea textarea',
            'textarea[aria-label*="Type something"]',
            'footer textarea'
        ]
    };

    // ==================== 2. CONFIGURATION ====================
    const Config = {
        defaults: {
            // System
            ui: { showFab: true, enabled: true }, // New UI settings

            // Parameters
            temperature: { value: 1.0, enabled: true },
            topP: { value: 0.95, enabled: true },
            maxOutputTokens: { value: 65536, enabled: true },
            mediaResolution: { value: "Default", enabled: true },
            thinkingLevel: { value: "High", enabled: true },

            // Tools
            googleSearch: { value: true, enabled: true },
            urlContext: { value: false, enabled: true },
            codeExecution: { value: false, enabled: true },
            structuredOutput: { value: false, enabled: true },
            functionCalling: { value: false, enabled: true }
        },
        get() {
            const saved = GM_getValue('as_config_v18', null);
            if (!saved) {
                const old = GM_getValue('as_config_v17', null);
                return old ? { ...this.defaults, ...old } : JSON.parse(JSON.stringify(this.defaults));
            }
            // Merge with defaults to ensure new keys (like 'ui') exist
            return { ...this.defaults, ...saved, ui: { ...this.defaults.ui, ...(saved?.ui || {}) } };
        },
        save(cfg) {
            GM_setValue('as_config_v18', cfg);
        },
        reset() {
            this.save(this.defaults);
        }
    };

    // ==================== 3. UTILITIES ====================
    const Utils = {
        sleep: (ms) => new Promise(r => setTimeout(r, ms)),
        isMobile: () => window.innerWidth < 900,

        waitFor: (selector, parent = document) => {
            return new Promise((resolve) => {
                const el = parent.querySelector(selector);
                if (el) return resolve(el);
                const obs = new MutationObserver(() => {
                    const el = parent.querySelector(selector);
                    if (el) { obs.disconnect(); resolve(el); }
                });
                obs.observe(parent, { childList: true, subtree: true });
                setTimeout(() => { obs.disconnect(); resolve(null); }, CONSTANTS.waitTimeout);
            });
        },

        setNativeValue: (element, value) => {
            if (!element || element.disabled) return false;
            if (element.tagName !== 'INPUT' && element.tagName !== 'TEXTAREA') {
                element = element.querySelector('input, textarea');
            }
            if (!element) return false;

            const lastValue = element.value;
            if (element.type === 'number') {
                if (Math.abs(parseFloat(lastValue) - parseFloat(value)) < 0.001) return true;
            } else {
                if (String(lastValue) === String(value)) return true;
            }

            try {
                const prototype = Object.getPrototypeOf(element);
                const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value').set;
                if (prototypeValueSetter) {
                    prototypeValueSetter.call(element, value);
                } else {
                    element.value = value;
                }
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                element.dispatchEvent(new Event('blur', { bubbles: true }));
                return true;
            } catch (e) {
                return false;
            }
        }
    };

    // ==================== 4. UI CLASS (Material Design 3) ====================
    class SettingsUI {
        constructor(onSave, onToggleFab) {
            this.onSave = onSave;
            this.onToggleFab = onToggleFab;
            this.injectStyles();
        }

        injectStyles() {
            if (document.getElementById('as-ui-styles')) return;
            const css = `
                :root {
                    --as-primary: #0b57d0;
                    --as-primary-bg: #e8f0fe;
                    --as-bg: #ffffff;
                    --as-surface: #f0f4f9;
                    --as-text: #1f1f1f;
                    --as-text-sec: #444746;
                    --as-border: #e0e3e1;
                }

                /* Modal Overlay */
                .as-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.32); z-index: 9999999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); opacity: 0; animation: as-fade-in 0.2s forwards; }

                /* Modal Window */
                .as-modal {
                    background: var(--as-bg); width: 420px; max-width: 90%; max-height: 85vh;
                    border-radius: 28px;
                    box-shadow: 0 24px 48px -12px rgba(0,0,0,0.18);
                    display: flex; flex-direction: column; overflow: hidden;
                    font-family: 'Google Sans', 'Roboto', sans-serif;
                    transform: scale(0.95); animation: as-scale-in 0.25s cubic-bezier(0.2, 0, 0, 1) forwards;
                }

                /* Header */
                .as-header { padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; background: var(--as-bg); }
                .as-header h2 { margin: 0; font-size: 22px; font-weight: 400; color: var(--as-text); }
                .as-close-btn { background: none; border: none; cursor: pointer; padding: 8px; border-radius: 50%; color: var(--as-text-sec); display: flex; transition: 0.2s; }
                .as-close-btn:hover { background: rgba(0,0,0,0.08); color: var(--as-text); }

                /* Content */
                .as-content { padding: 0 24px 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 20px; }

                /* Groups */
                .as-group { background: var(--as-surface); border-radius: 16px; padding: 16px; }
                .as-group-title { font-size: 12px; font-weight: 600; color: var(--as-primary); text-transform: uppercase; margin-bottom: 16px; letter-spacing: 0.8px; opacity: 0.9; }

                /* Rows */
                .as-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
                .as-row:last-child { margin-bottom: 0; }

                /* Labels & Inputs */
                .as-label-wrap { display: flex; align-items: center; gap: 12px; flex: 1; cursor: pointer; }
                .as-label { font-size: 14px; font-weight: 500; color: var(--as-text); user-select: none; }
                .as-input { padding: 8px 12px; border: 1px solid var(--as-border); border-radius: 8px; width: 70px; text-align: center; font-size: 14px; background: var(--as-bg); color: var(--as-text); transition: 0.2s; }
                .as-input:focus { outline: 2px solid var(--as-primary); border-color: transparent; }
                .as-select { padding: 8px; border-radius: 8px; border: 1px solid var(--as-border); background: var(--as-bg); width: 110px; font-size: 13px; color: var(--as-text); cursor: pointer; }

                /* Custom Checkbox (Switch) */
                .as-switch { position: relative; display: inline-block; width: 36px; height: 20px; flex-shrink: 0; }
                .as-switch input { opacity: 0; width: 0; height: 0; }
                .as-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #e0e3e1; transition: .3s; border-radius: 34px; }
                .as-slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; box-shadow: 0 1px 2px rgba(0,0,0,0.2); }
                input:checked + .as-slider { background-color: var(--as-primary); }
                input:checked + .as-slider:before { transform: translateX(16px); }
                input:disabled + .as-slider { opacity: 0.5; cursor: not-allowed; }

                /* Footer */
                .as-footer { padding: 16px 24px; border-top: 1px solid var(--as-border); background: var(--as-bg); display: flex; justify-content: space-between; align-items: center; }
                .as-btn { padding: 10px 24px; border-radius: 100px; font-size: 14px; font-weight: 500; border: none; cursor: pointer; transition: 0.2s; }
                .as-btn-sec { background: transparent; color: var(--as-primary); }
                .as-btn-sec:hover { background: var(--as-primary-bg); }
                .as-btn-danger { color: #b3261e; }
                .as-btn-danger:hover { background: #fce8e6; }
                .as-btn-prim { background: var(--as-primary); color: white; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
                .as-btn-prim:hover { background: #0842a0; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }

                /* Toast */
                .as-toast {
                    position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%) translateY(20px);
                    background: #303030; color: #f2f2f2;
                    padding: 12px 24px; border-radius: 50px;
                    font-size: 14px; font-weight: 400; letter-spacing: 0.2px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    opacity: 0; pointer-events: none; transition: 0.4s cubic-bezier(0.2, 0, 0, 1); z-index: 1000000;
                    display: flex; align-items: center; gap: 8px;
                }
                .as-toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }

                @keyframes as-fade-in { from { opacity: 0; } to { opacity: 1; } }
                @keyframes as-scale-in { from { transform: scale(0.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            `;
            const style = document.createElement('style');
            style.id = 'as-ui-styles';
            style.textContent = css;
            document.head.appendChild(style);
        }

        showToast(msg, icon = 'check_circle') {
            let toast = document.querySelector('.as-toast');
            if (!toast) {
                toast = document.createElement('div');
                toast.className = 'as-toast';
                document.body.appendChild(toast);
            }
            toast.innerHTML = `<span class="material-symbols-outlined" style="font-size: 20px;">${icon}</span> ${msg}`;
            toast.classList.add('show');

            if(this.toastTimer) clearTimeout(this.toastTimer);
            this.toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
        }

        createControl(key, type, opts = []) {
            const cfg = Config.get();
            const item = cfg[key];
            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
            const isDisabled = !item.enabled;

            let inputHtml = '';
            if (type === 'toggle') {
                inputHtml = `
                <label class="as-switch">
                    <input type="checkbox" id="as-inp-${key}" ${item.value ? 'checked' : ''} ${isDisabled ? 'disabled' : ''}>
                    <span class="as-slider"></span>
                </label>`;
            } else if (type === 'select') {
                inputHtml = `<select id="as-inp-${key}" class="as-select" ${isDisabled ? 'disabled' : ''}>
                    ${opts.map(o => `<option value="${o}" ${o === item.value ? 'selected' : ''}>${o}</option>`).join('')}
                </select>`;
            } else {
                inputHtml = `<input type="number" id="as-inp-${key}" value="${item.value}" class="as-input" step="${key === 'temperature' ? 0.1 : 1}" min="0" ${isDisabled ? 'disabled' : ''}>`;
            }

            return `
            <div class="as-row">
                <div class="as-label-wrap" onclick="this.querySelector('input[type=checkbox]').click()">
                     <label class="as-switch" title="Enable/Disable applying this setting" onclick="event.stopPropagation()">
                        <input type="checkbox" data-key="${key}" ${item.enabled ? 'checked' : ''} onchange="
                            const el = document.getElementById('as-inp-${key}');
                            if(el) el.disabled = !this.checked;
                            this.closest('.as-row').style.opacity = this.checked ? 1 : 0.5;
                        ">
                        <span class="as-slider"></span>
                     </label>
                     <span class="as-label">${label}</span>
                </div>
                <div style="opacity: ${item.enabled ? 1 : 0.5}; transition: 0.2s">
                    ${inputHtml}
                </div>
            </div>`;
        }

        open() {
            if (document.querySelector('.as-overlay')) return;
            const cfg = Config.get();
            const overlay = document.createElement('div');
            overlay.className = 'as-overlay';
            overlay.innerHTML = `
            <div class="as-modal">
                <div class="as-header">
                    <h2>Auto Settings</h2>
                    <button class="as-close-btn" id="as-close"><span class="material-symbols-outlined">close</span></button>
                </div>
                <div class="as-content">
                    <div class="as-group">
                        <div class="as-group-title">Interface</div>
                        <div class="as-row">
                            <div class="as-label-wrap">
                                <span class="as-label">Show Floating Button</span>
                            </div>
                            <label class="as-switch">
                                <input type="checkbox" id="as-ui-fab" ${cfg.ui.showFab ? 'checked' : ''}>
                                <span class="as-slider"></span>
                            </label>
                        </div>
                    </div>

                    <div class="as-group">
                        <div class="as-group-title">Parameters</div>
                        ${this.createControl('temperature', 'number')}
                        ${this.createControl('topP', 'number')}
                        ${this.createControl('maxOutputTokens', 'number')}
                        ${this.createControl('mediaResolution', 'select', ['Default', 'Low', 'Medium', 'High'])}
                        ${this.createControl('thinkingLevel', 'select', ['Low', 'High'])}
                    </div>
                    <div class="as-group">
                        <div class="as-group-title">Tools</div>
                        ${this.createControl('googleSearch', 'toggle')}
                        ${this.createControl('codeExecution', 'toggle')}
                        ${this.createControl('structuredOutput', 'toggle')}
                        ${this.createControl('functionCalling', 'toggle')}
                        ${this.createControl('urlContext', 'toggle')}
                    </div>
                </div>
                <div class="as-footer">
                    <button class="as-btn as-btn-sec as-btn-danger" id="as-reset">Reset</button>
                    <div>
                        <button class="as-btn as-btn-sec" id="as-cancel" style="margin-right:8px">Cancel</button>
                        <button class="as-btn as-btn-prim" id="as-save">Apply</button>
                    </div>
                </div>
            </div>`;

            document.body.appendChild(overlay);

            // Close Logic
            const close = () => {
                overlay.style.animation = 'as-fade-in 0.2s reverse forwards';
                overlay.querySelector('.as-modal').style.animation = 'as-scale-in 0.2s reverse forwards';
                setTimeout(() => overlay.remove(), 200);
            };

            overlay.onclick = (e) => { if (e.target === overlay) close(); };
            document.getElementById('as-close').onclick = close;
            document.getElementById('as-cancel').onclick = close;

            // Reset Logic
            document.getElementById('as-reset').onclick = () => {
                if(confirm('Reset all settings to default?')) {
                    Config.reset();
                    close();
                    this.onSave();
                    this.onToggleFab(true);
                }
            };

            // Save Logic
            document.getElementById('as-save').onclick = () => {
                const newCfg = { ui: {} };

                // UI Settings
                newCfg.ui.showFab = document.getElementById('as-ui-fab').checked;

                // Auto Settings
                Object.keys(Config.defaults).forEach(k => {
                    if (k === 'ui') return;
                    const enabled = overlay.querySelector(`input[data-key="${k}"]`).checked;
                    const inp = document.getElementById(`as-inp-${k}`);
                    let val;
                    if (inp.type === 'checkbox') val = inp.checked;
                    else if (inp.type === 'number') val = parseFloat(inp.value);
                    else val = inp.value;
                    newCfg[k] = { enabled, value: val };
                });

                Config.save(newCfg);
                close();
                this.onToggleFab(newCfg.ui.showFab);
                this.onSave();
            };
        }
    }

    // ==================== 5. APPLIER LOGIC ====================
    class SettingsApplier {
        constructor() {
            this.openedByScript = false;
        }

        async ensurePanelOpen() {
            const panel = document.querySelector(SELECTORS.settingsPanel);
            if (panel && panel.offsetParent !== null) return true;

            const btn = document.querySelector(SELECTORS.settingsToggleBtn);
            if (!btn) return false;

            this.openedByScript = true;
            btn.click();
            const loaded = await Utils.waitFor(SELECTORS.settingsPanel);
            if (loaded) await Utils.sleep(CONSTANTS.animDelay);
            return !!loaded;
        }

        async applyDropdown(targetVal, identifier) {
            try {
                let select = document.querySelector(`mat-select[aria-label="${identifier}"]`) ||
                             document.querySelector(`div[data-test-id="${identifier}"] mat-select`);

                if (!select && identifier === SELECTORS.thinking) {
                    const headers = Array.from(document.querySelectorAll('h3, .settings-title'));
                    const header = headers.find(h => h.textContent.toLowerCase().includes('thinking'));
                    if (header) select = header.closest('.settings-item')?.querySelector('mat-select');
                }

                if (!select) return false;

                const currentText = select.querySelector('.mat-mdc-select-value-text span')?.textContent?.trim();
                if (currentText === targetVal) return true;

                select.click();
                const panel = await Utils.waitFor('.mat-mdc-select-panel');
                if (!panel) return false;

                const options = Array.from(document.querySelectorAll('mat-option'));
                const targetOpt = options.find(o => o.textContent.trim().includes(targetVal));

                if (targetOpt) targetOpt.click();
                else document.querySelector('.cdk-overlay-backdrop')?.click();

                await Utils.sleep(100);
                return true;
            } catch (e) {
                return false;
            }
        }

        async applyToggle(selectorOrArray, state) {
            try {
                let toggle = null;
                if (Array.isArray(selectorOrArray)) {
                    for (const sel of selectorOrArray) {
                        toggle = document.querySelector(sel);
                        if (toggle) break;
                    }
                } else {
                    toggle = document.querySelector(selectorOrArray);
                }

                if (!toggle) return false;

                const btn = toggle.querySelector('button[role="switch"]');
                if (!btn || btn.disabled) return true;

                const isChecked = btn.getAttribute('aria-checked') === 'true';
                if (isChecked !== state) {
                    btn.click();
                    await Utils.sleep(50);
                }
                return true;
            } catch (e) {
                return false;
            }
        }

        restoreFocus() {
            for (const sel of SELECTORS.chatInput) {
                const el = document.querySelector(sel);
                if (el) {
                    el.focus({ preventScroll: true });
                    if (el.value && el.setSelectionRange) {
                        const len = el.value.length;
                        el.setSelectionRange(len, len);
                    }
                    return;
                }
            }
        }

        async run() {
            if (!await this.ensurePanelOpen()) return false;
            const cfg = Config.get();

            const expanders = Array.from(document.querySelectorAll('.settings-group-header button[aria-expanded="false"]'));
            for (const btn of expanders) {
                btn.click();
                await Utils.sleep(100);
            }

            if (cfg.temperature.enabled) Utils.setNativeValue(document.querySelector(SELECTORS.temperature), cfg.temperature.value);
            if (cfg.topP.enabled) Utils.setNativeValue(document.querySelector(SELECTORS.topP), cfg.topP.value);
            if (cfg.maxOutputTokens.enabled) Utils.setNativeValue(document.querySelector(SELECTORS.maxTokens), cfg.maxOutputTokens.value);

            if (cfg.mediaResolution.enabled) await this.applyDropdown(cfg.mediaResolution.value, SELECTORS.mediaRes);
            if (cfg.thinkingLevel.enabled) await this.applyDropdown(cfg.thinkingLevel.value, SELECTORS.thinking);

            if (cfg.structuredOutput.enabled) await this.applyToggle(SELECTORS.structuredOutput, cfg.structuredOutput.value);
            if (cfg.codeExecution.enabled) await this.applyToggle(SELECTORS.codeExecution, cfg.codeExecution.value);
            if (cfg.functionCalling.enabled) await this.applyToggle(SELECTORS.functionCalling, cfg.functionCalling.value);
            if (cfg.googleSearch.enabled) await this.applyToggle(SELECTORS.googleSearch, cfg.googleSearch.value);
            if (cfg.urlContext.enabled) await this.applyToggle(SELECTORS.urlContext, cfg.urlContext.value);

            if (Utils.isMobile() && this.openedByScript) {
                await Utils.sleep(200);
                const closeBtn = document.querySelector(SELECTORS.closeSettingsBtn);
                if (closeBtn) {
                    closeBtn.click();
                    this.openedByScript = false;
                }
            }

            this.restoreFocus();
            return true;
        }
    }

    // ==================== 6. MAIN CONTROLLER ====================
    class Main {
        constructor() {
            this.applier = new SettingsApplier();
            this.ui = new SettingsUI(
                () => this.restart(),
                (show) => this.toggleFab(show)
            );
            this.btn = null;
            this.attempts = 0;
            this.isApplying = false;
            this.idleTimer = null;

            this.createFab();
            this.setupShortcuts();
            GM_registerMenuCommand("⚙️ Settings", () => this.ui.open());
            GM_registerMenuCommand("🔄 Re-apply Settings", () => this.restart());

            this.setupNavigationListener();
        }

        createFab() {
            if (document.getElementById('as-fab')) return;
            const btn = document.createElement('button');
            btn.id = 'as-fab';
            btn.className = 'as-fab';
            btn.title = "Auto Settings (Right-click for menu)";
            btn.innerHTML = `<span class="material-symbols-outlined">settings_motion</span>`;

            const css = `
                .as-fab {
                    position: fixed; left: 24px; bottom: 80px;
                    width: 48px; height: 48px;
                    border-radius: 16px;
                    background: #e8f0fe; color: #0b57d0;
                    border: none;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    cursor: pointer; z-index: 999998;
                    display: flex; align-items: center; justify-content: center;
                    transition: transform 0.2s, background 0.2s, opacity 0.3s, box-shadow 0.3s;
                }
                .as-fab:hover { transform: scale(1.05); background: #d3e3fd; opacity: 1 !important; box-shadow: 0 6px 16px rgba(0,0,0,0.2); }
                .as-fab:active { transform: scale(0.95); }
                .as-fab.idle { opacity: 0.4; box-shadow: none; }

                .as-fab.loading span { animation: spin 1s linear infinite; }
                .as-fab.loading { background: #fff; }

                .as-fab.success { background: #e6f4ea; color: #137333; }
                .as-fab.error { background: #fce8e6; color: #c5221f; }

                @keyframes spin { 100% { transform: rotate(360deg); } }
                @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(11, 87, 208, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(11, 87, 208, 0); } 100% { box-shadow: 0 0 0 0 rgba(11, 87, 208, 0); } }
                .as-fab.loading { animation: pulse 1.5s infinite; }
            `;
            const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);

            // Draggable Logic
            let isDragging = false, startX, startY, initialLeft, initialBottom;
            const onMove = (e) => {
                if (!isDragging) return;
                e.preventDefault();
                const clientX = e.clientX || e.touches?.[0].clientX;
                const clientY = e.clientY || e.touches?.[0].clientY;
                btn.style.left = `${initialLeft + (clientX - startX)}px`;
                btn.style.bottom = `${initialBottom - (clientY - startY)}px`;
                this.resetIdle();
            };
            const onUp = () => {
                isDragging = false;
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('touchmove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.removeEventListener('touchend', onUp);
            };
            const onDown = (e) => {
                if (e.button === 2) return;
                isDragging = true;
                startX = e.clientX || e.touches?.[0].clientX;
                startY = e.clientY || e.touches?.[0].clientY;
                const rect = btn.getBoundingClientRect();
                initialLeft = rect.left;
                initialBottom = window.innerHeight - rect.bottom;
                document.addEventListener('mousemove', onMove);
                document.addEventListener('touchmove', onMove, { passive: false });
                document.addEventListener('mouseup', onUp);
                document.addEventListener('touchend', onUp);
                this.resetIdle();
            };

            btn.addEventListener('mousedown', onDown);
            btn.addEventListener('touchstart', onDown, { passive: false });
            btn.onclick = (e) => {
                if (Math.abs((e.clientX || e.changedTouches?.[0].clientX) - startX) < 5) this.restart();
            };
            btn.oncontextmenu = (e) => { e.preventDefault(); this.ui.open(); };

            // Idle logic
            btn.onmouseenter = () => this.resetIdle();

            document.body.appendChild(btn);
            this.btn = btn;

            // Initial state check
            this.toggleFab(Config.get().ui.showFab);
            this.resetIdle();
        }

        resetIdle() {
            if (!this.btn) return;
            this.btn.classList.remove('idle');
            if (this.idleTimer) clearTimeout(this.idleTimer);
            this.idleTimer = setTimeout(() => {
                if (this.btn && !this.isApplying) this.btn.classList.add('idle');
            }, 3000);
        }

        toggleFab(show) {
            if (this.btn) this.btn.style.display = show ? 'flex' : 'none';
        }

        setupShortcuts() {
            document.addEventListener('keydown', (e) => {
                if (e.altKey && e.code === 'KeyS') {
                    e.preventDefault();
                    this.ui.open();
                }
                if (e.altKey && e.code === 'KeyA') {
                    e.preventDefault();
                    this.restart();
                }
            });
        }

        setStatus(status) {
            if (!this.btn) return;
            const icon = this.btn.querySelector('span');
            this.btn.className = `as-fab ${status}`;

            if (status === 'loading') {
                icon.textContent = 'settings';
                this.resetIdle();
            } else if (status === 'success') {
                icon.textContent = 'check';
                this.ui.showToast('Settings Applied');
                this.resetIdle();
            } else if (status === 'error') {
                icon.textContent = 'priority_high';
                this.ui.showToast('Failed to apply some settings', 'warning');
            }
        }

        async loop() {
            if (this.isApplying) return;
            this.isApplying = true;
            this.setStatus('loading');

            try {
                const success = await this.applier.run();
                if (success) {
                    this.setStatus('success');
                    this.isApplying = false;
                    return;
                }
            } catch (e) {
                console.error("AutoSettings Error:", e);
            }

            this.attempts++;
            if (this.attempts < CONSTANTS.maxAttempts) {
                this.isApplying = false;
                setTimeout(() => this.loop(), CONSTANTS.retryDelay);
            } else {
                this.setStatus('error');
                this.isApplying = false;
            }
        }

        restart() {
            this.attempts = 0;
            this.applier.openedByScript = false;
            setTimeout(() => this.loop(), 500);
        }

        setupNavigationListener() {
            const pushState = history.pushState;
            history.pushState = (...args) => { pushState.apply(history, args); this.restart(); };
            window.addEventListener('popstate', () => this.restart());

            let lastUrl = location.href;
            const obs = new MutationObserver(() => {
                if (location.href !== lastUrl) { lastUrl = location.href; this.restart(); }
            });
            obs.observe(document.body, { childList: true, subtree: true });
            this.restart();
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => new Main());
    else new Main();

})();
