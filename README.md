# Google AI Studio - Auto Settings

![Version](https://img.shields.io/badge/version-10.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

A robust UserScript that automatically configures model parameters in **Google AI Studio**. It handles the repetitive task of setting Temperature, Top-P, and Media Resolution every time you open a chat or switch prompts.

## ✨ Key Features

*   **🎨 Visual Settings Menu:** No more editing code! Configure your preferences (Temperature, Top-P, Resolution) through a modern, built-in UI.
*   **💾 Persistent Storage:** Settings are saved via your UserScript manager, so they persist even if you update the script.
*   **📱 Mobile & Desktop Support:** Works perfectly on desktop and automatically handles the side panel on mobile devices.
*   **🖱️ Draggable UI:** A minimalist status indicator that you can drag and place anywhere on the screen. It remembers its position.
*   **⚡ SPA Compatible:** Detects navigation between chats (Single Page Application) and reapplies settings instantly without reloading the page.
*   **🛡️ Bulletproof Detection:** Uses text-based search (XPath) instead of fragile CSS selectors. It won't break when Google updates their class names.
*   **⌨️ Auto Focus:** Automatically returns focus to the prompt input area after applying settings, so you can start typing immediately.

## 🚀 Installation

1.  **Install a UserScript Manager:**
    *   [Tampermonkey](https://www.tampermonkey.net/) (Recommended for Chrome, Edge, Firefox, Safari)
    *   Violentmonkey

2.  **Install the Script:**
    *   **[Click here to install from Greasy Fork](https://greasyfork.org/en/scripts/554936-google-ai-studio-auto-settings)** 
    *   Or create a new script in Tampermonkey and paste the code manually.

## 🔧 Configuration

**New in v10.0:** You don't need to edit the code anymore!

### Method 1: Right-Click the Icon
1.  Locate the floating status icon (square) on your screen.
2.  **Right-click** the icon to open the Settings Modal.
3.  Adjust your values and click **Save & Apply**.

### Method 2: Tampermonkey Menu
1.  Click the Tampermonkey extension icon in your browser toolbar.
2.  Select **"⚙️ Configure Auto Settings"** from the menu.

### Available Settings:
*   **Temperature:** Range 0.0 - 2.0 (Controls randomness).
*   **Top P:** Range 0.0 - 1.0 (Nucleus sampling).
*   **Media Resolution:** Low, Medium, or High.

## 🖥️ Interface Guide

The script adds a small, non-intrusive status icon to your screen:

| Icon | Color | Status | Action |
| :---: | :--- | :--- | :--- |
| **⏳** | **Blue** | **Applying...** | The script is currently searching for settings and applying values. |
| **✓** | **Green** | **Success** | All settings have been applied successfully. |
| **!** | **Red** | **Timeout** | Could not find some settings. **Left-click to retry.** |

**Interactions:**
*   **Left Click:** Retry applying settings.
*   **Right Click:** Open Configuration Menu.
*   **Drag:** Move the icon to any position on the screen.

## 📱 Mobile Behavior

On mobile devices (width < 768px), the script performs an automated sequence:
1.  Detects if the settings panel is closed.
2.  Automatically clicks the **Settings (Tune)** button.
3.  Applies your parameters.
4.  Closes the panel automatically to return focus to the chat.

## 🤝 Contributing

Feel free to open an issue or submit a pull request if Google updates the UI and breaks the detection logic.

---
*This script is not affiliated with Google.*
