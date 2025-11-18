# Google AI Studio - Auto Settings

![Version](https://img.shields.io/badge/version-9.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

A robust UserScript that automatically configures model parameters in **Google AI Studio**. It handles the repetitive task of setting Temperature, Top-P, and Media Resolution every time you open a chat or switch prompts.

## ✨ Key Features

*   **📱 Mobile & Desktop Support:** Works perfectly on desktop and automatically handles the side panel on mobile devices.
*   **🖱️ Draggable UI:** A minimalist status indicator that you can drag and place anywhere on the screen. It remembers its position.
*   **⚡ SPA Compatible:** Detects navigation between chats (Single Page Application) and reapplies settings instantly without reloading the page.
*   **🛡️ Bulletproof Detection:** Uses text-based search (XPath) instead of fragile CSS selectors. It won't break when Google updates their class names.
*   **⚙️ Fully Configurable:** Set your preferred defaults in the script code.

## 🚀 Installation

1.  **Install a UserScript Manager:**
    *   [Tampermonkey](https://www.tampermonkey.net/) (Recommended for Chrome, Edge, Firefox, Safari)
    *   Violentmonkey

2.  **Install the Script:**
    *   **[Click here to install from Greasy Fork](https://greasyfork.org/scripts/486538-google-ai-studio-auto-settings)** *(Example link - replace with your actual URL)*
    *   Or create a new script in Tampermonkey and paste the code manually.

## 🔧 Configuration

You can customize the default values by editing the `CONFIG` object at the top of the script.

1.  Open your UserScript manager (e.g., Tampermonkey dashboard).
2.  Edit the **Google AI Studio - Auto Settings** script.
3.  Modify the values in the `settings` block:

```javascript
const CONFIG = {
    settings: {
        temperature: 1.0,       // Range: 0.0 - 2.0
        topP: 0.0,              // Range: 0.0 - 1.0 (Set 0 to remove limit)
        mediaResolution: "Low", // Options: "Low", "Medium", "High"
    },
    execution: {
        maxAttempts: 20,        // How many times to try applying settings
        retryDelay: 500,        // Delay between attempts (ms)
    },
    // ...
};
```

## 🖥️ Interface Guide

The script adds a small, non-intrusive status icon to your screen:

| Icon | Color | Status | Action |
| :---: | :--- | :--- | :--- |
| **⏳** | **Blue** | **Applying...** | The script is currently searching for settings and applying values. |
| **✓** | **Green** | **Success** | All settings (Temp, Top-P, Resolution) have been applied successfully. |
| **!** | **Red** | **Timeout** | Could not find some settings (e.g., panel was closed). **Click the icon to retry.** |

> **Note:** You can drag this icon to any corner of the screen. The script will save the position for your next visit.

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
```
