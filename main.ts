import { App, EditorPosition, MarkdownView, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import { createModel, type Model } from "vosk-browser";

/** Position you'd land on after inserting `text` at `pos` (handles newlines). */
function advance(pos: EditorPosition, text: string): EditorPosition {
  const lines = text.split("\n");
  if (lines.length === 1) return { line: pos.line, ch: pos.ch + text.length };
  return { line: pos.line + lines.length - 1, ch: lines[lines.length - 1].length };
}

const MODEL_FILE = "model.tar.gz";
const SAMPLE_RATE = 16000;

// Default: small English model (fast, ~40 MB). Hosted on the plugin's own release.
const SMALL_MODEL_URL = "https://github.com/imKaidenn/gimmevocal/releases/download/1.1.0/model.tar.gz";

interface GimmeVocalSettings {
  modelUrl: string;
}
const DEFAULT_SETTINGS: GimmeVocalSettings = { modelUrl: SMALL_MODEL_URL };

export default class GimmeVocalPlugin extends Plugin {
  settings: GimmeVocalSettings = { ...DEFAULT_SETTINGS };

  private isListening = false;
  private busy = false;

  // Vosk
  private model: Model | null = null;
  private recognizer: any = null;
  private modelUrl: string | null = null;

  // Audio
  private mediaStream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;

  // UI
  private ribbonEl: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;

  // Cursor / interim tracking
  private anchor: EditorPosition | null = null;
  private interimEnd: EditorPosition | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.ribbonEl = this.addRibbonIcon("mic", "GimmeVocal: start / stop dictation", () => this.toggle());
    this.addCommand({ id: "toggle-dictation", name: "Toggle dictation", callback: () => this.toggle() });
    this.addSettingTab(new GimmeVocalSettingTab(this.app, this));

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        if (this.isListening) this.stop("GimmeVocal: stopped (switched note)");
      })
    );
  }

  onunload(): void {
    this.teardownAudio();
    if (this.recognizer) { try { this.recognizer.remove(); } catch { /* ignore */ } this.recognizer = null; }
    if (this.model) { try { this.model.terminate(); } catch { /* ignore */ } this.model = null; }
    if (this.modelUrl) { try { URL.revokeObjectURL(this.modelUrl); } catch { /* ignore */ } this.modelUrl = null; }
    this.setActive(false);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private toggle(): void {
    if (this.isListening) this.stop("GimmeVocal: dictation stopped");
    else void this.start();
  }

  private get modelPath(): string {
    return `${this.manifest.dir}/${MODEL_FILE}`;
  }

  /** Delete the cached model so a new one downloads next start (used by settings). */
  async clearCachedModel(): Promise<void> {
    if (this.model) { try { this.model.terminate(); } catch { /* ignore */ } this.model = null; }
    if (this.modelUrl) { try { URL.revokeObjectURL(this.modelUrl); } catch { /* ignore */ } this.modelUrl = null; }
    const adapter = this.app.vault.adapter;
    if (await adapter.exists(this.modelPath)) await adapter.remove(this.modelPath);
  }

  /** Load the Vosk model (lazy). Downloads it once if not already cached locally. */
  private async ensureModel(): Promise<Model> {
    if (this.model) return this.model;
    const adapter = this.app.vault.adapter;
    let buf: ArrayBuffer;

    if (await adapter.exists(this.modelPath)) {
      buf = await adapter.readBinary(this.modelPath);
    } else {
      const dl = new Notice("GimmeVocal: downloading voice model (one time)… please wait.", 0);
      try {
        const res = await fetch(this.settings.modelUrl);
        if (!res.ok) throw new Error(`download failed (HTTP ${res.status})`);
        buf = await res.arrayBuffer();
        await adapter.writeBinary(this.modelPath, buf);
      } finally {
        dl.hide();
      }
      new Notice("GimmeVocal: model ready ✅");
    }

    const blob = new Blob([buf], { type: "application/gzip" });
    this.modelUrl = URL.createObjectURL(blob);
    this.model = await createModel(this.modelUrl);
    return this.model;
  }

  private async start(): Promise<void> {
    if (this.isListening || this.busy) return;
    if (!this.app.workspace.getActiveViewOfType(MarkdownView)) {
      new Notice("GimmeVocal: open a Markdown note first.");
      return;
    }

    this.busy = true;
    try {
      const model = await this.ensureModel();

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
        video: false,
      });

      this.recognizer = new model.KaldiRecognizer(SAMPLE_RATE);
      this.recognizer.setWords(false);
      this.recognizer.on("partial", (m: any) => this.onPartial(m?.result?.partial ?? ""));
      this.recognizer.on("result", (m: any) => this.onFinal(m?.result?.text ?? ""));

      const AudioCtor: typeof AudioContext =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtor();
      this.source = this.audioCtx.createMediaStreamSource(this.mediaStream);
      this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);
      this.processor.onaudioprocess = (e: AudioProcessingEvent) => {
        try { this.recognizer?.acceptWaveform(e.inputBuffer); } catch { /* ignore */ }
        e.outputBuffer.getChannelData(0).fill(0); // mute → no echo
      };
      this.source.connect(this.processor);
      this.processor.connect(this.audioCtx.destination);

      const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor ?? null;
      this.anchor = editor ? editor.getCursor() : null;
      this.interimEnd = null;

      this.isListening = true;
      this.setActive(true);
      new Notice("GimmeVocal: dictation started 🎙️");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      new Notice(`GimmeVocal: couldn't start — ${msg}`);
      this.teardownAudio();
      this.isListening = false;
      this.setActive(false);
    } finally {
      this.busy = false;
    }
  }

  private getEditor() {
    return this.app.workspace.getActiveViewOfType(MarkdownView)?.editor ?? null;
  }

  /** Live preview — replace the interim span with the current hypothesis. */
  private onPartial(text: string): void {
    const editor = this.getEditor();
    if (!editor || !this.anchor) return;
    const preview = text.replace(/\s+/g, " ").trim();
    if (this.interimEnd) editor.replaceRange(preview, this.anchor, this.interimEnd);
    else editor.replaceRange(preview, this.anchor);
    this.interimEnd = preview ? advance(this.anchor, preview) : null;
    if (this.interimEnd) editor.setCursor(this.interimEnd);
  }

  /** Finalized utterance — commit at the cursor with a trailing space. */
  private onFinal(text: string): void {
    const editor = this.getEditor();
    if (!editor || !this.anchor) return;
    const finalText = text.replace(/\s+/g, " ").trim();
    const from = this.anchor;
    const to = this.interimEnd ?? this.anchor;
    if (finalText) {
      const out = finalText + " ";
      editor.replaceRange(out, from, to);
      this.anchor = advance(from, out);
    } else {
      if (this.interimEnd) editor.replaceRange("", from, to);
      this.anchor = from;
    }
    this.interimEnd = null;
    editor.setCursor(this.anchor);
  }

  private stop(message: string): void {
    this.teardownAudio();
    if (this.recognizer) { try { this.recognizer.retrieveFinalResult?.(); } catch { /* ignore */ } }
    this.interimEnd = null;
    this.anchor = null;
    this.isListening = false;
    this.setActive(false);
    new Notice(message);
  }

  private teardownAudio(): void {
    if (this.processor) { try { this.processor.disconnect(); this.processor.onaudioprocess = null; } catch { /* ignore */ } this.processor = null; }
    if (this.source) { try { this.source.disconnect(); } catch { /* ignore */ } this.source = null; }
    if (this.audioCtx) { try { void this.audioCtx.close(); } catch { /* ignore */ } this.audioCtx = null; }
    if (this.mediaStream) { try { this.mediaStream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ } this.mediaStream = null; }
  }

  private setActive(active: boolean): void {
    this.ribbonEl?.toggleClass("gimmevocal-listening", active);
    if (active) {
      if (!this.statusEl) {
        this.statusEl = this.addStatusBarItem();
        this.statusEl.setText("🎙️ GimmeVocal listening…");
      }
    } else if (this.statusEl) {
      this.statusEl.remove();
      this.statusEl = null;
    }
  }
}

class GimmeVocalSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: GimmeVocalPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h3", { text: "GimmeVocal" });

    new Setting(containerEl)
      .setName("Voice model URL")
      .setDesc(
        "The .tar.gz Vosk model to download on first use. Default is the small English model (fast, ~40 MB, lower accuracy). " +
        "For better accuracy, paste a larger model URL (e.g. vosk-model-en-us-0.22-lgraph), then use “Clear downloaded model” below and restart dictation."
      )
      .addText((t) =>
        t
          .setPlaceholder(SMALL_MODEL_URL)
          .setValue(this.plugin.settings.modelUrl)
          .onChange(async (v) => {
            this.plugin.settings.modelUrl = v.trim() || SMALL_MODEL_URL;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Clear downloaded model")
      .setDesc("Deletes the cached model so the URL above is re-downloaded next time you start dictation.")
      .addButton((b) =>
        b.setButtonText("Clear & re-download").setWarning().onClick(async () => {
          await this.plugin.clearCachedModel();
          new Notice("GimmeVocal: cached model cleared. It will download again on next start.");
        })
      );
  }
}
