// ==UserScript==
// @name         Google AI Studio - Auto Settings (Ultimate)
// @namespace    https://github.com/Stranmor/google-ai-studio-auto-settings
// @version      10.0
// @description  Reliable text-based search + Draggable UI + Mobile support + Auto Focus + Visual Settings Menu.
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
    defaults: {
      temperature: 1.0,
      topP: 0.0,
      mediaResolution: "Low"
    },

    get() {
      return {
        temperature: GM_getValue('temperature', this.defaults.temperature),
        topP: GM_getValue('topP', this.defaults.topP),
        mediaResolution: GM_getValue('mediaResolution', this.defaults.mediaResolution)
      };
    },

    set(key, value) {
      GM_setValue(key, value);
    },

    saveAll(settings) {
      this.set('temperature', parseFloat(settings.temperature));
      this.set('topP', parseFloat(settings.topP));
      this.set('mediaResolution', settings.mediaResolution);
    }
  };

  const CONSTANTS = {
    execution: {
      maxAttempts: 20,
      retryDelay: 500,
    },
    storageKey: "as-panel-pos-v10"
  };

  // ==================== UTILITIES ====================
  const Utils = {
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    
    isMobile: () => window.innerWidth < 768,

    findByText: (text, tag = "*") => {
      const xpath = `//${tag}[contains(text(), '${text}')]`;
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return result.singleNodeValue;
    },

    findInputNearLabel: (labelText) => {
      const label = Utils.findByText(labelText);
      if (!label) return null;
      
      let parent = label.parentElement;
      for (let i = 0; i < 6; i++) {
        if (!parent) break;
        const input = parent.querySelector('input[type="number"]');
        if (input) return input;
        parent = parent.parentElement;
      }
      return null;
    },

    setValue: (input, value) => {
      if (!input) return false;
      if (Math.abs(parseFloat(input.value) - value) < 0.01) return true;

      try {
        input.focus();
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeInputValueSetter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.blur();
        return true;
      } catch (e) {
        return false;
      }
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
          background: rgba(0, 0, 0, 0.5); z-index: 1000000;
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(2px);
        }
        .as-modal {
          background: white; padding: 24px; border-radius: 12px;
          width: 320px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);
          font-family: 'Google Sans', Roboto, sans-serif;
        }
        .as-modal h2 { margin: 0 0 20px 0; font-size: 20px; color: #1f2937; }
        .as-field { margin-bottom: 16px; }
        .as-field label { display: block; font-size: 14px; color: #4b5563; margin-bottom: 6px; font-weight: 500; }
        .as-input {
          width: 100%; padding: 8px 12px; border: 1px solid #d1d5db;
          border-radius: 6px; font-size: 14px; box-sizing: border-box;
          transition: border-color 0.2s;
        }
        .as-input:focus { outline: none; border-color: #3b82f6; ring: 2px solid #3b82f6; }
        .as-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; }
        .as-btn {
          padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500;
          cursor: pointer; border: none; transition: background 0.2s;
        }
        .as-btn-cancel { background: #f3f4f6; color: #374151; }
        .as-btn-cancel:hover { background: #e5e7eb; }
        .as-btn-save { background: #2563eb; color: white; }
        .as-btn-save:hover { background: #1d4ed8; }
      `;
      const style = document.createElement('style');
      style.id = 'as-modal-styles';
      style.textContent = css;
      document.head.appendChild(style);
    }

    open() {
      if (document.getElementById('as-settings-modal')) return;

      const settings = ConfigManager.get();
      
      const overlay = document.createElement('div');
      overlay.className = 'as-modal-overlay';
      overlay.id = 'as-settings-modal';
      
      overlay.innerHTML = `
        <div class="as-modal">
          <h2>Auto Settings Config</h2>
          
          <div class="as-field">
            <label>Temperature (0.0 - 2.0)</label>
            <input type="number" id="as-cfg-temp" class="as-input" step="0.1" min="0" max="2" value="${settings.temperature}">
          </div>

          <div class="as-field">
            <label>Top P (0.0 - 1.0)</label>
            <input type="number" id="as-cfg-topp" class="as-input" step="0.05" min="0" max="1" value="${settings.topP}">
          </div>

          <div class="as-field">
            <label>Media Resolution</label>
            <select id="as-cfg-res" class="as-input">
              <option value="Low" ${settings.mediaResolution === 'Low' ? 'selected' : ''}>Low</option>
              <option value="Medium" ${settings.mediaResolution === 'Medium' ? 'selected' : ''}>Medium</option>
              <option value="High" ${settings.mediaResolution === 'High' ? 'selected' : ''}>High</option>
            </select>
          </div>

          <div class="as-actions">
            <button class="as-btn as-btn-cancel" id="as-btn-cancel">Cancel</button>
            <button class="as-btn as-btn-save" id="as-btn-save">Save & Apply</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      // Event Listeners
      document.getElementById('as-btn-cancel').onclick = () => this.close();
      overlay.onclick = (e) => { if(e.target === overlay) this.close(); };
      
      document.getElementById('as-btn-save').onclick = () => {
        const newSettings = {
          temperature: document.getElementById('as-cfg-temp').value,
          topP: document.getElementById('as-cfg-topp').value,
          mediaResolution: document.getElementById('as-cfg-res').value
        };
        ConfigManager.saveAll(newSettings);
        this.close();
        this.onSave(); // Trigger re-run
      };
    }

    close() {
      const el = document.getElementById('as-settings-modal');
      if (el) el.remove();
    }
  }

  // ==================== MOBILE HANDLER ====================
  const MobileHandler = {
    isPanelOpen: () => {
      const input = document.querySelector('input[type="number"]');
      return input && input.offsetParent !== null;
    },
    findToggleButton: () => {
      const icons = Array.from(document.querySelectorAll('.material-symbols-outlined, .material-icons'));
      const tuneIcon = icons.find(icon => icon.textContent.trim() === 'tune');
      if (tuneIcon) return tuneIcon.closest('button');
      return document.querySelector('button.runsettings-toggle-button');
    },
    async toggle(shouldOpen) {
      if (this.isPanelOpen() === shouldOpen) return true;
      const btn = this.findToggleButton();
      if (!btn) return false;
      btn.click();
      for (let i = 0; i < 5; i++) {
        await Utils.sleep(200);
        if (this.isPanelOpen() === shouldOpen) return true;
      }
      return false;
    }
  };

  // ==================== SETTINGS APPLIER ====================
  class SettingsApplier {
    constructor() {
      this.status = { temp: false, topP: false, res: false };
    }

    reset() {
      this.status = { temp: false, topP: false, res: false };
    }

    async applyResolution(targetRes) {
      if (this.status.res) return true;
      const label = Utils.findByText("Media resolution");
      if (!label) return false;

      let parent = label.parentElement;
      let select = null;
      for (let i = 0; i < 6; i++) {
        if (!parent) break;
        select = parent.querySelector('mat-select');
        if (select) break;
        parent = parent.parentElement;
      }

      if (!select) return false;

      const currentVal = select.querySelector('.mat-mdc-select-value-text span')?.textContent?.trim();
      if (currentVal === targetRes) {
        this.status.res = true;
        return true;
      }

      select.click();
      await Utils.sleep(150);
      
      const options = document.querySelectorAll('mat-option');
      let clicked = false;
      for (const opt of options) {
        if (opt.textContent.includes(targetRes)) {
          opt.click();
          clicked = true;
          break;
        }
      }

      if (!clicked) document.body.click();
      else this.status.res = true;
      return this.status.res;
    }

    async run() {
      const settings = ConfigManager.get();

      if (Utils.isMobile()) {
        await MobileHandler.toggle(true);
        await Utils.sleep(300);
      }

      if (!this.status.temp) {
        const input = Utils.findInputNearLabel("Temperature");
        if (input && Utils.setValue(input, settings.temperature)) this.status.temp = true;
      }

      if (!this.status.topP) {
        const input = Utils.findInputNearLabel("Top P") || Utils.findInputNearLabel("Top-P");
        if (input) {
          if (settings.topP === 0) input.removeAttribute('min');
          if (Utils.setValue(input, settings.topP)) this.status.topP = true;
        }
      }

      await this.applyResolution(settings.mediaResolution);

      const allDone = this.status.temp && this.status.topP && this.status.res;

      if (Utils.isMobile() && allDone) {
        await Utils.sleep(200);
        await MobileHandler.toggle(false);
      }

      return allDone;
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
      const old = document.getElementById('as-panel-v10');
      if (old) old.remove();

      this.panel = document.createElement('div');
      this.panel.id = 'as-panel-v10';
      this.panel.title = "Left Click: Retry | Right Click: Settings";
      
      Object.assign(this.panel.style, {
        position: 'fixed', zIndex: '999999', width: '32px', height: '32px',
        background: '#ffffff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', userSelect: 'none', border: '1px solid #e5e7eb',
        fontSize: '18px', transition: 'transform 0.1s'
      });

      const savedPos = localStorage.getItem(CONSTANTS.storageKey);
      if (savedPos) {
        const { left, bottom } = JSON.parse(savedPos);
        this.panel.style.left = left;
        this.panel.style.bottom = bottom;
      } else {
        this.panel.style.left = '20px';
        this.panel.style.bottom = '20px';
      }

      this.updateStatus('loading');
      document.body.appendChild(this.panel);
      this.makeDraggable();
      
      // Click Events
      this.panel.addEventListener('click', () => { 
        if (!this.isDragging) this.onRetry(); 
      });
      
      this.panel.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!this.isDragging) this.onSettings();
      });
    }

    updateStatus(state) {
      if (!this.panel) return;
      if (state === 'loading') {
        this.panel.innerHTML = '⏳';
        this.panel.style.borderColor = '#3b82f6';
      } else if (state === 'success') {
        this.panel.innerHTML = '<span style="color:#10b981">✓</span>';
        this.panel.style.borderColor = '#10b981';
      } else {
        this.panel.innerHTML = '<span style="color:#ef4444">!</span>';
        this.panel.style.borderColor = '#ef4444';
      }
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
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchend', onUp);
      };
      const onMove = (e) => {
        const cx = e.clientX || e.touches?.[0]?.clientX;
        const cy = e.clientY || e.touches?.[0]?.clientY;
        if (Math.abs(cx - startX) > 3 || Math.abs(cy - startY) > 3) {
          this.isDragging = true;
          if (e.preventDefault) e.preventDefault();
        }
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
      this.panel.addEventListener('mousedown', onDown);
      this.panel.addEventListener('touchstart', onDown, { passive: false });
    }
  }

  // ==================== MAIN CONTROLLER ====================
  class Main {
    constructor() {
      this.applier = new SettingsApplier();
      this.modal = new SettingsModal(() => this.startProcess());
      
      this.ui = new UI(
        () => this.startProcess(), // Left click: Retry
        () => this.modal.open()    // Right click: Settings
      );
      
      this.attempts = 0;
      this.timer = null;

      // Register Tampermonkey Menu Command
      GM_registerMenuCommand("⚙️ Configure Auto Settings", () => this.modal.open());
    }

    init() {
      let lastUrl = location.href;
      setInterval(() => {
        if (location.href !== lastUrl) {
          lastUrl = location.href;
          this.startProcess();
        }
      }, 1000);
      this.startProcess();
    }

    startProcess() {
      this.applier.reset();
      this.attempts = 0;
      this.ui.updateStatus('loading');
      if (this.timer) clearTimeout(this.timer);
      this.loop();
    }

    async loop() {
      const done = await this.applier.run();
      
      if (done) {
        this.ui.updateStatus('success');
        setTimeout(() => Utils.focusPrompt(), 100);
      } else {
        this.attempts++;
        if (this.attempts < CONSTANTS.execution.maxAttempts) {
          this.timer = setTimeout(() => this.loop(), CONSTANTS.execution.retryDelay);
        } else {
          this.ui.updateStatus('error');
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
