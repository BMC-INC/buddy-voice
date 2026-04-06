import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BubbleParser, ParsedBubble } from './bubbleParser';

export type BubbleCallback = (bubble: ParsedBubble) => void;

// Strip ANSI escape codes from raw terminal data
function stripAnsi(text: string): string {
    return text.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
               .replace(/\x1b\][^\x07]*\x07/g, '')
               .replace(/\x1b\][^\x1b]*\x1b\\/g, '');
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

                // Process raw data directly for bubble detection.
                // VTermScreen was losing bubble content because subsequent
                // spinner frames clear rows with ESC[2K before the debounced
                // scan could read them. Instead, we scan each raw data chunk
                // immediately for box-drawing bubble patterns.
                this.scanRawData(e.data);
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
        // Need at least a top corner and bottom corner for a complete bubble
        const hasTopCorner = /[┌╭┏╔]/.test(stripped);
        const hasBottomCorner = /[└╰┗╚]/.test(stripped);
        const hasVerticalBorder = /[│┃║]/.test(stripped);

        if (!hasTopCorner || !hasBottomCorner || !hasVerticalBorder) return;

        this.debugFile(`RAW HIT: chunk has box chars (len=${data.length})`);

        // Extract text between vertical border pairs.
        // The bubble renders as: ┌───┐ │text│ │text│ └───┘
        // After stripping ANSI, cursor movements are gone, so border pairs
        // appear in sequence: │ text │ │ more text │
        const lines: string[] = [];
        const borderPattern = /[│┃║]\s*(.+?)\s*[│┃║]/g;
        let match;

        while ((match = borderPattern.exec(stripped)) !== null) {
            const text = match[1].trim();
            // Skip if it looks like a border line (all dashes/box chars)
            if (/^[─━═┄┈\-_\s]+$/.test(text)) continue;
            // Skip very short matches (likely false positives)
            if (text.length < 2) continue;
            // Skip if it contains control chars or looks like file paths
            if (text.startsWith('/') && text.includes('.')) continue;
            lines.push(text);
        }

        if (lines.length === 0) return;

        const bubbleText = lines.join(' ');

        this.debugFile(`RAW BUBBLE: "${bubbleText}" (${lines.length} lines)`);

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
        if (this.logWatcher) {
            this.logWatcher.close();
            this.logWatcher = null;
        }
        this.parser.reset();
        this.spokenTexts.clear();
    }
}
