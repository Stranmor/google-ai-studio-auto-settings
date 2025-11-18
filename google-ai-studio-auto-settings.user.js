// ==UserScript==
// @name         Google AI Studio - Auto Settings (Ultimate)
// @namespace    https://github.com/Stranmor/google-ai-studio-auto-settings
// @version      9.0
// @description  Best of both worlds: Reliable text-based search + Draggable UI + Mobile support.
// @author       Stranmor
// @match        https://aistudio.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=aistudio.google.com
// @grant        none
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(function () {
  "use strict";

  // ==================== КОНФИГУРАЦИЯ ====================
  const CONFIG = {
    settings: {
      temperature: 1.0,
      topP: 0.0,
      mediaResolution: "Low", // "Low", "Medium", "High"
    },
    execution: {
      maxAttempts: 20,    // Сколько раз пытаться применить (раз в 500мс)
      retryDelay: 500,    // Пауза между попытками
    },
    storageKey: "as-panel-pos-v9"
  };

  // ==================== ИНСТРУМЕНТЫ (UTILS) ====================
  const Utils = {
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),

    isMobile: () => window.innerWidth < 768,

    // Надежный поиск элемента по тексту (XPath)
    findByText: (text, tag = "*") => {
      const xpath = `//${tag}[contains(text(), '${text}')]`;
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return result.singleNodeValue;
    },

    // Поиск инпута рядом с текстовой меткой (обходит Shadow DOM и вложенность)
    findInputNearLabel: (labelText) => {
      const label = Utils.findByText(labelText);
      if (!label) return null;

      // Ищем вверх на 6 уровней, проверяя наличие input внутри
      let parent = label.parentElement;
      for (let i = 0; i < 6; i++) {
        if (!parent) break;
        const input = parent.querySelector('input[type="number"]');
        if (input) return input;
        parent = parent.parentElement;
      }
      return null;
    },

    // Эмуляция ввода пользователя (Focus -> Value -> Event -> Blur)
    setValue: (input, value) => {
      if (!input) return false;
      if (Math.abs(parseFloat(input.value) - value) < 0.01) return true; // Уже стоит

      try {
        input.focus();
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeInputValueSetter.call(input, value);

        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.blur();
        return true;
      } catch (e) {
        console.error("Set value error:", e);
        return false;
      }
    }
  };

  // ==================== ЛОГИКА МОБИЛЬНОЙ ВЕРСИИ ====================
  const MobileHandler = {
    // Проверяет, открыта ли панель (виден ли инпут температуры)
    isPanelOpen: () => {
      const input = document.querySelector('input[type="number"]');
      return input && input.offsetParent !== null;
    },

    // Ищет кнопку настроек (обычно иконка 'tune')
    findToggleButton: () => {
      // 1. Ищем по иконке Material Symbols
      const icons = Array.from(document.querySelectorAll('.material-symbols-outlined, .material-icons'));
      const tuneIcon = icons.find(icon => icon.textContent.trim() === 'tune');
      if (tuneIcon) return tuneIcon.closest('button');

      // 2. Ищем по классу (резерв)
      return document.querySelector('button.runsettings-toggle-button');
    },

    async toggle(shouldOpen) {
      if (this.isPanelOpen() === shouldOpen) return true;

      const btn = this.findToggleButton();
      if (!btn) return false;

      btn.click();
      // Ждем анимацию
      for (let i = 0; i < 5; i++) {
        await Utils.sleep(200);
        if (this.isPanelOpen() === shouldOpen) return true;
      }
      return false;
    }
  };

  // ==================== ЛОГИКА ПРИМЕНЕНИЯ НАСТРОЕК ====================
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

      // Ищем селект рядом с меткой
      let parent = label.parentElement;
      let select = null;
      for (let i = 0; i < 6; i++) {
        if (!parent) break;
        select = parent.querySelector('mat-select');
        if (select) break;
        parent = parent.parentElement;
      }

      if (!select) return false;

      // Проверка текущего значения
      const currentVal = select.querySelector('.mat-mdc-select-value-text span')?.textContent?.trim();
      if (currentVal === targetRes) {
        this.status.res = true;
        return true;
      }

      // Клик и выбор
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

      if (!clicked) document.body.click(); // Закрыть если не нашли
      else this.status.res = true;

      return this.status.res;
    }

    async run() {
      // 1. Мобильная версия: Открыть панель
      if (Utils.isMobile()) {
        await MobileHandler.toggle(true);
        await Utils.sleep(300);
      }

      // 2. Применение Temperature
      if (!this.status.temp) {
        const input = Utils.findInputNearLabel("Temperature");
        if (input && Utils.setValue(input, CONFIG.settings.temperature)) {
          this.status.temp = true;
        }
      }

      // 3. Применение Top P
      if (!this.status.topP) {
        const input = Utils.findInputNearLabel("Top P") || Utils.findInputNearLabel("Top-P");
        if (input) {
          if (CONFIG.settings.topP === 0) input.removeAttribute('min');
          if (Utils.setValue(input, CONFIG.settings.topP)) {
            this.status.topP = true;
          }
        }
      }

      // 4. Применение Resolution
      await this.applyResolution(CONFIG.settings.mediaResolution);

      const allDone = this.status.temp && this.status.topP && this.status.res;

      // 5. Мобильная версия: Закрыть панель если всё готово
      if (Utils.isMobile() && allDone) {
        await Utils.sleep(200);
        await MobileHandler.toggle(false);
      }

      return allDone;
    }
  }

  // ==================== UI (DRAGGABLE PANEL) ====================
  class UI {
    constructor(onRetry) {
      this.panel = null;
      this.onRetry = onRetry;
      this.render();
    }

    render() {
      // Удаляем старую панель если есть
      const old = document.getElementById('as-panel-v9');
      if (old) old.remove();

      this.panel = document.createElement('div');
      this.panel.id = 'as-panel-v9';

      // Стили
      Object.assign(this.panel.style, {
        position: 'fixed',
        zIndex: '999999',
        width: '32px',
        height: '32px',
        background: '#ffffff',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        userSelect: 'none',
        border: '1px solid #e5e7eb',
        fontSize: '18px',
        transition: 'transform 0.1s'
      });

      // Загрузка позиции
      const savedPos = localStorage.getItem(CONFIG.storageKey);
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

      // События
      this.makeDraggable();
      this.panel.addEventListener('click', (e) => {
        if (!this.isDragging) this.onRetry();
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
        // Игнорируем клик правой кнопкой
        if (e.button === 2) return;

        this.isDragging = false;
        const clientX = e.clientX || e.touches?.[0]?.clientX;
        const clientY = e.clientY || e.touches?.[0]?.clientY;

        startX = clientX;
        startY = clientY;

        const rect = this.panel.getBoundingClientRect();
        startLeft = rect.left;
        startBottom = window.innerHeight - rect.bottom;

        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchend', onUp);
      };

      const onMove = (e) => {
        const clientX = e.clientX || e.touches?.[0]?.clientX;
        const clientY = e.clientY || e.touches?.[0]?.clientY;

        // Если сдвинули больше чем на 3 пикселя, считаем это перетаскиванием
        if (Math.abs(clientX - startX) > 3 || Math.abs(clientY - startY) > 3) {
          this.isDragging = true;
          if (e.preventDefault) e.preventDefault(); // Блокируем скролл на мобильных
        }

        const dx = clientX - startX;
        const dy = clientY - startY;

        this.panel.style.left = `${startLeft + dx}px`;
        this.panel.style.bottom = `${startBottom - dy}px`;
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchend', onUp);

        // Сохраняем позицию
        localStorage.setItem(CONFIG.storageKey, JSON.stringify({
          left: this.panel.style.left,
          bottom: this.panel.style.bottom
        }));
      };

      this.panel.addEventListener('mousedown', onDown);
      this.panel.addEventListener('touchstart', onDown, { passive: false });
    }
  }

  // ==================== ГЛАВНЫЙ КОНТРОЛЛЕР ====================
  class Main {
    constructor() {
      this.applier = new SettingsApplier();
      this.ui = new UI(() => this.startProcess());
      this.attempts = 0;
      this.timer = null;
    }

    init() {
      // Следим за URL (SPA навигация)
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
      } else {
        this.attempts++;
        if (this.attempts < CONFIG.execution.maxAttempts) {
          this.timer = setTimeout(() => this.loop(), CONFIG.execution.retryDelay);
        } else {
          this.ui.updateStatus('error');
        }
      }
    }
  }

  // ЗАПУСК
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new Main().init());
  } else {
    new Main().init();
  }

})();
