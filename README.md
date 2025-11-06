# Google AI Studio - Auto Settings

[![Greasy Fork Version][version-shield]][version-url]
[![Greasy Fork Installs][installs-shield]][installs-url]
[![License: MIT][license-shield]][license-url]

A lightweight UserScript that automatically configures your preferred model parameters in Google AI Studio. Set your favorite Temperature, Top-P, and Media Resolution once, and let the script handle the rest every time you load a prompt.

![Auto Settings Demo]([TODO: Insert a link to your screenshot or GIF here])
> *A minimalist UI element provides clear status feedback without getting in your way.*

---

## 🤔 Why Use This Script?

Are you tired of manually adjusting the model settings like Temperature and Top-P every single time you open a new prompt in Google AI Studio? This script solves that problem by automating the process, ensuring your preferred settings are applied consistently and saving you valuable time.

It's designed to be minimalist, reliable, and easy to configure.

## ✨ Features

- **Automatic Settings:** Automatically applies your chosen `Temperature`, `Top-P`, and `Media Resolution` on page load.
- **Fully Configurable:** Easily edit the script's configuration block to set your desired values.
- **Minimalist UI:** A small, clean status icon shows the script's state (loading, success, error) without cluttering the interface.
- **Smart Focus Restoration:** After applying settings, the script automatically returns focus to the prompt input area so you can start typing immediately.
- **Reliable and Robust:** Includes multiple retry attempts and a page load timeout to handle slow network conditions.
- **Lightweight:** Zero dependencies and a clean, modern codebase.

## 🚀 Installation

1.  **Install a UserScript Manager**
    You need a browser extension to run this script. [Tampermonkey](https://www.tampermonkey.net/) is the most popular choice.
    - [Get Tampermonkey for Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
    - [Get Tampermonkey for Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
    - [Get Tampermonkey for Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

2.  **Install the Script**
    Click the link below to install the script from Greasy Fork, the most trusted repository for user scripts.

    ➡️ **[Install from Greasy Fork](https://greasyfork.org/en/scripts/XXXXX-google-ai-studio-auto-settings)** ⬅️
    
    *[TODO: Replace XXXXX with the actual ID of your script after publishing it on Greasy Fork.]*

## 🔧 Configuration

Customizing the script is easy! All settings are located in a clear `CONFIG` block at the top of the script file.

1.  Open your Tampermonkey Dashboard.
2.  Click on the `Google AI Studio - Auto Settings` script to open the editor.
3.  Find the `CONFIGURATION` section and change the values to your liking.

Here is the default configuration block:

```javascript
// ==================== CONFIGURATION ====================
const CONFIG = {
    // Model parameters to apply automatically
    settings: {
        temperature: 0.7,   // Creativity/randomness. Range: 0.0 - 2.0
        topP: 0.00,         // Nucleus sampling probability. Range: 0.0 - 1.0
        mediaResolution: 'Low' // Media generation resolution. Options: 'Low', 'High'
    },

    // Script execution settings
    execution: {
        debug: false,           // Set to true to enable detailed console logs
        maxAttempts: 30,        // Maximum number of attempts to apply settings
        retryDelay: 2000,       // Delay between retry attempts (in milliseconds)
        pageLoadTimeout: 60000  // Maximum time to wait for the page to load
    },
    // ... selectors
};
