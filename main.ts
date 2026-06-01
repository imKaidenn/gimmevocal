import { EditorPosition, MarkdownView, Notice, Plugin } from "obsidian";

/**
 * Minimal typings for the native Web Speech API (absent from Obsidian's TS libs).
 * Named "*Like" so they never clash with lib.dom's own SpeechRecognition types.
 */
type SRResultLike = { isFinal: boolean; 0: { transcript: string } };
interface SREvent extends Event {
  resultIndex: number;
  results: { length: number; [i: number]: SRResultLike };
}
interface SRErrorEvent extends Event { error: string }
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
}
type SRConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SRConstructor | null {
  const w = window as unknown as {
    SpeechRecognition?: SRConstructor;
    webkitSpeechRecognition?: SRConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Position you'd land on after inserting `text` at `pos` (handles newlines). */
function advance(pos: EditorPosition, text: string): EditorPosition {
  const lines = text.split("\n");
  if (lines.length === 1) return { line: pos.line, ch: pos.ch + text.length };
  return { line: pos.line + lines.length - 1, ch: lines[lines.length - 1].length };
}

export default class GimmeVocalPlugin extends Plugin {
  private recognition: SpeechRecognitionLike | null = null;
  private isListening = false;
  /** Our *intent* to listen — drives auto-restart on silent engine drops. */
  private wantListening = false;
  private ribbonEl: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;
  private lang = "en-US";

  // Span currently holding the live (interim) preview text.
  private interimFrom: EditorPosition | null = null;
  private interimTo: EditorPosition | null = null;

  async onload(): Promise<void> {
    this.ribbonEl = this.addRibbonIcon("mic", "GimmeVocal: start / stop dictation", () => this.toggle());

    this.addCommand({
      id: "toggle-dictation",
      name: "Toggle dictation",
      callback: () => this.toggle(),
    });

    // Safety: stop the instant the user leaves the active note/pane.
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        if (this.isListening) this.stop("GimmeVocal: stopped (switched note)");
      })
    );
  }

  onunload(): void {
    this.teardown();
  }

  private toggle(): void {
    if (this.isListening) this.stop("GimmeVocal: dictation stopped");
    else this.start();
  }

  private start(): void {
    const SR = getSpeechRecognition();
    if (!SR) {
      new Notice("GimmeVocal: Speech Recognition isn't available in this build.");
      return;
    }
    if (!this.app.workspace.getActiveViewOfType(MarkdownView)) {
      new Notice("GimmeVocal: open a Markdown note first.");
      return;
    }

    let rec: SpeechRecognitionLike;
    try {
      rec = new SR();
    } catch {
      new Notice("GimmeVocal: could not initialise Speech Recognition.");
      return;
    }

    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => this.handleResult(e);

    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return; // benign
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        this.wantListening = false;
        new Notice("GimmeVocal: microphone permission denied.");
      } else {
        if (e.error === "network") this.wantListening = false; // don't loop forever
        new Notice(`GimmeVocal: error — ${e.error}`);
      }
    };

    rec.onend = () => {
      this.isListening = false;
      this.interimFrom = this.interimTo = null; // keep whatever preview is shown
      if (this.wantListening) {
        try { rec.start(); this.isListening = true; }
        catch { this.wantListening = false; this.setActive(false); }
      } else {
        this.setActive(false);
      }
    };

    try {
      this.recognition = rec;
      this.wantListening = true;
      this.interimFrom = this.interimTo = null;
      rec.start();
      this.isListening = true;
      this.setActive(true);
      new Notice("GimmeVocal: dictation started 🎙️");
    } catch {
      this.wantListening = false;
      this.recognition = null;
      new Notice("GimmeVocal: could not start dictation.");
    }
  }

  /** Live preview + commit-at-cursor on every recognition event. */
  private handleResult(e: SREvent): void {
    const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
    if (!editor) { this.interimFrom = this.interimTo = null; return; }

    // 1. Erase the previously shown interim preview, if any.
    let at: EditorPosition;
    if (this.interimFrom && this.interimTo) {
      editor.replaceRange("", this.interimFrom, this.interimTo);
      at = this.interimFrom;
    } else {
      at = editor.getCursor();
    }

    // 2. Split this batch into finalized vs interim transcripts.
    let finalChunk = "";
    let interimChunk = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      const txt = r[0]?.transcript ?? "";
      if (r.isFinal) finalChunk += txt;
      else interimChunk += txt;
    }

    // 3. Commit finalized text (persisted, trailing space) exactly at the cursor.
    if (finalChunk.trim()) {
      const finalText = finalChunk.replace(/\s+/g, " ").trim() + " ";
      editor.replaceRange(finalText, at);
      at = advance(at, finalText);
    }

    // 4. Re-render the current interim preview right after the committed text.
    const interim = interimChunk.replace(/\s+/g, " ").trimStart();
    if (interim) {
      editor.replaceRange(interim, at);
      this.interimFrom = at;
      this.interimTo = advance(at, interim);
      editor.setCursor(this.interimTo);
    } else {
      this.interimFrom = this.interimTo = null;
      editor.setCursor(at);
    }
  }

  private stop(message: string): void {
    this.wantListening = false;
    this.interimFrom = this.interimTo = null; // leave preview text in the note
    if (this.recognition) {
      try { this.recognition.stop(); } catch { /* ignore */ }
    }
    this.isListening = false;
    this.setActive(false);
    new Notice(message);
  }

  private teardown(): void {
    this.wantListening = false;
    this.interimFrom = this.interimTo = null;
    if (this.recognition) {
      try {
        this.recognition.onend = null; // stop auto-restart during teardown
        this.recognition.onresult = null;
        this.recognition.abort(); // fully releases the microphone
      } catch { /* ignore */ }
    }
    this.recognition = null;
    this.isListening = false;
    this.setActive(false);
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
