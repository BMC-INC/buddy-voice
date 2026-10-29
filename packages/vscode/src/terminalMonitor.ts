import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BubbleParser, ParsedBubble } from './bubbleParser';

export type BubbleCallback = (bubble: ParsedBubble) => void;

// Strip ANSI escape codes from raw terminal data.
// Each cursor-position sequence is replaced based on whether the ROW
// changes: new row → newline, same row → space.
// This preserves both line structure and word boundaries.
function stripAnsi(text: string): string {
    let lastRow = -1;
    // Phase 1: replace cursor-position sequences
    let out = text.replace(/\x1b\[([0-9;]*)([Hf])/g, (_m, params) => {
        const parts = (params || '').split(';');
        const row = parseInt(parts[0], 10) || 1;
        if (row !== lastRow) {
            lastRow = row;
            return '\n';
        }
        return ' ';
    });
    // Phase 2: strip remaining ANSI sequences
    out = out
        .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
        .replace(/\x1b\][^\x07]*\x07/g, '')
        .replace(/\x1b\][^\x1b]*\x1b\\/g, '');
    // Phase 3: collapse runs of spaces (but NOT newlines) to single space
    out = out.replace(/[ \t]{2,}/g, ' ');
    return out;
}

export class TerminalMonitor {
    private parser: BubbleParser;
    private callback: BubbleCallback;
    private disposables: vscode.Disposable[] = [];
    private mode: 'terminal-data' | 'log-watcher' | 'none' = 'none';
    private logWatcher: fs.FSWatcher | null = null;
    private lastLogSize: number = 0;
    private lastLogInode: number = 0;
    private lastLogModified: number = 0;
    private logPath: string = '';
    private spokenTexts: Set<string> = new Set();
    private ready: boolean = false;
    private readyTimer: ReturnType<typeof setTimeout> | null = null;
    private rawBuffer: string = '';
    private scanTimer: ReturnType<typeof setTimeout> | null = null;
    private static SCAN_DELAY_MS = 300; // wait for all chunks to arrive

    constructor(buddyName: string, callback: BubbleCallback) {
        this.parser = new BubbleParser(buddyName);
        this.callback = callback;
    }

    start(): string {
        if (this.tryTerminalDataAPI()) {
            this.mode = 'terminal-data';
            return this.mode;
        }
        if (this.tryLogWatcher()) {
            this.mode = 'log-watcher';
            return this.mode;
        }
        this.mode = 'none';
        return this.mode;
    }

    private tryTerminalDataAPI(): boolean {
        try {
            const onDidWrite = (vscode.window as any).onDidWriteTerminalData;
            if (typeof onDidWrite !== 'function') return false;

            // Grace period: ignore the initial terminal buffer dump
            this.readyTimer = setTimeout(() => {
                this.parser.reset();
                this.ready = true;
            }, 2000);

            const disposable = onDidWrite((e: { terminal: vscode.Terminal; data: string }) => {
                if (!this.ready) return;

                // Accumulate raw data chunks, then scan after a short
                // debounce so the full bubble (which may arrive across
                // multiple onDidWrite events) is present in one pass.
                this.rawBuffer += e.data;
                if (this.scanTimer) clearTimeout(this.scanTimer);
                this.scanTimer = setTimeout(() => {
                    const data = this.rawBuffer;
                    this.rawBuffer = '';
                    this.scanRawData(data);
                }, TerminalMonitor.SCAN_DELAY_MS);
            });

            this.disposables.push(disposable);
            return true;
        } catch {
            return false;
        }
    }


