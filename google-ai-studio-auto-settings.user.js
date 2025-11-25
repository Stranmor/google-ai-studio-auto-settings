// ==UserScript==
// @name         Google AI Studio - Auto Settings (With Toggles)
// @namespace    https://github.com/Stranmor/google-ai-studio-auto-settings
// @version      15.1
// @description  Allows disabling specific settings (like Max Output Tokens) via explicit toggles.
// @author       Stranmor
// @match        https://aistudio.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=aistudio.google.com
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(function () {
  "use strict";

  // ==================== 1. CONFIGURATION ====================
  const Config = {
    defaults: {
      temperature: { value: 1.0, enabled: true },
      topP: { value: 0.95, enabled: true },
      maxOutputTokens: { value: 8192, enabled: true }, // Теперь можно явно выключить enabled
      mediaResolution: { value: "Default", enabled: true },
      thinkingLevel: { value: "High", enabled: true },
      // Tools
      googleSearch: { value: true, enabled: true },
      urlContext: { value: false, enabled: true },
      codeExecution: { value: false, enabled: true },
      structuredOutput: { value: false, enabled: true },
      functionCalling: { value: false, enabled: true }
    },
    load() {
      const saved = GM_getValue('as_config_v15', null);
      if (!saved) return GM_getValue('as_config_v14', this.defaults);
      // Merge defaults to ensure new keys exist
      return { ...this.defaults, ...saved };
    },
    save(cfg) { GM_setValue('as_config_v15', cfg); }
  };

  const CONSTANTS = {
    maxAttempts: 20,
    retryDelay: 800,
    waitTimeout: 5000
  };

  // ==================== 2. UTILITIES ====================
  const Utils = {
    sleep: (ms) => new Promise(r => setTimeout(r, ms)),
    isMobile: () => window.innerWidth < 900,

    waitFor: (selector, parent = document) => {
        return new Promise((resolve) => {
            if (parent.querySelector(selector)) return resolve(parent.querySelector(selector));
            const obs = new MutationObserver(() => {
                if (parent.querySelector(selector)) { obs.disconnect(); resolve(parent.querySelector(selector)); }
            });
            obs.observe(parent, { childList: true, subtree: true });
            setTimeout(() => { obs.disconnect(); resolve(null); }, CONSTANTS.waitTimeout);
        });
    },

    setInputValue: (input, value) => {
      if (!input || input.disabled) return false;
      if (input.tagName !== 'INPUT') input = input.querySelector('input');
      if (!input) return false;

      let currentVal = input.value;
      if (input.type === 'number') currentVal = parseFloat(currentVal);
      // Small tolerance for float comparison
      if (Math.abs(currentVal - value) < 0.001) return true;

      try {
        input.focus();
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
        return true;
      } catch (e) { return false; }
    }
  };

  // ==================== 3. UI (MATERIAL DESIGN) ====================
  class SettingsUI {
    constructor(onSave) {
        this.onSave = onSave;
        this.injectStyles();
    }

    injectStyles() {
        if (document.getElementById('as-ui-styles')) return;
        const css = `
            :root {
                --as-primary: #0b57d0;
                --as-bg: #ffffff;
                --as-surface: #f3f6fc;
                --as-text: #1f1f1f;
                --as-text-sec: #444746;
                --as-border: #e0e3e1;
            }
            .as-overlay {
                position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 9999999;
                display: flex; align-items: center; justify-content: center;
                backdrop-filter: blur(4px); opacity: 0; animation: as-fade-in 0.2s forwards;
            }
            .as-modal {
                background: var(--as-bg); width: 420px; max-width: 90%; max-height: 85vh;
                border-radius: 28px; box-shadow: 0 20px 40px rgba(0,0,0,0.2);
                display: flex; flex-direction: column; overflow: hidden;
                font-family: 'Google Sans', 'Roboto', sans-serif;
                transform: scale(0.95); animation: as-scale-in 0.2s forwards;
            }
            .as-header { padding: 20px 24px; border-bottom: 1px solid var(--as-border); display: flex; justify-content: space-between; align-items: center; background: var(--as-surface); }
            .as-header h2 { margin: 0; font-size: 20px; color: var(--as-text); font-weight: 500; }
            .as-close-btn { background: none; border: none; cursor: pointer; color: var(--as-text-sec); padding: 8px; border-radius: 50%; transition: bg 0.2s; display: flex; }
            .as-close-btn:hover { background: rgba(0,0,0,0.05); }

            .as-content { padding: 20px 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }

            .as-group { border: 1px solid var(--as-border); border-radius: 16px; padding: 16px; }
            .as-group-title { font-size: 11px; font-weight: 700; color: var(--as-primary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }

            .as-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
            .as-row:last-child { margin-bottom: 0; }

            .as-label-wrap { display: flex; align-items: center; gap: 12px; flex: 1; }
            .as-label { font-size: 14px; color: var(--as-text); font-weight: 500; cursor: pointer; }

            /* Inputs */
            .as-input {
                padding: 8px 12px; border: 1px solid var(--as-border); border-radius: 8px;
                width: 90px; font-size: 14px; text-align: center; color: var(--as-text); background: var(--as-bg);
                transition: all 0.2s;
            }
            .as-input:focus { outline: none; border-color: var(--as-primary); border-width: 2px; padding: 7px 11px; }
            .as-input:disabled { background: var(--as-surface); color: #999; border-color: transparent; }

            .as-select { width: 116px; padding: 7px; border-radius: 8px; border: 1px solid var(--as-border); background: var(--as-bg); cursor: pointer; }
            .as-select:disabled { background: var(--as-surface); color: #999; }

            /* Toggle Switch */
            .as-switch { position: relative; display: inline-block; width: 36px; height: 20px; flex-shrink: 0; }
            .as-switch input { opacity: 0; width: 0; height: 0; }
            .as-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #e0e3e1; transition: .3s; border-radius: 24px; }
            .as-slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; box-shadow: 0 1px 2px rgba(0,0,0,0.2); }
            input:checked + .as-slider { background-color: var(--as-primary); }
            input:checked + .as-slider:before { transform: translateX(16px); }

            .as-footer { padding: 16px 24px; border-top: 1px solid var(--as-border); background: var(--as-surface); display: flex; justify-content: flex-end; gap: 12px; }
            .as-btn { padding: 10px 24px; border-radius: 20px; font-size: 14px; font-weight: 500; border: none; cursor: pointer; transition: transform 0.1s; }
            .as-btn-sec { background: transparent; color: var(--as-primary); }
            .as-btn-sec:hover { background: rgba(11, 87, 208, 0.08); }
            .as-btn-prim { background: var(--as-primary); color: white; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
            .as-btn-prim:hover { background: #0842a0; }

            /* Toast */
            .as-toast {
                position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%) translateY(20px);
                background: #323232; color: #f2f2f2; padding: 12px 24px; border-radius: 28px;
                font-size: 14px; opacity: 0; pointer-events: none; z-index: 1000000;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .as-toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }

            @keyframes as-fade-in { from { opacity: 0; } to { opacity: 1; } }
            @keyframes as-scale-in { from { transform: scale(0.95); } to { transform: scale(1); } }
            @media (max-width: 600px) {
                .as-modal { width: 100%; height: 100%; max-height: 100%; border-radius: 0; }
            }
        `;
        const style = document.createElement('style');
        style.id = 'as-ui-styles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    showToast(msg, type = 'normal') {
        let toast = document.querySelector('.as-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'as-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.background = type === 'error' ? '#8C1D18' : '#323232';
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    // Создаем элемент управления: Слева тумблер (Применять?), Справа значение
    createControl(key, type, opts = []) {
        const cfg = Config.load();
        const item = cfg[key];
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

        let inputHtml = '';
        const isDisabled = !item.enabled;

        if (type === 'toggle') {
            // Для инструментов: сам тумблер справа это Value.
            // Тумблер слева - "Применять ли эту настройку вообще".
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
             inputHtml = `<input type="number" id="as-inp-${key}" value="${item.value}" class="as-input" step="${key==='temperature'?0.1:1}" min="0" ${isDisabled ? 'disabled' : ''}>`;
        }

        // Явный переключатель "Enabled" слева
        return `
        <div class="as-row">
            <div class="as-label-wrap">
                 <label class="as-switch" title="Toggle to enable/disable applying this setting">
                    <input type="checkbox" data-key="${key}" ${item.enabled ? 'checked' : ''} onchange="
                        const el = document.getElementById('as-inp-${key}');
                        if(el) el.disabled = !this.checked;
                        this.closest('.as-row').style.opacity = this.checked ? 1 : 0.6;
                    ">
                    <span class="as-slider"></span>
                 </label>
                 <span class="as-label" onclick="this.previousElementSibling.querySelector('input').click()">${label}</span>
            </div>
            <div class="as-control-wrap" style="opacity: ${item.enabled ? 1 : 0.6}">
                ${inputHtml}
            </div>
        </div>`;
    }

    open() {
        if (document.querySelector('.as-overlay')) return;
        const overlay = document.createElement('div');
        overlay.className = 'as-overlay';

        const content = `
        <div class="as-modal">
            <div class="as-header">
                <h2>Auto Settings</h2>
                <button class="as-close-btn" id="as-close">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <div class="as-content">
                <div class="as-group">
                    <div class="as-group-title">Generation Parameters</div>
                    <div style="font-size:12px; color:#666; margin-bottom:8px;">Switch OFF left toggle to let Google decide.</div>

                    ${this.createControl('temperature', 'number')}
                    ${this.createControl('topP', 'number')}
                    ${this.createControl('maxOutputTokens', 'number')}
                    ${this.createControl('mediaResolution', 'select', ['Default', 'Low', 'Medium', 'High'])}
                    ${this.createControl('thinkingLevel', 'select', ['Low', 'High'])}
                </div>
                <div class="as-group">
                    <div class="as-group-title">Tools (Force State)</div>
                    ${this.createControl('googleSearch', 'toggle')}
                    ${this.createControl('codeExecution', 'toggle')}
                    ${this.createControl('structuredOutput', 'toggle')}
                    ${this.createControl('functionCalling', 'toggle')}
                    ${this.createControl('urlContext', 'toggle')}
                </div>
            </div>
            <div class="as-footer">
                <button class="as-btn as-btn-sec" id="as-cancel">Cancel</button>
                <button class="as-btn as-btn-prim" id="as-save">Apply</button>
            </div>
        </div>`;

        overlay.innerHTML = content;
        document.body.appendChild(overlay);

        const close = () => {
            overlay.style.animation = 'as-fade-in 0.2s reverse forwards';
            overlay.querySelector('.as-modal').style.animation = 'as-scale-in 0.2s reverse forwards';
            setTimeout(() => overlay.remove(), 200);
        };

        overlay.onclick = (e) => { if(e.target === overlay) close(); };
        document.getElementById('as-close').onclick = close;
        document.getElementById('as-cancel').onclick = close;

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
    constructor() { this.openedByScript = false; }

    async preparePanel() {
        let content = document.querySelector('ms-run-settings');
        if (content && Utils.isMobile()) {
            // Check if drawer is technically open but hidden via styles
            const drawer = document.querySelector('.ms-right-side-panel') || document.querySelector('mat-drawer');
            if (drawer) {
                const style = window.getComputedStyle(drawer);
                if (style.display === 'none' || style.visibility === 'hidden') content = null;
            }
        }

        if (content) return true;

        const btn = document.querySelector('button.runsettings-toggle-button');
        if (!btn) return false;

        this.openedByScript = true;
        btn.click();

        const loaded = await Utils.waitFor('ms-run-settings');
        if (loaded) {
             await Utils.sleep(600);
             return true;
        }
        return false;
    }

    async applyDropdown(targetVal, ariaLabel) {
        let select = document.querySelector(`div[data-test-id="${ariaLabel}"] mat-select`) ||
                     document.querySelector(`mat-select[aria-label="${ariaLabel}"]`);

        if (!select && ariaLabel === 'Thinking Level') {
             const h3 = Array.from(document.querySelectorAll('h3')).find(el => el.textContent.includes('Thinking level'));
             if (h3) select = h3.closest('.settings-item')?.querySelector('mat-select');
        }

        if (!select) return false;

        const curr = select.querySelector('.mat-mdc-select-value-text span')?.textContent?.trim();
        if (curr === targetVal) return true;

        select.click();
        const panel = await Utils.waitFor('.mdc-menu-surface.mat-mdc-select-panel');
        if (!panel) return false;

        const options = Array.from(document.querySelectorAll('mat-option'));
        const targetOpt = options.find(o => o.textContent.trim().includes(targetVal));

        if (targetOpt) targetOpt.click();
        else {
            const backdrop = document.querySelector('.cdk-overlay-backdrop');
            if (backdrop) backdrop.click();
        }
        await Utils.sleep(200);
        return true;
    }

    async applyToggle(selector, state) {
        const toggle = document.querySelector(selector);
        if (!toggle) return false;
        const btn = toggle.querySelector('button[role="switch"]');
        if (!btn || btn.disabled) return true;
        if ((btn.getAttribute('aria-checked') === 'true') !== state) {
            btn.click();
            await Utils.sleep(100);
        }
        return true;
    }

    async run() {
        if (!await this.preparePanel()) return false;
        const cfg = Config.load();

        // Expand sections logic
        const headers = Array.from(document.querySelectorAll('.settings-group-header:not(.expanded)'));
        for (const h of headers) {
            if (h.textContent.match(/(Tools|Advanced)/)) {
                h.querySelector('button')?.click();
                await Utils.sleep(250);
            }
        }

        // --- Values (Check .enabled property!) ---
        if (cfg.temperature.enabled) Utils.setInputValue(document.querySelector('div[data-test-id="temperatureSliderContainer"] input'), cfg.temperature.value);
        if (cfg.topP.enabled) Utils.setInputValue(document.querySelector('ms-slider input[max="1"]'), cfg.topP.value);

        // !!! Max Output Tokens: Скрипт применит значение ТОЛЬКО если enabled === true
        if (cfg.maxOutputTokens.enabled) {
            Utils.setInputValue(document.querySelector('input[name="maxOutputTokens"]'), cfg.maxOutputTokens.value);
        }

        if (cfg.mediaResolution.enabled) await this.applyDropdown(cfg.mediaResolution.value, 'mediaResolution');
        if (cfg.thinkingLevel.enabled) await this.applyDropdown(cfg.thinkingLevel.value, 'Thinking Level');

        // --- Tools ---
        if (cfg.structuredOutput.enabled) await this.applyToggle('.structured-output-toggle', cfg.structuredOutput.value);
        if (cfg.codeExecution.enabled) await this.applyToggle('.code-execution-toggle', cfg.codeExecution.value);
        if (cfg.functionCalling.enabled) await this.applyToggle('.function-calling-toggle', cfg.functionCalling.value);
        if (cfg.googleSearch.enabled) await this.applyToggle('.search-as-a-tool-toggle', cfg.googleSearch.value);

        if (cfg.urlContext.enabled) {
             const el = document.querySelector('ms-browse-as-a-tool mat-slide-toggle');
             if (el) {
                 const btn = el.querySelector('button');
                 if (btn && (btn.getAttribute('aria-checked') === 'true') !== cfg.urlContext.value) btn.click();
             }
        }

        // Close on Mobile
        if (Utils.isMobile() && this.openedByScript) {
             await Utils.sleep(500);
             const closeBtn = document.querySelector('ms-run-settings button[iconname="close"]');
             if (closeBtn) { closeBtn.click(); this.openedByScript = false; }
        }

        return true;
    }
  }

  // ==================== 5. MAIN ====================
  class Main {
    constructor() {
        this.applier = new SettingsApplier();
        this.ui = new SettingsUI(() => this.restart());
        this.btn = null;
        this.attempts = 0;
        this.createBtn();
        GM_registerMenuCommand("⚙️ Settings", () => this.ui.open());
    }

    createBtn() {
        if (document.getElementById('as-fab')) return;
        const btn = document.createElement('button');
        btn.id = 'as-fab';
        btn.className = 'as-fab';
        btn.innerHTML = `<span class="material-symbols-outlined">settings_motion</span>`;

        const css = `
            .as-fab {
                position: fixed; left: 20px; bottom: 80px; width: 48px; height: 48px;
                border-radius: 16px; background: #e8f0fe; color: #0b57d0; border: none;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15); cursor: pointer; z-index: 999998;
                display: flex; align-items: center; justify-content: center;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .as-fab:hover { transform: scale(1.05); background: #d3e3fd; box-shadow: 0 6px 14px rgba(0,0,0,0.2); }
            .as-fab:active { transform: scale(0.95); }
            .as-fab.loading span { animation: spin 1s linear infinite; }
            .as-fab.success { background: #e6f4ea; color: #137333; }
            .as-fab.error { background: #fce8e6; color: #c5221f; }
            @keyframes spin { 100% { transform: rotate(360deg); } }
        `;
        const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);

        let isDrag = false, startX, startY, iLeft, iBottom;
        const move = (e) => {
            const cx = e.clientX || e.touches[0].clientX;
            const cy = e.clientY || e.touches[0].clientY;
            if (Math.abs(cx - startX) > 5) isDrag = true;
            btn.style.left = (iLeft + cx - startX) + 'px';
            btn.style.bottom = (iBottom - cy + startY) + 'px';
        };
        const stop = () => { document.removeEventListener('mousemove', move); document.removeEventListener('touchmove', move); };
        const start = (e) => {
            if(e.button === 2) return;
            isDrag = false;
            startX = e.clientX || e.touches[0].clientX;
            startY = e.clientY || e.touches[0].clientY;
            const r = btn.getBoundingClientRect();
            iLeft = r.left; iBottom = window.innerHeight - r.bottom;
            document.addEventListener('mousemove', move); document.addEventListener('touchmove', move, {passive:false});
            document.addEventListener('mouseup', stop); document.addEventListener('touchend', stop);
        };

        btn.addEventListener('mousedown', start);
        btn.addEventListener('touchstart', start, {passive:false});
        btn.onclick = (e) => { if(!isDrag) this.restart(); };
        btn.oncontextmenu = (e) => { e.preventDefault(); if(!isDrag) this.ui.open(); };

        document.body.appendChild(btn);
        this.btn = btn;
    }

    setStatus(st) {
        if (!this.btn) return;
        const icon = this.btn.querySelector('span');
        this.btn.className = 'as-fab ' + st;
        if (st === 'loading') icon.textContent = 'settings';
        else if (st === 'success') {
            icon.textContent = 'check';
            this.ui.showToast('Settings Applied');
        } else icon.textContent = 'priority_high';
    }

    async loop() {
        this.setStatus('loading');
        try {
            if (await this.applier.run()) {
                this.setStatus('success');
                return;
            }
        } catch(e) { console.error(e); }

        if (++this.attempts < CONSTANTS.maxAttempts) setTimeout(() => this.loop(), CONSTANTS.retryDelay);
        else this.setStatus('error');
    }

    restart() {
        this.attempts = 0;
        this.applier.openedByScript = false;
        this.loop();
    }

    init() {
        let lastUrl = location.href;
        setInterval(() => { if (location.href !== lastUrl) { lastUrl = location.href; this.restart(); } }, 1000);
        setTimeout(() => this.restart(), 1500);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => new Main().init());
  else new Main().init();
})();
