// ==UserScript==
// @name         Google AI Studio - Auto Settings
// @namespace    https://github.com/ai-studio-tools
// @version      7.0
// @description  Automatically configures model parameters (Temperature, Top-P, Media Resolution) in Google AI Studio with a clean, modern interface
// @author       AI Studio Tools
// @match        https://aistudio.google.com/prompts/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=aistudio.google.com
// @grant        none
// @run-at       document-end
// @license      MIT
// @homepageURL  https://github.com/ai-studio-tools/auto-settings
// @supportURL   https://github.com/ai-studio-tools/auto-settings/issues
// ==/UserScript==

(function() {
    'use strict';

    // ==================== CONFIGURATION ====================
    const CONFIG = {
        settings: {
            temperature: 0.7,
            topP: 0.00,
            mediaResolution: 'Low'
        },
        execution: {
            debug: true,
            maxAttempts: 30,
            retryDelay: 2000,
            pageLoadTimeout: 60000
        },
        selectors: {
            temperature: {
                container: '[data-test-id="temperatureSliderContainer"]',
                title: 'Temperature'
            },
            topP: {
                titles: ['Top P', 'Top-P']
            },
            mediaResolution: {
                container: '[data-test-id="mediaResolution"]',
                title: 'Media resolution'
            },
            promptInput: 'ms-autosize-textarea textarea.textarea'
        }
    };

    // ==================== UTILITIES ====================
    const Logger = {
        log: (message, ...args) => CONFIG.execution.debug && console.log(`[AS] ${message}`, ...args),
        warn: (message, ...args) => CONFIG.execution.debug && console.warn(`[AS] ${message}`, ...args),
        error: (message, ...args) => CONFIG.execution.debug && console.error(`[AS] ${message}`, ...args)
    };

    const TimeUtils = {
        sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms))
    };

    // ==================== DOM INTERACTION ====================
    class DOMInteractor {
        static findElementByText(selector, text) {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
                if (el.textContent.trim() === text) {
                    return el.closest('.settings-item-column, .settings-item');
                }
            }
            return null;
        }

        static click(element) {
            if (!element) return false;
            const eventOptions = { bubbles: true, cancelable: true, view: window };
            element.dispatchEvent(new MouseEvent('mousedown', eventOptions));
            element.focus?.();
            element.dispatchEvent(new MouseEvent('mouseup', eventOptions));
            element.dispatchEvent(new MouseEvent('click', eventOptions));
            return true;
        }

        static setValue(element, value) {
            if (!element) return false;
            element.focus();
            const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
            descriptor?.set?.call(element, value);
            ['input', 'change'].forEach(eventType => element.dispatchEvent(new Event(eventType, { bubbles: true })));
            element.blur();
            return true;
        }

        static isPageLoaded() {
            return document.querySelector(CONFIG.selectors.promptInput) !== null &&
                   document.querySelector('h3') !== null;
        }

        static restorePromptFocus() {
            const promptInput = document.querySelector(CONFIG.selectors.promptInput);
            if (promptInput) {
                setTimeout(() => {
                    promptInput.focus();
                    Logger.log('Focus restored to prompt input');
                }, 100);
                return true;
            }
            Logger.warn('Prompt input not found for focus restore');
            return false;
        }
    }

    // ==================== SETTINGS MANAGERS ====================
    class BaseSettingManager {
        constructor(name) {
            this.name = name;
            this.isApplied = false;
        }
        async check() { throw new Error('Method check() must be implemented'); }
        async apply() { throw new Error('Method apply() must be implemented'); }
        reset() { this.isApplied = false; }
        log(message, level = 'log') { Logger[level](`[${this.name}] ${message}`); }
    }

    class TemperatureManager extends BaseSettingManager {
        constructor() { super('Temperature'); }
        async check(targetValue) {
            const container = this._findContainer();
            if (!container) return false;
            const input = container.querySelector('input[type="number"]');
            if (!input) return false;
            const isMatch = Math.abs(parseFloat(input.value) - targetValue) < 0.001;
            if (isMatch) {
                this.isApplied = true;
                this.log(`Already set to ${targetValue}`);
            }
            return isMatch;
        }
        async apply(value) {
            if (this.isApplied) return true;
            const container = this._findContainer();
            if (!container) { this.log('Container not found', 'warn'); return false; }
            const numInput = container.querySelector('input[type="number"]');
            const rangeInput = container.querySelector('input[type="range"]');
            if (!numInput || !rangeInput) { this.log('Input elements not found', 'warn'); return false; }
            DOMInteractor.click(numInput);
            DOMInteractor.setValue(numInput, value);
            DOMInteractor.setValue(rangeInput, value);
            this.isApplied = await this.check(value);
            this.log(this.isApplied ? `Successfully set to ${value}` : `Failed to set to ${value}`, this.isApplied ? 'log' : 'error');
            return this.isApplied;
        }
        _findContainer() {
            return DOMInteractor.findElementByText('h3', CONFIG.selectors.temperature.title) ||
                   document.querySelector(CONFIG.selectors.temperature.container);
        }
    }

    class TopPManager extends BaseSettingManager {
        constructor() { super('TopP'); }
        async check(targetValue) {
            const container = this._findContainer();
            if (!container) return false;
            const input = container.querySelector('input[type="number"]');
            if (!input) return false;
            const isMatch = Math.abs(parseFloat(input.value) - targetValue) < 0.001;
            if (isMatch) {
                this.isApplied = true;
                this.log(`Already set to ${targetValue}`);
            }
            return isMatch;
        }
        async apply(value) {
            if (this.isApplied) return true;
            const container = this._findContainer();
            if (!container) { this.log('Container not found', 'warn'); return false; }
            const numInput = container.querySelector('input[type="number"]');
            const rangeInput = container.querySelector('input[type="range"]');
            if (!numInput || !rangeInput) { this.log('Input elements not found', 'warn'); return false; }
            if (value === 0) {
                this._removeMinConstraint(rangeInput);
                this._removeMinConstraint(numInput);
            }
            DOMInteractor.click(numInput);
            DOMInteractor.setValue(numInput, value);
            DOMInteractor.setValue(rangeInput, value);
            this.isApplied = await this.check(value);
            this.log(this.isApplied ? `Successfully set to ${value}` : `Failed to set to ${value}`, this.isApplied ? 'log' : 'error');
            return this.isApplied;
        }
        _findContainer() {
            for (const title of CONFIG.selectors.topP.titles) {
                const container = DOMInteractor.findElementByText('h3', title);
                if (container) return container;
            }
            return null;
        }
        _removeMinConstraint(input) {
            if (input) {
                input.removeAttribute('min');
                input.min = '0';
            }
        }
    }

    class MediaResolutionManager extends BaseSettingManager {
        constructor() { super('MediaResolution'); }
        async check(targetValue) {
            const container = this._findContainer();
            if (!container) return false;
            const select = container.querySelector('mat-select');
            if (!select) return false;
            const currentValue = select.querySelector('.mat-mdc-select-value-text span')?.textContent?.trim();
            const isMatch = currentValue === targetValue;
            if (isMatch) {
                this.isApplied = true;
                this.log(`Already set to ${targetValue}`);
            }
            return isMatch;
        }
        async apply(value) {
            if (this.isApplied) return true;
            const container = this._findContainer();
            if (!container) { this.log('Container not found', 'warn'); return false; }
            const select = container.querySelector('mat-select');
            if (!select) { this.log('Select element not found', 'warn'); return false; }
            DOMInteractor.click(select);
            await TimeUtils.sleep(100);
            const option = Array.from(document.querySelectorAll('mat-option'))
                                .find(opt => opt.querySelector('.mdc-list-item__primary-text')?.textContent?.trim() === value);
            if (!option) {
                this.log(`Option "${value}" not found`, 'error');
                DOMInteractor.click(document.body);
                return false;
            }
            DOMInteractor.click(option);
            await TimeUtils.sleep(100);
            this.isApplied = await this.check(value);
            this.log(this.isApplied ? `Successfully set to ${value}` : `Failed to set to ${value}`, this.isApplied ? 'log' : 'error');
            return this.isApplied;
        }
        _findContainer() {
            return DOMInteractor.findElementByText('h3', CONFIG.selectors.mediaResolution.title) ||
                   document.querySelector(CONFIG.selectors.mediaResolution.container);
        }
    }

    // ==================== ORCHESTRATOR ====================
    class SettingsOrchestrator {
        constructor() {
            this.managers = [
                new TemperatureManager(),
                new TopPManager(),
                new MediaResolutionManager()
            ];
        }
        async waitForPageLoad() {
            const startTime = Date.now();
            Logger.log('Waiting for page to load...');
            while (Date.now() - startTime < CONFIG.execution.pageLoadTimeout) {
                if (DOMInteractor.isPageLoaded()) {
                    Logger.log('Page loaded successfully');
                    return true;
                }
                await TimeUtils.sleep(500);
            }
            Logger.warn('Page load timeout, but continuing anyway...');
            return false;
        }
        async applyAll() {
            await this.waitForPageLoad();
            const { temperature, topP, mediaResolution } = CONFIG.settings;
            Logger.log('Starting settings application');
            for (let attempt = 1; attempt <= CONFIG.execution.maxAttempts; attempt++) {
                Logger.log(`Attempt ${attempt}/${CONFIG.execution.maxAttempts}`);
                if (!this.managers[0].isApplied) await this.managers[0].apply(temperature);
                if (!this.managers[1].isApplied) await this.managers[1].apply(topP);
                if (!this.managers[2].isApplied) await this.managers[2].apply(mediaResolution);
                if (this.isComplete()) {
                    Logger.log('All settings applied successfully');
                    DOMInteractor.restorePromptFocus();
                    return true;
                }
                if (attempt < CONFIG.execution.maxAttempts) {
                    await TimeUtils.sleep(CONFIG.execution.retryDelay);
                }
            }
            Logger.warn('Failed to apply all settings after maximum attempts');
            DOMInteractor.restorePromptFocus();
            return false;
        }
        isComplete() { return this.managers.every(m => m.isApplied); }
        reset() { this.managers.forEach(m => m.reset()); }
        getStatus() {
            return {
                total: this.managers.length,
                applied: this.managers.filter(m => m.isApplied).length,
                pending: this.managers.filter(m => !m.isApplied).map(m => m.name)
            };
        }
    }

    // ==================== UI COMPONENT ====================
    class UIComponent {
        constructor(orchestrator) {
            this.orchestrator = orchestrator;
            this.panel = null;
        }

        render() {
            // Inject styles first
            this._injectStyles();

            // Create panel
            const panel = document.createElement('div');
            panel.id = 'as-panel';
            panel.className = 'as-panel--loading';
            panel.innerHTML = `
                <div id="as-status">⏳</div>
                <div id="as-tooltip">Loading...</div>
            `;

            document.body.appendChild(panel);
            this.panel = panel;

            this.panel.addEventListener('click', () => this._handleClick());
            Logger.log('UI rendered successfully');
        }

        _injectStyles() {
            const style = document.createElement('style');
            style.id = 'as-styles';
            style.textContent = `
                #as-panel {
                    position: fixed !important;
                    bottom: 20px !important;
                    left: 20px !important;
                    width: 44px !important;
                    height: 44px !important;
                    background: #f1f5f9 !important;
                    border: 2px solid #e2e8f0 !important;
                    border-radius: 50% !important;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
                    z-index: 999999 !important;
                    cursor: pointer !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }
                #as-panel:hover {
                    transform: translateY(-3px) scale(1.05) !important;
                    box-shadow: 0 8px 20px rgba(0,0,0,0.2) !important;
                }
                #as-panel.as-panel--success {
                    background-color: #ecfdf5 !important;
                    border-color: #10b981 !important;
                }
                #as-panel.as-panel--success #as-status {
                    color: #10b981 !important;
                }
                #as-panel.as-panel--error {
                    background-color: #fef2f2 !important;
                    border-color: #ef4444 !important;
                }
                #as-panel.as-panel--error #as-status {
                    color: #ef4444 !important;
                }
                #as-panel.as-panel--loading {
                    background-color: #eff6ff !important;
                    border-color: #3b82f6 !important;
                }
                #as-panel.as-panel--loading #as-status {
                    color: #3b82f6 !important;
                }
                #as-panel:hover #as-tooltip {
                    opacity: 1 !important;
                    visibility: visible !important;
                    transform: translateY(-50%) scale(1) !important;
                }
                #as-status {
                    font-size: 22px !important;
                    line-height: 1 !important;
                    transition: color 0.3s !important;
                }
                #as-tooltip {
                    position: absolute !important;
                    left: 58px !important;
                    top: 50% !important;
                    transform: translateY(-50%) scale(0.95) !important;
                    background: #1f2937 !important;
                    color: #fff !important;
                    padding: 8px 14px !important;
                    border-radius: 8px !important;
                    font-size: 13px !important;
                    font-weight: 500 !important;
                    white-space: nowrap !important;
                    opacity: 0 !important;
                    visibility: hidden !important;
                    transition: all 0.2s ease-out !important;
                    pointer-events: none !important;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
                }
                #as-tooltip::before {
                    content: '' !important;
                    position: absolute !important;
                    right: 100% !important;
                    top: 50% !important;
                    transform: translateY(-50%) !important;
                    border: 6px solid transparent !important;
                    border-right-color: #1f2937 !important;
                }
            `;
            document.head.appendChild(style);
            Logger.log('Styles injected');
        }

        async _handleClick() {
            Logger.log('Panel clicked - reapplying settings');
            this.orchestrator.reset();
            await this.runApplication();
        }

        async runApplication() {
            this.updateStatus('loading');
            const success = await this.orchestrator.applyAll();
            this.updateStatus(success ? 'success' : 'error');
        }

        updateStatus(state) {
            if (!this.panel) return;

            const statusEl = this.panel.querySelector('#as-status');
            const tooltipEl = this.panel.querySelector('#as-tooltip');
            const status = this.orchestrator.getStatus();

            this.panel.className = `as-panel--${state}`;

            switch (state) {
                case 'loading':
                    statusEl.textContent = '⏳';
                    tooltipEl.textContent = `Applying... (${status.applied}/${status.total})`;
                    break;
                case 'success':
                    statusEl.textContent = '✓';
                    tooltipEl.textContent = 'All settings applied!';
                    break;
                case 'error':
                    statusEl.textContent = '✗';
                    tooltipEl.textContent = `Failed! Pending: ${status.pending.join(', ')}`;
                    break;
            }

            Logger.log(`Status updated: ${state}`);
        }
    }

    // ==================== APPLICATION ====================
    class Application {
        constructor() {
            this.orchestrator = new SettingsOrchestrator();
            this.ui = new UIComponent(this.orchestrator);
        }

        async initialize() {
            try {
                Logger.log('Initializing Auto Settings v7.0');

                // Wait a bit for page to stabilize
                await TimeUtils.sleep(1000);

                this.ui.render();
                await this.ui.runApplication();

                Logger.log('Initialization complete');
            } catch (error) {
                Logger.error('Initialization failed:', error);
            }
        }
    }

    // ==================== ENTRY POINT ====================
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                new Application().initialize();
            });
        } else {
            // Page already loaded
            new Application().initialize();
        }
    }

    init();
})();
