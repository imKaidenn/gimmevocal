<div align="center">

# 🎙️ GimmeVocal

**Instant, local live dictation for Obsidian. Click to talk — your words appear at the cursor in real time.**
**No API keys. No audio files. No cloud. 100% on-device via the native Web Speech API.**

![License](https://img.shields.io/badge/license-GPL--3.0-7c3aed?style=for-the-badge)
![Platform](https://img.shields.io/badge/platform-Desktop-22d3ee?style=for-the-badge)
![Version](https://img.shields.io/badge/version-1.0.0-8b5cf6?style=for-the-badge)

[☕ Buy me a coffee](https://buymeacoffee.com/ridhakaiden) · [PayPal](https://paypal.me/1mkaiden)

</div>

---

## ✨ Features
- 🎤 **One-click toggle** — mic ribbon icon starts/stops; **pulses red** while listening.
- ⌨️ **Live at your cursor** — interim words preview as you speak, finalized text commits exactly where your cursor is (with a trailing space).
- 🔔 **Clear feedback** — `Notice` popups on start/stop/errors + a **🎙️ Listening…** status-bar item.
- 🔒 **Private & free** — nothing is recorded or uploaded; no Whisper, no API keys.
- 🛡️ **Safe** — auto-stops when you switch notes, fully releases the mic on disable, and recovers gracefully from drop-outs.

---

## 📥 Installation

### Option A — BRAT (recommended, auto-updates)
1. Install the **BRAT** plugin from Obsidian Community Plugins (search “BRAT”) and enable it.
2. Open the command palette → **BRAT: Add a beta plugin for testing**.
3. Paste this repo URL:
   ```
   https://github.com/imKaidenn/gimmevocal
   ```
4. Choose the latest version → **Add Plugin**. BRAT installs it and keeps it updated.
5. Go to **Settings → Community plugins** and enable **GimmeVocal**.

### Option B — Manual install
1. Download these 3 files from the [latest Release](https://github.com/imKaidenn/gimmevocal/releases/latest):
   - `main.js`
   - `manifest.json`
   - `styles.css`
2. Create a folder in your vault:
   ```
   <YourVault>/.obsidian/plugins/gimmevocal/
   ```
3. Drag the 3 files into that folder.
4. In Obsidian: **Settings → Community plugins**, reload, then enable **GimmeVocal**.

---

## ▶️ Usage
1. Open a Markdown note.
2. Click the **🎤 mic** in the left ribbon (it turns pulsing red).
3. Allow microphone access if prompted, then talk — text lands at your cursor.
4. Click the mic again to stop. *(Tip: bind a hotkey to “GimmeVocal: Toggle dictation”.)*

---

## 🛠️ Build from source
```bash
npm install
npm run build   # outputs main.js
```

## ⚠️ Note
Live recognition uses the speech backend exposed to Obsidian's runtime. On some builds it may be unavailable — GimmeVocal detects this and shows a clear notice instead of failing silently.

---

<div align="center">

**Made by Kaiden** ❤️ — [@imKaidenn](https://github.com/imKaidenn)

If GimmeVocal saves you some typing: [buy me a coffee ☕](https://buymeacoffee.com/ridhakaiden) · [PayPal](https://paypal.me/1mkaiden)

</div>
