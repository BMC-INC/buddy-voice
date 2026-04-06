import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BubbleParser, ParsedBubble } from './bubbleParser';

export type BubbleCallback = (bubble: ParsedBubble) => void;

// Strip ANSI escape codes from raw terminal data.
// Row-changing cursor moves → newline (preserves line structure).
// Same-row cursor moves → space (preserves word boundaries).
// Tracks the last cursor row so we can tell the difference.
function stripAnsi(text: string): string {
    let lastRow = -1;
    // Phase 1: replace cursor-position sequences intelligently
    let out = text.replace(/\x1b\[([0-9;]*)([Hf])/g, (_m, params) => {
        const parts = (params || '').split(';');
        const row = parseInt(parts[0], 10) || 1;
        if (row !== lastRow) {
            lastRow = row;
            return '\n';   // new row → line break
        }
        return ' ';        // same row, different column → word space
    });
    // Phase 2: strip remaining ANSI sequences
    out = out
        .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')        // remaining CSI (colors, etc.)
        .replace(/\x1b\][^\x07]*\x07/g, '')             // OSC (title, etc.)
        .replace(/\x1b\][^\x1b]*\x1b\\/g, '');          // OSC with ST terminator
    return out;
}

export class TerminalMonitor {
    private parser: BubbleParser;
    private callback: BubbleCallback;
    private disposables: vscode.Disposable[] = [];
    private mode: 'terminal-data' | 'log-watcher' | 'none' = 'none';
    private logWatcher: fs.FSWatcher | null = null;
    private lastLogSize: number = 0;
    private logPath: string = '';
    private spokenTexts: Set<string> = new Set();
    private ready: boolean = false;
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
            setTimeout(() => {
                this.parser.reset();
                this.ready = true;
                this.debugFile('READY: grace period ended, now listening');
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

    private debugFile(msg: string): void {
        try {
            const p = path.join(os.homedir(), 'frostwig-debug.log');
            fs.appendFileSync(p, `${new Date().toISOString()} ${msg}\n`);
        } catch { /* ignore */ }
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
        // Only process chunks large enough to contain a bubble (top + content + bottom)
        if (data.length < 30) return;

        const stripped = stripAnsi(data);

        // Quick check: does this chunk contain box-drawing border chars?
        const hasTopCorner = /[┌╭┏╔]/.test(stripped);
        const hasBottomCorner = /[└╰┗╚]/.test(stripped);
        const hasVerticalBorder = /[│┃║]/.test(stripped);

        if (!hasTopCorner || !hasBottomCorner || !hasVerticalBorder) return;

        this.debugFile(`RAW HIT: chunk has box chars (len=${data.length})`);

        // Log first 300 chars of stripped text for debugging
        this.debugFile(`STRIPPED: "${stripped.substring(0, 300).replace(/\n/g, '\\n')}"`);

        // Split into lines (row-change cursor moves were converted to newlines)
        const rawLines = stripped.split('\n').map(l => l.trim()).filter(Boolean);

        // Find bubble structure: top border → content lines → bottom border
        // Allow spaces between border chars (cursor positioning inserts spaces)
        const topRe = /[┌╭┏╔]\s*[─━═┄┈][\s─━═┄┈]*[┐╮┓╗]/;
        const bottomRe = /[└╰┗╚]\s*[─━═┄┈][\s─━═┄┈]*[┘╯┛╝]/;
        const contentRe = /[│┃║]\s*(.*?)\s*[│┃║]/;

        let inBubble = false;
        const bubbleLines: string[] = [];

        for (const line of rawLines) {
            if (topRe.test(line)) {
                inBubble = true;
                bubbleLines.length = 0;
                continue;
            }
            if (inBubble && bottomRe.test(line)) {
                inBubble = false;
                continue;
            }
            if (inBubble) {
                const m = line.match(contentRe);
                if (m) {
                    const text = m[1].trim();
                    if (text.length >= 2) bubbleLines.push(text);
                }
            }
        }

        if (bubbleLines.length === 0) return;

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
            this.debugFile(`SKIP EMOTE-ONLY: "${bubbleText.substring(0, 60)}"`);
            return;
        }

        // Skip if too short after cleanup (likely UI fragments)
        if (bubbleText.length < 4) {
            this.debugFile(`SKIP SHORT: "${bubbleText}"`);
            return;
        }

        this.debugFile(`RAW BUBBLE: "${bubbleText}" (${bubbleLines.length} lines)`);

        // Dedup: don't speak the same text twice
        const key = bubbleText.trim();
        if (!key || this.spokenTexts.has(key)) {
            this.debugFile(`DEDUP: already spoken "${key.substring(0, 50)}"`);
            return;
        }

        this.spokenTexts.add(key);
        if (this.spokenTexts.size > 200) {
            const first = this.spokenTexts.values().next().value;
            if (first !== undefined) this.spokenTexts.delete(first);
        }

        this.debugFile(`SPOKE: "${key}" (pattern: raw-bubble)`);
        this.callback({ text: bubbleText, pattern: 'bubble' });
    }

    private tryLogWatcher(): boolean {
        const claudeDir = path.join(os.homedir(), '.claude');
        if (!fs.existsSync(claudeDir)) return false;

        const logCandidates = [
            path.join(claudeDir, 'buddy.log'),
            path.join(claudeDir, 'companion.log'),
        ];

        const logsDir = path.join(claudeDir, 'logs');
        if (fs.existsSync(logsDir)) {
            try {
                const files = fs.readdirSync(logsDir)
                    .filter(f => f.endsWith('.log'))
                    .map(f => ({
                        name: f,
                        mtime: fs.statSync(path.join(logsDir, f)).mtime.getTime()
                    }))
                    .sort((a, b) => b.mtime - a.mtime);
                if (files.length > 0) {
                    logCandidates.push(path.join(logsDir, files[0].name));
                }
            } catch { /* ignore */ }
        }

        for (const candidate of logCandidates) {
            if (fs.existsSync(candidate)) {
                this.logPath = candidate;
                try {
                    const stat = fs.statSync(candidate);
                    this.lastLogSize = stat.size;
                    this.logWatcher = fs.watch(candidate, (eventType) => {
                        if (eventType === 'change') this.readNewLogContent();
                    });
                    return true;
                } catch { continue; }
            }
        }

        try {
            this.logWatcher = fs.watch(claudeDir, (_eventType, filename) => {
                if (filename && (filename.includes('buddy') || filename.includes('companion'))) {
                    const filePath = path.join(claudeDir, filename);
                    if (fs.existsSync(filePath)) {
                        this.logPath = filePath;
                        this.lastLogSize = 0;
                        this.readNewLogContent();
                    }
                }
            });
            return true;
        } catch {
            return false;
        }
    }

    private readNewLogContent(): void {
        if (!this.logPath) return;
        try {
            const stat = fs.statSync(this.logPath);
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
        if (this.logWatcher) {
            this.logWatcher.close();
            this.logWatcher = null;
        }
        this.parser.reset();
        this.spokenTexts.clear();
    }
}
