// ==UserScript==
// @name         Google AI Studio - Auto Settings (Enhanced)
// @namespace    https://github.com/Stranmor/google-ai-studio-auto-settings
// @version      16.0
// @description  Allows disabling specific settings and applies them reliably using prototype setters.
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

    // ==================== 1. CONFIGURATION ====================
    const Config = {
        defaults: {
            temperature: { value: 1.0, enabled: true },
            topP: { value: 0.95, enabled: true },
            maxOutputTokens: { value: 8192, enabled: true },
            mediaResolution: { value: "Default", enabled: true },
            thinkingLevel: { value: "High", enabled: true }, // Для моделей с thinking process
            // Tools
            googleSearch: { value: true, enabled: true },
            urlContext: { value: false, enabled: true },
            codeExecution: { value: false, enabled: true },
            structuredOutput: { value: false, enabled: true },
            functionCalling: { value: false, enabled: true }
        },
        get() {
            const saved = GM_getValue('as_config_v16', null);
            // Миграция со старых версий или возврат дефолтных
            if (!saved) {
                const old = GM_getValue('as_config_v15', null);
                return old ? { ...this.defaults, ...old } : JSON.parse(JSON.stringify(this.defaults));
            }
            return { ...this.defaults, ...saved };
        },
        save(cfg) {
            GM_setValue('as_config_v16', cfg);
        },
        reset() {
            this.save(this.defaults);
        }
    };

    const CONSTANTS = {
        maxAttempts: 30,
        retryDelay: 500,
        waitTimeout: 8000
    };

    // ==================== 2. UTILITIES ====================
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

        // Самая важная функция: корректная установка значения для React/Angular
        setNativeValue: (element, value) => {
            if (!element || element.disabled) return false;

            // Если передан враппер, ищем input внутри
            if (element.tagName !== 'INPUT' && element.tagName !== 'TEXTAREA') {
                element = element.querySelector('input, textarea');
            }
            if (!element) return false;

            const lastValue = element.value;
            // Приведение типов для сравнения
            const targetValStr = String(value);
            const currentValStr = String(lastValue);

            // Пропускаем, если значение уже стоит (с небольшим допуском для чисел)
            if (element.type === 'number') {
                if (Math.abs(parseFloat(lastValue) - parseFloat(value)) < 0.001) return true;
            } else {
                if (currentValStr === targetValStr) return true;
            }

            try {
                // Магия для обхода React/Angular state tracking
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
                console.warn('AutoSettings: Error setting value', e);
                return false;
            }
        }
    };

    // ==================== 3. UI (STYLES & COMPONENTS) ====================
    class SettingsUI {
        constructor(onSave) {
            this.onSave = onSave;
            this.injectStyles();
        }

        injectStyles() {
            if (document.getElementById('as-ui-styles')) return;
            const css = `
                :root { --as-primary: #0b57d0; --as-bg: #ffffff; --as-surface: #f3f6fc; --as-text: #1f1f1f; --as-border: #e0e3e1; }
                .as-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 9999999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(2px); opacity: 0; animation: as-fade-in 0.2s forwards; }
                .as-modal { background: var(--as-bg); width: 450px; max-width: 95%; max-height: 90vh; border-radius: 24px; box-shadow: 0 24px 48px rgba(0,0,0,0.2); display: flex; flex-direction: column; overflow: hidden; font-family: 'Google Sans', sans-serif; transform: scale(0.95); animation: as-scale-in 0.2s forwards; }
                .as-header { padding: 16px 24px; border-bottom: 1px solid var(--as-border); display: flex; justify-content: space-between; align-items: center; background: var(--as-surface); }
                .as-header h2 { margin: 0; font-size: 18px; color: var(--as-text); }
                .as-close-btn { background: none; border: none; cursor: pointer; padding: 8px; border-radius: 50%; display: flex; }
                .as-close-btn:hover { background: rgba(0,0,0,0.05); }
                .as-content { padding: 20px 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
                .as-group { border: 1px solid var(--as-border); border-radius: 12px; padding: 16px; }
                .as-group-title { font-size: 11px; font-weight: 700; color: var(--as-primary); text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.5px; }
                .as-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
                .as-row:last-child { margin-bottom: 0; }
                .as-label-wrap { display: flex; align-items: center; gap: 10px; flex: 1; }
                .as-label { font-size: 14px; font-weight: 500; cursor: pointer; user-select: none; }
                .as-input { padding: 6px 10px; border: 1px solid var(--as-border); border-radius: 6px; width: 80px; text-align: center; font-size: 14px; }
                .as-input:focus { outline: 2px solid var(--as-primary); border-color: transparent; }
                .as-select { padding: 6px; border-radius: 6px; border: 1px solid var(--as-border); background: white; width: 100px; }

                /* Toggle Switch */
                .as-switch { position: relative; display: inline-block; width: 32px; height: 18px; flex-shrink: 0; }
                .as-switch input { opacity: 0; width: 0; height: 0; }
                .as-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .3s; border-radius: 34px; }
                .as-slider:before { position: absolute; content: ""; height: 12px; width: 12px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; }
                input:checked + .as-slider { background-color: var(--as-primary); }
                input:checked + .as-slider:before { transform: translateX(14px); }

                .as-footer { padding: 16px 24px; border-top: 1px solid var(--as-border); background: var(--as-surface); display: flex; justify-content: space-between; align-items: center; }
                .as-btn { padding: 8px 20px; border-radius: 18px; font-size: 13px; font-weight: 500; border: none; cursor: pointer; transition: 0.2s; }
                .as-btn-sec { background: transparent; color: #444; }
                .as-btn-sec:hover { background: rgba(0,0,0,0.05); }
                .as-btn-danger { color: #d93025; }
                .as-btn-danger:hover { background: rgba(217, 48, 37, 0.08); }
                .as-btn-prim { background: var(--as-primary); color: white; }
                .as-btn-prim:hover { background: #0842a0; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }

                .as-toast { position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%) translateY(20px); background: #323232; color: white; padding: 10px 20px; border-radius: 20px; font-size: 13px; opacity: 0; pointer-events: none; transition: 0.3s; z-index: 1000000; }
                .as-toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }

                @keyframes as-fade-in { from { opacity: 0; } to { opacity: 1; } }
                @keyframes as-scale-in { from { transform: scale(0.95); } to { transform: scale(1); } }
            `;
            const style = document.createElement('style');
            style.id = 'as-ui-styles';
            style.textContent = css;
            document.head.appendChild(style);
        }

        showToast(msg) {
            let toast = document.querySelector('.as-toast');
            if (!toast) {
                toast = document.createElement('div');
                toast.className = 'as-toast';
                document.body.appendChild(toast);
            }
            toast.textContent = msg;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 2500);
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
                <div class="as-label-wrap">
                     <label class="as-switch" title="Enable/Disable this setting">
                        <input type="checkbox" data-key="${key}" ${item.enabled ? 'checked' : ''} onchange="
                            const el = document.getElementById('as-inp-${key}');
                            if(el) el.disabled = !this.checked;
                            this.closest('.as-row').style.opacity = this.checked ? 1 : 0.5;
                        ">
                        <span class="as-slider"></span>
                     </label>
                     <span class="as-label" onclick="this.previousElementSibling.querySelector('input').click()">${label}</span>
                </div>
                <div style="opacity: ${item.enabled ? 1 : 0.5}; transition: 0.2s">
                    ${inputHtml}
                </div>
            </div>`;
        }

        open() {
            if (document.querySelector('.as-overlay')) return;
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
                    <button class="as-btn as-btn-sec as-btn-danger" id="as-reset">Reset Defaults</button>
                    <div>
                        <button class="as-btn as-btn-sec" id="as-cancel" style="margin-right:8px">Cancel</button>
                        <button class="as-btn as-btn-prim" id="as-save">Apply</button>
                    </div>
                </div>
            </div>`;

            document.body.appendChild(overlay);

            const close = () => {
                overlay.style.animation = 'as-fade-in 0.2s reverse forwards';
                overlay.querySelector('.as-modal').style.animation = 'as-scale-in 0.2s reverse forwards';
                setTimeout(() => overlay.remove(), 200);
            };

            overlay.onclick = (e) => { if (e.target === overlay) close(); };
            document.getElementById('as-close').onclick = close;
            document.getElementById('as-cancel').onclick = close;

            document.getElementById('as-reset').onclick = () => {
                if(confirm('Reset all settings to default?')) {
                    Config.reset();
                    close();
                    this.onSave();
                }
            };

            document.getElementById('as-save').onclick = () => {
                const newCfg = {};
                Object.keys(Config.defaults).forEach(k => {
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
                this.onSave();
            };
        }
    }

    // ==================== 4. APPLIER LOGIC ====================
    class SettingsApplier {
        constructor() {
            this.openedByScript = false;
        }

        async ensurePanelOpen() {
            // Проверяем, открыта ли панель
            const panel = document.querySelector('ms-run-settings');
            if (panel && panel.offsetParent !== null) return true; // offsetParent null если скрыт

            const btn = document.querySelector('button.runsettings-toggle-button');
            if (!btn) return false;

            this.openedByScript = true;
            btn.click();

            // Ждем появления контента
            const loaded = await Utils.waitFor('ms-run-settings');
            if (loaded) await Utils.sleep(400); // Анимация
            return !!loaded;
        }

        async applyDropdown(targetVal, ariaLabel) {
            // Ищем селект по aria-label или внутри контейнера с data-test-id
            let select = document.querySelector(`mat-select[aria-label="${ariaLabel}"]`) ||
                         document.querySelector(`div[data-test-id="${ariaLabel}"] mat-select`);

            // Fallback для Thinking Level (он часто меняется)
            if (!select && ariaLabel === 'Thinking Level') {
                const headers = Array.from(document.querySelectorAll('h3, .settings-title'));
                const header = headers.find(h => h.textContent.toLowerCase().includes('thinking'));
                if (header) select = header.closest('.settings-item')?.querySelector('mat-select');
            }

            if (!select) return false;

            // Проверяем текущее значение
            const currentText = select.querySelector('.mat-mdc-select-value-text span')?.textContent?.trim();
            if (currentText === targetVal) return true;

            // Открываем
            select.click();
            const panel = await Utils.waitFor('.mat-mdc-select-panel');
            if (!panel) return false;

            // Выбираем опцию
            const options = Array.from(document.querySelectorAll('mat-option'));
            const targetOpt = options.find(o => o.textContent.trim().includes(targetVal));

            if (targetOpt) {
                targetOpt.click();
            } else {
                // Если опции нет, закрываем меню кликом в фон
                document.querySelector('.cdk-overlay-backdrop')?.click();
            }
            await Utils.sleep(150);
            return true;
        }

        async applyToggle(selector, state) {
            const toggle = document.querySelector(selector);
            if (!toggle) return false;

            const btn = toggle.querySelector('button[role="switch"]');
            if (!btn || btn.disabled) return true;

            const isChecked = btn.getAttribute('aria-checked') === 'true';
            if (isChecked !== state) {
                btn.click();
                await Utils.sleep(100);
            }
            return true;
        }

        async run() {
            if (!await this.ensurePanelOpen()) return false;
            const cfg = Config.get();

            // Раскрываем свернутые секции (Advanced settings, Tools)
            const expanders = Array.from(document.querySelectorAll('.settings-group-header button[aria-expanded="false"]'));
            for (const btn of expanders) {
                btn.click();
                await Utils.sleep(200);
            }

            // --- Parameters ---
            if (cfg.temperature.enabled) {
                Utils.setNativeValue(document.querySelector('div[data-test-id="temperatureSliderContainer"] input'), cfg.temperature.value);
            }
            if (cfg.topP.enabled) {
                Utils.setNativeValue(document.querySelector('ms-slider input[max="1"]'), cfg.topP.value);
            }
            if (cfg.maxOutputTokens.enabled) {
                Utils.setNativeValue(document.querySelector('input[name="maxOutputTokens"]'), cfg.maxOutputTokens.value);
            }

            if (cfg.mediaResolution.enabled) await this.applyDropdown(cfg.mediaResolution.value, 'mediaResolution');
            if (cfg.thinkingLevel.enabled) await this.applyDropdown(cfg.thinkingLevel.value, 'Thinking Level');

            // --- Tools ---
            if (cfg.structuredOutput.enabled) await this.applyToggle('.structured-output-toggle', cfg.structuredOutput.value);
            if (cfg.codeExecution.enabled) await this.applyToggle('.code-execution-toggle', cfg.codeExecution.value);
            if (cfg.functionCalling.enabled) await this.applyToggle('.function-calling-toggle', cfg.functionCalling.value);
            if (cfg.googleSearch.enabled) await this.applyToggle('.search-as-a-tool-toggle', cfg.googleSearch.value);

            // URL Context (Browse as tool)
            if (cfg.urlContext.enabled) {
                // Иногда класс меняется, ищем по тексту или тегу
                const browseToggle = document.querySelector('ms-browse-as-a-tool mat-slide-toggle') ||
                                     document.querySelector('.url-context-toggle');
                if (browseToggle) {
                    const btn = browseToggle.querySelector('button');
                    const isChecked = btn?.getAttribute('aria-checked') === 'true';
                    if (btn && isChecked !== cfg.urlContext.value) btn.click();
                }
            }

            // Закрываем панель на мобильных, если мы её открыли
            if (Utils.isMobile() && this.openedByScript) {
                await Utils.sleep(300);
                const closeBtn = document.querySelector('ms-run-settings button[iconname="close"]');
                if (closeBtn) {
                    closeBtn.click();
                    this.openedByScript = false;
                }
            }

            return true;
        }
    }

    // ==================== 5. MAIN CONTROLLER ====================
    class Main {
        constructor() {
            this.applier = new SettingsApplier();
            this.ui = new SettingsUI(() => this.restart());
            this.btn = null;
            this.attempts = 0;
            this.isApplying = false;

            this.createFab();
            GM_registerMenuCommand("⚙️ Settings", () => this.ui.open());

            this.setupNavigationListener();
        }

        createFab() {
            if (document.getElementById('as-fab')) return;
            const btn = document.createElement('button');
            btn.id = 'as-fab';
            btn.className = 'as-fab';
            btn.innerHTML = `<span class="material-symbols-outlined">settings_motion</span>`;

            const css = `
                .as-fab { position: fixed; left: 20px; bottom: 80px; width: 48px; height: 48px; border-radius: 14px; background: #e8f0fe; color: #0b57d0; border: none; box-shadow: 0 4px 12px rgba(0,0,0,0.15); cursor: pointer; z-index: 999998; display: flex; align-items: center; justify-content: center; transition: transform 0.2s, background 0.2s; }
                .as-fab:hover { transform: scale(1.08); background: #d3e3fd; }
                .as-fab:active { transform: scale(0.95); }
                .as-fab.loading span { animation: spin 1s linear infinite; }
                .as-fab.success { background: #e6f4ea; color: #137333; }
                .as-fab.error { background: #fce8e6; color: #c5221f; }
                @keyframes spin { 100% { transform: rotate(360deg); } }
            `;
            const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);

            // Draggable Logic
            let isDragging = false, startX, startY, initialLeft, initialBottom;

            const onMove = (e) => {
                if (!isDragging) return;
                e.preventDefault(); // Prevent selection
                const clientX = e.clientX || e.touches?.[0].clientX;
                const clientY = e.clientY || e.touches?.[0].clientY;
                const dx = clientX - startX;
                const dy = clientY - startY;
                btn.style.left = `${initialLeft + dx}px`;
                btn.style.bottom = `${initialBottom - dy}px`;
            };

            const onUp = () => {
                isDragging = false;
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('touchmove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.removeEventListener('touchend', onUp);
            };

            const onDown = (e) => {
                if (e.button === 2) return; // Ignore right click
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
            };

            btn.addEventListener('mousedown', onDown);
            btn.addEventListener('touchstart', onDown, { passive: false });

            // Click handler (only if not dragged)
            btn.onclick = (e) => {
                const wasDragged = Math.abs((e.clientX || e.changedTouches?.[0].clientX) - startX) > 5;
                if (!wasDragged) this.restart();
            };

            btn.oncontextmenu = (e) => {
                e.preventDefault();
                this.ui.open();
            };

            document.body.appendChild(btn);
            this.btn = btn;
        }

        setStatus(status) {
            if (!this.btn) return;
            const icon = this.btn.querySelector('span');
            this.btn.className = `as-fab ${status}`;

            if (status === 'loading') icon.textContent = 'settings';
            else if (status === 'success') {
                icon.textContent = 'check';
                this.ui.showToast('Settings Applied');
            } else if (status === 'error') {
                icon.textContent = 'priority_high';
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
            // Небольшая задержка перед стартом, чтобы UI прогрузился
            setTimeout(() => this.loop(), 500);
        }

        setupNavigationListener() {
            // 1. Перехват History API
            const pushState = history.pushState;
            history.pushState = (...args) => {
                pushState.apply(history, args);
                this.restart();
            };
            window.addEventListener('popstate', () => this.restart());

            // 2. MutationObserver для отлова изменений в Title или Body (SPA navigation fallback)
            let lastUrl = location.href;
            const obs = new MutationObserver(() => {
                if (location.href !== lastUrl) {
                    lastUrl = location.href;
                    this.restart();
                }
            });
            obs.observe(document.body, { childList: true, subtree: true });

            // Initial run
            this.restart();
        }
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => new Main());
    } else {
        new Main();
    }

})();
