<div align="center">

# 🎙️ GimmeVocal

**Offline live dictation for Obsidian. Click the mic, talk — your words appear at the cursor in real time.**
**100% local & free — powered by [Vosk](https://alphacephei.com/vosk/) (WASM). No cloud, no API keys, no audio files saved.**

![License](https://img.shields.io/badge/license-GPL--3.0-7c3aed?style=for-the-badge)
![Platform](https://img.shields.io/badge/platform-Desktop-22d3ee?style=for-the-badge)
![Version](https://img.shields.io/badge/version-1.1.0-8b5cf6?style=for-the-badge)

[☕ Buy me a coffee](https://buymeacoffee.com/ridhakaiden) · [PayPal](https://paypal.me/1mkaiden)

</div>

---

## ✨ Features
- 🎤 **One-click toggle** — mic ribbon icon; **pulses red** while listening.
- ⌨️ **Live at your cursor** — words preview as you speak, finalized text commits where your cursor is (trailing space).
- 🔒 **Fully offline** — recognition runs on-device via Vosk WASM. Nothing is recorded or uploaded.
- 🔔 **Clear feedback** — start/stop/error notices + a **🎙️ Listening…** status-bar item.
- ⚙️ **Swappable models** — small model by default; point Settings at a bigger model for higher accuracy.
- 🛡️ **Safe** — auto-stops when you switch notes, releases the mic on disable.

> First time you click the mic, GimmeVocal downloads the voice model once into the plugin folder. After that it's 100% offline.
> Default is the small English model (~40 MB, fast). For better accuracy, switch to **lgraph** (~128 MB) in Settings — see “Want better accuracy?” below.

---

## 📥 Installation

### Option A — BRAT (recommended, auto-updates)
1. Install **BRAT** from Community Plugins and enable it.
2. Command palette → **BRAT: Add a beta plugin for testing**.
3. Paste: `https://github.com/imKaidenn/gimmevocal`
4. Add Plugin → then **Settings → Community plugins** → enable **GimmeVocal**.

### Option B — Manual
1. From the [latest release](https://github.com/imKaidenn/gimmevocal/releases/latest), download `main.js`, `manifest.json`, `styles.css`.
2. Put them in `<YourVault>/.obsidian/plugins/gimmevocal/`.
3. Reload Obsidian, enable **GimmeVocal**.

*(The model is fetched automatically on first use — you don't need to download it manually.)*

---

## ▶️ Usage
1. Open a note, click the **🎤** ribbon icon (turns pulsing red).
2. First run: wait for the one-time model download, then allow mic access.
3. Talk — text lands at your cursor. Click the mic again to stop. *(Bind a hotkey to “GimmeVocal: Toggle dictation” if you like.)*

## 🎯 Want better accuracy?
The default small model is fast but basic. For noticeably better accuracy, use the **lgraph** model (~128 MB):
1. **Settings → GimmeVocal → Voice model URL** → paste:
   ```
   https://github.com/imKaidenn/gimmevocal/releases/download/1.1.0/model-lgraph.tar.gz
   ```
2. Click **Clear & re-download**, then start dictation again.

Other models (any size): <https://alphacephei.com/vosk/models> — repackage `.zip` → `.tar.gz` before use.

## 🛠️ Build from source
```bash
npm install
npm run build   # outputs main.js
```

---

<div align="center">

**Made by Kaiden** ❤️ — [@imKaidenn](https://github.com/imKaidenn)

If GimmeVocal saves you some typing: [buy me a coffee ☕](https://buymeacoffee.com/ridhakaiden) · [PayPal](https://paypal.me/1mkaiden)

</div>
