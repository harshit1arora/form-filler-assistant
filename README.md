# Form Copilot

Form Copilot is a powerful Chrome extension designed to automate the tedious task of filling out web forms. It uses an intelligent heuristic mapping engine and a persistent learning system to accurately identify and autofill form fields with CRM data.

## Features

- **Smart Field Detection**: Scans the DOM for input, textarea, and select elements, extracting labels and metadata using multiple fallback strategies.
- **Weighted Heuristic Mapping**: Uses a sophisticated scoring system to match fields to your CRM schema with high precision.
- **Persistent Learning**: Remembers your corrections on a per-domain basis, ensuring better accuracy over time.
- **Dynamic Form Support**: Uses MutationObservers to handle fields that appear dynamically in modern web apps (React, Vue, etc.).
- **Developer-Friendly**: Built with a modular architecture for easy extension and debugging.

## Getting Started

1.  **Download/Clone**: Get the source code from this repository.
2.  **Load in Chrome**:
    - Open Chrome and navigate to `chrome://extensions`.
    - Enable **Developer mode** in the top right.
    - Click **Load unpacked** and select the `extension` folder.
3.  **Use**: Navigate to any webpage with a form, click the Form Copilot icon, and start scanning and autofilling!

## Architecture

```text
extension/
├── manifest.json    # Extension manifest (V3)
├── background.js    # Service worker
├── content.js       # Core logic: scanning, autofilling, and UI overlays
├── mapping.js       # Heuristic engine and field scoring
├── popup.html/js    # Extension popup interface
└── crm.json         # Sample CRM data source
```

Built for productivity.
