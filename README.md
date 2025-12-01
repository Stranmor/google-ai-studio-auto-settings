# Google AI Studio - Auto Settings

![License](https://img.shields.io/badge/license-MIT-green.svg)
![GreasyFork Version](https://img.shields.io/greasyfork/v/554936?label=version&color=blue)

A robust UserScript that automatically configures model parameters in **Google AI Studio**. It handles the repetitive task of setting Temperature, Top-P, Safety Settings, and Tools every time you open a chat or switch prompts.

## ✨ Key Features

*   **🎨 Visual Settings Menu:** No more editing code! Configure your preferences through a modern, built-in UI designed to match Google's Material Design.
*   **🧠 Smart Selectors:** Uses a robust detection system (searching by text labels and dynamic elements) to ensure the script works even if Google updates their CSS class names.
*   **💾 Persistent Storage:** Settings are saved via your UserScript manager, persisting across sessions and script updates.
*   **📱 Mobile & Desktop Support:** Works perfectly on desktop and automatically handles the side panel on mobile devices to apply settings and return focus.
*   **🖱️ Draggable FAB:** A floating action button that indicates status. You can drag and place it anywhere on the screen, and it remembers its position.
*   **⚡ SPA Compatible:** Detects navigation between chats (Single Page Application) and reapplies settings instantly without reloading the page.
*   **⌨️ Auto Focus:** Automatically returns focus to the prompt input area after applying settings, so you can start typing immediately.

## 🚀 Installation

1.  **Install a UserScript Manager:**
    *   [Tampermonkey](https://www.tampermonkey.net/) (Recommended for Chrome, Edge, Firefox, Safari)
    *   Violentmonkey

2.  **Install the Script:**
    *   **[Click here to install from Greasy Fork](https://greasyfork.org/en/scripts/554936-google-ai-studio-auto-settings)** 
    *   Or create a new script in your manager and paste the code manually.

## 🔧 Configuration

You can configure the script without touching the code.

### Method 1: Right-Click the Button
1.  Locate the floating **Settings Button** (gear icon) on your screen.
2.  **Right-click** the button to open the **Auto Settings Menu**.
3.  Adjust your values and click **Apply**.

### Method 2: Script Manager Menu
1.  Click your UserScript manager extension icon (e.g., Tampermonkey) in the browser toolbar.
2.  Select **"⚙️ Settings"** from the menu.

### Available Settings:
*   **Parameters:** Temperature, Top-P, Top-K, Max Output Tokens.
*   **Model Settings:** Media Resolution, Thinking Level.
*   **Tools & Toggles:** Grounding (Google Search), Code Execution, Structured Outputs, Function Calling, URL Context.
*   **UI Preferences:** Toggle the visibility of the floating button.

## 🖥️ Interface Guide

The script adds a non-intrusive Floating Action Button (FAB) to your screen:

| Icon | Status | Meaning | Action |
| :---: | :--- | :--- | :--- |
| **⚙️ / ⏳** | **Loading** | **Applying...** | The script is currently searching for settings and applying values. |
| **✓** | **Success** | **Done** | All settings have been applied successfully. |
| **!** | **Error** | **Timeout** | Could not find some settings (or panel didn't open). |

**Interactions:**
*   **Left Click:** Force re-apply settings.
*   **Right Click:** Open Configuration Menu.
*   **Drag:** Click and hold to move the button to any position.

## 📱 Mobile Behavior

On mobile devices, the script performs an automated sequence to ensure a smooth experience:
1.  Detects if the settings panel is closed.
2.  Automatically opens the **Run Settings** panel.
3.  Applies your configured parameters.
4.  Closes the panel automatically to return focus to the chat input.

## 🤝 Contributing

Google frequently updates the AI Studio interface. If the script stops working, feel free to open an issue or submit a pull request with updated selectors.

---
*This script is not affiliated with Google.*
