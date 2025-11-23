// ==UserScript==
// @name         Google AI Studio - Auto Settings (Ultimate Custom)
// @namespace    https://github.com/Stranmor/google-ai-studio-auto-settings
// @version      13.0
// @description  Customizable settings: 'Default' resolution added, individual setting toggles, removed reset button.
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

  // ==================== CONFIGURATION MANAGER ====================
  const ConfigManager = {
    // Default structure: { value: <val>, enabled: <bool> }
    defaults: {
      temperature: { value: 1.0, enabled: true },
      topP: { value: 0.95, enabled: true },
      maxOutputTokens: { value: 8192, enabled: true },
      // Updated: Default is now "Default" as requested
      mediaResolution: { value: "Default", enabled: true },
      thinkingLevel: { value: "High", enabled: true },
      // Toggles
      googleSearch: { value: true, enabled: true },
      urlContext: { value: false, enabled: true },
      codeExecution: { value: false, enabled: true },
      structuredOutput: { value: false, enabled: true },
      functionCalling: { value: false, enabled: true }
    },

    load() {
      const saved = GM_getValue('as_config_v13', null);
      if (!saved) {
        // Migration attempt from v12 (if exists) or use defaults
        const old = GM_getValue('as_config_v12', null);
        if (old) {
            // Update mediaResolution if it was something else, or keep user pref
            return { ...this.defaults, ...old };
        }
        return this.defaults;
      }
      return { ...this.defaults, ...saved };
    },

    save(config) {
      GM_setValue('as_config_v13', config);
    }
  };

  const CONSTANTS = {
    execution: {
      maxAttempts: 25,
      retryDelay: 500,
    },
    storageKey: "as-panel-pos-v13"
  };

  // ==================== UTILITIES ====================
  const Utils = {
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),

    isMobile: () => window.innerWidth < 768,

    // Robust input setter
    setValue: (input, value) => {
      if (!input) return false;
      if (input.disabled) return false;

      let currentVal = input.value;
      if (input.type === 'number') currentVal = parseFloat(currentVal);
      if (currentVal == value) return true;

      try {
        input.focus();
        const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
        if (descriptor && descriptor.set) {
            descriptor.set.call(input, value);
        } else {
            input.value = value;
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.blur();
        return true;
      } catch (e) { return false; }
    },

    focusPrompt: () => {
      const selectors = ['textarea.textarea', '.ms-autosize-textarea textarea', 'textarea[placeholder*="Type"]', 'textarea'];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          el.focus();
          if (el.value) el.selectionStart = el.selectionEnd = el.value.length;
          return true;
        }
      }
      return false;
    },

    expandSection: async (titleText) => {
        const headers = Array.from(document.querySelectorAll('.settings-group-header'));
        const target = headers.find(h => h.textContent.includes(titleText));
        if (target && !target.classList.contains('expanded')) {
            const btn = target.querySelector('button');
            if (btn) {
                btn.click();
                await Utils.sleep(250);
            }
        }
    }
  };

  // ==================== SETTINGS MODAL (UI) ====================
  class SettingsModal {
    constructor(onSave) {
      this.onSave = onSave;
      this.injectStyles();
    }

    injectStyles() {
      if (document.getElementById('as-modal-styles')) return;
      const css = `
        .as-modal-overlay {
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(0, 0, 0, 0.4); z-index: 1000000;
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(3px);
        }
        .as-modal {
          background: #fff; padding: 24px; border-radius: 16px;
          width: 450px; max-height: 85vh; overflow-y: auto;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          font-family: 'Google Sans', Roboto, sans-serif; color: #1f2937;
        }
        .as-header { margin-bottom: 20px; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; }
        .as-header h2 { margin: 0; font-size: 20px; font-weight: 500; }

        .as-section-title { font-size: 12px; font-weight: 700; color: #6b7280; text-transform: uppercase; margin: 16px 0 8px 0; letter-spacing: 0.5px; }

        .as-item { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; padding: 4px 0; }
        .as-enable-cb { width: 18px; height: 18px; cursor: pointer; accent-color: #2563eb; }
        .as-label { flex: 1; font-size: 14px; font-weight: 500; color: #374151; }
        .as-input-wrapper { flex: 1; display: flex; justify-content: flex-end; }
        .as-input { width: 100px; padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; }
        .as-input:disabled { background: #f3f4f6; color: #9ca3af; cursor: not-allowed; }
        .as-select { width: 122px; padding: 6px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: white; }
        .as-select:disabled { background: #f3f4f6; color: #9ca3af; }

        .as-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
        .as-btn { padding: 8px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; transition: all 0.2s; }
        .as-btn-cancel { background: #f3f4f6; color: #4b5563; }
        .as-btn-cancel:hover { background: #e5e7eb; }
        .as-btn-save { background: #2563eb; color: white; }
        .as-btn-save:hover { background: #1d4ed8; shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.5); }
      `;
      const style = document.createElement('style');
      style.id = 'as-modal-styles';
      style.textContent = css;
      document.head.appendChild(style);
    }

    createRow(key, label, type, config, options = []) {
      const isEnabled = config[key].enabled;
      const value = config[key].value;

      const div = document.createElement('div');
      div.className = 'as-item';

      // Checkbox for Enabling/Disabling the setting
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'as-enable-cb';
      cb.checked = isEnabled;
      cb.dataset.key = key;
      cb.title = "Uncheck to stop applying this setting (keep Google default)";

      const labelEl = document.createElement('span');
      labelEl.className = 'as-label';
      labelEl.textContent = label;

      const wrapper = document.createElement('div');
      wrapper.className = 'as-input-wrapper';

      let input;
      if (type === 'select') {
        input = document.createElement('select');
        input.className = 'as-select';
        options.forEach(opt => {
          const o = document.createElement('option');
          o.value = opt;
          o.textContent = opt;
          if (opt === value) o.selected = true;
          input.appendChild(o);
        });
      } else if (type === 'number') {
        input = document.createElement('input');
        input.type = 'number';
        input.className = 'as-input';
        input.value = value;
        if (key === 'temperature') { input.step = 0.1; input.min = 0; input.max = 2; }
        if (key === 'topP') { input.step = 0.05; input.min = 0; input.max = 1; }
      } else if (type === 'toggle') {
        input = document.createElement('select');
        input.className = 'as-select';
        const on = document.createElement('option'); on.value = 'true'; on.textContent = 'Force ON';
        const off = document.createElement('option'); off.value = 'false'; off.textContent = 'Force OFF';
        if (String(value) === 'true') on.selected = true; else off.selected = true;
        input.appendChild(on);
        input.appendChild(off);
      }

      input.id = `as-input-${key}`;
      input.disabled = !isEnabled;

      cb.onchange = () => { input.disabled = !cb.checked; };

      wrapper.appendChild(input);
      div.appendChild(cb);
      div.appendChild(labelEl);
      div.appendChild(wrapper);

      return div;
    }

    open() {
      if (document.getElementById('as-settings-modal')) return;
      let cfg = ConfigManager.load();

      const overlay = document.createElement('div');
      overlay.className = 'as-modal-overlay';
      overlay.id = 'as-settings-modal';

      const content = document.createElement('div');
      content.className = 'as-modal';

      // Header (Removed Reset Button)
      const header = document.createElement('div');
      header.className = 'as-header';
      header.innerHTML = `<h2>Auto Settings</h2>`;
      content.appendChild(header);

      // --- Parameters Section ---
      const pTitle = document.createElement('div'); pTitle.className = 'as-section-title'; pTitle.textContent = 'Generation Parameters';
      content.appendChild(pTitle);

      content.appendChild(this.createRow('temperature', 'Temperature', 'number', cfg));
      content.appendChild(this.createRow('topP', 'Top P', 'number', cfg));
      content.appendChild(this.createRow('maxOutputTokens', 'Max Tokens', 'number', cfg));

      // Added 'Default' to options
      content.appendChild(this.createRow('mediaResolution', 'Media Resolution', 'select', cfg, ['Default', 'Low', 'Medium', 'High']));

      content.appendChild(this.createRow('thinkingLevel', 'Thinking Level', 'select', cfg, ['Low', 'High']));

      // --- Tools Section ---
      const tTitle = document.createElement('div'); tTitle.className = 'as-section-title'; tTitle.textContent = 'Tools & Integrations';
      content.appendChild(tTitle);

      content.appendChild(this.createRow('googleSearch', 'Google Search', 'toggle', cfg));
      content.appendChild(this.createRow('urlContext', 'URL Context', 'toggle', cfg));
      content.appendChild(this.createRow('codeExecution', 'Code Execution', 'toggle', cfg));
      content.appendChild(this.createRow('structuredOutput', 'Structured Outputs', 'toggle', cfg));
      content.appendChild(this.createRow('functionCalling', 'Function Calling', 'toggle', cfg));

      // Actions
      const actions = document.createElement('div');
      actions.className = 'as-actions';
      actions.innerHTML = `
        <button class="as-btn as-btn-cancel" id="as-btn-cancel">Cancel</button>
        <button class="as-btn as-btn-save" id="as-btn-save">Save Settings</button>
      `;
      content.appendChild(actions);
      overlay.appendChild(content);
      document.body.appendChild(overlay);

      // Handlers
      document.getElementById('as-btn-cancel').onclick = () => this.close();
      overlay.onclick = (e) => { if(e.target === overlay) this.close(); };

      document.getElementById('as-btn-save').onclick = () => {
        const newConfig = {};
        Object.keys(ConfigManager.defaults).forEach(key => {
            const cb = content.querySelector(`input[data-key="${key}"]`);
            const input = document.getElementById(`as-input-${key}`);
            let val = input.value;

            if (key === 'googleSearch' || key === 'urlContext' || key === 'codeExecution' || key === 'structuredOutput' || key === 'functionCalling') {
                val = (val === 'true');
            } else if (key === 'temperature' || key === 'topP') {
                val = parseFloat(val);
            } else if (key === 'maxOutputTokens') {
                val = parseInt(val, 10);
            }

            newConfig[key] = {
                enabled: cb.checked,
                value: val
            };
        });
        ConfigManager.save(newConfig);
        this.close();
        this.onSave();
      };
    }

    close() {
      const el = document.getElementById('as-settings-modal');
      if (el) el.remove();
    }
  }

  // ==================== SETTINGS APPLIER ====================
  class SettingsApplier {
    constructor() {
      this.status = { done: false };
    }

    async applyDropdown(targetText, containerName) {
        let el = document.querySelector(`mat-select[aria-label="${containerName}"]`);

        if (!el) {
            const label = Utils.findByText(containerName, 'h3');
            if (label) {
                el = label.closest('.settings-item')?.querySelector('mat-select');
            }
        }

        if (!el) return false;

        const currentVal = el.querySelector('.mat-mdc-select-value-text span')?.textContent?.trim();
        // Check if value already matches
        if (currentVal === targetText) return true;

        el.click();
        await Utils.sleep(200);

        const options = document.querySelectorAll('mat-option');
        let clicked = false;
        for (const opt of options) {
            // Trim and check content
            if (opt.textContent.trim().includes(targetText)) {
                opt.click();
                clicked = true;
                break;
            }
        }
        if (!clicked) document.body.click();
        return clicked;
    }

    async applyToggle(wrapperSelector, shouldBeOn) {
        let wrapper = document.querySelector(wrapperSelector);
        if (!wrapper) return false;

        const btn = wrapper.querySelector('button[role="switch"]');
        if (!btn) return false;

        if (btn.disabled) return true;

        const isChecked = btn.getAttribute('aria-checked') === 'true';
        if (isChecked === shouldBeOn) return true;

        btn.click();
        await Utils.sleep(100);
        return true;
    }

    async run() {
      const cfg = ConfigManager.load();

      if (Utils.isMobile()) {
         const btn = document.querySelector('button.runsettings-toggle-button');
         if (btn && !document.querySelector('.ms-right-side-panel')) {
             btn.click();
             await Utils.sleep(400);
         }
      }

      const needTools = cfg.structuredOutput.enabled || cfg.codeExecution.enabled || cfg.functionCalling.enabled || cfg.googleSearch.enabled || cfg.urlContext.enabled;
      const needAdvanced = cfg.topP.enabled || cfg.maxOutputTokens.enabled;

      if (needTools) await Utils.expandSection('Tools');
      if (needAdvanced) await Utils.expandSection('Advanced settings');

      // --- Apply Enabled Settings ---

      if (cfg.temperature.enabled) {
          const input = document.querySelector('div[data-test-id="temperatureSliderContainer"] input[type="number"]');
          Utils.setValue(input, cfg.temperature.value);
      }

      if (cfg.topP.enabled) {
          const input = document.querySelector('ms-slider input[type="number"][max="1"]');
          if(input) Utils.setValue(input, cfg.topP.value);
      }

      if (cfg.maxOutputTokens.enabled) {
          const input = document.querySelector('input[name="maxOutputTokens"]');
          Utils.setValue(input, cfg.maxOutputTokens.value);
      }

      if (cfg.mediaResolution.enabled) {
          await this.applyDropdown(cfg.mediaResolution.value, 'Media resolution');
      }

      if (cfg.thinkingLevel.enabled) {
           await this.applyDropdown(cfg.thinkingLevel.value, 'Thinking Level');
      }

      if (cfg.structuredOutput.enabled) await this.applyToggle('.structured-output-toggle', cfg.structuredOutput.value);
      if (cfg.codeExecution.enabled) await this.applyToggle('.code-execution-toggle', cfg.codeExecution.value);
      if (cfg.functionCalling.enabled) await this.applyToggle('.function-calling-toggle', cfg.functionCalling.value);
      if (cfg.googleSearch.enabled) await this.applyToggle('.search-as-a-tool-toggle', cfg.googleSearch.value);

      if (cfg.urlContext.enabled) {
          const wrapper = document.querySelector('ms-browse-as-a-tool mat-slide-toggle');
          if (wrapper) {
             const btn = wrapper.querySelector('button');
             if (btn && btn.getAttribute('aria-checked') !== String(cfg.urlContext.value)) {
                 btn.click();
             }
          }
      }

      return true;
    }
  }

  // ==================== UI (DRAGGABLE PANEL) ====================
  class UI {
    constructor(onRetry, onSettings) {
      this.panel = null;
      this.onRetry = onRetry;
      this.onSettings = onSettings;
      this.isDragging = false;
      this.render();
    }

    render() {
      const old = document.getElementById('as-panel-v13');
      if (old) old.remove();

      this.panel = document.createElement('div');
      this.panel.id = 'as-panel-v13';
      this.panel.title = "Left: Retry Apply | Right: Settings";

      Object.assign(this.panel.style, {
        position: 'fixed', zIndex: '999999', width: '38px', height: '38px',
        background: 'white', borderRadius: '12px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', userSelect: 'none', border: '1px solid #e5e7eb',
        transition: 'transform 0.1s, border-color 0.2s',
      });

      const savedPos = localStorage.getItem(CONSTANTS.storageKey);
      if (savedPos) {
        const { left, bottom } = JSON.parse(savedPos);
        this.panel.style.left = left;
        this.panel.style.bottom = bottom;
      } else {
        this.panel.style.left = '24px';
        this.panel.style.bottom = '24px';
      }

      this.updateStatus('loading');
      document.body.appendChild(this.panel);
      this.makeDraggable();

      this.panel.addEventListener('click', () => { if (!this.isDragging) this.onRetry(); });
      this.panel.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!this.isDragging) this.onSettings();
      });
    }

    updateStatus(state) {
      if (!this.panel) return;
      this.panel.innerHTML = '';

      const icon = document.createElement('span');
      icon.className = 'material-symbols-outlined';
      icon.style.fontSize = '22px';

      if (state === 'loading') {
        icon.textContent = 'settings';
        icon.style.animation = 'as-spin 1.5s linear infinite';
        this.panel.style.borderColor = '#3b82f6';
        this.panel.style.color = '#3b82f6';
      } else if (state === 'success') {
        icon.textContent = 'check_circle';
        this.panel.style.borderColor = '#10b981';
        this.panel.style.color = '#10b981';
      } else {
        icon.textContent = 'warning';
        this.panel.style.borderColor = '#ef4444';
        this.panel.style.color = '#ef4444';
      }
      this.panel.appendChild(icon);
    }

    makeDraggable() {
      let startX, startY, startLeft, startBottom;
      const onDown = (e) => {
        if (e.button === 2) return;
        this.isDragging = false;
        startX = e.clientX || e.touches?.[0]?.clientX;
        startY = e.clientY || e.touches?.[0]?.clientY;
        const rect = this.panel.getBoundingClientRect();
        startLeft = rect.left;
        startBottom = window.innerHeight - rect.bottom;

        const onMove = (e) => {
             const cx = e.clientX || e.touches?.[0]?.clientX;
             const cy = e.clientY || e.touches?.[0]?.clientY;
             if (Math.abs(cx - startX) > 3 || Math.abs(cy - startY) > 3) this.isDragging = true;
             this.panel.style.left = `${startLeft + (cx - startX)}px`;
             this.panel.style.bottom = `${startBottom - (cy - startY)}px`;
        };
        const onUp = () => {
             document.removeEventListener('mousemove', onMove);
             document.removeEventListener('touchmove', onMove);
             document.removeEventListener('mouseup', onUp);
             document.removeEventListener('touchend', onUp);
             localStorage.setItem(CONSTANTS.storageKey, JSON.stringify({
                 left: this.panel.style.left, bottom: this.panel.style.bottom
             }));
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchend', onUp);
      };
      this.panel.addEventListener('mousedown', onDown);
      this.panel.addEventListener('touchstart', onDown, { passive: false });
    }
  }

  class Main {
    constructor() {
      this.applier = new SettingsApplier();
      this.modal = new SettingsModal(() => this.startProcess());
      this.ui = new UI(
        () => this.startProcess(),
        () => this.modal.open()
      );
      this.attempts = 0;
      this.timer = null;

      const style = document.createElement('style');
      style.textContent = `@keyframes as-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
      document.head.appendChild(style);

      GM_registerMenuCommand("⚙️ Settings", () => this.modal.open());
    }

    init() {
      let lastUrl = location.href;
      setInterval(() => {
        if (location.href !== lastUrl) {
          lastUrl = location.href;
          this.startProcess();
        }
      }, 1000);

      setTimeout(() => this.startProcess(), 1000);
    }

    startProcess() {
      this.attempts = 0;
      this.ui.updateStatus('loading');
      if (this.timer) clearTimeout(this.timer);
      this.loop();
    }

    async loop() {
      try {
          await this.applier.run();
          this.attempts++;

          if (this.attempts > 4) {
            this.ui.updateStatus('success');
            Utils.focusPrompt();
            return;
          }
      } catch (e) {
          console.warn("AutoSettings Pending:", e);
      }

      if (this.attempts < CONSTANTS.execution.maxAttempts) {
        this.timer = setTimeout(() => this.loop(), CONSTANTS.execution.retryDelay);
      } else {
        if (document.querySelector('.ms-run-settings')) {
            this.ui.updateStatus('error');
        } else {
            this.ui.updateStatus('success');
        }
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new Main().init());
  } else {
    new Main().init();
  }

})();