    /**
     * Scan raw terminal data for box-drawing speech bubbles.
     *
     * Claude Code renders the companion's speech bubble using box-drawing
     * characters (┌─┐│└─┘) via cursor positioning. A single TUI frame
     * contains the entire bubble. We strip ANSI codes and extract text
     * between │ delimiters when the frame contains a complete box structure.
     */
    private scanRawData(data: string): void {
        if (data.length < 30) return;

        const stripped = stripAnsi(data);

        const hasTopCorner = /[┌╭┏╔]/.test(stripped);
        const hasBottomCorner = /[└╰┗╚]/.test(stripped);
        const hasVerticalBorder = /[│┃║]/.test(stripped);

        if (!hasTopCorner || !hasBottomCorner || !hasVerticalBorder) return;


        // Verify the chunk has a complete bubble (top + bottom border)
        const topRe = /[┌╭┏╔][\s─━═┄┈]+[┐╮┓╗]/;
        const bottomRe = /[└╰┗╚][\s─━═┄┈]+[┘╯┛╝]/;
        if (!topRe.test(stripped) || !bottomRe.test(stripped)) return;

        // Extract ALL text between │...│ pairs across the full stripped text.
        // This avoids depending on newlines between rows (which cursor
        // positioning may not produce consistently).
        const borderOnly = /^[\s─━═┄┈┌┐└┘╭╮╰╯┏┓┗┛╔╗╚╝│┃║.\-`´/()\\~]*$/;
        const segments: string[] = [];
        const pairRe = /[│┃║]\s?((?:(?![│┃║]).)+?)\s?[│┃║]/g;
        let m: RegExpExecArray | null;
        while ((m = pairRe.exec(stripped)) !== null) {
            const seg = m[1].trim();
            if (seg.length < 2) continue;
            if (borderOnly.test(seg)) continue;
            segments.push(seg);
        }

        if (segments.length === 0) return;

        const bubbleLines = segments;

        // Join and clean the bubble text
        let bubbleText = bubbleLines.join(' ')
            .replace(/[│┃║─━═┌┐└┘╭╮╰╯┏┓┗┛╔╗╚╝]/g, '')  // stray border chars
            .replace(/\s{2,}/g, ' ')
            .trim();

        // Filter out Claude Code UI chrome that leaks into bubble area
        bubbleText = bubbleText
            .replace(/[◐◑◒◓]\s*\w+\s*·\s*\/\w+/g, '')     // spinner + mode like ◐medium·/effort
            .replace(/esc\s*to\s*interrupt/gi, '')            // "esc to interrupt"
            .replace(/\?\s*for\s*shortcuts/gi, '')            // "? for shortcuts"
            .replace(/\/\(\s*\)\s*\\/g, '')                   // /( )\ penguin body
            .replace(/`---´/g, '')                            // penguin beak
            .replace(/[❯❮►▸▹▷]\s*$/g, '')                    // prompt arrows
            .replace(/\s{2,}/g, ' ')
            .trim();

        // Skip if only emotes remain (e.g. "*waddles closer*")
        const withoutEmotes = bubbleText.replace(/\*[^*]+\*/g, '').trim();
        if (!withoutEmotes || withoutEmotes.length < 3) {
            return;
        }

        // Skip if too short after cleanup (likely UI fragments)
        if (bubbleText.length < 4) {
            return;
        }


        // Dedup: don't speak the same text twice
        const key = bubbleText.trim();
        if (!key || this.spokenTexts.has(key)) {
            return;
        }

        this.spokenTexts.add(key);
        if (this.spokenTexts.size > 200) {
            const first = this.spokenTexts.values().next().value;
            if (first !== undefined) this.spokenTexts.delete(first);
        }

        this.callback({ text: bubbleText, pattern: 'bubble' });
    }

    private tryLogWatcher(): boolean {
        const claudeDir = path.join(os.homedir(), '.claude');
        if (!fs.existsSync(claudeDir)) return false;

        const logCandidates = [
            path.join(claudeDir, 'buddy.log'),
            path.join(claudeDir, 'companion.log'),
        ];


        for (const candidate of logCandidates) {
            if (fs.existsSync(candidate)) {
                this.logPath = candidate;
                try {
                    const stat = fs.statSync(candidate);
                    this.lastLogSize = stat.size;
                    this.lastLogInode = stat.ino;
                    this.lastLogModified = stat.mtimeMs;
                    // Watch the directory so replacing/rotating the file does not detach us.
                    this.logWatcher = fs.watch(path.dirname(candidate), () => {
                        // macOS can report the directory name for a content change.
                        // Always stat only our selected companion log.
                        this.readNewLogContent();
                    });
                    return true;
                } catch { continue; }
            }
        }

        return false;
    }

    private readNewLogContent(): void {
        if (!this.logPath) return;
        try {
            const stat = fs.statSync(this.logPath);
            if (stat.ino !== this.lastLogInode || stat.size < this.lastLogSize ||
                (stat.size === this.lastLogSize && stat.mtimeMs !== this.lastLogModified)) {
                this.lastLogSize = 0;
                this.parser.reset();
            }
            this.lastLogInode = stat.ino;
            this.lastLogModified = stat.mtimeMs;
            if (stat.size <= this.lastLogSize) return;

            const fd = fs.openSync(this.logPath, 'r');
            const bufSize = stat.size - this.lastLogSize;
            const buf = Buffer.alloc(bufSize);
            fs.readSync(fd, buf, 0, bufSize, this.lastLogSize);
            fs.closeSync(fd);
            this.lastLogSize = stat.size;

            const newContent = buf.toString('utf-8');
            const bubbles = this.parser.parse(newContent);
            for (const bubble of bubbles) {
                this.callback(bubble);
            }
        } catch { /* ignore read errors */ }
    }

    setBuddyName(name: string): void {
        this.parser.setBuddyName(name);
    }

    getMode(): string {
        return this.mode;
    }

    dispose(): void {
        for (const d of this.disposables) d.dispose();
        this.disposables = [];
        if (this.scanTimer) { clearTimeout(this.scanTimer); this.scanTimer = null; }
        this.rawBuffer = '';
        this.ready = false;
        if (this.readyTimer) { clearTimeout(this.readyTimer); this.readyTimer = null; }
        if (this.logWatcher) {
            this.logWatcher.close();
            this.logWatcher = null;
        }
        this.parser.reset();
        this.spokenTexts.clear();
    }
}
